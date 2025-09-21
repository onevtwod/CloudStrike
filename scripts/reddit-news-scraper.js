#!/usr/bin/env node

/**
 * Reddit & News Scraper - No API Limits!
 * 
 * This script scrapes Reddit and news websites without API limits,
 * perfect for free usage with unlimited scraping.
 * 
 * Usage:
 *   node scripts/reddit-news-scraper.js
 * 
 * Environment Variables:
 *   - API_BASE_URL: Your disaster alert API endpoint (default: http://localhost:3001)
 *   - SCRAPING_INTERVAL: How often to scrape (default: 300000ms = 5 minutes)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('axios-rate-limit');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const SCRAPING_INTERVAL = parseInt(process.env.SCRAPING_INTERVAL) || 300000; // 5 minutes

// Rate-limited HTTP client
const http = rateLimit(axios.create(), { maxRequests: 100, perMilliseconds: 60000 });

// Disaster-related keywords in multiple languages
const DISASTER_KEYWORDS = [
    // English
    'flood', 'flooding', 'storm', 'thunderstorm', 'earthquake', 'fire', 'landslide',
    'emergency', 'disaster', 'evacuation', 'rescue', 'damage', 'injury', 'casualty',
    'hurricane', 'tornado', 'cyclone', 'typhoon', 'blizzard', 'drought', 'wildfire',
    'tsunami', 'volcanic', 'eruption', 'avalanche', 'mudslide', 'sinkhole',

    // Malay/Bahasa Malaysia
    'banjir', 'ribut', 'ribut petir', 'gempa bumi', 'kebakaran', 'tanah runtuh',
    'kecemasan', 'bencana', 'evakuasi', 'penyelamatan', 'kerosakan', 'cedera',
    'tsunami', 'gunung berapi', 'letusan', 'salji runtuh', 'tanah runtuh',

    // Location keywords for Malaysia
    'kuala lumpur', 'kl', 'petaling jaya', 'pj', 'shah alam', 'selangor',
    'penang', 'georgetown', 'johor', 'johor bahru', 'melaka', 'malacca',
    'sabah', 'kota kinabalu', 'sarawak', 'kuching', 'kelantan', 'terengganu',
    'kedah', 'perak', 'perlis', 'pahang', 'negeri sembilan', 'putrajaya',
    'cyberjaya', 'klang', 'subang jaya', 'ampang', 'cheras', 'kepong',
    'setapak', 'wangsa maju', 'titiwangsa', 'sentul', 'brickfields'
];

class RedditNewsScraper {
    constructor() {
        this.isRunning = false;
        this.scrapedCount = 0;
        this.processedCount = 0;
        this.verifiedCount = 0;
        this.lastScrapeTime = null;
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️  Reddit & News scraper is already running');
            return;
        }

        console.log('🔴📰 Starting Reddit & News Scraper (No API Limits!)');
        console.log('=====================================================');
        console.log(`📡 API Base URL: ${API_BASE_URL}`);
        console.log(`⏱️  Scraping Interval: ${SCRAPING_INTERVAL / 1000} seconds`);
        console.log(`🔍 Disaster Keywords: ${DISASTER_KEYWORDS.length} keywords`);
        console.log('🚀 Unlimited scraping - no API rate limits!');
        console.log('');

        this.isRunning = true;

        // Initial scrape
        await this.scrapeAllSources();

        // Set up interval for continuous scraping
        setInterval(async () => {
            if (this.isRunning) {
                await this.scrapeAllSources();
            }
        }, SCRAPING_INTERVAL);

        console.log('✅ Reddit & News scraper started successfully');
        console.log(`📊 Stats: Scraped ${this.scrapedCount}, Processed ${this.processedCount}, Verified ${this.verifiedCount}`);
    }

    async stop() {
        this.isRunning = false;
        console.log('🛑 Reddit & News scraper stopped');
    }

    async scrapeAllSources() {
        const startTime = Date.now();
        this.lastScrapeTime = new Date();

        console.log(`\n🔍 Starting scrape cycle at ${this.lastScrapeTime.toISOString()}`);

        try {
            // Scrape Reddit and News sources in parallel
            const results = await Promise.allSettled([
                this.scrapeReddit(),
                this.scrapeNewsWebsites(),
                this.scrapeMalaysianNews(),
                this.scrapeEmergencyServices()
            ]);

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            const duration = Date.now() - startTime;
            console.log(`✅ Scrape cycle completed in ${duration}ms`);
            console.log(`📊 Sources: ${successful} successful, ${failed} failed`);
            console.log(`📈 Total: ${this.scrapedCount} scraped, ${this.processedCount} processed, ${this.verifiedCount} verified`);

        } catch (error) {
            console.error('❌ Error in scrape cycle:', error.message);
        }
    }

    async scrapeReddit() {
        try {
            console.log('🔴 Scraping Reddit...');

            // Reddit subreddits for Malaysia and disasters (verified to exist)
            const subreddits = [
                'malaysia',
                'malaysians',
                'kualalumpur',
                'penang',
                'sabah',
                'sarawak',
                'emergency',
                'weather',
                'malaysiaflood',  // More specific flood subreddit
                'malaysiaweather' // More specific weather subreddit
            ];

            const posts = [];

            for (const subreddit of subreddits) {
                try {
                    // Get recent posts from subreddit
                    const response = await http.get(`https://www.reddit.com/r/${subreddit}/new.json?limit=25`, {
                        headers: {
                            'User-Agent': 'DisasterAlertBot/1.0'
                        },
                        timeout: 10000
                    });

                    if (response.data && response.data.data && response.data.data.children) {
                        const subredditPosts = response.data.data.children
                            .map(post => ({
                                id: `reddit_${post.data.id}`,
                                text: `${post.data.title} ${post.data.selftext || ''}`,
                                author: `u/${post.data.author}`,
                                source: 'reddit',
                                timestamp: new Date(post.data.created_utc * 1000).toISOString(),
                                url: `https://reddit.com${post.data.permalink}`,
                                subreddit: subreddit,
                                upvotes: post.data.ups || 0,
                                comments: post.data.num_comments || 0
                            }))
                            .filter(post => this.containsDisasterKeywords(post.text));

                        posts.push(...subredditPosts);
                        console.log(`   📝 Found ${subredditPosts.length} disaster-related posts in r/${subreddit}`);
                    }

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    if (error.response?.status === 404) {
                        console.log(`   ⚠️  Subreddit r/${subreddit} not found or private - skipping`);
                    } else {
                        console.error(`   ❌ Error scraping r/${subreddit}:`, error.message);
                    }
                }
            }

            await this.processPosts(posts);
            console.log(`✅ Reddit scraping completed: ${posts.length} posts found`);
            
            return posts; // Return the posts array

        } catch (error) {
            console.error('❌ Reddit scraping failed:', error.message);
            return []; // Return empty array on error
        }
    }

    async scrapeNewsWebsites() {
        try {
            console.log('📰 Scraping international news websites...');

            const newsSites = [
                'https://www.bbc.com/news',
                'https://www.reuters.com',
                'https://www.cnn.com',
                'https://www.aljazeera.com'
            ];

            const posts = [];

            for (const site of newsSites) {
                try {
                    const response = await http.get(site, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 15000
                    });

                    const $ = cheerio.load(response.data);

                    // Extract headlines and links
                    $('h1, h2, h3, .headline, .title, [data-testid="headline"]').each((i, element) => {
                        const text = $(element).text().trim();
                        const link = $(element).find('a').attr('href') || $(element).parent('a').attr('href');

                        if (text && this.containsDisasterKeywords(text)) {
                            posts.push({
                                id: `news_${Date.now()}_${i}`,
                                text: text,
                                author: site.replace('https://www.', '').replace('.com', ''),
                                source: 'news',
                                timestamp: new Date().toISOString(),
                                url: link ? (link.startsWith('http') ? link : `${site}${link}`) : site
                            });
                        }
                    });

                    console.log(`   📰 Scraped ${site}: ${posts.length} disaster-related headlines`);

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (error) {
                    console.error(`   ❌ Error scraping ${site}:`, error.message);
                }
            }

            await this.processPosts(posts);
            console.log(`✅ News scraping completed: ${posts.length} posts found`);

        } catch (error) {
            console.error('❌ News scraping failed:', error.message);
        }
    }

    async scrapeMalaysianNews() {
        try {
            console.log('🇲🇾 Scraping Malaysian news websites...');

            const malaysianNews = [
                'https://www.thestar.com.my',
                'https://www.nst.com.my',
                'https://www.malaymail.com',
                'https://www.freemalaysiatoday.com',
                'https://www.bernama.com'
            ];

            const posts = [];

            for (const site of malaysianNews) {
                try {
                    const response = await http.get(site, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 15000
                    });

                    const $ = cheerio.load(response.data);

                    // Extract headlines
                    $('h1, h2, h3, .headline, .title, .story-title, .news-title').each((i, element) => {
                        const text = $(element).text().trim();
                        const link = $(element).find('a').attr('href') || $(element).parent('a').attr('href');

                        if (text && this.containsDisasterKeywords(text)) {
                            posts.push({
                                id: `malaysia_news_${Date.now()}_${i}`,
                                text: text,
                                author: site.replace('https://www.', '').replace('.com.my', '').replace('.com', ''),
                                source: 'malaysia_news',
                                timestamp: new Date().toISOString(),
                                url: link ? (link.startsWith('http') ? link : `${site}${link}`) : site
                            });
                        }
                    });

                    console.log(`   🇲🇾 Scraped ${site}: ${posts.length} disaster-related headlines`);

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (error) {
                    console.error(`   ❌ Error scraping ${site}:`, error.message);
                }
            }

            await this.processPosts(posts);
            console.log(`✅ Malaysian news scraping completed: ${posts.length} posts found`);

        } catch (error) {
            console.error('❌ Malaysian news scraping failed:', error.message);
        }
    }

    async scrapeEmergencyServices() {
        try {
            console.log('🚨 Scraping emergency services websites...');

            // Emergency services and government websites
            const emergencySites = [
                'https://www.met.gov.my',
                'https://www.bomba.gov.my',
                'https://www.polis.gov.my'
            ];

            const posts = [];

            for (const site of emergencySites) {
                try {
                    const response = await http.get(site, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 15000
                    });

                    const $ = cheerio.load(response.data);

                    // Extract announcements and alerts
                    $('h1, h2, h3, .alert, .announcement, .warning').each((i, element) => {
                        const text = $(element).text().trim();

                        if (text && this.containsDisasterKeywords(text)) {
                            posts.push({
                                id: `emergency_${Date.now()}_${i}`,
                                text: text,
                                author: site.replace('https://www.', '').replace('.gov.my', ''),
                                source: 'emergency_services',
                                timestamp: new Date().toISOString(),
                                url: site
                            });
                        }
                    });

                    console.log(`   🚨 Scraped ${site}: ${posts.length} emergency alerts`);

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 3000));

                } catch (error) {
                    console.error(`   ❌ Error scraping ${site}:`, error.message);
                }
            }

            await this.processPosts(posts);
            console.log(`✅ Emergency services scraping completed: ${posts.length} alerts found`);

        } catch (error) {
            console.error('❌ Emergency services scraping failed:', error.message);
        }
    }

    containsDisasterKeywords(text) {
        const lowerText = text.toLowerCase();
        return DISASTER_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
    }

    async processPosts(posts) {
        for (const post of posts) {
            try {
                this.scrapedCount++;

                console.log(`\n📨 Processing post: ${post.text.substring(0, 100)}...`);
                console.log(`   👤 Author: ${post.author}`);
                console.log(`   📱 Source: ${post.source}`);

                const response = await http.post(`${API_BASE_URL}/ingest/twitter`, {
                    text: post.text,
                    source: post.source,
                    author: post.author,
                    timestamp: post.timestamp,
                    url: post.url,
                    metadata: {
                        scrapedAt: new Date().toISOString(),
                        originalId: post.id,
                        subreddit: post.subreddit,
                        upvotes: post.upvotes,
                        comments: post.comments
                    }
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });

                this.processedCount++;

                if (response.data.verified) {
                    this.verifiedCount++;
                    console.log(`   ✅ VERIFIED DISASTER EVENT!`);
                    console.log(`   🆔 Event ID: ${response.data.id}`);
                    console.log(`   📊 Severity: ${response.data.severity}`);
                    console.log(`   📍 Location: ${response.data.location || 'Not detected'}`);
                    console.log(`   🚨 ALERT SENT TO EMERGENCY SERVICES!`);
                } else {
                    console.log(`   ⏸️  Event processed but not verified (severity: ${response.data.severity})`);
                }

                // Rate limiting between API calls
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`   ❌ Error processing post:`, error.response?.data?.message || error.message);
            }
        }
    }

    getStats() {
        return {
            isRunning: this.isRunning,
            scrapedCount: this.scrapedCount,
            processedCount: this.processedCount,
            verifiedCount: this.verifiedCount,
            lastScrapeTime: this.lastScrapeTime,
            uptime: this.lastScrapeTime ? Date.now() - this.lastScrapeTime.getTime() : 0
        };
    }
}

// Create scraper instance
const redditNewsScraper = new RedditNewsScraper();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await redditNewsScraper.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await redditNewsScraper.stop();
    process.exit(0);
});

// Start the scraper if this script is run directly
if (require.main === module) {
    redditNewsScraper.start().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { RedditNewsScraper, redditNewsScraper };
