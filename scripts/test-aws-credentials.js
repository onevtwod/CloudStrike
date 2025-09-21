#!/usr/bin/env node

/**
 * Test AWS Credentials and Basic Connectivity
 * This script tests if AWS credentials are properly configured and basic services are accessible
 */

const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { SNSClient, ListTopicsCommand } = require('@aws-sdk/client-sns');
const { SQSClient, ListQueuesCommand } = require('@aws-sdk/client-sqs');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { ComprehendClient, ListEntityRecognizersCommand } = require('@aws-sdk/client-comprehend');
const { RekognitionClient, ListCollectionsCommand } = require('@aws-sdk/client-rekognition');
const { SecretsManagerClient, ListSecretsCommand } = require('@aws-sdk/client-secrets-manager');
const { CloudWatchClient, ListMetricsCommand } = require('@aws-sdk/client-cloudwatch');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class AWSCredentialsTester {
    constructor() {
        this.results = [];
        this.region = process.env.AWS_REGION || 'us-east-1';
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const color = type === 'success' ? colors.green :
            type === 'error' ? colors.red :
                type === 'warning' ? colors.yellow : colors.blue;

        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async testService(serviceName, client, command, description) {
        try {
            this.log(`Testing ${serviceName}...`, 'info');
            const startTime = Date.now();
            await client.send(command);
            const duration = Date.now() - startTime;

            this.results.push({
                service: serviceName,
                status: 'SUCCESS',
                duration: `${duration}ms`,
                description
            });

            this.log(`✓ ${serviceName} - ${description} (${duration}ms)`, 'success');
            return true;
        } catch (error) {
            this.results.push({
                service: serviceName,
                status: 'FAILED',
                error: error.message,
                description
            });

            this.log(`✗ ${serviceName} - ${error.message}`, 'error');
            return false;
        }
    }

    async testAWSCredentials() {
        this.log('🔐 Testing AWS Credentials and Basic Connectivity', 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log('='.repeat(60), 'info');

        const sts = new STSClient({ region: this.region });

        // Test 1: Basic AWS Identity
        await this.testService(
            'STS',
            sts,
            new GetCallerIdentityCommand({}),
            'Get AWS account identity'
        );

        // Test 2: DynamoDB
        const dynamodb = new DynamoDBClient({ region: this.region });
        await this.testService(
            'DynamoDB',
            dynamodb,
            new ListTablesCommand({}),
            'List DynamoDB tables'
        );

        // Test 3: SNS
        const sns = new SNSClient({ region: this.region });
        await this.testService(
            'SNS',
            sns,
            new ListTopicsCommand({}),
            'List SNS topics'
        );

        // Test 4: SQS
        const sqs = new SQSClient({ region: this.region });
        await this.testService(
            'SQS',
            sqs,
            new ListQueuesCommand({}),
            'List SQS queues'
        );

        // Test 5: S3
        const s3 = new S3Client({ region: this.region });
        await this.testService(
            'S3',
            s3,
            new ListBucketsCommand({}),
            'List S3 buckets'
        );

        // Test 6: Comprehend
        const comprehend = new ComprehendClient({ region: this.region });
        await this.testService(
            'Comprehend',
            comprehend,
            new ListEntityRecognizersCommand({}),
            'List Comprehend entity recognizers'
        );

        // Test 7: Rekognition
        const rekognition = new RekognitionClient({ region: this.region });
        await this.testService(
            'Rekognition',
            rekognition,
            new ListCollectionsCommand({}),
            'List Rekognition collections'
        );

        // Test 8: Secrets Manager
        const secretsManager = new SecretsManagerClient({ region: this.region });
        await this.testService(
            'Secrets Manager',
            secretsManager,
            new ListSecretsCommand({}),
            'List secrets in Secrets Manager'
        );

        // Test 9: CloudWatch
        const cloudwatch = new CloudWatchClient({ region: this.region });
        await this.testService(
            'CloudWatch',
            cloudwatch,
            new ListMetricsCommand({}),
            'List CloudWatch metrics'
        );

        this.printSummary();
    }

    printSummary() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 TEST SUMMARY', 'bold');
        this.log('='.repeat(60), 'bold');

        const successCount = this.results.filter(r => r.status === 'SUCCESS').length;
        const totalCount = this.results.length;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);

        this.log(`\nTotal Tests: ${totalCount}`, 'info');
        this.log(`Successful: ${colors.green}${successCount}${colors.reset}`, 'info');
        this.log(`Failed: ${colors.red}${totalCount - successCount}${colors.reset}`, 'info');
        this.log(`Success Rate: ${successRate}%`, 'info');

        this.log('\n📋 DETAILED RESULTS:', 'bold');
        this.results.forEach(result => {
            const status = result.status === 'SUCCESS' ?
                `${colors.green}✓${colors.reset}` :
                `${colors.red}✗${colors.reset}`;

            console.log(`${status} ${result.service}: ${result.description}`);
            if (result.status === 'SUCCESS' && result.duration) {
                console.log(`   Duration: ${result.duration}`);
            }
            if (result.status === 'FAILED' && result.error) {
                console.log(`   Error: ${colors.red}${result.error}${colors.reset}`);
            }
        });

        if (successCount === totalCount) {
            this.log('\n🎉 All tests passed! AWS credentials are properly configured.', 'success');
        } else {
            this.log('\n⚠️  Some tests failed. Please check your AWS credentials and permissions.', 'warning');
        }
    }
}

// Run the test
async function main() {
    const tester = new AWSCredentialsTester();
    await tester.testAWSCredentials();

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

module.exports = AWSCredentialsTester;