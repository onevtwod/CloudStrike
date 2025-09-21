import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface QueueMessage {
    id: string;
    platform: string;
    text: string;
    author: string;
    createdAt: string;
    url: string;
    location?: string;
    hashtags?: string[];
    mentions?: string[];
    mediaUrls?: string[];
    engagement?: {
        likes: number;
        shares: number;
        comments: number;
    };
    queuedAt: string;
}

interface ProcessedEvent {
    id: string;
    originalText: string;
    processedText: string;
    platform: string;
    author: string;
    createdAt: string;
    url: string;
    location?: string;
    entities: Array<{
        text: string;
        type: string;
        confidence: number;
    }>;
    sentiment: {
        sentiment: string;
        confidence: number;
    };
    disasterScore: number;
    verified: boolean;
    processedAt: string;
}

export const handler = async (event: any): Promise<{ processed: number; errors: number }> => {
    console.log('Starting queue processing');

    let processed = 0;
    let errors = 0;

    try {
        // Process messages from the main queue
        const mainQueueUrl = process.env.SOCIAL_MEDIA_QUEUE_URL;
        if (mainQueueUrl) {
            const result = await processQueue(mainQueueUrl, 'main');
            processed += result.processed;
            errors += result.errors;
        }

        // Process messages from the high priority queue
        const priorityQueueUrl = process.env.PRIORITY_QUEUE_URL;
        if (priorityQueueUrl) {
            const result = await processQueue(priorityQueueUrl, 'priority');
            processed += result.processed;
            errors += result.errors;
        }

        console.log(`Queue processing completed: ${processed} processed, ${errors} errors`);
        return { processed, errors };

    } catch (error) {
        console.error('Error in queue processing:', error);
        throw error;
    }
};

async function processQueue(queueUrl: string, queueType: string): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
        // Receive messages from SQS
        const receiveCommand = new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
            MessageAttributeNames: ['All']
        });

        const response = await sqs.send(receiveCommand);
        const messages = response.Messages || [];

        console.log(`Processing ${messages.length} messages from ${queueType} queue`);

        for (const message of messages) {
            try {
                if (!message.Body) continue;

                const queueMessage: QueueMessage = JSON.parse(message.Body);

                // Check for duplicates before processing
                const isDuplicate = await checkForDuplicate(queueMessage.author, queueMessage.text);
                if (isDuplicate) {
                    console.log(`Skipping duplicate post from ${queueMessage.author}: "${queueMessage.text.substring(0, 50)}..."`);

                    // Delete message from queue even if it's a duplicate
                    await deleteMessage(queueUrl, message.ReceiptHandle!);
                    continue;
                }

                const processedEvent = await processSocialMediaPost(queueMessage);

                // Store processed event in DynamoDB
                await storeProcessedEvent(processedEvent);

                // If it's a verified disaster event, send alerts
                if (processedEvent.verified && processedEvent.disasterScore > 0.7) {
                    await sendDisasterAlert(processedEvent);
                }

                // Delete message from queue
                await deleteMessage(queueUrl, message.ReceiptHandle!);

                processed++;
                console.log(`Processed message ${queueMessage.id} from ${queueType} queue`);

            } catch (error) {
                console.error(`Error processing message:`, error);
                errors++;

                // Send to dead letter queue if max retries exceeded
                if (message.Attributes?.ApproximateReceiveCount && parseInt(message.Attributes.ApproximateReceiveCount) >= 3) {
                    await sendToDeadLetterQueue(queueUrl, message);
                    await deleteMessage(queueUrl, message.ReceiptHandle!);
                }
            }
        }

    } catch (error) {
        console.error(`Error processing ${queueType} queue:`, error);
        errors++;
    }

    return { processed, errors };
}

