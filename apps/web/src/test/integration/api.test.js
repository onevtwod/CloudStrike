import { describe, it, expect, beforeAll } from 'vitest';
const API_BASE = process.env.API_BASE_URL || 'https://test-api.example.com';
describe('API Integration Tests', () => {
    beforeAll(() => {
        // Set up any global test configuration
    });
    it('should get events from API', async () => {
        const response = await fetch(`${API_BASE}/events`);
        expect(response.ok).toBe(true);
        const events = await response.json();
        expect(Array.isArray(events)).toBe(true);
    });
    it('should process tweet and create event', async () => {
        const tweetData = {
            text: 'Test disaster: Flood warning in downtown area, roads blocked'
        };
        const response = await fetch(`${API_BASE}/ingest/twitter`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tweetData)
        });
        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('verified');
        expect(typeof result.verified).toBe('number');
    });
    it('should subscribe to email alerts', async () => {
        const subscriptionData = {
            kind: 'email',
            value: 'test@example.com'
        };
        const response = await fetch(`${API_BASE}/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscriptionData)
        });
        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result).toHaveProperty('message');
        expect(result.message).toContain('Subscription requested');
    });
    it('should subscribe to SMS alerts', async () => {
        const subscriptionData = {
            kind: 'sms',
            value: '+15551234567'
        };
        const response = await fetch(`${API_BASE}/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscriptionData)
        });
        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result).toHaveProperty('message');
        expect(result.message).toContain('Subscription requested');
    });
    it('should handle invalid tweet data', async () => {
        const response = await fetch(`${API_BASE}/ingest/twitter`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result).toHaveProperty('message');
        expect(result.message).toContain('text is required');
    });
    it('should handle invalid subscription data', async () => {
        const response = await fetch(`${API_BASE}/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ kind: 'email' })
        });
        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result).toHaveProperty('message');
        expect(result.message).toContain('kind and value required');
    });
});
