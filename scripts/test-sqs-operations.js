#!/usr/bin/env node

/**
 * Test SQS Operations
 * This script tests SQS queue creation, message sending, receiving, and processing
 */

const { SQSClient, CreateQueueCommand, ListQueuesCommand, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand, DeleteQueueCommand } = require('@aws-sdk/client-sqs');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class SQSTester {
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.sqs = new SQSClient({ region: this.region });
        this.results = [];
        this.testQueueUrl = null;
        this.testQueueArn = null;
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

    async testQueueCreation() {
        this.log('📦 Testing SQS Queue Creation', 'bold');

        const queueName = `disaster-alert-test-queue-${Date.now()}`;

        const result = await this.testOperation(
            'Create Queue',
            () => this.sqs.send(new CreateQueueCommand({
                QueueName: queueName,
                Attributes: {
                    VisibilityTimeout: '300',
                    MessageRetentionPeriod: '1209600', // 14 days
                    DelaySeconds: '0',
                    ReceiveMessageWaitTimeSeconds: '0'
                }
            })),
            `Create test queue: ${queueName}`
        );

        if (result && result.QueueUrl) {
            this.testQueueUrl = result.QueueUrl;
            this.log(`   Queue URL: ${this.testQueueUrl}`, 'info');
        }

        return result;
    }

    async testListQueues() {
        this.log('📋 Testing List Queues', 'bold');

        const result = await this.testOperation(
            'List Queues',
            () => this.sqs.send(new ListQueuesCommand({})),
            'List all SQS queues'
        );

        if (result && result.QueueUrls) {
            this.log(`   Found ${result.QueueUrls.length} queues:`, 'info');
            result.QueueUrls.forEach(url => {
                this.log(`     - ${url}`, 'info');
            });
        }

        return result;
    }

    async testMessageSending() {
        this.log('📤 Testing Message Sending', 'bold');

        if (!this.testQueueUrl) {
            this.log('   No test queue available for message sending', 'warning');
            return null;
        }

        const testMessages = [
            {
                message: JSON.stringify({
                    id: 'msg-1',
                    type: 'flood',
                    location: 'Kuala Lumpur',
                    text: 'Heavy flooding reported in city center',
                    timestamp: new Date().toISOString(),
                    source: 'twitter'
                }),
                description: 'Flood disaster message'
            },
            {
                message: JSON.stringify({
                    id: 'msg-2',
                    type: 'earthquake',
                    location: 'Sabah',
                    text: 'Earthquake magnitude 5.2 reported',
                    timestamp: new Date().toISOString(),
                    source: 'reddit'
                }),
                description: 'Earthquake disaster message'
            },
            {
                message: JSON.stringify({
                    id: 'msg-3',
                    type: 'fire',
                    location: 'Penang',
                    text: 'Forest fire spreading rapidly',
                    timestamp: new Date().toISOString(),
                    source: 'news_api'
                }),
                description: 'Fire disaster message'
            }
        ];

        const sendResults = [];

        for (const testMsg of testMessages) {
            const result = await this.testOperation(
                `Send Message (${testMsg.description})`,
                () => this.sqs.send(new SendMessageCommand({
                    QueueUrl: this.testQueueUrl,
                    MessageBody: testMsg.message,
                    MessageAttributes: {
                        'disaster_type': {
                            DataType: 'String',
                            StringValue: testMsg.message.type || 'unknown'
                        },
                        'location': {
                            DataType: 'String',
                            StringValue: testMsg.message.location || 'unknown'
                        },
                        'source': {
                            DataType: 'String',
                            StringValue: testMsg.message.source || 'unknown'
                        }
                    }
                })),
                `Send ${testMsg.description} to test queue`
            );

            if (result && result.MessageId) {
                this.log(`   Message ID: ${result.MessageId}`, 'info');
            }

            sendResults.push(result);
        }

        return sendResults;
    }

    async testMessageReceiving() {
        this.log('📥 Testing Message Receiving', 'bold');

        if (!this.testQueueUrl) {
            this.log('   No test queue available for message receiving', 'warning');
            return null;
        }

        const result = await this.testOperation(
            'Receive Messages',
            () => this.sqs.send(new ReceiveMessageCommand({
                QueueUrl: this.testQueueUrl,
                MaxNumberOfMessages: 10,
                WaitTimeSeconds: 5,
                MessageAttributeNames: ['All']
            })),
            'Receive messages from test queue'
        );

        if (result && result.Messages) {
            this.log(`   Received ${result.Messages.length} messages:`, 'info');
            result.Messages.forEach((msg, index) => {
                this.log(`     Message ${index + 1}:`, 'info');
                this.log(`       ID: ${msg.MessageId}`, 'info');
                this.log(`       Body: ${msg.Body.substring(0, 100)}...`, 'info');
                if (msg.MessageAttributes) {
                    this.log(`       Attributes:`, 'info');
                    Object.entries(msg.MessageAttributes).forEach(([key, value]) => {
                        this.log(`         ${key}: ${value.StringValue}`, 'info');
                    });
                }
            });
        }

        return result;
    }

    async testMessageProcessing() {
        this.log('⚙️  Testing Message Processing', 'bold');

        if (!this.testQueueUrl) {
            this.log('   No test queue available for message processing', 'warning');
            return null;
        }

        // First, send a test message
        const testMessage = JSON.stringify({
            id: 'process-test-' + Date.now(),
            type: 'flood',
            location: 'Kuala Lumpur',
            text: 'Test message for processing',
            timestamp: new Date().toISOString(),
            source: 'test'
        });

        const sendResult = await this.testOperation(
            'Send Test Message',
            () => this.sqs.send(new SendMessageCommand({
                QueueUrl: this.testQueueUrl,
                MessageBody: testMessage
            })),
            'Send test message for processing'
        );

        if (!sendResult) return null;

        // Wait a moment for message to be available
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Receive the message
        const receiveResult = await this.testOperation(
            'Receive Test Message',
            () => this.sqs.send(new ReceiveMessageCommand({
                QueueUrl: this.testQueueUrl,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 5
            })),
            'Receive test message for processing'
        );

        if (receiveResult && receiveResult.Messages && receiveResult.Messages.length > 0) {
            const message = receiveResult.Messages[0];

            // Simulate message processing
            const processResult = await this.testOperation(
                'Process Message',
                async () => {
                    // Simulate processing time
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Parse and validate message
                    const messageData = JSON.parse(message.Body);
                    const processedData = {
                        ...messageData,
                        processed: true,
                        processedAt: new Date().toISOString(),
                        status: 'completed'
                    };

                    return processedData;
                },
                'Process received message'
            );

            // Delete the processed message
            if (processResult) {
                await this.testOperation(
                    'Delete Processed Message',
                    () => this.sqs.send(new DeleteMessageCommand({
                        QueueUrl: this.testQueueUrl,
                        ReceiptHandle: message.ReceiptHandle
                    })),
                    'Delete processed message from queue'
                );
            }
        }

        return { sendResult, receiveResult };
    }

    async testQueueAttributes() {
        this.log('📊 Testing Queue Attributes', 'bold');

        if (!this.testQueueUrl) {
            this.log('   No test queue available for attribute testing', 'warning');
            return null;
        }

        const result = await this.testOperation(
            'Get Queue Attributes',
            () => this.sqs.send(new GetQueueAttributesCommand({
                QueueUrl: this.testQueueUrl,
                AttributeNames: ['All']
            })),
            'Get queue attributes and statistics'
        );

        if (result && result.Attributes) {
            this.log(`   Queue Attributes:`, 'info');
            Object.entries(result.Attributes).forEach(([key, value]) => {
                this.log(`     ${key}: ${value}`, 'info');
            });
        }

        return result;
    }

    async testBatchOperations() {
        this.log('📦 Testing Batch Operations', 'bold');

        if (!this.testQueueUrl) {
            this.log('   No test queue available for batch operations', 'warning');
            return null;
        }

        // Send multiple messages
        const batchMessages = Array.from({ length: 5 }, (_, i) => ({
            Id: `batch-${i}`,
            MessageBody: JSON.stringify({
                id: `batch-msg-${i}`,
                type: 'test',
                location: 'Test Location',
                text: `Batch test message ${i}`,
                timestamp: new Date().toISOString(),
                batchId: `batch-${Date.now()}`
            })
        }));

        const result = await this.testOperation(
            'Batch Send Messages',
            async () => {
                const promises = batchMessages.map(msg =>
                    this.sqs.send(new SendMessageCommand({
                        QueueUrl: this.testQueueUrl,
                        MessageBody: msg.MessageBody,
                        MessageAttributes: {
                            'batch_id': {
                                DataType: 'String',
                                StringValue: `batch-${Date.now()}`
                            }
                        }
                    }))
                );
                return Promise.all(promises);
            },
            `Send ${batchMessages.length} messages in batch`
        );

        if (result) {
            this.log(`   Sent ${result.length} messages successfully`, 'info');
        }

        return result;
    }

    async testSQSOperations() {
        this.log('📦 Testing SQS Operations', 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log('='.repeat(60), 'info');

        await this.testListQueues();
        await this.testQueueCreation();
        await this.testMessageSending();
        await this.testMessageReceiving();
        await this.testMessageProcessing();
        await this.testQueueAttributes();
        await this.testBatchOperations();

        // Cleanup
        if (this.testQueueUrl) {
            await this.cleanup();
        }

        this.printSummary();
    }

    async cleanup() {
        this.log('🧹 Cleaning up test resources...', 'info');

        try {
            await this.sqs.send(new DeleteQueueCommand({
                QueueUrl: this.testQueueUrl
            }));
            this.log('   Test queue deleted successfully', 'success');
        } catch (error) {
            this.log(`   Failed to delete test queue: ${error.message}`, 'warning');
        }
    }

    printSummary() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 SQS TEST SUMMARY', 'bold');
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
            this.log('\n🎉 All SQS operations successful!', 'success');
        } else {
            this.log('\n⚠️  Some operations failed. Check SQS service availability.', 'warning');
        }
    }
}

// Run the test
async function main() {
    const tester = new SQSTester();
    await tester.testSQSOperations();

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

module.exports = SQSTester;
