import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { generateId, fetchMeteorologicalSignal, DisasterEvent } from '@shared/utils';

const bedrock = new BedrockRuntimeClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});

interface IngestRequest {
    text: string;
    source?: string;
    author?: string;
    timestamp?: string;
    location?: { lat: number; lng: number };
}

export const handler = async (event: any) => {
    try {
        // Parse request body
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
        const request: IngestRequest = body;

        // Validate input
        const validation = validateIngestRequest(request);
        if (validation.errors.length > 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Validation failed',
                    errors: validation.errors
                })
            };
        }

        // Extract text and clean it
        const text = request.text.trim();

        // Check for duplicates before processing
        const isDuplicate = await checkForDuplicate(request.author || 'unknown', text);
        if (isDuplicate) {
            console.log(`Skipping duplicate post from ${request.author}: "${text.substring(0, 50)}..."`);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Duplicate post detected and skipped',
                    duplicate: true
                })
            };
        }

        // Detect language and analyze with Bedrock
        const detectedLang = detectLanguage(text);
        const analysisResult = await analyzeWithBedrock(text);

        // Check if Bedrock determined this is actually a disaster
        if (!analysisResult.isDisaster) {
            console.log('Post not disaster-related according to Bedrock analysis, skipping');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Post not disaster-related',
                    isDisaster: false,
                    reasoning: analysisResult.reasoning
                })
            };
        }

        const entities = analysisResult.entities ?? [];
        const location = entities.find(e => e.type === 'LOCATION')?.text;
        const eventType = entities.find(e => e.type === 'EVENT')?.text ?? 'disaster';

        // Cross-validate with meteorological data only if Bedrock identified it as a disaster
        const met = await fetchMeteorologicalSignal(request.location);
        const verified = met.severity > 0.5 ? 1 : 0;

        // Create disaster event record
        const item: DisasterEvent = {
            id: generateId(),
            text,
            location,
            coordinates: request.location,
            eventType,
            verified,
            createdAt: request.timestamp || new Date().toISOString(),
        };

        // Store in DynamoDB
        await ddb.send(new PutCommand({
            TableName: process.env.EVENTS_TABLE,
            Item: item
        }));

        // Send alert if verified
        if (verified && process.env.ALERTS_TOPIC_ARN) {
            await sns.send(new PublishCommand({
                TopicArn: process.env.ALERTS_TOPIC_ARN,
                Message: JSON.stringify({
                    type: eventType,
                    text,
                    location,
                    coordinates: request.location,
                    source: request.source || 'unknown',
                    author: request.author,
                    timestamp: item.createdAt,
                    severity: met.severity,
                    meteoSource: met.source
                })
            }));
        }

        // Return success response
        return {
            statusCode: 202,
            body: JSON.stringify({
                id: item.id,
                verified,
                severity: met.severity,
                source: met.source,
                location: item.location,
                eventType: item.eventType,
                message: verified ? 'Event verified and alert sent' : 'Event processed and stored'
            })
        };

    } catch (error) {
        console.error('Error processing tweet:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            })
        };
    }
};

function validateIngestRequest(request: IngestRequest): { errors: string[] } {
    const errors: string[] = [];

    if (!request.text || typeof request.text !== 'string') {
        errors.push('Text is required and must be a string');
    } else if (request.text.trim().length === 0) {
        errors.push('Text cannot be empty');
    } else if (request.text.length > 1000) {
        errors.push('Text must be less than 1000 characters');
    }

    if (request.location) {
        if (typeof request.location.lat !== 'number' || typeof request.location.lng !== 'number') {
            errors.push('Location coordinates must be numbers');
        } else if (request.location.lat < -90 || request.location.lat > 90) {
            errors.push('Latitude must be between -90 and 90');
        } else if (request.location.lng < -180 || request.location.lng > 180) {
            errors.push('Longitude must be between -180 and 180');
        }
    }

    if (request.source && typeof request.source !== 'string') {
        errors.push('Source must be a string');
    }

    if (request.author && typeof request.author !== 'string') {
        errors.push('Author must be a string');
    }

    if (request.timestamp && !isValidISODate(request.timestamp)) {
        errors.push('Timestamp must be a valid ISO 8601 date string');
    }

    return { errors };
}

function detectLanguage(text: string): string {
    // Simple language detection based on common Malay words
    const malayWords = ['banjir', 'ribut', 'gempa', 'bencana', 'kecemasan', 'kebakaran', 'tanah runtuh'];
    const lowerText = text.toLowerCase();

    return malayWords.some(word => lowerText.includes(word)) ? 'ms' : 'en';
}

function isValidISODate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString();
}

async function analyzeWithBedrock(text: string) {
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
        const response = await bedrock.send(command);

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
                return createSafeResponse(text, analysisText);
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
            return createSafeResponse(text, analysisText);
        }

    } catch (error) {
        console.error('❌ Error analyzing with Bedrock:', error.message);
        return fallbackAnalysis(text);
    }
}

