import { SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';

const sns = new SNSClient({});

export const handler = async (event: any) => {
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
        const kind = body?.kind as 'email' | 'sms';
        const value = body?.value as string;
        if (!kind || !value) return { statusCode: 400, body: JSON.stringify({ message: 'kind and value required' }) };
        const protocol = kind === 'sms' ? 'sms' : 'email';
        const input = { TopicArn: process.env.ALERTS_TOPIC_ARN, Protocol: protocol, Endpoint: value };
        await sns.send(new SubscribeCommand(input));
        return { statusCode: 200, body: JSON.stringify({ message: 'Subscription requested' }) };
    } catch (e: any) {
        return { statusCode: 500, body: JSON.stringify({ message: e?.message || 'Error' }) };
    }
};
