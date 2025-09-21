#!/usr/bin/env node

const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

// Enhanced disaster detection with Comprehend and image analysis
class EnhancedDisasterDetector {
    constructor() {
        this.api = rateLimit(axios.create(), { maxRequests: 10, perMilliseconds: 1000 });
        this.browser = null;
        this.events = [];
        this.spikeThreshold = 5; // Posts per minute
        this.locationThreshold = 3; // Posts from same area
        this.verificationSources = [
            'Malaysian Meteorological Department',
            'Malaysia Civil Defence Force',
            'National Disaster Management Agency',
            'Fire and Rescue Department Malaysia'
        ];

        // Enhanced location patterns for Malaysia
        this.locationPatterns = {
            states: [
                'kuala lumpur', 'kl', 'selangor', 'penang', 'johor', 'sabah', 'sarawak',
                'perak', 'kedah', 'kelantan', 'terengganu', 'pahang', 'negeri sembilan',
                'melaka', 'malacca', 'putrajaya', 'labuan', 'perlis'
            ],
            cities: [
                'georgetown', 'ipoh', 'johor bahru', 'kota kinabalu', 'kuching', 'alor setar',
                'kota bharu', 'kuala terengganu', 'kuantan', 'seremban', 'melaka', 'kangar',
                'shah alam', 'petaling jaya', 'subang jaya', 'klang', 'kajang', 'ampang',
                'cheras', 'kepong', 'sentul', 'brickfields', 'bangsar', 'mont kiara'
            ],
            areas: [
                'damansara', 'puchong', 'putrajaya', 'cyberjaya', 'subang', 'sunway',
                'bandar sunway', 'taman tun', 'ttdi', 'bangsar south', 'klcc', 'bukit bintang',
                'times square', 'pavilion', 'lot 10', 'sungai wang', 'low yat', 'imbi'
            ]
        };

        // Disaster keywords with severity levels
        this.disasterKeywords = {
            high: [
                'earthquake', 'gempa', 'tsunami', 'landslide', 'tanah runtuh', 'building collapse',
                'runtuh', 'explosion', 'letupan', 'fire', 'kebakaran', 'emergency', 'kecemasan',
                'urgent', 'mendesak', 'dangerous', 'berbahaya', 'evacuate', 'evakuasi'
            ],
            medium: [
                'flood', 'banjir', 'storm', 'ribut', 'heavy rain', 'hujan lebat', 'thunderstorm',
                'ribut petir', 'strong wind', 'angin kencang', 'warning', 'amaran', 'alert',
                'siaga', 'caution', 'berhati-hati', 'road closed', 'jalan tutup', 'traffic jam'
            ],
            low: [
                'rain', 'hujan', 'cloudy', 'mendung', 'windy', 'berangin', 'hot', 'panas',
                'humidity', 'lembap', 'weather', 'cuaca', 'temperature', 'suhu'
            ]
        };
    }

