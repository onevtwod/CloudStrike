#!/usr/bin/env node

const { ComprehendClient, DetectEntitiesCommand, DetectSentimentCommand, DetectKeyPhrasesCommand } = require('@aws-sdk/client-comprehend');

class AWSComprehendAnalyzer {
    constructor() {
        this.comprehend = new ComprehendClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy'
            }
        });

        // Disaster-related entity types to look for
        this.disasterEntityTypes = [
            'PERSON', 'LOCATION', 'ORGANIZATION', 'COMMERCIAL_ITEM', 'EVENT'
        ];

        // Disaster keywords for context
        this.disasterContext = [
            'earthquake', 'flood', 'storm', 'fire', 'emergency', 'disaster',
            'gempa', 'banjir', 'ribut', 'kebakaran', 'kecemasan', 'bencana'
        ];
    }

    async analyzePost(post) {
        try {
            console.log(`🔍 Analyzing post with AWS Comprehend: "${post.text.substring(0, 50)}..."`);

            // Detect language first
            const language = this.detectLanguage(post.text);

            // Run multiple Comprehend operations in parallel
            const [entities, sentiment, keyPhrases] = await Promise.all([
                this.detectEntities(post.text, language),
                this.detectSentiment(post.text, language),
                this.detectKeyPhrases(post.text, language)
            ]);

            // Extract location from entities
            const location = this.extractLocationFromEntities(entities);

            // Calculate disaster severity
            const severity = this.calculateDisasterSeverity(entities, sentiment, keyPhrases);

            // Determine if post is disaster-related
            const isDisasterRelated = this.isDisasterRelated(entities, keyPhrases, post.text);

            return {
                ...post,
                location: location || post.location,
                severity: severity,
                entities: entities,
                sentiment: sentiment,
                keyPhrases: keyPhrases,
                isDisasterRelated: isDisasterRelated,
                confidence: this.calculateConfidence(entities, sentiment),
                language: language,
                analyzedAt: new Date()
            };

        } catch (error) {
            console.error('❌ Error analyzing post with Comprehend:', error.message);

            // Fallback to basic analysis
            return {
                ...post,
                severity: this.calculateBasicSeverity(post.text),
                isDisasterRelated: this.containsDisasterKeywords(post.text),
                confidence: 0.5,
                analyzedAt: new Date()
            };
        }
    }

    detectLanguage(text) {
        // Simple language detection for Malaysian context
        const malayWords = ['banjir', 'ribut', 'gempa', 'kebakaran', 'kecemasan', 'bencana', 'malaysia'];
        const hasMalayWords = malayWords.some(word => text.toLowerCase().includes(word));

        return hasMalayWords ? 'ms' : 'en';
    }

    async detectEntities(text, languageCode) {
        try {
            const command = new DetectEntitiesCommand({
                Text: text,
                LanguageCode: languageCode
            });

            const response = await this.comprehend.send(command);
            return response.Entities || [];

        } catch (error) {
            console.error('❌ Error detecting entities:', error.message);
            return [];
        }
    }

    async detectSentiment(text, languageCode) {
        try {
            const command = new DetectSentimentCommand({
                Text: text,
                LanguageCode: languageCode
            });

            const response = await this.comprehend.send(command);
            return {
                sentiment: response.Sentiment,
                confidence: response.SentimentScore
            };

        } catch (error) {
            console.error('❌ Error detecting sentiment:', error.message);
            return {
                sentiment: 'NEUTRAL',
                confidence: { Positive: 0.33, Negative: 0.33, Neutral: 0.34, Mixed: 0 }
            };
        }
    }

    async detectKeyPhrases(text, languageCode) {
        try {
            const command = new DetectKeyPhrasesCommand({
                Text: text,
                LanguageCode: languageCode
            });

            const response = await this.comprehend.send(command);
            return response.KeyPhrases || [];

        } catch (error) {
            console.error('❌ Error detecting key phrases:', error.message);
            return [];
        }
    }

    extractLocationFromEntities(entities) {
        // Look for location entities
        const locationEntities = entities.filter(entity =>
            entity.Type === 'LOCATION' && entity.Score > 0.7
        );

        if (locationEntities.length > 0) {
            // Return the highest confidence location
            const bestLocation = locationEntities.reduce((best, current) =>
                current.Score > best.Score ? current : best
            );

            return bestLocation.Text.toLowerCase();
        }

        return null;
    }

    calculateDisasterSeverity(entities, sentiment, keyPhrases) {
        let severity = 0.3; // Base severity

        // Increase severity based on disaster-related entities
        for (const entity of entities) {
            if (this.isDisasterEntity(entity)) {
                severity += entity.Score * 0.3;
            }
        }

        // Increase severity based on negative sentiment
        if (sentiment.sentiment === 'NEGATIVE') {
            severity += sentiment.confidence.Negative * 0.2;
        }

        // Increase severity based on disaster key phrases
        for (const phrase of keyPhrases) {
            if (this.isDisasterKeyPhrase(phrase.Text)) {
                severity += phrase.Score * 0.2;
            }
        }

        return Math.min(1.0, Math.max(0.1, severity));
    }

    isDisasterEntity(entity) {
        const disasterKeywords = [
            'earthquake', 'flood', 'storm', 'fire', 'emergency', 'disaster',
            'gempa', 'banjir', 'ribut', 'kebakaran', 'kecemasan', 'bencana',
            'evacuation', 'rescue', 'help', 'danger', 'warning', 'alert'
        ];

        return disasterKeywords.some(keyword =>
            entity.Text.toLowerCase().includes(keyword)
        );
    }

    isDisasterKeyPhrase(phrase) {
        const disasterPhrases = [
            'heavy rain', 'strong wind', 'building collapse', 'road closed',
            'emergency services', 'evacuation center', 'flood warning',
            'earthquake felt', 'storm damage', 'fire emergency'
        ];

        return disasterPhrases.some(disasterPhrase =>
            phrase.toLowerCase().includes(disasterPhrase)
        );
    }

    isDisasterRelated(entities, keyPhrases, text) {
        // Check if any entities are disaster-related
        const hasDisasterEntities = entities.some(entity => this.isDisasterEntity(entity));

        // Check if any key phrases are disaster-related
        const hasDisasterPhrases = keyPhrases.some(phrase => this.isDisasterKeyPhrase(phrase.Text));

        // Check if text contains disaster keywords
        const hasDisasterKeywords = this.containsDisasterKeywords(text);

        return hasDisasterEntities || hasDisasterPhrases || hasDisasterKeywords;
    }

    containsDisasterKeywords(text) {
        const disasterKeywords = [
            'earthquake', 'flood', 'storm', 'fire', 'emergency', 'disaster',
            'gempa', 'banjir', 'ribut', 'kebakaran', 'kecemasan', 'bencana',
            'evacuation', 'rescue', 'help', 'danger', 'warning', 'alert',
            'urgent', 'stuck', 'trapped', 'injured', 'damage', 'destroyed'
        ];

        const lowerText = text.toLowerCase();
        return disasterKeywords.some(keyword => lowerText.includes(keyword));
    }

    calculateConfidence(entities, sentiment) {
        // Calculate overall confidence based on entity scores and sentiment confidence
        let confidence = 0.5; // Base confidence

        if (entities.length > 0) {
            const avgEntityScore = entities.reduce((sum, entity) => sum + entity.Score, 0) / entities.length;
            confidence = (confidence + avgEntityScore) / 2;
        }

        if (sentiment.confidence) {
            const maxSentimentConfidence = Math.max(
                sentiment.confidence.Positive || 0,
                sentiment.confidence.Negative || 0,
                sentiment.confidence.Neutral || 0,
                sentiment.confidence.Mixed || 0
            );
            confidence = (confidence + maxSentimentConfidence) / 2;
        }

        return Math.min(1.0, confidence);
    }

    calculateBasicSeverity(text) {
        let severity = 0.3;

        const highSeverityKeywords = ['earthquake', 'gempa', 'tsunami', 'landslide', 'tanah runtuh', 'building collapse', 'runtuh', 'explosion', 'letupan'];
        const mediumSeverityKeywords = ['flood', 'banjir', 'storm', 'ribut', 'heavy rain', 'hujan lebat', 'thunderstorm', 'ribut petir'];
        const lowSeverityKeywords = ['rain', 'hujan', 'cloudy', 'mendung', 'windy', 'berangin'];

        const lowerText = text.toLowerCase();

        for (const keyword of highSeverityKeywords) {
            if (lowerText.includes(keyword)) {
                severity += 0.4;
                break;
            }
        }

        for (const keyword of mediumSeverityKeywords) {
            if (lowerText.includes(keyword)) {
                severity += 0.2;
                break;
            }
        }

        for (const keyword of lowSeverityKeywords) {
            if (lowerText.includes(keyword)) {
                severity += 0.1;
                break;
            }
        }

        return Math.min(1.0, Math.max(0.1, severity));
    }
}

module.exports = AWSComprehendAnalyzer;
