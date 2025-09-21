#!/usr/bin/env node

const { SNSClient, SubscribeCommand, ListSubscriptionsByTopicCommand, UnsubscribeCommand } = require('@aws-sdk/client-sns');

class SNSSubscriptionManager {
    constructor() {
        // Use AWS SDK default credential chain (includes OS-configured credentials)
        const config = {
            region: process.env.AWS_REGION || 'us-east-1'
        };

        // Only set explicit credentials if environment variables are provided
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };

            // Add session token if present (for temporary credentials)
            if (process.env.AWS_SESSION_TOKEN) {
                config.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
            }
        }
        // If no explicit credentials, AWS SDK will use default credential chain

        this.sns = new SNSClient(config);

        this.topics = {
            disasterAlerts: process.env.SNS_DISASTER_ALERTS_TOPIC || 'arn:aws:sns:us-east-1:123456789012:disaster-alerts',
            verifications: process.env.SNS_VERIFICATIONS_TOPIC || 'arn:aws:sns:us-east-1:123456789012:disaster-verifications',
            systemStatus: process.env.SNS_SYSTEM_STATUS_TOPIC || 'arn:aws:sns:us-east-1:123456789012:system-status',
            emergency: process.env.SNS_EMERGENCY_TOPIC || 'arn:aws:sns:us-east-1:123456789012:emergency-alerts'
        };

        console.log('📢 SNS Subscription Manager initialized');
    }

    // Subscribe email addresses to a topic
    async subscribeEmail(topicName, emailAddresses) {
        const results = [];

        for (const email of emailAddresses) {
            try {
                const command = new SubscribeCommand({
                    TopicArn: this.topics[topicName],
                    Protocol: 'email',
                    Endpoint: email
                });

                const response = await this.sns.send(command);
                results.push({
                    email,
                    subscriptionArn: response.SubscriptionArn,
                    status: 'success'
                });

                console.log(`   ✅ Email subscribed: ${email}`);

            } catch (error) {
                results.push({
                    email,
                    error: error.message,
                    status: 'failed'
                });
                console.error(`   ❌ Error subscribing email ${email}:`, error.message);
            }
        }

        return results;
    }

    // Subscribe phone numbers for SMS
    async subscribeSMS(topicName, phoneNumbers) {
        const results = [];

        for (const phone of phoneNumbers) {
            try {
                const command = new SubscribeCommand({
                    TopicArn: this.topics[topicName],
                    Protocol: 'sms',
                    Endpoint: phone
                });

                const response = await this.sns.send(command);
                results.push({
                    phone,
                    subscriptionArn: response.SubscriptionArn,
                    status: 'success'
                });

                console.log(`   ✅ SMS subscribed: ${phone}`);

            } catch (error) {
                results.push({
                    phone,
                    error: error.message,
                    status: 'failed'
                });
                console.error(`   ❌ Error subscribing SMS ${phone}:`, error.message);
            }
        }

        return results;
    }

    // Subscribe webhook endpoints
    async subscribeWebhook(topicName, webhookUrls) {
        const results = [];

        for (const url of webhookUrls) {
            try {
                const command = new SubscribeCommand({
                    TopicArn: this.topics[topicName],
                    Protocol: 'https',
                    Endpoint: url
                });

                const response = await this.sns.send(command);
                results.push({
                    url,
                    subscriptionArn: response.SubscriptionArn,
                    status: 'success'
                });

                console.log(`   ✅ Webhook subscribed: ${url}`);

            } catch (error) {
                results.push({
                    url,
                    error: error.message,
                    status: 'failed'
                });
                console.error(`   ❌ Error subscribing webhook ${url}:`, error.message);
            }
        }

        return results;
    }

    // Subscribe mobile app endpoints
    async subscribeMobileApp(topicName, mobileEndpoints) {
        const results = [];

        for (const endpoint of mobileEndpoints) {
            try {
                const command = new SubscribeCommand({
                    TopicArn: this.topics[topicName],
                    Protocol: 'application',
                    Endpoint: endpoint
                });

                const response = await this.sns.send(command);
                results.push({
                    endpoint,
                    subscriptionArn: response.SubscriptionArn,
                    status: 'success'
                });

                console.log(`   ✅ Mobile app subscribed: ${endpoint}`);

            } catch (error) {
                results.push({
                    endpoint,
                    error: error.message,
                    status: 'failed'
                });
                console.error(`   ❌ Error subscribing mobile app ${endpoint}:`, error.message);
            }
        }

        return results;
    }

    // List all subscriptions for a topic
    async listSubscriptions(topicName) {
        try {
            const command = new ListSubscriptionsByTopicCommand({
                TopicArn: this.topics[topicName]
            });

            const response = await this.sns.send(command);
            return response.Subscriptions || [];

        } catch (error) {
            console.error(`❌ Error listing subscriptions for ${topicName}:`, error.message);
            return [];
        }
    }

    // Unsubscribe from a topic
    async unsubscribe(subscriptionArn) {
        try {
            const command = new UnsubscribeCommand({
                SubscriptionArn: subscriptionArn
            });

            await this.sns.send(command);
            console.log(`   ✅ Unsubscribed: ${subscriptionArn}`);
            return true;

        } catch (error) {
            console.error(`❌ Error unsubscribing ${subscriptionArn}:`, error.message);
            return false;
        }
    }

    // Set up default subscriptions for disaster detection system
    async setupDefaultSubscriptions() {
        console.log('🔧 Setting up default subscriptions for disaster detection system...');

        const defaultSubscriptions = {
            // Emergency contacts for critical alerts
            emergency: {
                emails: [
                    'emergency@your-organization.com',
                    'admin@your-organization.com',
                    'disaster-response@your-organization.com'
                ],
                sms: [
                    '+60123456789',  // Emergency response team
                    '+60198765432',  // Admin contact
                    '+60155555555'   // Backup contact
                ]
            },

            // General disaster alerts
            disasterAlerts: {
                emails: [
                    'alerts@your-organization.com',
                    'monitoring@your-organization.com'
                ],
                webhooks: [
                    'https://your-dashboard.com/api/disaster-alerts',
                    'https://your-mobile-app.com/webhook/alerts'
                ]
            },

            // Verification notifications
            verifications: {
                emails: [
                    'verification@your-organization.com',
                    'quality-control@your-organization.com'
                ],
                webhooks: [
                    'https://your-dashboard.com/api/verifications'
                ]
            },

            // System status updates
            systemStatus: {
                emails: [
                    'system-admin@your-organization.com',
                    'devops@your-organization.com'
                ],
                webhooks: [
                    'https://your-monitoring.com/api/status'
                ]
            }
        };

        const results = {};

        for (const [topicName, subscriptions] of Object.entries(defaultSubscriptions)) {
            console.log(`\n📢 Setting up subscriptions for ${topicName}...`);
            results[topicName] = {};

            if (subscriptions.emails) {
                results[topicName].emails = await this.subscribeEmail(topicName, subscriptions.emails);
            }

            if (subscriptions.sms) {
                results[topicName].sms = await this.subscribeSMS(topicName, subscriptions.sms);
            }

            if (subscriptions.webhooks) {
                results[topicName].webhooks = await this.subscribeWebhook(topicName, subscriptions.webhooks);
            }
        }

        return results;
    }

    // Get subscription summary
    async getSubscriptionSummary() {
        console.log('📊 Getting subscription summary...');

        const summary = {};

        for (const [topicName, topicArn] of Object.entries(this.topics)) {
            const subscriptions = await this.listSubscriptions(topicName);

            summary[topicName] = {
                topicArn,
                totalSubscriptions: subscriptions.length,
                subscriptions: subscriptions.map(sub => ({
                    protocol: sub.Protocol,
                    endpoint: sub.Endpoint,
                    subscriptionArn: sub.SubscriptionArn,
                    owner: sub.Owner
                }))
            };
        }

        return summary;
    }

    // Test notification delivery
    async testNotificationDelivery() {
        console.log('🧪 Testing notification delivery...');

        const testMessage = {
            type: 'test_notification',
            message: 'This is a test notification from the disaster detection system',
            timestamp: new Date().toISOString(),
            system: 'disaster-detection'
        };

        // Test each topic
        for (const [topicName, topicArn] of Object.entries(this.topics)) {
            try {
                console.log(`   📢 Testing ${topicName}...`);

                const command = new PublishCommand({
                    TopicArn: topicArn,
                    Subject: `Test Notification - ${topicName}`,
                    Message: JSON.stringify(testMessage, null, 2),
                    MessageAttributes: {
                        test: {
                            DataType: 'String',
                            StringValue: 'true'
                        }
                    }
                });

                const response = await this.sns.send(command);
                console.log(`   ✅ Test notification sent to ${topicName} (MessageId: ${response.MessageId})`);

            } catch (error) {
                console.error(`   ❌ Error testing ${topicName}:`, error.message);
            }
        }
    }
}

