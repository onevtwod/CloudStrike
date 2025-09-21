#!/usr/bin/env node

/**
 * Test SNS Notifications
 * This script tests SNS topic creation, subscription management, and notification sending
 */

const { SNSClient, CreateTopicCommand, ListTopicsCommand, SubscribeCommand, PublishCommand, ListSubscriptionsByTopicCommand, DeleteTopicCommand } = require('@aws-sdk/client-sns');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class SNSTester {
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.sns = new SNSClient({ region: this.region });
        this.results = [];
        this.testTopicArn = null;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const color = type === 'success' ? colors.green :
            type === 'error' ? colors.red :
                type === 'warning' ? colors.yellow : colors.blue;

        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async testOperation(operationName, testFunction, description) {
        try {
            this.log(`Testing ${operationName}...`, 'info');
            const startTime = Date.now();
            const result = await testFunction();
            const duration = Date.now() - startTime;

            this.results.push({
                operation: operationName,
                status: 'SUCCESS',
                duration: `${duration}ms`,
                description,
                result
            });

            this.log(`✓ ${operationName} - ${description} (${duration}ms)`, 'success');
            return result;
        } catch (error) {
            this.results.push({
                operation: operationName,
                status: 'FAILED',
                error: error.message,
                description
            });

            this.log(`✗ ${operationName} - ${error.message}`, 'error');
            return null;
        }
    }

    async testTopicCreation() {
        this.log('📢 Testing SNS Topic Creation', 'bold');

        const topicName = `disaster-alert-test-${Date.now()}`;

        const result = await this.testOperation(
            'Create Topic',
            () => this.sns.send(new CreateTopicCommand({
                Name: topicName
            })),
            `Create test topic: ${topicName}`
        );

        if (result && result.TopicArn) {
            this.testTopicArn = result.TopicArn;
            this.log(`   Topic ARN: ${this.testTopicArn}`, 'info');
        }

        return result;
    }

    async testListTopics() {
        this.log('📋 Testing List Topics', 'bold');

        const result = await this.testOperation(
            'List Topics',
            () => this.sns.send(new ListTopicsCommand({})),
            'List all SNS topics'
        );

        if (result && result.Topics) {
            this.log(`   Found ${result.Topics.length} topics:`, 'info');
            result.Topics.forEach(topic => {
                this.log(`     - ${topic.TopicArn}`, 'info');
            });
        }

        return result;
    }

    async testSubscriptionManagement() {
        this.log('📧 Testing Subscription Management', 'bold');

        if (!this.testTopicArn) {
            this.log('   No test topic available for subscription testing', 'warning');
            return null;
        }

        // Test email subscription
        const emailSubscription = await this.testOperation(
            'Email Subscription',
            () => this.sns.send(new SubscribeCommand({
                TopicArn: this.testTopicArn,
                Protocol: 'email',
                Endpoint: 'test@example.com'
            })),
            'Subscribe email endpoint to test topic'
        );

        // Test SMS subscription
        const smsSubscription = await this.testOperation(
            'SMS Subscription',
            () => this.sns.send(new SubscribeCommand({
                TopicArn: this.testTopicArn,
                Protocol: 'sms',
                Endpoint: '+1234567890'
            })),
            'Subscribe SMS endpoint to test topic'
        );

        // Test HTTP subscription
        const httpSubscription = await this.testOperation(
            'HTTP Subscription',
            () => this.sns.send(new SubscribeCommand({
                TopicArn: this.testTopicArn,
                Protocol: 'https',
                Endpoint: 'https://webhook.site/unique-id'
            })),
            'Subscribe HTTP endpoint to test topic'
        );

        // List subscriptions
        const listResult = await this.testOperation(
            'List Subscriptions',
            () => this.sns.send(new ListSubscriptionsByTopicCommand({
                TopicArn: this.testTopicArn
            })),
            'List all subscriptions for test topic'
        );

        if (listResult && listResult.Subscriptions) {
            this.log(`   Found ${listResult.Subscriptions.length} subscriptions:`, 'info');
            listResult.Subscriptions.forEach(sub => {
                this.log(`     - ${sub.Protocol}: ${sub.Endpoint} (${sub.SubscriptionArn})`, 'info');
            });
        }

        return { emailSubscription, smsSubscription, httpSubscription, listResult };
    }

    async testNotificationPublishing() {
        this.log('📤 Testing Notification Publishing', 'bold');

        if (!this.testTopicArn) {
            this.log('   No test topic available for publishing', 'warning');
            return null;
        }

        const testMessages = [
            {
                subject: 'Test Disaster Alert - Flood',
                message: JSON.stringify({
                    type: 'flood',
                    location: 'Kuala Lumpur',
                    severity: 'high',
                    timestamp: new Date().toISOString(),
                    description: 'Heavy flooding reported in city center. Water level rising rapidly.'
                }),
                description: 'Flood disaster alert'
            },
            {
                subject: 'Test Disaster Alert - Earthquake',
                message: JSON.stringify({
                    type: 'earthquake',
                    location: 'Sabah',
                    severity: 'medium',
                    timestamp: new Date().toISOString(),
                    description: 'Earthquake magnitude 5.2 reported. Buildings damaged.'
                }),
                description: 'Earthquake disaster alert'
            },
            {
                subject: 'Test Disaster Alert - Fire',
                message: JSON.stringify({
                    type: 'fire',
                    location: 'Penang',
                    severity: 'high',
                    timestamp: new Date().toISOString(),
                    description: 'Forest fire spreading rapidly. Evacuation ordered.'
                }),
                description: 'Fire disaster alert'
            }
        ];

        const publishResults = [];

        for (const testMsg of testMessages) {
            const result = await this.testOperation(
                `Publish Message (${testMsg.description})`,
                () => this.sns.send(new PublishCommand({
                    TopicArn: this.testTopicArn,
                    Subject: testMsg.subject,
                    Message: testMsg.message,
                    MessageAttributes: {
                        'disaster_type': {
                            DataType: 'String',
                            StringValue: testMsg.message.type || 'unknown'
                        },
                        'severity': {
                            DataType: 'String',
                            StringValue: 'high'
                        },
                        'location': {
                            DataType: 'String',
                            StringValue: testMsg.message.location || 'unknown'
                        }
                    }
                })),
                `Publish ${testMsg.description} to test topic`
            );

            if (result && result.MessageId) {
                this.log(`   Message ID: ${result.MessageId}`, 'info');
            }

            publishResults.push(result);
        }

        return publishResults;
    }

    async testDisasterAlertFormat() {
        this.log('🚨 Testing Disaster Alert Message Format', 'bold');

        if (!this.testTopicArn) {
            this.log('   No test topic available for alert testing', 'warning');
            return null;
        }

        const disasterAlert = {
            type: 'flood',
            location: 'Kuala Lumpur City Center',
            coordinates: { lat: 3.1390, lng: 101.6869 },
            severity: 'high',
            timestamp: new Date().toISOString(),
            source: 'social_media',
            author: 'emergency_responder',
            description: 'Heavy flooding reported in downtown area. Water level rising rapidly. Evacuation ordered for affected areas.',
            verified: true,
            meteoSource: 'malaysian_weather_api',
            alternativeRoutes: [
                {
                    from: 'Kuala Lumpur International Airport',
                    to: 'Kuala Lumpur City Center',
                    route: 'Via Federal Highway',
                    estimatedTime: '45 minutes',
                    status: 'open'
                }
            ],
            emergencyContacts: [
                '999 (Emergency)',
                '03-12345678 (KL City Hall)',
                '03-87654321 (Flood Control Center)'
            ]
        };

        const result = await this.testOperation(
            'Disaster Alert Format',
            () => this.sns.send(new PublishCommand({
                TopicArn: this.testTopicArn,
                Subject: `🚨 DISASTER ALERT: ${disasterAlert.type.toUpperCase()} in ${disasterAlert.location}`,
                Message: JSON.stringify(disasterAlert, null, 2),
                MessageAttributes: {
                    'alert_type': {
                        DataType: 'String',
                        StringValue: disasterAlert.type
                    },
                    'severity': {
                        DataType: 'String',
                        StringValue: disasterAlert.severity
                    },
                    'location': {
                        DataType: 'String',
                        StringValue: disasterAlert.location
                    },
                    'verified': {
                        DataType: 'String',
                        StringValue: disasterAlert.verified.toString()
                    }
                }
            })),
            'Publish formatted disaster alert message'
        );

        if (result && result.MessageId) {
            this.log(`   Alert Message ID: ${result.MessageId}`, 'info');
            this.log(`   Alert Type: ${disasterAlert.type}`, 'info');
            this.log(`   Location: ${disasterAlert.location}`, 'info');
            this.log(`   Severity: ${disasterAlert.severity}`, 'info');
        }

        return result;
    }

    async testBatchPublishing() {
        this.log('📦 Testing Batch Publishing', 'bold');

        if (!this.testTopicArn) {
            this.log('   No test topic available for batch publishing', 'warning');
            return null;
        }

        const batchMessages = [
            { type: 'flood', location: 'Kuala Lumpur', severity: 'high' },
            { type: 'earthquake', location: 'Sabah', severity: 'medium' },
            { type: 'fire', location: 'Penang', severity: 'low' },
            { type: 'landslide', location: 'Cameron Highlands', severity: 'high' }
        ];

        const result = await this.testOperation(
            'Batch Publishing',
            async () => {
                const promises = batchMessages.map((msg, index) =>
                    this.sns.send(new PublishCommand({
                        TopicArn: this.testTopicArn,
                        Subject: `Batch Test Alert ${index + 1}`,
                        Message: JSON.stringify({
                            ...msg,
                            timestamp: new Date().toISOString(),
                            batchId: `batch-${Date.now()}`
                        })
                    }))
                );
                return Promise.all(promises);
            },
            `Publish ${batchMessages.length} messages in parallel`
        );

        if (result) {
            this.log(`   Published ${result.length} messages successfully`, 'info');
        }

        return result;
    }

    async testSNSService() {
        this.log('📢 Testing SNS Service', 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log('='.repeat(60), 'info');

        await this.testListTopics();
        await this.testTopicCreation();
        await this.testSubscriptionManagement();
        await this.testNotificationPublishing();
        await this.testDisasterAlertFormat();
        await this.testBatchPublishing();

        // Cleanup
        if (this.testTopicArn) {
            await this.cleanup();
        }

        this.printSummary();
    }

    async cleanup() {
        this.log('🧹 Cleaning up test resources...', 'info');

        try {
            await this.sns.send(new DeleteTopicCommand({
                TopicArn: this.testTopicArn
            }));
            this.log('   Test topic deleted successfully', 'success');
        } catch (error) {
            this.log(`   Failed to delete test topic: ${error.message}`, 'warning');
        }
    }

    printSummary() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 SNS TEST SUMMARY', 'bold');
        this.log('='.repeat(60), 'bold');

        const successCount = this.results.filter(r => r.status === 'SUCCESS').length;
        const totalCount = this.results.length;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);

        this.log(`\nTotal Operations: ${totalCount}`, 'info');
        this.log(`Successful: ${colors.green}${successCount}${colors.reset}`, 'info');
        this.log(`Failed: ${colors.red}${totalCount - successCount}${colors.reset}`, 'info');
        this.log(`Success Rate: ${successRate}%`, 'info');

        this.log('\n📋 DETAILED RESULTS:', 'bold');
        this.results.forEach(result => {
            const status = result.status === 'SUCCESS' ?
                `${colors.green}✓${colors.reset}` :
                `${colors.red}✗${colors.reset}`;

            console.log(`${status} ${result.operation}: ${result.description}`);
            if (result.status === 'SUCCESS' && result.duration) {
                console.log(`   Duration: ${result.duration}`);
            }
            if (result.status === 'FAILED' && result.error) {
                console.log(`   Error: ${colors.red}${result.error}${colors.reset}`);
            }
        });

        if (successCount === totalCount) {
            this.log('\n🎉 All SNS operations successful!', 'success');
        } else {
            this.log('\n⚠️  Some operations failed. Check SNS service availability.', 'warning');
        }
    }
}

// Run the test
async function main() {
    const tester = new SNSTester();
    await tester.testSNSNotifications();
    
    // Exit with non-zero code if any tests failed
    const successCount = tester.results.filter(r => r.status === 'SUCCESS').length;
    const totalCount = tester.results.length;
    
    if (successCount !== totalCount) {
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SNSTester;
