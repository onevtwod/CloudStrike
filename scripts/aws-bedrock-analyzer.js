#!/usr/bin/env node

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

class AWSBedrockAnalyzer {
    constructor() {
        // Use AWS SDK default credential chain (includes OS-configured credentials)
        const config = {
            region: process.env.AWS_REGION || 'us-east-1'
        };

        // Only set explicit credentials if environment variables are provided
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };

            // Add session token if present (for temporary credentials)
            if (process.env.AWS_SESSION_TOKEN) {
                config.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
            }
        }

        this.bedrock = new BedrockRuntimeClient(config);

        // Rate limiting for AWS Bedrock (very conservative)
        this.lastRequestTime = 0;
        this.requestDelay = 2000; // 2 seconds between requests (0.5 requests per second)
        this.maxRetries = 3; // Reduced retries to avoid timeouts
    }

    async analyzePost(post) {
        try {
            console.log(`🔍 Analyzing post with AWS Bedrock: "${post.text.substring(0, 50)}..."`);

            // Detect language first
            const language = this.detectLanguage(post.text);

            // Run comprehensive analysis with Bedrock
            const analysisResult = await this.analyzeWithBedrock(post.text, language);

            return {
                ...post,
                location: analysisResult.location || post.location,
                severity: analysisResult.severity || 0.1,
                entities: analysisResult.entities || [],
                sentiment: analysisResult.sentiment || { sentiment: 'NEUTRAL', confidence: 0.5 },
                keyPhrases: analysisResult.keyPhrases || [],
                isDisasterRelated: analysisResult.isDisaster || false,
                disasterType: analysisResult.disasterType || null,
                confidence: analysisResult.confidence || 0.5,
                reasoning: analysisResult.reasoning || 'No reasoning provided',
                language: language,
                analyzedAt: new Date()
            };

        } catch (error) {
            console.error('❌ Error analyzing post with Bedrock:', error.message);
            console.error('   📝 Post text length:', post.text?.length || 0);
            console.error('   🔍 Error details:', error.code || 'Unknown error');

            // Fallback to basic analysis
            return {
                ...post,
                severity: this.calculateBasicSeverity(post.text),
                isDisasterRelated: this.containsDisasterKeywords(post.text),
                confidence: 0.5,
                analyzedAt: new Date(),
                error: error.message
            };
        }
    }

    async rateLimitRequest() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.requestDelay) {
            const delay = this.requestDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
    }

    async retryRequest(requestFn, maxRetries = null) {
        const retries = maxRetries || this.maxRetries;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await this.rateLimitRequest();

                // Add timeout wrapper to prevent hanging
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout after 20 seconds')), 20000);
                });

                const requestPromise = requestFn();
                return await Promise.race([requestPromise, timeoutPromise]);

            } catch (error) {
                if (error.message.includes('timeout')) {
                    console.error(`❌ Request timeout on attempt ${attempt}/${retries}`);
                    if (attempt === retries) {
                        throw new Error('Request timeout after all retries');
                    }
                    const delay = Math.min(attempt * 3, 10) * 1000;
                    console.log(`   ⏳ Request timeout, retrying in ${delay / 1000}s... (attempt ${attempt}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else if (error.name === 'ThrottlingException' || error.message.includes('throttl') || error.message.includes('rate')) {
                    if (attempt === retries) {
                        console.error(`❌ Max retries (${retries}) exceeded for Bedrock request`);
                        throw error;
                    }
                    const delay = Math.min(attempt * 5, 20) * 1000; // Exponential backoff, max 20s
                    console.log(`   ⏳ AWS Bedrock rate limited, retrying in ${delay / 1000}s... (attempt ${attempt}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    }

    detectLanguage(text) {
        // Simple language detection for Malaysian context
        const malayWords = ['banjir', 'ribut', 'gempa', 'kebakaran', 'kecemasan', 'bencana', 'malaysia'];
        const hasMalayWords = malayWords.some(word => text.toLowerCase().includes(word));

        // Return language code for context
        return hasMalayWords ? 'ms' : 'en';
    }

    async analyzeWithBedrock(text, languageCode) {
        try {
            const prompt = `<|begin_of_text|><|start_header_id|>user<|end_header_id|>

You must respond with ONLY a valid JSON object. No other text allowed.

Analyze this text: "${text}"

Return this exact JSON format:
{
  "isDisaster": false,
  "disasterType": null,
  "severity": 0.1,
  "confidence": 0.9,
  "entities": [],
  "sentiment": {"sentiment": "NEUTRAL", "confidence": 0.5},
  "keyPhrases": [],
  "location": null,
  "reasoning": "This is about normal traffic, not a disaster"
}

CRITICAL: Start your response with { and end with }. No text before or after the JSON.

<|eot_id|><|start_header_id|>assistant<|end_header_id|>`;

            const input = {
                modelId: 'us.meta.llama4-maverick-17b-instruct-v1:0',
                contentType: 'application/json',
                body: JSON.stringify({
                    prompt: prompt,
                    max_gen_len: 1000,
                    temperature: 0.1,
                    top_p: 0.9
                })
            };

            const command = new InvokeModelCommand(input);
            const response = await this.retryRequest(() => this.bedrock.send(command));

            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const analysisText = responseBody.generation.trim();

            console.log('🔍 Raw Bedrock response:', analysisText);

            // Parse the JSON response from Bedrock with better error handling
            let jsonText = analysisText.trim(); // Declare outside try block

            try {
                // Clean the response text - remove markdown code blocks and extra whitespace
                jsonText = jsonText.trim();

                // Remove markdown code blocks (```json ... ``` or ``` ... ```)
                jsonText = jsonText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

                // Look for JSON object in the response - try multiple patterns
                let jsonMatch = jsonText.match(/\{[\s\S]*\}/);

                // If no JSON found, try to find JSON-like content
                if (!jsonMatch) {
                    // Look for any content that starts with { and might be JSON
                    const possibleJson = jsonText.match(/\{.*\}/);
                    if (possibleJson) {
                        jsonMatch = possibleJson;
                        jsonText = possibleJson[0];
                    }
                }

                // If still no JSON found, try to create a safe response based on content
                if (!jsonMatch) {
                    console.warn('⚠️ No JSON found in Bedrock response, creating safe response');
                    console.warn('📝 Raw response:', analysisText);
                    console.warn('📝 Cleaned response:', jsonText);
                    return this.createSafeResponse(text, analysisText);
                }

                // Try to parse the JSON
                const analysis = JSON.parse(jsonText);
                console.log('✅ Successfully parsed Bedrock JSON response');
                console.log('🤖 Bedrock reasoning:', analysis.reasoning);

                return {
                    isDisaster: analysis.isDisaster || false,
                    disasterType: analysis.disasterType || null,
                    severity: analysis.severity || 0.1,
                    confidence: analysis.confidence || 0.5,
                    entities: analysis.entities || [],
                    sentiment: analysis.sentiment || { sentiment: 'NEUTRAL', confidence: 0.5 },
                    keyPhrases: analysis.keyPhrases || [],
                    location: analysis.location || null,
                    reasoning: analysis.reasoning || 'No reasoning provided'
                };
            } catch (parseError) {
                console.warn('⚠️ Failed to parse Bedrock JSON response, using safe response');
                console.warn('📝 Parse error:', parseError.message);
                console.warn('📝 Raw response:', analysisText);
                console.warn('📝 Cleaned response:', jsonText);
                console.warn('📝 Attempted JSON:', jsonText);
                return this.createSafeResponse(text, analysisText);
            }

        } catch (error) {
            console.error('❌ Error analyzing with Bedrock:', error.message);
            console.error('🔍 Error details:', error.code || 'Unknown error');
            console.error('📝 Text length:', text?.length || 0);
            return this.fallbackAnalysis(text);
        }
    }

    createSafeResponse(text, rawResponse) {
        const lowerText = text.toLowerCase();
        const lowerResponse = rawResponse.toLowerCase();

        // If Bedrock explicitly said it's not a disaster, respect that
        if (lowerResponse.includes('not a disaster') ||
            lowerResponse.includes('not describe a disaster') ||
            lowerResponse.includes('not an emergency') ||
            lowerResponse.includes('normal traffic') ||
            lowerResponse.includes('routine activities')) {
            return {
                isDisaster: false,
                disasterType: null,
                severity: 0.1,
                confidence: 0.8,
                entities: [],
                sentiment: { sentiment: 'NEUTRAL', confidence: 0.5 },
                keyPhrases: [],
                location: null,
                reasoning: 'Bedrock indicated this is not a disaster'
            };
        }

        // Check for clear non-disaster contexts
        const nonDisasterContexts = [
            'traffic jam', 'stuck in traffic', 'road closure', 'construction',
            'shopping', 'restaurant', 'movie', 'concert', 'sports',
            'work', 'office', 'meeting', 'conference', 'hangout',
            'finding spots', 'activities', 'normal day', 'food',
            'croissant', 'bakery', 'breakfast', 'lunch', 'dinner',
            'eating', 'drinking', 'coffee', 'tea', 'snack',
            'best', 'delicious', 'tasty', 'flaky', 'dense', 'chewy',
            'butter', 'bread', 'pastry', 'cafe', 'café'
        ];

        if (nonDisasterContexts.some(context => lowerText.includes(context))) {
            return {
                isDisaster: false,
                disasterType: null,
                severity: 0.1,
                confidence: 0.9,
                entities: [],
                sentiment: { sentiment: 'NEUTRAL', confidence: 0.5 },
                keyPhrases: [],
                location: null,
                reasoning: 'Content appears to be about normal activities, not disasters'
            };
        }

        // Only classify as disaster if there are clear disaster indicators
        const clearDisasterKeywords = ['flood', 'earthquake', 'fire', 'storm', 'emergency', 'disaster', 'evacuation', 'rescue'];
        const hasClearDisasterKeywords = clearDisasterKeywords.some(keyword => lowerText.includes(keyword));

        return {
            isDisaster: hasClearDisasterKeywords,
            disasterType: hasClearDisasterKeywords ? 'unknown' : null,
            severity: hasClearDisasterKeywords ? 0.5 : 0.1,
            confidence: 0.4,
            entities: [],
            sentiment: { sentiment: 'NEUTRAL', confidence: 0.5 },
            keyPhrases: [],
            location: null,
            reasoning: 'Safe response - conservative analysis due to parsing issues'
        };
    }

    fallbackAnalysis(text) {
        // Simple fallback analysis when Bedrock fails
        const lowerText = text.toLowerCase();

        // Check for clear non-disaster contexts first
        const nonDisasterContexts = [
            'traffic jam', 'stuck in traffic', 'road closure', 'construction',
            'shopping', 'restaurant', 'movie', 'concert', 'sports',
            'work', 'office', 'meeting', 'conference', 'hangout',
            'food', 'croissant', 'bakery', 'breakfast', 'lunch', 'dinner',
            'eating', 'drinking', 'coffee', 'tea', 'snack',
            'best', 'delicious', 'tasty', 'flaky', 'dense', 'chewy',
            'butter', 'bread', 'pastry', 'cafe', 'café'
        ];

        if (nonDisasterContexts.some(context => lowerText.includes(context))) {
            return {
                isDisaster: false,
                disasterType: null,
                severity: 0.1,
                confidence: 0.9,
                entities: [],
                sentiment: { sentiment: 'NEUTRAL', confidence: 0.5 },
                keyPhrases: [],
                location: null,
                reasoning: 'Fallback analysis - content appears to be normal activities'
            };
        }

        // Basic disaster keyword check for fallback
        const disasterKeywords = ['flood', 'earthquake', 'fire', 'storm', 'emergency', 'disaster', 'evacuation', 'rescue'];
        const hasDisasterKeywords = disasterKeywords.some(keyword => lowerText.includes(keyword));

        // Basic sentiment analysis
        const negativeWords = ['disaster', 'emergency', 'danger', 'flood', 'fire', 'damage'];
        const positiveWords = ['safe', 'rescue', 'help', 'recovery'];
        const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
        const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;

        let sentiment = 'NEUTRAL';
        if (negativeCount > positiveCount) sentiment = 'NEGATIVE';
        else if (positiveCount > negativeCount) sentiment = 'POSITIVE';

        return {
            isDisaster: hasDisasterKeywords,
            disasterType: hasDisasterKeywords ? 'unknown' : null,
            severity: hasDisasterKeywords ? 0.5 : 0.1,
            confidence: 0.3,
            entities: [],
            sentiment: { sentiment, confidence: 0.5 },
            keyPhrases: [],
            location: null,
            reasoning: 'Fallback analysis - Bedrock unavailable'
        };
    }

    // Simple fallback methods for when Bedrock is unavailable
    containsDisasterKeywords(text) {
        const disasterKeywords = ['flood', 'earthquake', 'fire', 'storm', 'emergency', 'disaster', 'evacuation', 'rescue'];
        const lowerText = text.toLowerCase();
        return disasterKeywords.some(keyword => lowerText.includes(keyword));
    }

    calculateBasicSeverity(text) {
        let severity = 0.1;
        const lowerText = text.toLowerCase();

        const highSeverityKeywords = ['earthquake', 'tsunami', 'explosion', 'building collapse'];
        const mediumSeverityKeywords = ['flood', 'fire', 'storm', 'emergency'];
        const lowSeverityKeywords = ['rain', 'wind', 'cloudy'];

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

module.exports = AWSBedrockAnalyzer;