function createSafeResponse(text: string, rawResponse: string) {
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

function fallbackAnalysis(text: string) {
    // Fallback analysis when Bedrock fails
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

    const entities = extractBasicEntities(text);
    const sentiment = analyzeBasicSentiment(text);
    const keyPhrases = extractBasicKeyPhrases(text);
    const disasterKeywords = extractDisasterKeywords(text);

    return {
        isDisaster: disasterKeywords.length > 0,
        disasterType: disasterKeywords.length > 0 ? 'unknown' : null,
        severity: disasterKeywords.length > 0 ? 0.5 : 0.1,
        confidence: 0.3,
        entities,
        sentiment,
        keyPhrases,
        location: null,
        reasoning: 'Fallback analysis - Bedrock unavailable'
    };
}

function extractBasicEntities(text: string) {
    const entities = [];
    const words = text.split(/\s+/);

    // Simple entity extraction based on patterns
    words.forEach((word) => {
        const cleanWord = word.replace(/[^\w]/g, '');

        // Location patterns
        if (cleanWord.length > 3 && /^[A-Z]/.test(cleanWord)) {
            entities.push({
                text: cleanWord,
                type: 'LOCATION',
                confidence: 0.6
            });
        }

        // Event patterns
        if (isDisasterKeyword(cleanWord)) {
            entities.push({
                text: cleanWord,
                type: 'EVENT',
                confidence: 0.8
            });
        }
    });

    return entities;
}

function analyzeBasicSentiment(text: string) {
    const negativeWords = ['disaster', 'emergency', 'danger', 'flood', 'fire', 'damage', 'injured', 'stuck', 'trapped'];
    const positiveWords = ['safe', 'rescue', 'help', 'recovery', 'saved'];

    const lowerText = text.toLowerCase();
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;

    if (negativeCount > positiveCount) {
        return { sentiment: 'NEGATIVE', confidence: Math.min(0.9, 0.5 + (negativeCount * 0.1)) };
    } else if (positiveCount > negativeCount) {
        return { sentiment: 'POSITIVE', confidence: Math.min(0.9, 0.5 + (positiveCount * 0.1)) };
    } else {
        return { sentiment: 'NEUTRAL', confidence: 0.5 };
    }
}

function extractBasicKeyPhrases(text: string) {
    const phrases = [];
    const sentences = text.split(/[.!?]+/);

    sentences.forEach(sentence => {
        if (sentence.trim().length > 10) {
            const disasterKeywords = ['earthquake', 'flood', 'storm', 'fire', 'emergency', 'disaster'].filter(keyword =>
                sentence.toLowerCase().includes(keyword)
            );

            if (disasterKeywords.length > 0) {
                phrases.push({
                    text: sentence.trim(),
                    confidence: 0.7
                });
            }
        }
    });

    return phrases;
}

function extractDisasterKeywords(text: string) {
    const disasterKeywords = [
        'earthquake', 'flood', 'storm', 'fire', 'emergency', 'disaster',
        'gempa', 'banjir', 'ribut', 'kebakaran', 'kecemasan', 'bencana'
    ];
    const lowerText = text.toLowerCase();
    return disasterKeywords.filter(keyword => lowerText.includes(keyword));
}

function isDisasterKeyword(word: string) {
    const disasterKeywords = [
        'earthquake', 'flood', 'storm', 'fire', 'emergency', 'disaster',
        'gempa', 'banjir', 'ribut', 'kebakaran', 'kecemasan', 'bencana',
        'evacuation', 'rescue', 'help', 'danger', 'warning', 'alert'
    ];
    return disasterKeywords.some(keyword => word.toLowerCase().includes(keyword));
}

async function checkForDuplicate(author: string, text: string): Promise<boolean> {
    try {
        // Query DynamoDB for existing posts with same author and text
        const command = new QueryCommand({
            TableName: process.env.EVENTS_TABLE,
            IndexName: 'AuthorTextIndex', // We'll need to create this GSI
            KeyConditionExpression: 'author = :author AND text = :text',
            ExpressionAttributeValues: {
                ':author': author,
                ':text': text
            },
            Limit: 1
        });

        const result = await ddb.send(command);
        return (result.Items && result.Items.length > 0);

    } catch (error) {
        // If the GSI doesn't exist or there's an error, fall back to a simple text-based check
        console.warn('Error checking for duplicates, using fallback method:', error);

        // Fallback: Check if we've seen this exact text recently (last 24 hours)
        const recentTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const fallbackCommand = new QueryCommand({
            TableName: process.env.EVENTS_TABLE,
            FilterExpression: 'author = :author AND text = :text AND createdAt > :recentTime',
            ExpressionAttributeValues: {
                ':author': author,
                ':text': text,
                ':recentTime': recentTime
            },
            Limit: 1
        });

        const fallbackResult = await ddb.send(fallbackCommand);
        return (fallbackResult.Items && fallbackResult.Items.length > 0);
    }
}
