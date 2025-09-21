import { handler } from '../handlers/getEvents';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Mock AWS SDK
jest.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: jest.fn(() => ({
            send: jest.fn()
        }))
    },
    QueryCommand: jest.fn(),
    ScanCommand: jest.fn()
}));

describe('getEvents handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.EVENTS_TABLE = 'test-table';
    });

    it('should return events from GSI query successfully', async () => {
        const mockEvents = [
            {
                id: 'event-1',
                text: 'Flood in downtown',
                location: 'downtown',
                verified: 1,
                createdAt: '2024-01-01T00:00:00Z'
            },
            {
                id: 'event-2',
                text: 'Fire at warehouse',
                location: 'warehouse district',
                verified: 1,
                createdAt: '2024-01-01T01:00:00Z'
            }
        ];

        const mockSend = jest.fn().mockResolvedValue({
            Items: mockEvents
        });
        (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
            send: mockSend
        });

        const result = await handler();

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockEvents);

        // Verify QueryCommand was used
        expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({
                    TableName: 'test-table',
                    IndexName: 'verified-index',
                    KeyConditionExpression: '#v = :v',
                    ExpressionAttributeNames: { '#v': 'verified' },
                    ExpressionAttributeValues: { ':v': 1 }
                })
            })
        );
    });

    it('should fallback to scan when GSI query fails', async () => {
        const mockEvents = [
            {
                id: 'event-1',
                text: 'Emergency situation',
                verified: 1,
                createdAt: '2024-01-01T00:00:00Z'
            }
        ];

        const mockSend = jest.fn()
            .mockRejectedValueOnce(new Error('GSI not available'))
            .mockResolvedValueOnce({
                Items: mockEvents
            });
        (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
            send: mockSend
        });

        const result = await handler();

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockEvents);

        // Verify both QueryCommand and ScanCommand were called
        expect(mockSend).toHaveBeenCalledTimes(2);

        // First call should be QueryCommand
        expect(mockSend).toHaveBeenNthCalledWith(1,
            expect.objectContaining({
                input: expect.objectContaining({
                    TableName: 'test-table',
                    IndexName: 'verified-index'
                })
            })
        );

        // Second call should be ScanCommand
        expect(mockSend).toHaveBeenNthCalledWith(2,
            expect.objectContaining({
                input: expect.objectContaining({
                    TableName: 'test-table',
                    FilterExpression: '#v = :v'
                })
            })
        );
    });

    it('should return empty array when no events found', async () => {
        const mockSend = jest.fn().mockResolvedValue({
            Items: []
        });
        (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
            send: mockSend
        });

        const result = await handler();

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual([]);
    });

    it('should return empty array when Items is undefined', async () => {
        const mockSend = jest.fn().mockResolvedValue({});
        (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
            send: mockSend
        });

        const result = await handler();

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual([]);
    });
});
