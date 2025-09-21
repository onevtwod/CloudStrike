#!/usr/bin/env node

/**
 * Real Twitter Scraper using Twitter API v2
 * 
 * This script uses the official Twitter API to scrape real tweets
 * and feed them into the disaster alert system.
 * 
 * Setup:
 * 1. Get Twitter API credentials from https://developer.twitter.com/
 * 2. Set environment variables
 * 3. Run the scraper
 * 
 * Usage:
 *   node scripts/twitter-scraper.js
 * 
 * Environment Variables:
 *   - TWITTER_BEARER_TOKEN: Twitter API v2 Bearer Token
 *   - API_BASE_URL: Your disaster alert API endpoint
 *   - SCRAPING_INTERVAL: How often to scrape (default: 300000ms = 5 minutes)
 */

const axios = require('axios');
const rateLimit = require('axios-rate-limit');

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const SCRAPING_INTERVAL = parseInt(process.env.SCRAPING_INTERVAL) || 300000; // 5 minutes

// Rate-limited HTTP client for Twitter API
const twitterApi = rateLimit(axios.create({
    baseURL: 'https://api.twitter.com/2',
    headers: {
        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
        'User-Agent': 'DisasterAlertBot/1.0'
    }
}), { maxRequests: 300, perMilliseconds: 900000 }); // 300 requests per 15 minutes

// HTTP client for disaster alert API
const disasterApi = rateLimit(axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
}), { maxRequests: 100, perMilliseconds: 60000 }); // 100 requests per minute

class TwitterScraper {
    constructor() {
        this.isRunning = false;
        this.processedCount = 0;
        this.verifiedCount = 0;
        this.lastTweetId = null;
        this.lastScrapeTime = null;
    }

    async start() {
        if (!TWITTER_BEARER_TOKEN) {
            console.error('❌ TWITTER_BEARER_TOKEN environment variable is required');
            console.log('📝 Get your Bearer Token from: https://developer.twitter.com/en/portal/dashboard');
            process.exit(1);
        }

        if (this.isRunning) {
            console.log('⚠️  Twitter scraper is already running');
            return;
        }

        console.log('🐦 Starting Twitter Scraper');
        console.log('============================');
        console.log(`📡 API Base URL: ${API_BASE_URL}`);
        console.log(`⏱️  Scraping Interval: ${SCRAPING_INTERVAL / 1000} seconds`);
        console.log('');

        this.isRunning = true;

        // Initial scrape
        await this.scrapeTweets();

        // Set up interval for continuous scraping
        setInterval(async () => {
            if (this.isRunning) {
                await this.scrapeTweets();
            }
        }, SCRAPING_INTERVAL);

        console.log('✅ Twitter scraper started successfully');
        console.log(`📊 Stats: Processed ${this.processedCount}, Verified ${this.verifiedCount}`);
    }

    async stop() {
        this.isRunning = false;
        console.log('🛑 Twitter scraper stopped');
    }

    async scrapeTweets() {
        const startTime = Date.now();
        this.lastScrapeTime = new Date();

        console.log(`\n🔍 Starting Twitter scrape at ${this.lastScrapeTime.toISOString()}`);

        try {
            // Search for tweets with disaster-related keywords
            const tweets = await this.searchDisasterTweets();

            if (tweets.length > 0) {
                console.log(`📝 Found ${tweets.length} potential disaster tweets`);
                await this.processTweets(tweets);
            } else {
                console.log('📝 No new disaster-related tweets found');
            }

            const duration = Date.now() - startTime;
            console.log(`✅ Twitter scrape completed in ${duration}ms`);
            console.log(`📈 Total: ${this.processedCount} processed, ${this.verifiedCount} verified`);

        } catch (error) {
            console.error('❌ Error in Twitter scrape:', error.response?.data || error.message);
        }
    }

    async searchDisasterTweets() {
        try {
            // Disaster-related search queries for Malaysia
            const queries = [
                'flood OR banjir (Malaysia OR KL OR Kuala Lumpur)',
                'storm OR ribut (Malaysia OR Selangor OR Penang)',
                'earthquake OR gempa (Malaysia OR Sabah OR Sarawak)',
                'fire OR kebakaran (Malaysia OR emergency OR kecemasan)',
                'landslide OR tanah runtuh Malaysia',
                'emergency OR kecemasan OR bencana Malaysia'
            ];

            const allTweets = [];

            for (const query of queries) {
                try {
                    console.log(`🔍 Searching: "${query}"`);

                    const response = await twitterApi.get('/tweets/search/recent', {
                        params: {
                            query: query,
                            max_results: 10,
                            'tweet.fields': 'created_at,author_id,public_metrics,geo,context_annotations',
                            'user.fields': 'username,name,location',
                            expansions: 'author_id,geo.place_id',
                            'place.fields': 'full_name,country,geo',
                            since_id: this.lastTweetId
                        }
                    });

                    if (response.data && response.data.data) {
                        const tweets = response.data.data.map(tweet => {
                            const author = response.data.includes?.users?.find(u => u.id === tweet.author_id);
                            const place = response.data.includes?.places?.find(p => p.id === tweet.geo?.place_id);

                            return {
                                id: tweet.id,
                                text: tweet.text,
                                author: author ? `@${author.username}` : 'Unknown',
                                authorName: author?.name || 'Unknown',
                                timestamp: tweet.created_at,
                                metrics: tweet.public_metrics,
                                location: place ? {
                                    name: place.full_name,
                                    country: place.country,
                                    geo: place.geo
                                } : null,
                                source: 'twitter',
                                url: `https://twitter.com/${author?.username || 'unknown'}/status/${tweet.id}`
                            };
                        });

                        allTweets.push(...tweets);
                        console.log(`   📝 Found ${tweets.length} tweets`);
                    }

                    // Rate limiting between searches
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    console.error(`   ❌ Error searching "${query}":`, error.response?.data || error.message);
                }
            }

            // Remove duplicates and filter by relevance
            const uniqueTweets = this.removeDuplicateTweets(allTweets);
            const relevantTweets = this.filterRelevantTweets(uniqueTweets);

            // Update last tweet ID for next search
            if (relevantTweets.length > 0) {
                this.lastTweetId = relevantTweets[0].id;
            }

            return relevantTweets;

        } catch (error) {
            console.error('❌ Error searching tweets:', error.response?.data || error.message);
            return [];
        }
    }

