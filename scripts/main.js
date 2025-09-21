#!/usr/bin/env node

const AWSBedrockAnalyzer = require('./aws-bedrock-analyzer');
const ImageLocationAnalyzer = require('./image-location-analyzer');
const DisasterVerificationSystem = require('./disaster-verification-system');
const { RedditNewsScraper } = require('./reddit-news-scraper');
const DynamoDBStorage = require('./dynamodb-storage');
const WeatherAPIService = require('./weather-api-service');
const EnhancedSNSNotifications = require('./enhanced-sns-notifications');
const axios = require('axios');

class ComprehensiveDisasterSystem {
    constructor() {
        this.bedrockAnalyzer = new AWSBedrockAnalyzer();
        this.imageAnalyzer = new ImageLocationAnalyzer();
        this.verificationSystem = new DisasterVerificationSystem();
        this.redditScraper = new RedditNewsScraper();
        this.storage = new DynamoDBStorage();
        this.weatherService = new WeatherAPIService();
        this.snsNotifications = new EnhancedSNSNotifications(this.storage);

        // Initialize Amazon Bedrock for translation
        this.bedrockRegion = process.env.AWS_REGION || 'us-east-1';
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            console.log('🤖 Amazon Bedrock translation configured');
        } else {
            console.log('⚠️  Amazon Bedrock not configured. AWS credentials required for translation');
        }

        this.events = [];
        this.verifiedEvents = [];
        this.analysisStats = {
            totalPosts: 0,
            analyzedPosts: 0,
            locationDetected: 0,
            imageLocations: 0,
            verifiedEvents: 0,
            falsePositives: 0,
            weatherCrossChecked: 0
        };

