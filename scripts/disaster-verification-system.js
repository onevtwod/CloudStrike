#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');

class DisasterVerificationSystem {
    constructor() {
        this.verificationSources = {
            official: [
                {
                    name: 'Malaysian Meteorological Department',
                    url: 'https://www.met.gov.my/',
                    selectors: {
                        alerts: '.alert, .warning, .emergency',
                        content: '.content, .news, .announcement'
                    }
                },
                {
                    name: 'Malaysia Civil Defence Force',
                    url: 'https://www.civildefence.gov.my/',
                    selectors: {
                        alerts: '.alert, .warning, .emergency',
                        content: '.content, .news, .announcement'
                    }
                },
                {
                    name: 'National Disaster Management Agency',
                    url: 'https://www.nadma.gov.my/',
                    selectors: {
                        alerts: '.alert, .warning, .emergency',
                        content: '.content, .news, .announcement'
                    }
                },
                {
                    name: 'Fire and Rescue Department Malaysia',
                    url: 'https://www.bomba.gov.my/',
                    selectors: {
                        alerts: '.alert, .warning, .emergency',
                        content: '.content, .news, .announcement'
                    }
                }
            ],
            news: [
                {
                    name: 'The Star Malaysia',
                    url: 'https://www.thestar.com.my/',
                    selectors: {
                        articles: '.story, .article, .news-item',
                        title: 'h1, h2, .headline, .title',
                        content: '.content, .story-content, .article-content'
                    }
                },
                {
                    name: 'New Straits Times',
                    url: 'https://www.nst.com.my/',
                    selectors: {
                        articles: '.story, .article, .news-item',
                        title: 'h1, h2, .headline, .title',
                        content: '.content, .story-content, .article-content'
                    }
                },
                {
                    name: 'Malay Mail',
                    url: 'https://www.malaymail.com/',
                    selectors: {
                        articles: '.story, .article, .news-item',
                        title: 'h1, h2, .headline, .title',
                        content: '.content, .story-content, .article-content'
                    }
                }
            ]
        };

        this.disasterKeywords = [
            'earthquake', 'gempa', 'flood', 'banjir', 'storm', 'ribut',
            'fire', 'kebakaran', 'landslide', 'tanah runtuh', 'emergency',
            'kecemasan', 'disaster', 'bencana', 'evacuation', 'evakuasi',
            'warning', 'amaran', 'alert', 'siaga', 'urgent', 'mendesak'
        ];

        this.locationKeywords = [
            'kuala lumpur', 'kl', 'selangor', 'penang', 'johor', 'sabah',
            'sarawak', 'perak', 'kedah', 'kelantan', 'terengganu', 'pahang',
            'negeri sembilan', 'melaka', 'malacca', 'putrajaya', 'labuan',
            'perlis', 'ipoh', 'johor bahru', 'kota kinabalu', 'kuching'
        ];

        this.verifiedEvents = new Map();
        this.verificationHistory = [];
    }

    async startVerificationMonitoring() {
        console.log('🔍 Starting disaster verification monitoring...');

        // Check for verifications every 5 minutes
        setInterval(async () => {
            try {
                await this.checkForVerifications();
            } catch (error) {
                console.error('❌ Error in verification monitoring:', error.message);
            }
        }, 300000); // 5 minutes

        // Initial check
        await this.checkForVerifications();
    }

    async checkForVerifications() {
        console.log('🔍 Checking for official disaster verifications...');

        const verifications = [];

        // Check official sources
        for (const source of this.verificationSources.official) {
            try {
                const sourceVerifications = await this.scanOfficialSource(source);
                verifications.push(...sourceVerifications);
            } catch (error) {
                console.error(`❌ Error scanning ${source.name}:`, error.message);
            }
        }

        // Check news sources
        for (const source of this.verificationSources.news) {
            try {
                const newsVerifications = await this.scanNewsSource(source);
                verifications.push(...newsVerifications);
            } catch (error) {
                console.error(`❌ Error scanning ${source.name}:`, error.message);
            }
        }

        // Process verifications
        for (const verification of verifications) {
            await this.processVerification(verification);
        }

        console.log(`✅ Verification check completed: ${verifications.length} verifications found`);
    }

