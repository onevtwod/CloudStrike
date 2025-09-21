import { handler } from '../handlers/subscribe';
import { SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';

// Mock AWS SDK
jest.mock('@aws-sdk/client-sns');

const mockSNS = SNSClient as jest.MockedClass<typeof SNSClient>;

describe('subscribe handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ALERTS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-topic';
    });

    it('should subscribe email successfully', async () => {
        const mockEvent = {
            body: JSON.stringify({
                kind: 'email',
                value: 'test@example.com'
            })
        };

        mockSNS.prototype.send = jest.fn().mockResolvedValue({});

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Subscription requested'
        });

        expect(mockSNS.prototype.send).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({
                    TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
                    Protocol: 'email',
                    Endpoint: 'test@example.com'
                })
            })
        );
    });

    it('should subscribe SMS successfully', async () => {
        const mockEvent = {
            body: JSON.stringify({
                kind: 'sms',
                value: '+15551234567'
            })
        };

        mockSNS.prototype.send = jest.fn().mockResolvedValue({});

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Subscription requested'
        });

        expect(mockSNS.prototype.send).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({
                    TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
                    Protocol: 'sms',
                    Endpoint: '+15551234567'
                })
            })
        );
    });

    it('should return 400 for missing kind', async () => {
        const mockEvent = {
            body: JSON.stringify({
                value: 'test@example.com'
            })
        };

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            message: 'kind and value required'
        });
    });

    it('should return 400 for missing value', async () => {
        const mockEvent = {
            body: JSON.stringify({
                kind: 'email'
            })
        };

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            message: 'kind and value required'
        });
    });

    it('should handle string body parsing', async () => {
        const mockEvent = {
            body: '{"kind": "email", "value": "test@example.com"}'
        };

        mockSNS.prototype.send = jest.fn().mockResolvedValue({});

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(200);
    });

    it('should return 500 for SNS errors', async () => {
        const mockEvent = {
            body: JSON.stringify({
                kind: 'email',
                value: 'test@example.com'
            })
        };

        mockSNS.prototype.send = jest.fn().mockRejectedValue(new Error('SNS error'));

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            message: 'SNS error'
        });
    });

    it('should handle missing body gracefully', async () => {
        const mockEvent = {};

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            message: 'kind and value required'
        });
    });
});
