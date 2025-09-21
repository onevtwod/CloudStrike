import { handler } from '../handlers/processTweet';
import { ComprehendClient, DetectEntitiesCommand } from '@aws-sdk/client-comprehend';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-comprehend', () => ({
    ComprehendClient: jest.fn(() => ({
        send: jest.fn()
    })),
    DetectEntitiesCommand: jest.fn()
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: jest.fn(() => ({
            send: jest.fn()
        }))
    },
    PutCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-sns', () => ({
    SNSClient: jest.fn(() => ({
        send: jest.fn()
    })),
    PublishCommand: jest.fn()
}));

jest.mock('@shared/utils', () => ({
    generateId: jest.fn(() => 'test-id-123'),
    fetchMeteorologicalSignal: jest.fn(() => Promise.resolve({ severity: 0.7, source: 'test' }))
}));

describe('processTweet handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.EVENTS_TABLE = 'test-table';
        process.env.ALERTS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-topic';
    });

    it('should process tweet successfully and send alert when verified', async () => {
        const mockEvent = {
            body: JSON.stringify({
                text: 'Flood warning in downtown area, roads blocked'
            })
        };

        const mockComprehendResponse = {
            Entities: [
                { Type: 'LOCATION', Text: 'downtown area' },
                { Type: 'EVENT', Text: 'Flood warning' }
            ]
        };

        const mockComprehendSend = jest.fn().mockResolvedValue(mockComprehendResponse);
        const mockDynamoSend = jest.fn().mockResolvedValue({});
        const mockSNSSend = jest.fn().mockResolvedValue({});

        (ComprehendClient as jest.Mock).mockImplementation(() => ({
            send: mockComprehendSend
        }));
        (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
            send: mockDynamoSend
        });
        (SNSClient as jest.Mock).mockImplementation(() => ({
            send: mockSNSSend
        }));

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(202);
        expect(JSON.parse(result.body)).toEqual({
            id: 'test-id-123',
            verified: 1
        });

        // Verify Comprehend was called
        expect(mockComprehendSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({
                    LanguageCode: 'en',
                    Text: 'Flood warning in downtown area, roads blocked'
                })
            })
        );

        // Verify DynamoDB put was called
        expect(mockDynamoSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({
                    TableName: 'test-table',
                    Item: expect.objectContaining({
                        id: 'test-id-123',
                        text: 'Flood warning in downtown area, roads blocked',
                        location: 'downtown area',
                        eventType: 'Flood warning',
                        verified: 1
                    })
                })
            })
        );

        // Verify SNS publish was called
        expect(mockSNSSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({
                    TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
                    Message: expect.stringContaining('Flood warning')
                })
            })
        );
    });

    it('should not send alert when severity is low', async () => {
        const { fetchMeteorologicalSignal } = require('@shared/utils');
        fetchMeteorologicalSignal.mockResolvedValueOnce({ severity: 0.3, source: 'test' });

        const mockEvent = {
            body: JSON.stringify({
                text: 'Light rain in the area'
            })
        };

        const mockComprehendResponse = {
            Entities: [
                { Type: 'LOCATION', Text: 'the area' }
            ]
        };

        const mockComprehendSend = jest.fn().mockResolvedValue(mockComprehendResponse);
        const mockDynamoSend = jest.fn().mockResolvedValue({});

        (ComprehendClient as jest.Mock).mockImplementation(() => ({
            send: mockComprehendSend
        }));
        (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
            send: mockDynamoSend
        });

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(202);
        expect(JSON.parse(result.body).verified).toBe(0);

        // Verify SNS was not called
        const mockSNSSend = jest.fn();
        (SNSClient as jest.Mock).mockImplementation(() => ({
            send: mockSNSSend
        }));
        expect(mockSNSSend).not.toHaveBeenCalled();
    });

    it('should return 400 for missing text', async () => {
        const mockEvent = {
            body: JSON.stringify({})
        };

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            message: 'text is required'
        });
    });

    it('should handle string body parsing', async () => {
        const mockEvent = {
            body: '{"text": "Test disaster"}'
        };

        const mockComprehendResponse = { Entities: [] };
        const mockComprehendSend = jest.fn().mockResolvedValue(mockComprehendResponse);
        const mockDynamoSend = jest.fn().mockResolvedValue({});

        (ComprehendClient as jest.Mock).mockImplementation(() => ({
            send: mockComprehendSend
        }));
        (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
            send: mockDynamoSend
        });

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(202);
    });
});