    removeDuplicateTweets(tweets) {
        const seen = new Set();
        return tweets.filter(tweet => {
            if (seen.has(tweet.id)) {
                return false;
            }
            seen.add(tweet.id);
            return true;
        });
    }

    filterRelevantTweets(tweets) {
        return tweets.filter(tweet => {
            const text = tweet.text.toLowerCase();

            // Check for disaster keywords
            const disasterKeywords = [
                'flood', 'banjir', 'storm', 'ribut', 'earthquake', 'gempa',
                'fire', 'kebakaran', 'emergency', 'kecemasan', 'disaster', 'bencana',
                'evacuation', 'evakuasi', 'rescue', 'penyelamatan', 'damage', 'kerosakan',
                'landslide', 'tanah runtuh', 'injury', 'cedera', 'casualty', 'kematian'
            ];

            const hasDisasterKeyword = disasterKeywords.some(keyword =>
                text.includes(keyword.toLowerCase())
            );

            // Check for location keywords
            const locationKeywords = [
                'malaysia', 'kuala lumpur', 'kl', 'selangor', 'penang', 'johor',
                'sabah', 'sarawak', 'melaka', 'kedah', 'perak', 'kelantan',
                'terengganu', 'pahang', 'negeri sembilan', 'perlis', 'putrajaya'
            ];

            const hasLocationKeyword = locationKeywords.some(keyword =>
                text.includes(keyword.toLowerCase())
            );

            // Check for recent activity (high engagement)
            const hasHighEngagement = tweet.metrics &&
                (tweet.metrics.retweet_count > 5 || tweet.metrics.like_count > 10);

            return hasDisasterKeyword && (hasLocationKeyword || hasHighEngagement);
        });
    }

    async processTweets(tweets) {
        for (const tweet of tweets) {
            try {
                console.log(`\n📨 Processing tweet: ${tweet.text.substring(0, 100)}...`);
                console.log(`   👤 Author: ${tweet.author} (${tweet.authorName})`);
                console.log(`   📍 Location: ${tweet.location?.name || 'Not specified'}`);
                console.log(`   📊 Engagement: ${tweet.metrics?.retweet_count || 0} RTs, ${tweet.metrics?.like_count || 0} likes`);

                // Extract coordinates if available
                let coordinates = null;
                if (tweet.location?.geo) {
                    // Convert Twitter's geo format to lat/lng
                    const bbox = tweet.location.geo.bbox;
                    if (bbox && bbox.length === 4) {
                        const [minLng, minLat, maxLng, maxLat] = bbox;
                        coordinates = {
                            lat: (minLat + maxLat) / 2,
                            lng: (minLng + maxLng) / 2
                        };
                    }
                }

                const response = await disasterApi.post('/ingest/twitter', {
                    text: tweet.text,
                    source: 'twitter',
                    author: tweet.author,
                    timestamp: tweet.timestamp,
                    location: coordinates,
                    metadata: {
                        tweetId: tweet.id,
                        authorName: tweet.authorName,
                        engagement: tweet.metrics,
                        location: tweet.location,
                        url: tweet.url,
                        scrapedAt: new Date().toISOString()
                    }
                });

                this.processedCount++;

                if (response.data.verified) {
                    this.verifiedCount++;
                    console.log(`   ✅ VERIFIED DISASTER EVENT!`);
                    console.log(`   🆔 Event ID: ${response.data.id}`);
                    console.log(`   📊 Severity: ${response.data.severity}`);
                    console.log(`   📍 Detected Location: ${response.data.location || 'Not detected'}`);
                    console.log(`   🚨 ALERT SENT TO EMERGENCY SERVICES!`);
                    console.log(`   🔗 Tweet URL: ${tweet.url}`);
                } else {
                    console.log(`   ⏸️  Event processed but not verified (severity: ${response.data.severity})`);
                }

                // Rate limiting between API calls
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`   ❌ Error processing tweet:`, error.response?.data?.message || error.message);
            }
        }
    }

    getStats() {
        return {
            isRunning: this.isRunning,
            processedCount: this.processedCount,
            verifiedCount: this.verifiedCount,
            lastTweetId: this.lastTweetId,
            lastScrapeTime: this.lastScrapeTime,
            uptime: this.lastScrapeTime ? Date.now() - this.lastScrapeTime.getTime() : 0
        };
    }
}

// Create scraper instance
const twitterScraper = new TwitterScraper();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await twitterScraper.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await twitterScraper.stop();
    process.exit(0);
});

// Start the scraper if this script is run directly
if (require.main === module) {
    twitterScraper.start().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { TwitterScraper, twitterScraper };