// Demonstration function
async function demonstrateSNSSubscriptions() {
    console.log('🚀 SNS Subscription Management Demo\n');

    const manager = new SNSSubscriptionManager();

    try {
        // 1. Show current subscriptions
        console.log('1️⃣ Current Subscriptions:');
        console.log('='.repeat(50));

        const summary = await manager.getSubscriptionSummary();
        for (const [topicName, info] of Object.entries(summary)) {
            console.log(`\n📢 ${topicName.toUpperCase()}:`);
            console.log(`   Topic ARN: ${info.topicArn}`);
            console.log(`   Total Subscriptions: ${info.totalSubscriptions}`);

            if (info.subscriptions.length > 0) {
                console.log('   Subscriptions:');
                for (const sub of info.subscriptions) {
                    console.log(`      - ${sub.protocol}: ${sub.endpoint}`);
                }
            } else {
                console.log('   No subscriptions found');
            }
        }

        // 2. Set up example subscriptions
        console.log('\n2️⃣ Setting up Example Subscriptions:');
        console.log('='.repeat(50));

        const exampleSubscriptions = {
            emergency: {
                emails: ['emergency@example.com', 'admin@example.com'],
                sms: ['+60123456789', '+60198765432']
            },
            disasterAlerts: {
                emails: ['alerts@example.com'],
                webhooks: ['https://example.com/webhook/alerts']
            }
        };

        for (const [topicName, subscriptions] of Object.entries(exampleSubscriptions)) {
            console.log(`\n📢 Setting up ${topicName} subscriptions...`);

            if (subscriptions.emails) {
                await manager.subscribeEmail(topicName, subscriptions.emails);
            }

            if (subscriptions.sms) {
                await manager.subscribeSMS(topicName, subscriptions.sms);
            }

            if (subscriptions.webhooks) {
                await manager.subscribeWebhook(topicName, subscriptions.webhooks);
            }
        }

        // 3. Show updated subscriptions
        console.log('\n3️⃣ Updated Subscriptions:');
        console.log('='.repeat(50));

        const updatedSummary = await manager.getSubscriptionSummary();
        for (const [topicName, info] of Object.entries(updatedSummary)) {
            console.log(`\n📢 ${topicName.toUpperCase()}:`);
            console.log(`   Total Subscriptions: ${info.totalSubscriptions}`);

            if (info.subscriptions.length > 0) {
                for (const sub of info.subscriptions) {
                    console.log(`      - ${sub.protocol}: ${sub.endpoint}`);
                }
            }
        }

        console.log('\n✅ SNS Subscription Management Demo Completed!');
        console.log('\n📋 Summary:');
        console.log('   📧 Email Notifications: Sent to specified email addresses');
        console.log('   📱 SMS Notifications: Sent to phone numbers');
        console.log('   🔗 Webhook Notifications: Sent to HTTP endpoints');
        console.log('   📱 Mobile App Notifications: Sent to mobile app endpoints');
        console.log('\n🚀 To set up in production:');
        console.log('   1. Configure real email addresses and phone numbers');
        console.log('   2. Set up webhook endpoints to receive notifications');
        console.log('   3. Configure mobile app push notification endpoints');
        console.log('   4. Run: npm run setup-subscriptions');

    } catch (error) {
        console.error('❌ Demo error:', error.message);
        console.log('\nℹ️  Note: This is expected without AWS credentials and proper setup');
    }
}

// Main execution
if (require.main === module) {
    demonstrateSNSSubscriptions().catch(console.error);
}

module.exports = SNSSubscriptionManager;