    async scanOfficialSource(source) {
        console.log(`🔍 Scanning ${source.name}...`);

        try {
            const response = await axios.get(source.url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            const verifications = [];

            // Look for alerts and warnings
            $(source.selectors.alerts).each((index, element) => {
                const text = $(element).text().toLowerCase();
                if (this.containsDisasterKeywords(text)) {
                    const location = this.extractLocationFromText(text);
                    if (location) {
                        verifications.push({
                            source: source.name,
                            type: 'official_alert',
                            location: location,
                            text: text,
                            timestamp: new Date(),
                            url: source.url,
                            confidence: 0.9
                        });
                    }
                }
            });

            // Look for news content
            $(source.selectors.content).each((index, element) => {
                const text = $(element).text().toLowerCase();
                if (this.containsDisasterKeywords(text)) {
                    const location = this.extractLocationFromText(text);
                    if (location) {
                        verifications.push({
                            source: source.name,
                            type: 'official_news',
                            location: location,
                            text: text,
                            timestamp: new Date(),
                            url: source.url,
                            confidence: 0.8
                        });
                    }
                }
            });

            console.log(`   📝 Found ${verifications.length} verifications from ${source.name}`);
            return verifications;

        } catch (error) {
            console.error(`❌ Error scanning ${source.name}:`, error.message);
            return [];
        }
    }

    async scanNewsSource(source) {
        console.log(`📰 Scanning ${source.name}...`);

        try {
            const response = await axios.get(source.url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            const verifications = [];

            // Look for disaster-related articles
            $(source.selectors.articles).each((index, element) => {
                const title = $(element).find(source.selectors.title).text().toLowerCase();
                const content = $(element).find(source.selectors.content).text().toLowerCase();
                const fullText = `${title} ${content}`;

                if (this.containsDisasterKeywords(fullText)) {
                    const location = this.extractLocationFromText(fullText);
                    if (location) {
                        verifications.push({
                            source: source.name,
                            type: 'news_article',
                            location: location,
                            text: fullText,
                            timestamp: new Date(),
                            url: source.url,
                            confidence: 0.7
                        });
                    }
                }
            });

            console.log(`   📝 Found ${verifications.length} verifications from ${source.name}`);
            return verifications;

        } catch (error) {
            console.error(`❌ Error scanning ${source.name}:`, error.message);
            return [];
        }
    }

    async processVerification(verification) {
        console.log(`✅ Processing verification: ${verification.type} from ${verification.source}`);
        console.log(`   📍 Location: ${verification.location}`);
        console.log(`   📝 Text: ${verification.text.substring(0, 100)}...`);

        // Find matching events to verify
        const matchingEvents = this.findMatchingEvents(verification);

        for (const event of matchingEvents) {
            await this.verifyEvent(event, verification);
        }

        // Store verification in history
        this.verificationHistory.push(verification);
    }

    findMatchingEvents(verification) {
        const matchingEvents = [];

        // This would typically query your event database
        // For now, simulate finding matching events
        const mockEvents = [
            {
                id: 'event_1',
                location: verification.location,
                type: 'earthquake',
                severity: 0.8,
                timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
                verified: false
            },
            {
                id: 'event_2',
                location: verification.location,
                type: 'flood',
                severity: 0.6,
                timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
                verified: false
            }
        ];

        // Find events that match location and are recent
        for (const event of mockEvents) {
            if (event.location === verification.location &&
                !event.verified &&
                this.isRecentEvent(event, verification)) {
                matchingEvents.push(event);
            }
        }

        return matchingEvents;
    }

    isRecentEvent(event, verification) {
        const timeDiff = verification.timestamp.getTime() - event.timestamp.getTime();
        return timeDiff >= 0 && timeDiff <= 2 * 60 * 60 * 1000; // Within 2 hours
    }

    async verifyEvent(event, verification) {
        console.log(`✅ Verifying event ${event.id} with ${verification.source}`);

        // Update event with verification
        event.verified = true;
        event.verificationSource = verification.source;
        event.verificationTimestamp = verification.timestamp;
        event.verificationType = verification.type;
        event.verificationConfidence = verification.confidence;

        // Store in verified events
        this.verifiedEvents.set(event.id, event);

        console.log(`   ✅ Event ${event.id} verified by ${verification.source}`);
        console.log(`   📍 Location: ${event.location}`);
        console.log(`   ⚠️  Severity: ${event.severity}`);
        console.log(`   🔍 Confidence: ${verification.confidence}`);

        // Send verification notification
        await this.sendVerificationNotification(event, verification);
    }

    async sendVerificationNotification(event, verification) {
        console.log(`📢 Sending verification notification for event ${event.id}`);

        // In production, this would send notifications via SNS, email, etc.
        const notification = {
            type: 'disaster_verified',
            eventId: event.id,
            location: event.location,
            disasterType: event.type,
            severity: event.severity,
            verificationSource: verification.source,
            verificationType: verification.type,
            verificationConfidence: verification.confidence,
            timestamp: new Date()
        };

        console.log(`   📢 Notification: ${JSON.stringify(notification, null, 2)}`);
    }

    containsDisasterKeywords(text) {
        return this.disasterKeywords.some(keyword => text.toLowerCase().includes(keyword));
    }

    extractLocationFromText(text) {
        const lowerText = text.toLowerCase();

        for (const location of this.locationKeywords) {
            if (lowerText.includes(location)) {
                return location;
            }
        }

        return null;
    }

    getVerifiedEvents() {
        return Array.from(this.verifiedEvents.values());
    }

    getVerificationHistory() {
        return this.verificationHistory;
    }

    async verifyEventManually(eventId, verificationSource, verificationType = 'manual') {
        console.log(`🔧 Manually verifying event ${eventId}...`);

        const verification = {
            source: verificationSource,
            type: verificationType,
            location: 'unknown',
            text: 'Manual verification',
            timestamp: new Date(),
            confidence: 1.0
        };

        // Find the event
        const event = this.findEventById(eventId);
        if (event) {
            await this.verifyEvent(event, verification);
            return true;
        } else {
            console.log(`❌ Event ${eventId} not found`);
            return false;
        }
    }

    findEventById(eventId) {
        // This would typically query your event database
        // For now, return a mock event
        return {
            id: eventId,
            location: 'kuala lumpur',
            type: 'earthquake',
            severity: 0.8,
            timestamp: new Date(),
            verified: false
        };
    }

    getVerificationStats() {
        const verifiedCount = this.verifiedEvents.size;
        const totalVerifications = this.verificationHistory.length;

        const sourceStats = {};
        for (const verification of this.verificationHistory) {
            sourceStats[verification.source] = (sourceStats[verification.source] || 0) + 1;
        }

        return {
            verifiedEvents: verifiedCount,
            totalVerifications: totalVerifications,
            sourceStats: sourceStats,
            lastVerification: this.verificationHistory.length > 0 ?
                this.verificationHistory[this.verificationHistory.length - 1].timestamp : null
        };
    }
}

module.exports = DisasterVerificationSystem;
