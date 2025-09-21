#!/usr/bin/env node

const AWSComprehendAnalyzer = require('./aws-comprehend-analyzer');
const ImageLocationAnalyzer = require('./image-location-analyzer');
const DisasterVerificationSystem = require('./disaster-verification-system');

class ComprehensiveDisasterSystem {
    constructor() {
        this.comprehendAnalyzer = new AWSComprehendAnalyzer();
        this.imageAnalyzer = new ImageLocationAnalyzer();
        this.verificationSystem = new DisasterVerificationSystem();

        this.events = [];
        this.verifiedEvents = [];
        this.analysisStats = {
            totalPosts: 0,
            analyzedPosts: 0,
            locationDetected: 0,
            imageLocations: 0,
            verifiedEvents: 0,
            falsePositives: 0
        };

        console.log('🚀 Comprehensive Disaster Detection System Initialized');
        console.log('🔍 Features: AWS Comprehend + Image Analysis + Verification');
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

                // Simulate social media posts (in production, this would be real scraping)
                const posts = await this.simulateSocialMediaPosts();

                // Process each post with comprehensive analysis
                for (const post of posts) {
                    await this.processPost(post);
                }

                // Check for disaster spikes
                await this.detectDisasterSpikes();

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

    async simulateSocialMediaPosts() {
        // Simulate various social media posts with different scenarios
        const mockPosts = [
            {
                text: "Just felt an earthquake in KL! My house shook for 30 seconds. Anyone else felt it? #earthquake #malaysia",
                author: "@regular_user_123",
                source: "twitter",
                timestamp: new Date(),
                images: ["https://example.com/earthquake_photo.jpg"],
                location: null
            },
            {
                text: "Heavy flooding in my area! Stay safe everyone #malaysiaflood",
                author: "@local_user_456",
                source: "instagram",
                timestamp: new Date(),
                images: ["https://example.com/flood_photo1.jpg", "https://example.com/flood_photo2.jpg"],
                location: null
            },
            {
                text: "Storm damage in Penang. Trees down everywhere. #ributmalaysia",
                author: "Community Member",
                source: "facebook",
                timestamp: new Date(),
                images: ["https://example.com/storm_damage.jpg"],
                location: "penang"
            },
            {
                text: "Fire at shopping mall in Johor Bahru. Emergency services on scene. #kebakaran",
                author: "@emergency_reporter",
                source: "twitter",
                timestamp: new Date(),
                images: ["https://example.com/fire_photo.jpg"],
                location: null
            },
            {
                text: "Landslide on highway to Cameron Highlands. Road closed. #tanahruntuh",
                author: "@road_user",
                source: "reddit",
                timestamp: new Date(),
                images: ["https://example.com/landslide_photo.jpg"],
                location: null
            }
        ];

        return mockPosts;
    }

    async processPost(post) {
        try {
            console.log(`\n🔍 Processing post: "${post.text.substring(0, 50)}..."`);
            this.analysisStats.totalPosts++;

            // Step 1: Analyze with AWS Comprehend
            console.log('   🤖 Analyzing with AWS Comprehend...');
            const comprehendResult = await this.comprehendAnalyzer.analyzePost(post);

            if (!comprehendResult.isDisasterRelated) {
                console.log('   ❌ Post not disaster-related, skipping');
                return;
            }

            this.analysisStats.analyzedPosts++;
            console.log(`   ✅ Disaster-related post detected (confidence: ${comprehendResult.confidence})`);
            console.log(`   📍 Text location: ${comprehendResult.location || 'Not detected'}`);
            console.log(`   ⚠️  Severity: ${comprehendResult.severity}`);

            // Step 2: Extract location from images if available
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
            const finalLocation = comprehendResult.location || imageLocation || post.location;
            if (finalLocation) {
                this.analysisStats.locationDetected++;
                console.log(`   📍 Final location: ${finalLocation}`);
            }

            // Step 4: Create event
            const event = {
                id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: post.text,
                author: post.author,
                source: post.source,
                location: finalLocation,
                severity: comprehendResult.severity,
                confidence: comprehendResult.confidence,
                entities: comprehendResult.entities,
                sentiment: comprehendResult.sentiment,
                keyPhrases: comprehendResult.keyPhrases,
                images: post.images,
                imageLocation: imageLocation,
                timestamp: post.timestamp,
                verified: false,
                verificationSource: null,
                verificationTimestamp: null
            };

            this.events.push(event);
            console.log(`   ✅ Event created: ${event.id}`);

        } catch (error) {
            console.error('❌ Error processing post:', error.message);
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
    }

    calculateAlertSeverity(events) {
        const avgSeverity = events.reduce((sum, event) => sum + event.severity, 0) / events.length;
        const eventCount = events.length;

        // Higher severity for more events and higher individual severity
        return Math.min(1.0, avgSeverity + (eventCount * 0.1));
    }

    updateStats() {
        this.analysisStats.verifiedEvents = this.verificationSystem.getVerifiedEvents().length;

        console.log('\n📊 Analysis Statistics:');
        console.log(`   📝 Total Posts: ${this.analysisStats.totalPosts}`);
        console.log(`   🔍 Analyzed Posts: ${this.analysisStats.analyzedPosts}`);
        console.log(`   📍 Location Detected: ${this.analysisStats.locationDetected}`);
        console.log(`   🖼️  Image Locations: ${this.analysisStats.imageLocations}`);
        console.log(`   ✅ Verified Events: ${this.analysisStats.verifiedEvents}`);
        console.log(`   ❌ False Positives: ${this.analysisStats.falsePositives}`);
    }

    async getSystemStatus() {
        const verificationStats = this.verificationSystem.getVerificationStats();

        return {
            analysis: this.analysisStats,
            verification: verificationStats,
            totalEvents: this.events.length,
            recentEvents: this.events.filter(event =>
                Date.now() - event.timestamp.getTime() < 60 * 60 * 1000 // Last hour
            ).length
        };
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