async function processSocialMediaPost(message: QueueMessage): Promise<ProcessedEvent> {
    console.log(`Processing social media post: ${message.id}`);

    // Analyze text with Amazon Bedrock
    const analysisResult = await analyzeWithBedrock(message.text);

    // Calculate disaster score
    const disasterScore = calculateDisasterScore(message, analysisResult);

    // Determine if event should be verified
    const verified = disasterScore > 0.6 && hasDisasterKeywords(message.text);

    return {
        id: `event_${message.id}_${Date.now()}`,
        originalText: message.text,
        processedText: message.text, // Could be enhanced with translation
        platform: message.platform,
        author: message.author,
        createdAt: message.createdAt,
        url: message.url,
        location: message.location,
        entities: analysisResult.entities?.map(entity => ({
            text: entity.text || '',
            type: entity.type || '',
            confidence: entity.confidence || 0
        })) || [],
        sentiment: {
            sentiment: analysisResult.sentiment?.sentiment || 'NEUTRAL',
            confidence: analysisResult.sentiment?.confidence || 0
        },
        disasterScore,
        verified,
        processedAt: new Date().toISOString()
    };
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

function calculateDisasterScore(message: QueueMessage, analysis: any): number {
    // Use Bedrock's intelligent analysis directly
    if (analysis.isDisaster) {
        return analysis.severity || 0.5;
    }

    // If not a disaster, return very low score
    return 0.1;
}

function hasDisasterKeywords(text: string): boolean {
    const disasterKeywords = [
        'flood', 'flooding', 'storm', 'earthquake', 'fire', 'landslide',
        'emergency', 'disaster', 'evacuation', 'rescue', 'damage',
        'hurricane', 'tornado', 'tsunami', 'wildfire', 'avalanche',
        'banjir', 'ribut', 'gempa bumi', 'kebakaran', 'tanah runtuh',
        'kecemasan', 'bencana', 'evakuasi', 'penyelamatan'
    ];

    // More specific disaster phrases to avoid false positives
    const disasterPhrases = [
        'stuck in flood', 'stuck in fire', 'stuck in building', 'stuck in rubble',
        'trapped in', 'injured in', 'damage from', 'destroyed by',
        'emergency evacuation', 'disaster relief', 'rescue operation'
    ];

    const lowerText = text.toLowerCase();

    // Check for specific disaster phrases first
    const hasDisasterPhrases = disasterPhrases.some(phrase => lowerText.includes(phrase));
    if (hasDisasterPhrases) return true;

    // Check for individual keywords but exclude common words that cause false positives
    const hasDisasterKeywords = disasterKeywords.some(keyword => lowerText.includes(keyword));

    // Additional context check - if it's about traffic, food, or other non-disaster contexts, don't consider it a disaster
    const nonDisasterContexts = [
        'traffic', 'jam', 'road', 'food', 'croissant', 'bakery', 'breakfast',
        'lunch', 'dinner', 'eating', 'drinking', 'coffee', 'tea', 'snack',
        'best', 'delicious', 'tasty', 'flaky', 'dense', 'chewy', 'butter',
        'bread', 'pastry', 'cafe', 'café', 'restaurant', 'shopping'
    ];

    if (nonDisasterContexts.some(context => lowerText.includes(context))) {
        return false;
    }

    return hasDisasterKeywords;
}

async function checkForDuplicate(author: string, text: string): Promise<boolean> {
    try {
        // Create a hash of author + text for efficient duplicate detection
        const duplicateKey = `${author}:${text}`;

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

        const result = await dynamoDb.send(command);
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

        const fallbackResult = await dynamoDb.send(fallbackCommand);
        return (fallbackResult.Items && fallbackResult.Items.length > 0);
    }
}

async function storeProcessedEvent(event: ProcessedEvent): Promise<void> {
    const command = new PutCommand({
        TableName: process.env.EVENTS_TABLE,
        Item: {
            ...event,
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
        }
    });

    await dynamoDb.send(command);
}

async function sendDisasterAlert(event: ProcessedEvent): Promise<void> {
    const alertMessage = {
        eventId: event.id,
        platform: event.platform,
        text: event.processedText,
        author: event.author,
        location: event.location,
        disasterScore: event.disasterScore,
        url: event.url,
        processedAt: event.processedAt,
        verified: event.verified
    };

    const command = new PublishCommand({
        TopicArn: process.env.ALERTS_TOPIC_ARN,
        Message: JSON.stringify(alertMessage),
        Subject: `Disaster Alert: ${event.platform.toUpperCase()} - ${event.location || 'Unknown Location'}`,
        MessageAttributes: {
            platform: {
                DataType: 'String',
                StringValue: event.platform
            },
            severity: {
                DataType: 'String',
                StringValue: event.disasterScore > 0.8 ? 'HIGH' : 'MEDIUM'
            },
            verified: {
                DataType: 'String',
                StringValue: event.verified.toString()
            }
        }
    });

    await sns.send(command);
    console.log(`Disaster alert sent for event: ${event.id}`);
}

async function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle
    });

    await sqs.send(command);
}

async function sendToDeadLetterQueue(originalQueueUrl: string, message: any): Promise<void> {
    const deadLetterQueueUrl = process.env.DEAD_LETTER_QUEUE_URL;
    if (!deadLetterQueueUrl) {
        console.warn('Dead letter queue not configured, message will be lost');
        return;
    }

    const command = new SendMessageCommand({
        QueueUrl: deadLetterQueueUrl,
        MessageBody: message.Body,
        MessageAttributes: {
            originalQueue: {
                DataType: 'String',
                StringValue: originalQueueUrl
            },
            failureReason: {
                DataType: 'String',
                StringValue: 'Max retries exceeded'
            },
            failedAt: {
                DataType: 'String',
                StringValue: new Date().toISOString()
            }
        }
    });

    await sqs.send(command);
    console.log(`Message sent to dead letter queue: ${message.MessageId}`);
}
