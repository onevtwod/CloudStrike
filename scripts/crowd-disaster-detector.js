#!/usr/bin/env node

/**
 * Crowd-Sourced Disaster Detection System
 * 
 * This system monitors normal users' posts to detect sudden spikes
 * in disaster-related content, providing early warning before
 * official authorities can respond.
 * 
 * Key Features:
 * - Monitors regular users (not official accounts)
 * - Detects sudden spikes in disaster posts
 * - Location-based clustering
 * - Real-time trend analysis
 * - Early warning alerts
 * 
 * Usage:
 *   node scripts/crowd-disaster-detector.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('axios-rate-limit');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const SCRAPING_INTERVAL = parseInt(process.env.SCRAPING_INTERVAL) || 60000; // 1 minute for faster detection
const SPIKE_THRESHOLD = parseInt(process.env.SPIKE_THRESHOLD) || 5; // Posts per location per minute
const TREND_WINDOW = parseInt(process.env.TREND_WINDOW) || 10; // Minutes to analyze trends

// Rate-limited HTTP client
const http = rateLimit(axios.create(), { maxRequests: 200, perMilliseconds: 60000 });

// Disaster keywords with severity levels
const DISASTER_KEYWORDS = {
    // High severity - immediate attention needed
    high: [
        'earthquake', 'gempa bumi', 'tsunami', 'fire', 'kebakaran',
        'explosion', 'letupan', 'building collapse', 'bangunan runtuh',
        'flood emergency', 'banjir kecemasan', 'landslide emergency'
    ],
    // Medium severity - monitor closely
    medium: [
        'flood', 'banjir', 'storm', 'ribut', 'heavy rain', 'hujan lebat',
        'power outage', 'tiada elektrik', 'road closed', 'jalan tutup',
        'evacuation', 'evakuasi', 'rescue', 'penyelamatan'
    ],
    // Low severity - track for patterns
    low: [
        'heavy traffic', 'traffic jam', 'kesesakan lalu lintas',
        'weather warning', 'amaran cuaca', 'storm coming', 'ribut datang'
    ]
};

// Malaysian locations for clustering
const MALAYSIA_LOCATIONS = {
    'kuala lumpur': ['kl', 'kuala lumpur', 'petaling jaya', 'pj', 'shah alam'],
    'selangor': ['selangor', 'klang', 'subang jaya', 'ampang', 'cheras'],
    'penang': ['penang', 'georgetown', 'butterworth'],
    'johor': ['johor', 'johor bahru', 'jb'],
    'sabah': ['sabah', 'kota kinabalu', 'kk', 'sandakan', 'tawau'],
    'sarawak': ['sarawak', 'kuching', 'sibu', 'miri'],
    'melaka': ['melaka', 'malacca'],
    'kedah': ['kedah', 'alor setar'],
    'perak': ['perak', 'ipoh'],
    'kelantan': ['kelantan', 'kota bharu'],
    'terengganu': ['terengganu', 'kuala terengganu'],
    'pahang': ['pahang', 'kuantan'],
    'negeri sembilan': ['negeri sembilan', 'seremban'],
    'perlis': ['perlis', 'kangar'],
    'putrajaya': ['putrajaya', 'cyberjaya']
};

class CrowdDisasterDetector {
    constructor() {
        this.isRunning = false;
        this.postHistory = new Map(); // location -> array of timestamps
        this.userPosts = new Map(); // location -> array of user posts
        this.spikeAlerts = new Map(); // location -> last alert time
        this.scrapedCount = 0;
        this.processedCount = 0;
        this.detectedSpikes = 0;
        this.lastScrapeTime = null;

        // Trend analysis data
        this.trendData = new Map(); // location -> { posts: [], timestamps: [] }
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️  Crowd disaster detector is already running');
            return;
        }

        console.log('👥 Starting Crowd-Sourced Disaster Detection System');
        console.log('==================================================');
        console.log(`📡 API Base URL: ${API_BASE_URL}`);
        console.log(`⏱️  Scraping Interval: ${SCRAPING_INTERVAL / 1000} seconds`);
        console.log(`📈 Spike Threshold: ${SPIKE_THRESHOLD} posts per location per minute`);
        console.log(`📊 Trend Window: ${TREND_WINDOW} minutes`);
        console.log(`🎯 Focus: Normal users' posts for early detection`);
        console.log('');

        this.isRunning = true;

        // Initial scrape
        await this.scrapeUserPosts();

        // Set up interval for continuous monitoring
        setInterval(async () => {
            if (this.isRunning) {
                await this.scrapeUserPosts();
                await this.analyzeTrends();
                await this.detectSpikes();
            }
        }, SCRAPING_INTERVAL);

        console.log('✅ Crowd disaster detector started successfully');
        console.log(`📊 Stats: Scraped ${this.scrapedCount}, Processed ${this.processedCount}, Detected ${this.detectedSpikes} spikes`);
    }

    async stop() {
        this.isRunning = false;
        console.log('🛑 Crowd disaster detector stopped');
    }

    async scrapeUserPosts() {
        const startTime = Date.now();
        this.lastScrapeTime = new Date();

        console.log(`\n🔍 Monitoring user posts at ${this.lastScrapeTime.toISOString()}`);

        try {
            // Scrape from multiple sources focused on regular users
            const results = await Promise.allSettled([
                this.scrapeRedditUsers(),
                this.scrapeTwitterUsers(),
                this.scrapeInstagramUsers(),
                this.scrapeFacebookUsers()
            ]);

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            const duration = Date.now() - startTime;
            console.log(`✅ User post monitoring completed in ${duration}ms`);
            console.log(`📊 Sources: ${successful} successful, ${failed} failed`);

        } catch (error) {
            console.error('❌ Error in user post monitoring:', error.message);
        }
    }

    async scrapeRedditUsers() {
        try {
            console.log('🔴 Monitoring Reddit users...');

            // Focus on Malaysia-related subreddits where regular users post
            const subreddits = [
                'malaysia',
                'malaysians',
                'kl',
                'kualalumpur',
                'penang',
                'sabah',
                'sarawak'
            ];

            for (const subreddit of subreddits) {
                try {
                    const response = await http.get(`https://www.reddit.com/r/${subreddit}/new.json?limit=50`, {
                        headers: {
                            'User-Agent': 'DisasterAlertBot/1.0'
                        },
                        timeout: 10000
                    });

                    if (response.data && response.data.data && response.data.data.children) {
                        const userPosts = response.data.data.children
                            .filter(post => {
                                // Filter out official/bot accounts, focus on regular users
                                const author = post.data.author;
                                return author &&
                                    !author.includes('bot') &&
                                    !author.includes('official') &&
                                    !author.includes('news') &&
                                    !author.includes('admin') &&
                                    post.data.ups > 0; // Has some engagement
                            })
                            .map(post => ({
                                id: `reddit_${post.data.id}`,
                                text: `${post.data.title} ${post.data.selftext || ''}`,
                                author: `u/${post.data.author}`,
                                source: 'reddit_user',
                                timestamp: new Date(post.data.created_utc * 1000).toISOString(),
                                location: this.extractLocation(`${post.data.title} ${post.data.selftext || ''}`),
                                subreddit: subreddit,
                                upvotes: post.data.ups || 0,
                                isDisasterRelated: this.isDisasterRelated(`${post.data.title} ${post.data.selftext || ''}`),
                                severity: this.getDisasterSeverity(`${post.data.title} ${post.data.selftext || ''}`)
                            }))
                            .filter(post => post.isDisasterRelated);

                        await this.processUserPosts(userPosts);
                        console.log(`   📝 Found ${userPosts.length} disaster-related user posts in r/${subreddit}`);
                    }

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    console.error(`   ❌ Error monitoring r/${subreddit}:`, error.message);
                }
            }

        } catch (error) {
            console.error('❌ Reddit user monitoring failed:', error.message);
        }
    }

    async scrapeTwitterUsers() {
        try {
            console.log('🐦 Monitoring Twitter users...');

            // Focus on regular users, not official accounts
            const searchTerms = [
                'malaysia earthquake',
                'malaysia flood',
                'malaysia storm',
                'banjir malaysia',
                'gempa malaysia',
                'ribut malaysia'
            ];

            for (const term of searchTerms) {
                try {
                    // Simulate Twitter API call (would need actual API for real implementation)
                    const mockUserPosts = [
                        {
                            id: `twitter_user_${Date.now()}_${term.replace(/\s+/g, '_')}`,
                            text: `Just felt an earthquake in KL! Anyone else felt it? #earthquake #malaysia`,
                            author: '@regular_user_123',
                            source: 'twitter_user',
                            timestamp: new Date().toISOString(),
                            location: this.extractLocation(`Just felt an earthquake in KL!`),
                            isDisasterRelated: true,
                            severity: 'high'
                        }
                    ];

                    await this.processUserPosts(mockUserPosts);
                    console.log(`   📝 Found ${mockUserPosts.length} user posts for "${term}"`);

                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    console.error(`   ❌ Error searching "${term}":`, error.message);
                }
            }

        } catch (error) {
            console.error('❌ Twitter user monitoring failed:', error.message);
        }
    }

    async scrapeInstagramUsers() {
        try {
            console.log('📷 Monitoring Instagram users...');

            const hashtags = [
                'malaysiaflood',
                'malaysiaearthquake',
                'malaysiastorm',
                'banjirmalaysia',
                'gempa malaysia'
            ];

            for (const hashtag of hashtags) {
                try {
                    // Simulate Instagram scraping (would need actual API)
                    const mockUserPosts = [
                        {
                            id: `instagram_user_${Date.now()}_${hashtag}`,
                            text: `Heavy flooding in my area! Stay safe everyone #${hashtag}`,
                            author: '@local_user_456',
                            source: 'instagram_user',
                            timestamp: new Date().toISOString(),
                            location: this.extractLocation(`Heavy flooding in my area!`),
                            hashtag: hashtag,
                            isDisasterRelated: true,
                            severity: 'medium'
                        }
                    ];

                    await this.processUserPosts(mockUserPosts);
                    console.log(`   📝 Found ${mockUserPosts.length} user posts for #${hashtag}`);

                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    console.error(`   ❌ Error monitoring #${hashtag}:`, error.message);
                }
            }

        } catch (error) {
            console.error('❌ Instagram user monitoring failed:', error.message);
        }
    }

    async scrapeFacebookUsers() {
        try {
            console.log('📘 Monitoring Facebook users...');

            // Focus on local community groups and personal posts
            const communityGroups = [
                'malaysia emergency community',
                'kl residents group',
                'penang community',
                'sabah residents'
            ];

            for (const group of communityGroups) {
                try {
                    // Simulate Facebook community group scraping
                    const mockUserPosts = [
                        {
                            id: `facebook_user_${Date.now()}_${group.replace(/\s+/g, '_')}`,
                            text: `Just experienced a strong earthquake in Penang! My house shook for 30 seconds. Anyone else felt it?`,
                            author: 'Community Member',
                            source: 'facebook_user',
                            timestamp: new Date().toISOString(),
                            location: this.extractLocation(`Just experienced a strong earthquake in Penang!`),
                            group: group,
                            isDisasterRelated: true,
                            severity: 'high'
                        }
                    ];

                    await this.processUserPosts(mockUserPosts);
                    console.log(`   📝 Found ${mockUserPosts.length} user posts in ${group}`);

                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (error) {
                    console.error(`   ❌ Error monitoring ${group}:`, error.message);
                }
            }

        } catch (error) {
            console.error('❌ Facebook user monitoring failed:', error.message);
        }
    }

    async processUserPosts(posts) {
        for (const post of posts) {
            try {
                this.scrapedCount++;

                console.log(`\n👤 User Post: ${post.text.substring(0, 80)}...`);
                console.log(`   👤 Author: ${post.author}`);
                console.log(`   📍 Location: ${post.location || 'Not detected'}`);
                console.log(`   ⚠️  Severity: ${post.severity}`);

                // Store in location-based history
                if (post.location) {
                    if (!this.userPosts.has(post.location)) {
                        this.userPosts.set(post.location, []);
                        this.postHistory.set(post.location, []);
                        this.trendData.set(post.location, { posts: [], timestamps: [] });
                    }

                    const locationPosts = this.userPosts.get(post.location);
                    const locationHistory = this.postHistory.get(post.location);
                    const locationTrend = this.trendData.get(post.location);

                    locationPosts.push({
                        ...post,
                        processedAt: new Date()
                    });

                    locationHistory.push(new Date());
                    locationTrend.posts.push(post);
                    locationTrend.timestamps.push(new Date());

                    // Keep only recent data (last 30 minutes)
                    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000);
                    this.userPosts.set(post.location, locationPosts.filter(p => p.processedAt > cutoffTime));
                    this.postHistory.set(post.location, locationHistory.filter(t => t > cutoffTime));
                    this.trendData.set(post.location, {
                        posts: locationTrend.posts.filter(p => p.processedAt > cutoffTime),
                        timestamps: locationTrend.timestamps.filter(t => t > cutoffTime)
                    });
                }

                this.processedCount++;

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`   ❌ Error processing user post:`, error.message);
            }
        }
    }

    async analyzeTrends() {
        console.log('\n📊 Analyzing post trends...');

        for (const [location, trendData] of this.trendData) {
            const posts = trendData.posts;
            const timestamps = trendData.timestamps;

            if (posts.length < 3) continue; // Need minimum data points

            // Calculate recent activity (last 5 minutes)
            const recentCutoff = new Date(Date.now() - 5 * 60 * 1000);
            const recentPosts = posts.filter(p => p.processedAt > recentCutoff);

            // Calculate trend metrics
            const highSeverityPosts = recentPosts.filter(p => p.severity === 'high').length;
            const totalRecentPosts = recentPosts.length;
            const avgPostsPerMinute = totalRecentPosts / 5;

            console.log(`   📍 ${location}: ${totalRecentPosts} posts in last 5min (${avgPostsPerMinute.toFixed(1)}/min)`);
            console.log(`      ⚠️  High severity: ${highSeverityPosts} posts`);

            // Update trend data
            this.trendData.set(location, {
                ...trendData,
                recentActivity: {
                    postsInLast5Min: totalRecentPosts,
                    highSeverityPosts: highSeverityPosts,
                    avgPostsPerMinute: avgPostsPerMinute,
                    lastUpdated: new Date()
                }
            });
        }
    }

    async detectSpikes() {
        console.log('\n🚨 Detecting disaster spikes...');

        for (const [location, trendData] of this.trendData) {
            if (!trendData.recentActivity) continue;

            const activity = trendData.recentActivity;
            const avgPostsPerMinute = activity.avgPostsPerMinute;
            const highSeverityPosts = activity.highSeverityPosts;

            // Check for spike conditions
            const isSpike = avgPostsPerMinute >= SPIKE_THRESHOLD;
            const hasHighSeverity = highSeverityPosts >= 2;
            const lastAlertTime = this.spikeAlerts.get(location);
            const timeSinceLastAlert = lastAlertTime ? Date.now() - lastAlertTime.getTime() : Infinity;

            if ((isSpike || hasHighSeverity) && timeSinceLastAlert > 10 * 60 * 1000) { // 10 minutes cooldown
                await this.triggerSpikeAlert(location, activity, trendData.posts);
                this.spikeAlerts.set(location, new Date());
                this.detectedSpikes++;
            }
        }
    }

    async triggerSpikeAlert(location, activity, posts) {
        try {
            console.log(`\n🚨 DISASTER SPIKE DETECTED!`);
            console.log(`📍 Location: ${location}`);
            console.log(`📊 Posts in last 5min: ${activity.postsInLast5Min}`);
            console.log(`⚠️  High severity posts: ${activity.highSeverityPosts}`);
            console.log(`📈 Average posts/min: ${activity.avgPostsPerMinute.toFixed(1)}`);

            // Get recent posts for context
            const recentPosts = posts.slice(-5).map(p => p.text.substring(0, 100));

            console.log(`📝 Recent posts:`);
            recentPosts.forEach((post, i) => {
                console.log(`   ${i + 1}. ${post}...`);
            });

            // Send alert to disaster system
            const alertData = {
                type: 'crowd_spike_detection',
                location: location,
                severity: activity.highSeverityPosts >= 2 ? 'high' : 'medium',
                metrics: {
                    postsInLast5Min: activity.postsInLast5Min,
                    highSeverityPosts: activity.highSeverityPosts,
                    avgPostsPerMinute: activity.avgPostsPerMinute,
                    spikeThreshold: SPIKE_THRESHOLD
                },
                recentPosts: recentPosts,
                detectedAt: new Date().toISOString(),
                source: 'crowd_detection'
            };

            const response = await http.post(`${API_BASE_URL}/ingest/twitter`, {
                text: `CROWD ALERT: ${activity.postsInLast5Min} disaster-related posts detected in ${location} in the last 5 minutes. Average: ${activity.avgPostsPerMinute.toFixed(1)} posts/min. High severity posts: ${activity.highSeverityPosts}`,
                source: 'crowd_detection',
                author: 'Crowd Disaster Detector',
                timestamp: new Date().toISOString(),
                location: location,
                metadata: {
                    alertType: 'spike_detection',
                    alertData: alertData,
                    detectedAt: new Date().toISOString()
                }
            });

            if (response.data.verified) {
                console.log(`   ✅ SPIKE ALERT SENT TO EMERGENCY SERVICES!`);
                console.log(`   🆔 Alert ID: ${response.data.id}`);
                console.log(`   📊 Severity: ${response.data.severity}`);
            } else {
                console.log(`   ⏸️  Spike alert processed but not verified`);
            }

        } catch (error) {
            console.error(`   ❌ Error sending spike alert:`, error.message);
        }
    }

    extractLocation(text) {
        const lowerText = text.toLowerCase();

        for (const [region, locations] of Object.entries(MALAYSIA_LOCATIONS)) {
            for (const location of locations) {
                if (lowerText.includes(location.toLowerCase())) {
                    return region;
                }
            }
        }

        return null;
    }

    isDisasterRelated(text) {
        const lowerText = text.toLowerCase();

        // Check all disaster keywords
        const allKeywords = [
            ...DISASTER_KEYWORDS.high,
            ...DISASTER_KEYWORDS.medium,
            ...DISASTER_KEYWORDS.low
        ];

        return allKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    }

    getDisasterSeverity(text) {
        const lowerText = text.toLowerCase();

        if (DISASTER_KEYWORDS.high.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
            return 'high';
        } else if (DISASTER_KEYWORDS.medium.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
            return 'medium';
        } else if (DISASTER_KEYWORDS.low.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
            return 'low';
        }

        return 'low';
    }

    getStats() {
        return {
            isRunning: this.isRunning,
            scrapedCount: this.scrapedCount,
            processedCount: this.processedCount,
            detectedSpikes: this.detectedSpikes,
            locationsBeingMonitored: this.trendData.size,
            lastScrapeTime: this.lastScrapeTime,
            uptime: this.lastScrapeTime ? Date.now() - this.lastScrapeTime.getTime() : 0
        };
    }
}

// Create detector instance
const crowdDetector = new CrowdDisasterDetector();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await crowdDetector.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await crowdDetector.stop();
    process.exit(0);
});

// Start the detector if this script is run directly
if (require.main === module) {
    crowdDetector.start().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { CrowdDisasterDetector, crowdDetector };
