import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async () => {
    try {
        const q = await ddb.send(new QueryCommand({
            TableName: process.env.EVENTS_TABLE,
            IndexName: 'verified-index',
            KeyConditionExpression: '#v = :v',
            ExpressionAttributeNames: { '#v': 'verified' },
            ExpressionAttributeValues: { ':v': 1 }
        }));
        return { statusCode: 200, body: JSON.stringify(q.Items ?? []) };
    } catch {
        const s = await ddb.send(new ScanCommand({
            TableName: process.env.EVENTS_TABLE,
            FilterExpression: '#v = :v',
            ExpressionAttributeNames: { '#v': 'verified' },
            ExpressionAttributeValues: { ':v': 1 }
        }));
        return { statusCode: 200, body: JSON.stringify(s.Items ?? []) };
    }
};
