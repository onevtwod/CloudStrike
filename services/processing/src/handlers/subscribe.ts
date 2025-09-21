import { SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const sns = new SNSClient({});
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: any) => {
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
        const kind = body?.kind as 'email' | 'sms';
        const value = body?.value as string;
        
        if (!kind || !value) {
            return { statusCode: 400, body: JSON.stringify({ message: 'kind and value required' }) };
        }
        
        const protocol = kind === 'sms' ? 'sms' : 'email';
        
        // Subscribe to SNS
        const snsInput = { TopicArn: process.env.ALERTS_TOPIC_ARN, Protocol: protocol, Endpoint: value };
        await sns.send(new SubscribeCommand(snsInput));
        
        // Store subscriber in DynamoDB
        await storeSubscriber(kind, value);
        
        return { statusCode: 200, body: JSON.stringify({ message: 'Subscription successful' }) };
    } catch (e: any) {
        console.error('Subscription error:', e);
        return { statusCode: 500, body: JSON.stringify({ message: e?.message || 'Error' }) };
    }
};

async function storeSubscriber(kind: 'email' | 'sms', value: string) {
    const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check for existing subscriber
    const existingSubscriber = await findExistingSubscriber(kind === 'email' ? value : null, kind === 'sms' ? value : null);
    
    if (existingSubscriber) {
        // Update existing subscriber
        console.log(`Updating existing subscriber: ${existingSubscriber.id}`);
        await dynamoDb.send(new UpdateCommand({
            TableName: process.env.SUBSCRIBERS_TABLE,
            Key: { id: existingSubscriber.id },
            UpdateExpression: 'SET active = :active, subscribedAt = :subscribedAt',
            ExpressionAttributeValues: {
                ':active': true,
                ':subscribedAt': new Date().toISOString()
            }
        }));
        return existingSubscriber;
    }
    
    // Create new subscriber
    const subscriber = {
        id: subscriberId,
        email: kind === 'email' ? value : null,
        phone: kind === 'sms' ? value : null,
        type: kind,
        preferences: {
            disasterAlerts: true,
            emergencyAlerts: true,
            verifications: true,
            systemStatus: false
        },
        location: 'unknown',
        active: true,
        subscribedAt: new Date().toISOString(),
        lastNotified: null,
        createdAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
    };
    
    await dynamoDb.send(new PutCommand({
        TableName: process.env.SUBSCRIBERS_TABLE,
        Item: subscriber
    }));
    
    console.log(`Subscriber stored: ${subscriberId}`);
    return subscriber;
}

async function findExistingSubscriber(email: string | null, phone: string | null) {
    try {
        const result = await dynamoDb.send(new ScanCommand({
            TableName: process.env.SUBSCRIBERS_TABLE,
            FilterExpression: 'active = :active AND (#email = :email OR #phone = :phone)',
            ExpressionAttributeNames: {
                '#email': 'email',
                '#phone': 'phone'
            },
            ExpressionAttributeValues: {
                ':active': true,
                ':email': email,
                ':phone': phone
            }
        }));
        
        return result.Items && result.Items.length > 0 ? result.Items[0] : null;
    } catch (error) {
        console.error('Error finding existing subscriber:', error);
        return null;
    }
}
