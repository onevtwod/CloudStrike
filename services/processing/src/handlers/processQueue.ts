import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ComprehendClient, DetectEntitiesCommand, DetectSentimentCommand } from '@aws-sdk/client-comprehend';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));
const comprehend = new ComprehendClient({ region: process.env.AWS_REGION || 'us-east-1' });
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

    // Analyze text with Amazon Comprehend
    const [entitiesResult, sentimentResult] = await Promise.all([
        analyzeEntities(message.text),
        analyzeSentiment(message.text)
    ]);

    // Calculate disaster score
    const disasterScore = calculateDisasterScore(message, entitiesResult, sentimentResult);

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
        entities: entitiesResult.Entities?.map(entity => ({
            text: entity.Text || '',
            type: entity.Type || '',
            confidence: entity.Score || 0
        })) || [],
        sentiment: {
            sentiment: sentimentResult.Sentiment || 'NEUTRAL',
            confidence: sentimentResult.SentimentScore?.[sentimentResult.Sentiment as keyof typeof sentimentResult.SentimentScore] || 0
        },
        disasterScore,
        verified,
        processedAt: new Date().toISOString()
    };
}

async function analyzeEntities(text: string) {
    const command = new DetectEntitiesCommand({
        Text: text,
        LanguageCode: 'en'
    });

    return await comprehend.send(command);
}

async function analyzeSentiment(text: string) {
    const command = new DetectSentimentCommand({
        Text: text,
        LanguageCode: 'en'
    });

    return await comprehend.send(command);
}

function calculateDisasterScore(message: QueueMessage, entities: any, sentiment: any): number {
    let score = 0;

    // Base score from sentiment (negative sentiment increases disaster likelihood)
    if (sentiment.Sentiment === 'NEGATIVE') {
        score += 0.3;
    } else if (sentiment.Sentiment === 'POSITIVE') {
        score -= 0.1;
    }

    // Score from entities
    const disasterEntities = ['PERSON', 'LOCATION', 'ORGANIZATION', 'EVENT'];
    const disasterEntityCount = entities.Entities?.filter((entity: any) =>
        disasterEntities.includes(entity.Type) && (entity.Score || 0) > 0.8
    ).length || 0;

    score += disasterEntityCount * 0.1;

    // Score from hashtags and mentions
    if (message.hashtags?.length) {
        const disasterHashtags = message.hashtags.filter(tag =>
            hasDisasterKeywords(tag.toLowerCase())
        ).length;
        score += disasterHashtags * 0.2;
    }

    // Score from engagement (high engagement might indicate important events)
    if (message.engagement) {
        const totalEngagement = (message.engagement.likes || 0) +
            (message.engagement.shares || 0) +
            (message.engagement.comments || 0);

        if (totalEngagement > 100) {
            score += 0.2;
        } else if (totalEngagement > 10) {
            score += 0.1;
        }
    }

    // Score from text content
    if (hasDisasterKeywords(message.text)) {
        score += 0.4;
    }

    return Math.min(score, 1.0);
}

function hasDisasterKeywords(text: string): boolean {
    const disasterKeywords = [
        'flood', 'flooding', 'storm', 'earthquake', 'fire', 'landslide',
        'emergency', 'disaster', 'evacuation', 'rescue', 'damage',
        'hurricane', 'tornado', 'tsunami', 'wildfire', 'avalanche',
        'banjir', 'ribut', 'gempa bumi', 'kebakaran', 'tanah runtuh',
        'kecemasan', 'bencana', 'evakuasi', 'penyelamatan'
    ];

    const lowerText = text.toLowerCase();
    return disasterKeywords.some(keyword => lowerText.includes(keyword));
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