    async start() {
        console.log('🚀 Starting Enhanced Disaster Detection System...');
        console.log('🔍 Features: Comprehend Analysis + Image Location Detection + Verification');

        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            // Start monitoring
            await this.monitorUserPosts();

            // Start verification monitoring
            setInterval(() => this.checkOfficialVerification(), 300000); // Every 5 minutes

        } catch (error) {
            console.error('❌ Error starting enhanced detector:', error.message);
        }
    }

    async stop() {
        if (this.browser) {
            await this.browser.close();
        }
        console.log('🛑 Enhanced disaster detector stopped');
    }

    async monitorUserPosts() {
        console.log('🔍 Starting enhanced user post monitoring...');

        while (true) {
            try {
                const startTime = Date.now();
                console.log(`\n🔍 Monitoring user posts at ${new Date().toISOString()}`);

                // Monitor multiple sources
                const results = await Promise.allSettled([
                    this.monitorRedditUsers(),
                    this.monitorTwitterUsers(),
                    this.monitorInstagramUsers(),
                    this.monitorFacebookUsers()
                ]);

                const successful = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;

                console.log(`✅ User post monitoring completed in ${Date.now() - startTime}ms`);
                console.log(`📊 Sources: ${successful} successful, ${failed} failed`);

                // Analyze trends and detect spikes
                await this.analyzeTrends();
                await this.detectDisasterSpikes();

                // Wait before next cycle
                await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

            } catch (error) {
                console.error('❌ Error in monitoring cycle:', error.message);
                await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute on error
            }
        }
    }

    async monitorRedditUsers() {
        console.log('🔴 Monitoring Reddit users...');

        const subreddits = ['malaysia', 'malaysians', 'kl', 'kualalumpur', 'penang', 'sabah', 'sarawak'];
        const posts = [];

        for (const subreddit of subreddits) {
            try {
                const response = await this.api.get(`https://www.reddit.com/r/${subreddit}/hot.json?limit=25`);
                const data = response.data.data.children;

                for (const post of data) {
                    const postData = post.data;
                    const text = `${postData.title} ${postData.selftext || ''}`.toLowerCase();

                    if (this.containsDisasterKeywords(text)) {
                        const enhancedPost = await this.enhancePostWithComprehend({
                            text: text,
                            author: postData.author,
                            source: 'reddit',
                            subreddit: subreddit,
                            url: `https://reddit.com${postData.permalink}`,
                            timestamp: new Date(postData.created_utc * 1000),
                            location: this.extractLocationFromText(text),
                            images: this.extractImageUrls(postData)
                        });

                        posts.push(enhancedPost);
                        console.log(`👤 User Post: ${postData.title.substring(0, 80)}...`);
                        console.log(`   👤 Author: u/${postData.author}`);
                        console.log(`   📍 Location: ${enhancedPost.location || 'Not detected'}`);
                        console.log(`   ⚠️  Severity: ${enhancedPost.severity}`);
                    }
                }

            } catch (error) {
                console.error(`   ❌ Error monitoring r/${subreddit}:`, error.message);
            }
        }

        return posts;
    }

    async monitorTwitterUsers() {
        console.log('🐦 Monitoring Twitter users...');

        // Simulate Twitter monitoring (in real implementation, use Twitter API)
        const mockPosts = [
            {
                text: "Just felt an earthquake in KL! Anyone else felt it? #earthquake #malaysia",
                author: "@regular_user_123",
                source: "twitter",
                timestamp: new Date(),
                location: "kuala lumpur",
                images: []
            },
            {
                text: "Heavy flooding in my area! Stay safe everyone #malaysiaflood",
                author: "@local_user_456",
                source: "twitter",
                timestamp: new Date(),
                location: null,
                images: ["https://example.com/flood_photo.jpg"]
            }
        ];

        const enhancedPosts = [];
        for (const post of mockPosts) {
            const enhancedPost = await this.enhancePostWithComprehend(post);
            enhancedPosts.push(enhancedPost);

            console.log(`👤 User Post: ${post.text.substring(0, 80)}...`);
            console.log(`   👤 Author: ${post.author}`);
            console.log(`   📍 Location: ${enhancedPost.location || 'Not detected'}`);
            console.log(`   ⚠️  Severity: ${enhancedPost.severity}`);
        }

        return enhancedPosts;
    }

    async monitorInstagramUsers() {
        console.log('📷 Monitoring Instagram users...');

        // Simulate Instagram monitoring
        const mockPosts = [
            {
                text: "Heavy flooding in my area! Stay safe everyone #malaysiaflood",
                author: "@local_user_456",
                source: "instagram",
                timestamp: new Date(),
                location: null,
                images: ["https://example.com/instagram_flood.jpg"]
            }
        ];

        const enhancedPosts = [];
        for (const post of mockPosts) {
            const enhancedPost = await this.enhancePostWithComprehend(post);
            enhancedPosts.push(enhancedPost);

            console.log(`👤 User Post: ${post.text.substring(0, 80)}...`);
            console.log(`   👤 Author: ${post.author}`);
            console.log(`   📍 Location: ${enhancedPost.location || 'Not detected'}`);
            console.log(`   ⚠️  Severity: ${enhancedPost.severity}`);
        }

        return enhancedPosts;
    }

    async monitorFacebookUsers() {
        console.log('📘 Monitoring Facebook users...');

        // Simulate Facebook monitoring
        const mockPosts = [
            {
                text: "Just experienced a strong earthquake in Penang! My house shook for 30 seconds. Anyone else felt it?",
                author: "Community Member",
                source: "facebook",
                timestamp: new Date(),
                location: "penang",
                images: []
            }
        ];

        const enhancedPosts = [];
        for (const post of mockPosts) {
            const enhancedPost = await this.enhancePostWithComprehend(post);
            enhancedPosts.push(enhancedPost);

            console.log(`👤 User Post: ${post.text.substring(0, 80)}...`);
            console.log(`   👤 Author: ${post.author}`);
            console.log(`   📍 Location: ${enhancedPost.location || 'Not detected'}`);
            console.log(`   ⚠️  Severity: ${enhancedPost.severity}`);
        }

        return enhancedPosts;
    }

    async enhancePostWithComprehend(post) {
        try {
            // Simulate Amazon Comprehend analysis
            const comprehendAnalysis = await this.analyzeWithComprehend(post.text);

            // Extract location from images if available
            let imageLocation = null;
            if (post.images && post.images.length > 0) {
                imageLocation = await this.extractLocationFromImages(post.images);
            }

            // Combine text and image location detection
            const finalLocation = post.location || imageLocation || this.extractLocationFromText(post.text);

            return {
                ...post,
                location: finalLocation,
                severity: this.calculateSeverity(post.text, comprehendAnalysis),
                entities: comprehendAnalysis.entities,
                sentiment: comprehendAnalysis.sentiment,
                confidence: comprehendAnalysis.confidence,
                verified: false,
                verificationSource: null,
                verificationTimestamp: null
            };

        } catch (error) {
            console.error('❌ Error enhancing post with Comprehend:', error.message);
            return {
                ...post,
                severity: this.calculateBasicSeverity(post.text),
                verified: false
            };
        }
    }

    async analyzeWithComprehend(text) {
        // Simulate Amazon Comprehend analysis
        // In real implementation, call AWS Comprehend API

        const entities = this.extractEntities(text);
        const sentiment = this.analyzeSentiment(text);
        const confidence = Math.random() * 0.4 + 0.6; // 60-100% confidence

        return {
            entities,
            sentiment,
            confidence
        };
    }

    extractEntities(text) {
        const entities = [];

        // Extract disaster-related entities
        for (const [severity, keywords] of Object.entries(this.disasterKeywords)) {
            for (const keyword of keywords) {
                if (text.toLowerCase().includes(keyword)) {
                    entities.push({
                        text: keyword,
                        type: 'DISASTER',
                        confidence: 0.8,
                        severity: severity
                    });
                }
            }
        }

        // Extract location entities
        for (const [type, locations] of Object.entries(this.locationPatterns)) {
            for (const location of locations) {
                if (text.toLowerCase().includes(location)) {
                    entities.push({
                        text: location,
                        type: 'LOCATION',
                        confidence: 0.9,
                        category: type
                    });
                }
            }
        }

        return entities;
    }

    analyzeSentiment(text) {
        const positiveWords = ['safe', 'okay', 'fine', 'good', 'help', 'rescue', 'saved'];
        const negativeWords = ['danger', 'dangerous', 'emergency', 'urgent', 'help', 'stuck', 'trapped', 'injured'];

        let score = 0;
        const words = text.toLowerCase().split(/\s+/);

        for (const word of words) {
            if (positiveWords.includes(word)) score += 1;
            if (negativeWords.includes(word)) score -= 1;
        }

        if (score > 0) return 'POSITIVE';
        if (score < 0) return 'NEGATIVE';
        return 'NEUTRAL';
    }

    async extractLocationFromImages(imageUrls) {
        console.log('🖼️  Analyzing images for location data...');

        // In real implementation, use AWS Rekognition or Google Vision API
        // For now, simulate location extraction from EXIF data or image analysis

        for (const imageUrl of imageUrls) {
            try {
                // Simulate image analysis
                const mockLocation = this.simulateImageLocationDetection(imageUrl);
                if (mockLocation) {
                    console.log(`   📍 Location detected from image: ${mockLocation}`);
                    return mockLocation;
                }
            } catch (error) {
                console.error(`   ❌ Error analyzing image ${imageUrl}:`, error.message);
            }
        }

        return null;
    }

    simulateImageLocationDetection(imageUrl) {
        // Simulate location detection from image metadata or content analysis
        const mockLocations = ['kuala lumpur', 'penang', 'sabah', 'johor', 'selangor'];
        return Math.random() > 0.7 ? mockLocations[Math.floor(Math.random() * mockLocations.length)] : null;
    }

    extractLocationFromText(text) {
        const lowerText = text.toLowerCase();

        // Check for state names
        for (const state of this.locationPatterns.states) {
            if (lowerText.includes(state)) {
                return state;
            }
        }

        // Check for city names
        for (const city of this.locationPatterns.cities) {
            if (lowerText.includes(city)) {
                return city;
            }
        }

        // Check for area names
        for (const area of this.locationPatterns.areas) {
            if (lowerText.includes(area)) {
                return area;
            }
        }

        return null;
    }

    extractImageUrls(postData) {
        const images = [];

        // Extract from Reddit post data
        if (postData.preview && postData.preview.images) {
            for (const image of postData.preview.images) {
                if (image.source && image.source.url) {
                    images.push(image.source.url);
                }
            }
        }

        // Extract from media metadata
        if (postData.media_metadata) {
            for (const [key, media] of Object.entries(postData.media_metadata)) {
                if (media.s && media.s.u) {
                    images.push(media.s.u);
                }
            }
        }

        return images;
    }

    calculateSeverity(text, comprehendAnalysis) {
        let severity = 0.3; // Base severity

        // Increase based on disaster keywords
        for (const [level, keywords] of Object.entries(this.disasterKeywords)) {
            for (const keyword of keywords) {
                if (text.toLowerCase().includes(keyword)) {
                    switch (level) {
                        case 'high': severity += 0.4; break;
                        case 'medium': severity += 0.2; break;
                        case 'low': severity += 0.1; break;
                    }
                }
            }
        }

        // Adjust based on sentiment
        if (comprehendAnalysis.sentiment === 'NEGATIVE') severity += 0.2;
        if (comprehendAnalysis.sentiment === 'POSITIVE') severity -= 0.1;

        // Adjust based on confidence
        severity *= comprehendAnalysis.confidence;

        return Math.min(1.0, Math.max(0.1, severity));
    }

    calculateBasicSeverity(text) {
        let severity = 0.3;

        for (const [level, keywords] of Object.entries(this.disasterKeywords)) {
            for (const keyword of keywords) {
                if (text.toLowerCase().includes(keyword)) {
                    switch (level) {
                        case 'high': severity += 0.4; break;
                        case 'medium': severity += 0.2; break;
                        case 'low': severity += 0.1; break;
                    }
                }
            }
        }

        return Math.min(1.0, Math.max(0.1, severity));
    }

    containsDisasterKeywords(text) {
        const allKeywords = [
            ...this.disasterKeywords.high,
            ...this.disasterKeywords.medium,
            ...this.disasterKeywords.low
        ];

        return allKeywords.some(keyword => text.toLowerCase().includes(keyword));
    }

    async analyzeTrends() {
        console.log('📊 Analyzing post trends...');

        // Group posts by location and time
        const locationGroups = {};
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        for (const event of this.events) {
            if (event.timestamp > oneHourAgo) {
                const location = event.location || 'unknown';
                if (!locationGroups[location]) {
                    locationGroups[location] = [];
                }
                locationGroups[location].push(event);
            }
        }

        // Analyze trends for each location
        for (const [location, posts] of Object.entries(locationGroups)) {
            if (posts.length >= this.locationThreshold) {
                console.log(`📍 Location trend detected: ${location} (${posts.length} posts)`);
            }
        }
    }

    async detectDisasterSpikes() {
        console.log('🚨 Detecting disaster spikes...');

        const now = new Date();
        const recentPosts = this.events.filter(event =>
            now.getTime() - event.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
        );

        if (recentPosts.length >= this.spikeThreshold) {
            console.log(`🚨 DISASTER SPIKE DETECTED: ${recentPosts.length} posts in last 5 minutes`);

            // Group by location
            const locationGroups = {};
            for (const post of recentPosts) {
                const location = post.location || 'unknown';
                if (!locationGroups[location]) {
                    locationGroups[location] = [];
                }
                locationGroups[location].push(post);
            }

            // Alert for each location with significant activity
            for (const [location, posts] of Object.entries(locationGroups)) {
                if (posts.length >= 3) {
                    console.log(`🚨 ALERT: ${posts.length} disaster posts from ${location}`);
                    await this.createDisasterAlert(location, posts);
                }
            }
        }
    }

    async createDisasterAlert(location, posts) {
        const alert = {
            id: `alert_${Date.now()}`,
            location: location,
            severity: this.calculateAlertSeverity(posts),
            postCount: posts.length,
            timestamp: new Date(),
            posts: posts,
            verified: false,
            verificationSource: null
        };

        this.events.push(alert);

        console.log(`🚨 DISASTER ALERT CREATED:`);
        console.log(`   📍 Location: ${location}`);
        console.log(`   ⚠️  Severity: ${alert.severity}`);
        console.log(`   📊 Posts: ${posts.length}`);
        console.log(`   🔍 Verified: ${alert.verified ? 'Yes' : 'No'}`);
    }

    calculateAlertSeverity(posts) {
        const avgSeverity = posts.reduce((sum, post) => sum + post.severity, 0) / posts.length;
        const postCount = posts.length;

        // Higher severity for more posts and higher individual severity
        return Math.min(1.0, avgSeverity + (postCount * 0.1));
    }

    async checkOfficialVerification() {
        console.log('🔍 Checking for official verification...');

        try {
            // Check official sources for disaster confirmations
            const verifications = await this.scanOfficialSources();

            for (const verification of verifications) {
                await this.verifyDisasterEvents(verification);
            }

        } catch (error) {
            console.error('❌ Error checking official verification:', error.message);
        }
    }

    async scanOfficialSources() {
        const verifications = [];

        // Simulate scanning official sources
        const mockVerifications = [
            {
                source: 'Malaysian Meteorological Department',
                location: 'kuala lumpur',
                disasterType: 'earthquake',
                severity: 'high',
                timestamp: new Date(),
                confirmed: true
            }
        ];

        return mockVerifications;
    }

    async verifyDisasterEvents(verification) {
        console.log(`✅ Official verification found: ${verification.disasterType} in ${verification.location}`);

        // Find matching events and mark as verified
        for (const event of this.events) {
            if (event.location === verification.location && !event.verified) {
                event.verified = true;
                event.verificationSource = verification.source;
                event.verificationTimestamp = verification.timestamp;

                console.log(`   ✅ Event verified: ${event.id}`);
            }
        }
    }
}

// Main execution
if (require.main === module) {
    const detector = new EnhancedDisasterDetector();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down enhanced disaster detector...');
        await detector.stop();
        process.exit(0);
    });

    detector.start().catch(console.error);
}

module.exports = EnhancedDisasterDetector;