        console.log('🚀 Comprehensive Disaster Detection System Initialized');
        console.log('🔍 Features: Real Reddit Data + AWS Bedrock + Image Analysis + Weather API Cross-check + Verification + SNS Notifications');
    }

    async start() {
        console.log('🚀 Starting Comprehensive Disaster Detection System...');

        try {
            // Start verification monitoring
            await this.verificationSystem.startVerificationMonitoring();

            // Start main monitoring loop
            await this.monitorSocialMedia();

        } catch (error) {
            console.error('❌ Error starting comprehensive system:', error.message);
        }
    }

    async monitorSocialMedia() {
        console.log('🔍 Starting comprehensive social media monitoring...');

        while (true) {
            try {
                const startTime = Date.now();
                console.log(`\n🔍 Monitoring cycle at ${new Date().toISOString()}`);

                // Scrape real Reddit posts for disaster-related content
                const posts = await this.scrapeRedditPosts();

                // Process each post with comprehensive analysis
                for (const post of posts) {
                    await this.processPost(post);
                    // Add delay between posts to avoid overwhelming AWS services
                    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
                }

                // Check for disaster spikes
                await this.detectDisasterSpikes();

                // Check for newly verified events and send SNS notifications
                await this.checkForVerifiedEvents();

                // Update statistics
                this.updateStats();

                const duration = Date.now() - startTime;
                console.log(`✅ Monitoring cycle completed in ${duration}ms`);
                console.log(`📊 Stats: ${JSON.stringify(this.analysisStats, null, 2)}`);

                // Wait before next cycle
                await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute

            } catch (error) {
                console.error('❌ Error in monitoring cycle:', error.message);
                await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes on error
            }
        }
    }

    async scrapeRedditPosts() {
        try {
            console.log('🔍 Scraping Reddit for disaster-related posts...');

            // Use the Reddit scraper to get real posts
            const redditPosts = await this.redditScraper.scrapeReddit();

            // Debug: Log what we received
            console.log(`   🔍 Reddit scraper returned ${redditPosts?.length || 0} posts`);
            if (redditPosts && redditPosts.length > 0) {
                console.log(`   📝 Sample post structure:`, {
                    hasText: !!redditPosts[0].text,
                    hasTitle: !!redditPosts[0].title,
                    hasContent: !!redditPosts[0].content,
                    textLength: redditPosts[0].text?.length || 0,
                    author: redditPosts[0].author,
                    subreddit: redditPosts[0].subreddit
                });
            }

            // Check if redditPosts is valid
            if (!redditPosts || !Array.isArray(redditPosts)) {
                console.log('   ⚠️  Reddit scraper returned invalid data, using fallback');
                return this.getFallbackPosts();
            }

            // Convert Reddit posts to our format
            const posts = redditPosts.map(post => ({
                text: post.text || post.title || 'No text available',
                author: post.author || 'reddit_user',
                source: 'reddit',
                timestamp: new Date(post.timestamp || Date.now()),
                images: post.images || [],
                location: post.location || null,
                url: post.url,
                subreddit: post.subreddit,
                score: post.upvotes || post.score || 0,
                comments: post.comments || 0
            }));

            console.log(`   📊 Found ${posts.length} Reddit posts`);
            return posts;

        } catch (error) {
            console.error('❌ Error scraping Reddit posts:', error.message);
            console.log('   🔄 Falling back to simulated data...');

            // Fallback to simulated data if Reddit scraping fails
            return this.getFallbackPosts();
        }
    }

    getFallbackPosts() {
        // Fallback simulated posts if Reddit scraping fails
        return [
            {
                text: "Just felt an earthquake in KL! My house shook for 30 seconds. Anyone else felt it? #earthquake #malaysia",
                author: "fallback_user",
                source: "simulated",
                timestamp: new Date(),
                images: [],
                location: null
            },
            {
                text: "Heavy flooding in my area! Stay safe everyone #malaysiaflood",
                author: "fallback_user",
                source: "simulated",
                timestamp: new Date(),
                images: [],
                location: null
            }
        ];
    }

    containsDisasterKeywords(text) {
        const disasterKeywords = [
            'earthquake', 'flood', 'storm', 'fire', 'emergency', 'disaster',
            'gempa', 'banjir', 'ribut', 'kebakaran', 'kecemasan', 'bencana',
            'evacuation', 'rescue', 'help', 'danger', 'warning', 'alert',
            'urgent', 'stuck', 'trapped', 'injured', 'damage', 'destroyed',
            'tropical', 'hurricane', 'typhoon', 'landslide', 'tsunami'
        ];

        const lowerText = text.toLowerCase();
        return disasterKeywords.some(keyword => lowerText.includes(keyword));
    }

    async translateText(text, sourceLanguage = 'ms', targetLanguage = 'en') {
        // Check if AWS credentials are configured
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            console.log(`   ⚠️  AWS credentials not configured. Using original text.`);
            return text;
        }

        try {
            console.log(`   🤖 Translating from ${sourceLanguage} to ${targetLanguage} using Amazon Bedrock (Titan Text)...`);

            // Import Bedrock client dynamically
            const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');

            const client = new BedrockRuntimeClient({
                region: this.bedrockRegion,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                }
            });

            // Prepare the prompt for Amazon Titan
            const prompt = `Translate the following ${sourceLanguage === 'ms' ? 'Malay' : sourceLanguage} text to English. Only return the translation, no explanations:

${text}`;

            const input = {
                modelId: 'amazon.titan-text-express-v1',
                contentType: 'application/json',
                body: JSON.stringify({
                    inputText: prompt,
                    textGenerationConfig: {
                        maxTokenCount: 1000,
                        temperature: 0.1,
                        topP: 0.9
                    }
                })
            };

            const command = new InvokeModelCommand(input);
            const response = await client.send(command);

            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const translation = responseBody.results[0].outputText.trim();

            console.log(`   ✅ Bedrock translation successful: "${translation}"`);
            return translation;

        } catch (error) {
            console.error(`   ❌ Amazon Bedrock translation failed: ${error.message}`);
            if (error.name === 'ValidationException') {
                console.error(`   Amazon Titan model not available in region ${this.bedrockRegion}. Try us-east-1 or us-west-2`);
            } else if (error.name === 'AccessDeniedException') {
                console.error(`   Access denied. Ensure Bedrock permissions for Amazon Titan model are configured`);
            }
            console.log(`   🔄 Falling back to original text.`);
            return text; // Return original text if translation fails
        }
    }

    detectLanguage(text) {
        // Simple language detection based on common Malay words
        const malayWords = ['banjir', 'ribut', 'gempa', 'kebakaran', 'kecemasan', 'bencana', 'malaysia', 'kuala', 'lumpur', 'selangor', 'sabah', 'sarawak', 'pulau', 'pinang', 'diminta', 'berpindah', 'mengganggu', 'penglihatan', 'penduduk'];
        const hasMalayWords = malayWords.some(word => text.toLowerCase().includes(word));
        return hasMalayWords ? 'ms' : 'en';
    }

    async processPost(post) {
        try {
            // Validate post object
            if (!post) {
                console.log(`\n⚠️  Skipping null/undefined post`);
                return;
            }

            // Validate post text
            if (!post.text || post.text.trim().length === 0) {
                console.log(`\n⚠️  Skipping post with empty text from ${post.author || 'unknown'}`);
                return;
            }

            // Check for duplicates before processing
            const isDuplicate = await this.checkForDuplicate(post.author || 'unknown', post.text);
            if (isDuplicate) {
                console.log(`\n⚠️  Skipping duplicate post from ${post.author}: "${post.text.substring(0, 50)}..."`);
                return;
            }

            // Check text length for AWS Comprehend (max 5KB)
            const maxLength = 5000;
            if (post.text.length > maxLength) {
                console.log(`\n⚠️  Post text too long (${post.text.length} chars), truncating to ${maxLength} chars`);
                post.text = post.text.substring(0, maxLength) + '...';
            }

            console.log(`\n🔍 Processing ${post.source} post: "${post.text.substring(0, 50)}..."`);
            if (post.subreddit) {
                console.log(`   📍 Subreddit: r/${post.subreddit}`);
            }
            if (post.score !== undefined) {
                console.log(`   ⬆️  Score: ${post.score} | 💬 Comments: ${post.comments}`);
            }
            console.log(`   📝 Text length: ${post.text.length} characters`);
            this.analysisStats.totalPosts++;

            // Store raw post in DynamoDB
            try {
                await this.storage.storeRawPost(post);
                console.log(`   💾 Raw post stored in DynamoDB`);
            } catch (storageError) {
                console.error(`   ❌ Failed to store raw post:`, storageError.message);
            }

            // Step 1: Detect language and translate if needed
            const detectedLanguage = this.detectLanguage(post.text);
            let textToAnalyze = post.text;
            let isTranslated = false;

            if (detectedLanguage === 'ms') {
                console.log('   🇲🇾 Malay text detected, translating to English...');
                textToAnalyze = await this.translateText(post.text, 'ms', 'en');
                isTranslated = true;
            }

            // Step 2: Analyze with AWS Bedrock
            console.log('   🤖 Analyzing with AWS Bedrock...');
            let bedrockResult;
            try {
                // Create a modified post object with translated text for analysis
                const postForAnalysis = { ...post, text: textToAnalyze };
                bedrockResult = await this.bedrockAnalyzer.analyzePost(postForAnalysis);

                // Add translation info to the result
                if (isTranslated) {
                    bedrockResult.originalText = post.text;
                    bedrockResult.translatedText = textToAnalyze;
                    bedrockResult.language = detectedLanguage;
                }
            } catch (bedrockError) {
                console.error('   ❌ AWS Bedrock analysis failed:', bedrockError.message);
                console.error('   📝 Post text length:', post.text?.length || 0);
                // Use fallback analysis
                bedrockResult = {
                    isDisasterRelated: this.containsDisasterKeywords(textToAnalyze),
                    confidence: 0.5,
                    severity: 0.3,
                    location: null,
                    entities: [],
                    sentiment: { sentiment: 'NEUTRAL', confidence: {} },
                    keyPhrases: []
                };
                if (isTranslated) {
                    bedrockResult.originalText = post.text;
                    bedrockResult.translatedText = textToAnalyze;
                    bedrockResult.language = detectedLanguage;
                }
            }

            if (!bedrockResult.isDisasterRelated) {
                console.log('   ❌ Post not disaster-related, skipping');
                return;
            }

            this.analysisStats.analyzedPosts++;
            console.log(`   ✅ Disaster-related post detected (confidence: ${bedrockResult.confidence})`);
            console.log(`   📍 Text location: ${bedrockResult.location || 'Not detected'}`);
            console.log(`   ⚠️  Severity: ${bedrockResult.severity}`);

            // Store analyzed post in DynamoDB
            try {
                const analyzedPost = {
                    ...post,
                    ...bedrockResult,
                    rawPostId: post.id || `raw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
                await this.storage.storeAnalyzedPost(analyzedPost);
                console.log(`   💾 Analyzed post stored in DynamoDB`);
            } catch (storageError) {
                console.error(`   ❌ Failed to store analyzed post:`, storageError.message);
            }

            // Step 3: Extract location from images if available
            let imageLocation = null;
            if (post.images && post.images.length > 0) {
                console.log('   🖼️  Analyzing images for location...');
                imageLocation = await this.imageAnalyzer.analyzeMultipleImages(post.images, post.text);

                if (imageLocation) {
                    this.analysisStats.imageLocations++;
                    console.log(`   📍 Image location detected: ${imageLocation}`);
                }
            }

            // Step 3: Combine location information
            const finalLocation = bedrockResult.location || imageLocation || post.location;
            if (finalLocation) {
                this.analysisStats.locationDetected++;
                console.log(`   📍 Final location: ${finalLocation}`);
            }

            // Step 4: Cross-check with meteorological data
            console.log('   🌦️  Cross-checking with meteorological data...');
            let meteorologicalData = null;
            let weatherAdjustedSeverity = bedrockResult.severity;

            try {
                meteorologicalData = await this.weatherService.getMeteorologicalData(finalLocation);
                weatherAdjustedSeverity = this.weatherService.calculateDisasterSeverityFromWeather(
                    post.text,
                    finalLocation,
                    meteorologicalData
                );

                this.analysisStats.weatherCrossChecked++;
                console.log(`   🌦️  Weather cross-check completed - Severity: ${bedrockResult.severity} → ${weatherAdjustedSeverity}`);

                // Log meteorological findings
                if (meteorologicalData.warnings.length > 0) {
                    console.log(`   ⚠️  Active weather warnings: ${meteorologicalData.warnings.length}`);
                }
                if (meteorologicalData.earthquakes.length > 0) {
                    console.log(`   🌍 Recent earthquakes: ${meteorologicalData.earthquakes.length}`);
                }

            } catch (weatherError) {
                console.error('   ❌ Weather cross-check failed:', weatherError.message);
                console.log('   🔄 Continuing with original severity assessment');
            }

            // Step 5: Create event
            const event = {
                id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: post.text,
                author: post.author,
                source: post.source,
                location: finalLocation,
                severity: weatherAdjustedSeverity, // Use weather-adjusted severity
                confidence: bedrockResult.confidence,
                meteorologicalData: meteorologicalData, // Include weather data
                entities: bedrockResult.entities,
                sentiment: bedrockResult.sentiment,
                keyPhrases: bedrockResult.keyPhrases,
                images: post.images,
                imageLocation: imageLocation,
                timestamp: post.timestamp,
                verified: false,
                verificationSource: null,
                verificationTimestamp: null,
                // Reddit-specific metadata
                subreddit: post.subreddit,
                score: post.score,
                comments: post.comments,
                url: post.url
            };

            this.events.push(event);
            console.log(`   ✅ Event created: ${event.id}`);

            // Store event in DynamoDB
            try {
                await this.storage.storeEvent(event);
                console.log(`   💾 Event stored in DynamoDB: ${event.id}`);
            } catch (storageError) {
                console.error(`   ❌ Failed to store event in DynamoDB:`, storageError.message);
            }

            // Send emergency notification for very high severity events
            if (event.severity >= 0.9) {
                try {
                    const emergencyAlert = {
                        id: `emergency_${event.id}`,
                        location: event.location,
                        severity: event.severity,
                        eventCount: 1,
                        timestamp: event.timestamp,
                        events: [event]
                    };

                    await this.snsNotifications.sendEmergencyAlert(emergencyAlert);
                    console.log(`   🚨 Emergency SNS notification sent for high-severity event: ${event.id}`);
                } catch (snsError) {
                    console.error(`   ❌ Failed to send emergency SNS notification:`, snsError.message);
                }
            }

        } catch (error) {
            console.error('❌ Error processing post:', error.message);
            console.error('   📝 Post details:', {
                text: post.text?.substring(0, 100) + '...',
                author: post.author,
                source: post.source,
                subreddit: post.subreddit,
                textLength: post.text?.length || 0
            });
            console.error('   🔍 Error type:', error.constructor.name);
            console.error('   🔍 Error code:', error.code || 'No code');
            console.error('   🔍 Error stack:', error.stack?.substring(0, 300) + '...');
            this.analysisStats.falsePositives++;
        }
    }

    async detectDisasterSpikes() {
        console.log('🚨 Detecting disaster spikes...');

        const now = new Date();
        const recentEvents = this.events.filter(event =>
            now.getTime() - event.timestamp.getTime() < 10 * 60 * 1000 // Last 10 minutes
        );

        if (recentEvents.length >= 3) {
            console.log(`🚨 DISASTER SPIKE DETECTED: ${recentEvents.length} events in last 10 minutes`);

            // Group by location
            const locationGroups = {};
            for (const event of recentEvents) {
                const location = event.location || 'unknown';
                if (!locationGroups[location]) {
                    locationGroups[location] = [];
                }
                locationGroups[location].push(event);
            }

            // Alert for each location with significant activity
            for (const [location, events] of Object.entries(locationGroups)) {
                if (events.length >= 2) {
                    console.log(`🚨 ALERT: ${events.length} disaster events from ${location}`);
                    await this.createDisasterAlert(location, events);
                }
            }
        }
    }

    async createDisasterAlert(location, events) {
        const alert = {
            id: `alert_${Date.now()}`,
            location: location,
            severity: this.calculateAlertSeverity(events),
            eventCount: events.length,
            events: events,
            timestamp: new Date(),
            verified: false,
            verificationSource: null
        };

        console.log(`🚨 DISASTER ALERT CREATED:`);
        console.log(`   📍 Location: ${location}`);
        console.log(`   ⚠️  Severity: ${alert.severity}`);
        console.log(`   📊 Events: ${events.length}`);
        console.log(`   🔍 Verified: ${alert.verified ? 'Yes' : 'No'}`);

        // Store alert
        this.events.push(alert);

        // Store alert in DynamoDB
        try {
            await this.storage.storeAlert(alert);
            console.log(`   💾 Alert stored in DynamoDB: ${alert.id}`);
        } catch (storageError) {
            console.error(`   ❌ Failed to store alert in DynamoDB:`, storageError.message);
        }

        // Send SNS notification for disaster alert
        try {
            if (alert.severity >= 0.8) {
                // Send emergency alert for high severity
                await this.snsNotifications.sendEmergencyAlert(alert);
                console.log(`   🚨 Emergency SNS notification sent for alert: ${alert.id}`);
            } else {
                // Send regular disaster alert
                await this.snsNotifications.sendDisasterAlert(alert);
                console.log(`   📢 Disaster alert SNS notification sent: ${alert.id}`);
            }
        } catch (snsError) {
            console.error(`   ❌ Failed to send SNS notification for alert:`, snsError.message);
        }
    }

    calculateAlertSeverity(events) {
        const avgSeverity = events.reduce((sum, event) => sum + event.severity, 0) / events.length;
        const eventCount = events.length;

        // Higher severity for more events and higher individual severity
        return Math.min(1.0, avgSeverity + (eventCount * 0.1));
    }

    // Handle verification notifications
    async handleVerificationNotification(event, verification) {
        try {
            console.log(`📢 Sending verification SNS notification for event ${event.id}`);

            // Send SNS verification notification
            await this.snsNotifications.sendVerificationNotification(event, verification);
            console.log(`   ✅ Verification SNS notification sent for event: ${event.id}`);

        } catch (snsError) {
            console.error(`   ❌ Failed to send verification SNS notification:`, snsError.message);
        }
    }

    // Check for newly verified events and send notifications
    async checkForVerifiedEvents() {
        try {
            const verifiedEvents = this.verificationSystem.getVerifiedEvents();
            const currentVerifiedCount = this.analysisStats.verifiedEvents;

            // Check if there are new verified events
            if (verifiedEvents.length > currentVerifiedCount) {
                console.log(`🔍 Found ${verifiedEvents.length - currentVerifiedCount} newly verified events`);

                // Get the newly verified events
                const newVerifiedEvents = verifiedEvents.slice(currentVerifiedCount);

                for (const event of newVerifiedEvents) {
                    // Create a verification object for the notification
                    const verification = {
                        source: event.verificationSource || 'Unknown Source',
                        type: event.verificationType || 'automated',
                        confidence: event.verificationConfidence || 0.8,
                        timestamp: event.verificationTimestamp || new Date()
                    };

                    // Send SNS notification for the newly verified event
                    await this.handleVerificationNotification(event, verification);
                }
            }
        } catch (error) {
            console.error('❌ Error checking for verified events:', error.message);
        }
    }

    updateStats() {
        this.analysisStats.verifiedEvents = this.verificationSystem.getVerifiedEvents().length;

        console.log('\n📊 Analysis Statistics:');
        console.log(`   📝 Total Posts: ${this.analysisStats.totalPosts}`);
        console.log(`   🔍 Analyzed Posts: ${this.analysisStats.analyzedPosts}`);
        console.log(`   📍 Location Detected: ${this.analysisStats.locationDetected}`);
        console.log(`   🖼️  Image Locations: ${this.analysisStats.imageLocations}`);
        console.log(`   🌦️  Weather Cross-checked: ${this.analysisStats.weatherCrossChecked}`);
        console.log(`   ✅ Verified Events: ${this.analysisStats.verifiedEvents}`);
        console.log(`   ❌ False Positives: ${this.analysisStats.falsePositives}`);

        // Send periodic system status notifications (every 10 cycles)
        if (this.analysisStats.totalPosts % 100 === 0 && this.analysisStats.totalPosts > 0) {
            this.sendSystemStatusNotification();
        }
    }

    // Send system status notification
    async sendSystemStatusNotification() {
        try {
            const verificationStats = this.verificationSystem.getVerificationStats();

            const status = {
                statistics: {
                    rawPosts: this.analysisStats.totalPosts,
                    analyzedPosts: this.analysisStats.analyzedPosts,
                    events: this.events.length,
                    alerts: this.events.filter(e => e.eventCount).length,
                    verifications: this.analysisStats.verifiedEvents,
                    lastUpdated: new Date().toISOString()
                },
                health: this.determineSystemHealth()
            };

            await this.snsNotifications.sendSystemStatus(status);
            console.log(`   📊 System status SNS notification sent`);

        } catch (snsError) {
            console.error(`   ❌ Failed to send system status SNS notification:`, snsError.message);
        }
    }

    // Determine system health based on statistics
    determineSystemHealth() {
        const errorRate = this.analysisStats.falsePositives / Math.max(this.analysisStats.analyzedPosts, 1);
        const processingRate = this.analysisStats.analyzedPosts / Math.max(this.analysisStats.totalPosts, 1);

        if (errorRate > 0.3 || processingRate < 0.5) {
            return 'DEGRADED';
        } else if (errorRate > 0.1 || processingRate < 0.8) {
            return 'WARNING';
        } else {
            return 'HEALTHY';
        }
    }

    async getSystemStatus() {
        const verificationStats = this.verificationSystem.getVerificationStats();
        const subscriberStats = await this.getSubscriberStats();

        return {
            analysis: this.analysisStats,
            verification: verificationStats,
            subscribers: subscriberStats,
            totalEvents: this.events.length,
            recentEvents: this.events.filter(event =>
                Date.now() - event.timestamp.getTime() < 60 * 60 * 1000 // Last hour
            ).length
        };
    }

    // Test SNS notification system with subscribers
    async testSNSNotifications() {
        try {
            console.log('🧪 Testing Enhanced SNS notification system with DynamoDB subscribers...');

            // Test the enhanced SNS notifications with sample subscribers
            return await this.snsNotifications.testNotificationsWithSubscribers();

        } catch (error) {
            console.error('❌ Error testing Enhanced SNS notifications:', error.message);
            return false;
        }
    }

    // Add sample subscribers for testing
    async addSampleSubscribers() {
        try {
            console.log('📝 Adding sample subscribers for testing...');

            const sampleSubscribers = [
                {
                    email: 'admin@example.com',
                    type: 'email',
                    preferences: {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: true,
                        systemStatus: true
                    },
                    location: 'Kuala Lumpur'
                },
                {
                    phone: '+60123456789',
                    type: 'sms',
                    preferences: {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: false,
                        systemStatus: false
                    }
                },
                {
                    email: 'emergency@example.com',
                    phone: '+60198765432',
                    type: 'both',
                    preferences: {
                        disasterAlerts: true,
                        emergencyAlerts: true,
                        verifications: true,
                        systemStatus: true
                    },
                    location: 'Kuala Lumpur'
                }
            ];

            for (const subscriber of sampleSubscribers) {
                await this.storage.storeSubscriber(subscriber);
            }

            console.log(`✅ Added ${sampleSubscribers.length} sample subscribers`);
            return true;

        } catch (error) {
            console.error('❌ Error adding sample subscribers:', error.message);
            return false;
        }
    }

    // Get subscriber statistics
    async getSubscriberStats() {
        try {
            const allSubscribers = await this.storage.getActiveSubscribers();
            const disasterAlertSubscribers = await this.storage.getActiveSubscribers('disasterAlerts');
            const emergencySubscribers = await this.storage.getActiveSubscribers('emergencyAlerts');
            const verificationSubscribers = await this.storage.getActiveSubscribers('verifications');
            const statusSubscribers = await this.storage.getActiveSubscribers('systemStatus');

            return {
                total: allSubscribers.length,
                disasterAlerts: disasterAlertSubscribers.length,
                emergencyAlerts: emergencySubscribers.length,
                verifications: verificationSubscribers.length,
                systemStatus: statusSubscribers.length,
                byType: {
                    email: allSubscribers.filter(s => s.type === 'email').length,
                    sms: allSubscribers.filter(s => s.type === 'sms').length,
                    both: allSubscribers.filter(s => s.type === 'both').length
                }
            };
        } catch (error) {
            console.error('❌ Error getting subscriber stats:', error.message);
            return {
                total: 0,
                disasterAlerts: 0,
                emergencyAlerts: 0,
                verifications: 0,
                systemStatus: 0,
                byType: { email: 0, sms: 0, both: 0 }
            };
        }
    }

    async checkForDuplicate(author, text) {
        try {
            // Check if we've seen this exact author + text combination recently
            const recentTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

            // Look through recent events for duplicates
            const recentEvents = this.events.filter(event =>
                event.timestamp && event.timestamp > recentTime &&
                event.author === author &&
                event.text === text
            );

            return recentEvents.length > 0;

        } catch (error) {
            console.error('❌ Error checking for duplicates:', error.message);
            return false; // If error, don't skip the post
        }
    }

    async stop() {
        console.log('🛑 Stopping comprehensive disaster detection system...');
        // Cleanup would go here
        console.log('✅ System stopped');
    }
}

// Main execution
if (require.main === module) {
    const system = new ComprehensiveDisasterSystem();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down comprehensive disaster detection system...');
        await system.stop();
        process.exit(0);
    });

    system.start().catch(console.error);
}

module.exports = ComprehensiveDisasterSystem;