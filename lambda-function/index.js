// Import AWS SDK v3 clients
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: 'us-east-1' });
const ddbDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    const path = event.path || event.rawPath || '';
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
    
    console.log(`Processing ${method} ${path}`);
    
    try {
        if (path.includes('/events')) {
            // Query DynamoDB for events
            const scanCommand = new ScanCommand({
                TableName: 'disaster-events',
                Limit: 50 // Limit to 50 most recent events
            });
            
            const response = await ddbDocClient.send(scanCommand);
            console.log('DynamoDB response:', JSON.stringify(response, null, 2));
            
            // Transform DynamoDB items to frontend format
            const events = response.Items.map(item => ({
                id: item.id,
                text: item.description || 'No description available',
                location: item.location || 'Unknown',
                eventType: item.type || 'disaster',
                createdAt: item.timestamp || item.createdAt,
                severity: getSeverityString(item.severity),
                source: item.source || 'Unknown',
                author: item.author,
                verified: item.verified || false,
                confidence: item.confidence || 0,
                entities: item.entities || [],
                keyPhrases: item.keyPhrases || [],
                sentiment: item.sentiment
            }));
            
            // Sort by timestamp (most recent first)
            events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            console.log(`Returning ${events.length} events`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(events)
            };
        }
        
        if (path.includes('/ingest/twitter')) {
            if (method === 'POST') {
                const body = JSON.parse(event.body || '{}');
                console.log('Received tweet data:', body);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        message: 'Tweet data ingested successfully',
                        data: body,
                        timestamp: new Date().toISOString()
                    })
                };
            }
        }
        
        if (path.includes('/subscribe')) {
            if (method === 'POST') {
                const body = JSON.parse(event.body || '{}');
                console.log('Subscription request:', body);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        message: 'Subscription successful',
                        email: body.email,
                        timestamp: new Date().toISOString()
                    })
                };
            }
        }
        
        // Default response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'CloudStrike API is working!',
                timestamp: new Date().toISOString(),
                path: path,
                method: method,
                status: 'success'
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

// Helper function to convert numeric severity to string
function getSeverityString(severityNum) {
    if (typeof severityNum === 'string') return severityNum;
    
    const severity = Number(severityNum);
    if (severity <= 1) return 'low';
    if (severity <= 2) return 'moderate';
    if (severity <= 3) return 'high';
    return 'critical';
}