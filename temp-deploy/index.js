const { SNSClient, SubscribeCommand } = require('@aws-sdk/client-sns');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const sns = new SNSClient({});
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Main handler that routes requests
exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    const path = event.requestContext?.http?.path || event.path;
    const method = event.requestContext?.http?.method || event.httpMethod;
    
    // Normalize the path to remove stage prefix
    const normalizedPath = path.replace(/^\/[^\/]+/, '') || path;
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: ''
        };
    }
    
    // Route to appropriate handler
    if ((normalizedPath === '/subscribe' || path === '/subscribe') && method === 'POST') {
        return await handleSubscribe(event);
    }
    
    if ((normalizedPath === '/events' || path === '/events') && method === 'GET') {
        return await handleGetEvents(event);
    }
    
    // Default response
    return {
        statusCode: 404,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Not Found' })
    };
};

// Subscribe handler
async function handleSubscribe(event) {
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
        const kind = body?.kind;
        const value = body?.value;
        
        console.log('Subscribe request:', { kind, value });
        
        if (!kind || !value) {
            return { 
                statusCode: 400, 
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'kind and value required' }) 
            };
        }
        
        const protocol = kind === 'sms' ? 'sms' : 'email';
        
        try {
            // Subscribe to SNS
            const snsInput = { TopicArn: process.env.ALERTS_TOPIC_ARN, Protocol: protocol, Endpoint: value };
            await sns.send(new SubscribeCommand(snsInput));
            console.log('SNS subscription successful');
        } catch (snsError) {
            console.error('SNS subscription failed:', snsError);
            // Continue with DynamoDB storage even if SNS fails
        }
        
        try {
            // Store subscriber in DynamoDB
            const result = await storeSubscriber(kind, value);
            console.log('DynamoDB storage successful:', result?.id);
        } catch (dbError) {
            console.error('DynamoDB storage failed:', dbError);
            return { 
                statusCode: 500, 
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Subscription failed - database error' }) 
            };
        }
        
        return { 
            statusCode: 200, 
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Subscription successful' }) 
        };
    } catch (e) {
        console.error('Subscription error:', e);
        return { 
            statusCode: 500, 
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: e?.message || 'Error' }) 
        };
    }
}

// Get events handler (existing functionality)
async function handleGetEvents(event) {
    try {
        const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
        
        // Fetch ALL events (no filtering by verified status)
        const s = await ddb.send(new ScanCommand({
            TableName: process.env.EVENTS_TABLE
        }));
        
        // Transform the data to match frontend expectations
        const transformedItems = (s.Items || []).map(item => ({
            id: item.id,
            text: item.description || item.text,
            location: item.location,
            eventType: item.type || item.eventType,
            createdAt: item.timestamp || item.createdAt
        }));
        
        return { 
            statusCode: 200, 
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(transformedItems) 
        };
    } catch (error) {
        console.error('Error fetching events:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Internal server error' })
        };
    }
}

// Store subscriber function
async function storeSubscriber(kind, value) {
    console.log('storeSubscriber called with:', { kind, value, table: process.env.SUBSCRIBERS_TABLE });
    
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
    
    console.log('Creating new subscriber:', subscriber);
    
    await dynamoDb.send(new PutCommand({
        TableName: process.env.SUBSCRIBERS_TABLE,
        Item: subscriber
    }));
    
    console.log(`Subscriber stored: ${subscriberId}`);
    return subscriber;
}

// Find existing subscriber function
async function findExistingSubscriber(email, phone) {
    try {
        let filterExpression = 'active = :active';
        let expressionAttributeValues = {
            ':active': true
        };
        let expressionAttributeNames = {};
        
        if (email) {
            filterExpression += ' AND #email = :email';
            expressionAttributeNames['#email'] = 'email';
            expressionAttributeValues[':email'] = email;
        }
        
        if (phone) {
            if (email) {
                filterExpression += ' OR (#phone = :phone AND active = :active)';
            } else {
                filterExpression += ' AND #phone = :phone';
            }
            expressionAttributeNames['#phone'] = 'phone';
            expressionAttributeValues[':phone'] = phone;
        }
        
        console.log('findExistingSubscriber query:', { filterExpression, expressionAttributeValues });
        
        const result = await dynamoDb.send(new ScanCommand({
            TableName: process.env.SUBSCRIBERS_TABLE,
            FilterExpression: filterExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        }));
        
        console.log('findExistingSubscriber result:', result.Items?.length || 0, 'items found');
        return result.Items && result.Items.length > 0 ? result.Items[0] : null;
    } catch (error) {
        console.error('Error finding existing subscriber:', error);
        return null;
    }
}