import { ComprehendClient, DetectEntitiesCommand } from '@aws-sdk/client-comprehend';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { generateId, fetchMeteorologicalSignal, DisasterEvent } from '@shared/utils';

const comprehend = new ComprehendClient({});
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

        // Detect language and entities using Comprehend
        const detectedLang = detectLanguage(text);
        const comprehendRes = await comprehend.send(new DetectEntitiesCommand({
            LanguageCode: detectedLang as any, // AWS SDK type issue with Malay language code
            Text: text
        }));

        const entities = comprehendRes.Entities ?? [];
        const location = entities.find(e => e.Type === 'LOCATION')?.Text;
        const eventType = entities.find(e => e.Type === 'EVENT')?.Text ?? 'disaster';

        // Cross-validate with meteorological data
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
