#!/usr/bin/env node

/**
 * AWS Credentials and Basic Service Connectivity Test
 * This test verifies AWS credentials are properly configured and basic services are accessible
 * 
 * Data Flow Position: 1 - Foundation layer
 * Dependencies: None
 * Tests: AWS SDK initialization, credential validation, basic service connectivity
 */

const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { SNSClient, ListTopicsCommand } = require('@aws-sdk/client-sns');
const { SQSClient, ListQueuesCommand } = require('@aws-sdk/client-sqs');
const { ComprehendClient, ListEntityRecognizersCommand } = require('@aws-sdk/client-comprehend');
const { RekognitionClient, ListCollectionsCommand } = require('@aws-sdk/client-rekognition');
const { CloudWatchClient, ListMetricsCommand } = require('@aws-sdk/client-cloudwatch');
const { SecretsManagerClient, ListSecretsCommand } = require('@aws-sdk/client-secrets-manager');

class AWSCredentialsTester {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
        this.region = process.env.AWS_REGION || 'us-east-1';
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colors = {
            success: '\x1b[32m',
            error: '\x1b[31m',
            warning: '\x1b[33m',
            info: '\x1b[34m',
            bold: '\x1b[1m',
            reset: '\x1b[0m'
        };

        const color = colors[type] || colors.info;
        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async testAWSCredentials() {
        this.log('🔐 Testing AWS Credentials...', 'bold');

        // Log credentials being used (masked for security)
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        const sessionToken = process.env.AWS_SESSION_TOKEN;
        const region = process.env.AWS_REGION || this.region;

        this.log('📋 Credentials Configuration:', 'info');
        this.log(`   AWS_ACCESS_KEY_ID: ${accessKeyId ? accessKeyId.substring(0, 8) + '...' : '❌ Not set'}`, 'info');
        this.log(`   AWS_SECRET_ACCESS_KEY: ${secretAccessKey ? '***' + secretAccessKey.substring(secretAccessKey.length - 4) : '❌ Not set'}`, 'info');
        this.log(`   AWS_SESSION_TOKEN: ${sessionToken ? 'Set (temporary credentials)' : 'Not set (permanent credentials)'}`, 'info');
        this.log(`   AWS_REGION: ${region}`, 'info');
        this.log(`   Credential Type: ${sessionToken ? 'Temporary (ASIA...)' : accessKeyId && accessKeyId.startsWith('AKIA') ? 'Permanent (AKIA...)' : 'Unknown'}`, 'info');

        try {
            const stsClient = new STSClient({ region: this.region });
            const command = new GetCallerIdentityCommand({});
            const response = await stsClient.send(command);

            this.results.push({
                test: 'AWS Credentials',
                status: 'SUCCESS',
                details: {
                    accountId: response.Account,
                    userId: response.UserId,
                    arn: response.Arn,
                    region: this.region
                }
            });

            this.log(`✅ AWS Credentials valid - Account: ${response.Account}`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'AWS Credentials',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ AWS Credentials failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testServiceConnectivity(serviceName, client, command) {
        try {
            const response = await client.send(command);
            this.results.push({
                test: `${serviceName} Connectivity`,
                status: 'SUCCESS',
                details: { region: this.region }
            });

            this.log(`✅ ${serviceName} accessible`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: `${serviceName} Connectivity`,
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ ${serviceName} failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testDynamoDBConnectivity() {
        this.log('🗄️ Testing DynamoDB connectivity...', 'info');
        const client = new DynamoDBClient({ region: this.region });
        const command = new ListTablesCommand({});
        return await this.testServiceConnectivity('DynamoDB', client, command);
    }

    async testS3Connectivity() {
        this.log('🪣 Testing S3 connectivity...', 'info');
        const client = new S3Client({ region: this.region });
        const command = new ListBucketsCommand({});
        return await this.testServiceConnectivity('S3', client, command);
    }

    async testSNSConnectivity() {
        this.log('📢 Testing SNS connectivity...', 'info');
        const client = new SNSClient({ region: this.region });
        const command = new ListTopicsCommand({});
        return await this.testServiceConnectivity('SNS', client, command);
    }

    async testSQSConnectivity() {
        this.log('📬 Testing SQS connectivity...', 'info');
        const client = new SQSClient({ region: this.region });
        const command = new ListQueuesCommand({});
        return await this.testServiceConnectivity('SQS', client, command);
    }

    async testComprehendConnectivity() {
        this.log('🧠 Testing Comprehend connectivity...', 'info');
        const client = new ComprehendClient({ region: this.region });
        const command = new ListEntityRecognizersCommand({});
        return await this.testServiceConnectivity('Comprehend', client, command);
    }

    async testRekognitionConnectivity() {
        this.log('👁️ Testing Rekognition connectivity...', 'info');
        const client = new RekognitionClient({ region: this.region });
        const command = new ListCollectionsCommand({});
        return await this.testServiceConnectivity('Rekognition', client, command);
    }

    async testCloudWatchConnectivity() {
        this.log('📊 Testing CloudWatch connectivity...', 'info');
        const client = new CloudWatchClient({ region: this.region });
        const command = new ListMetricsCommand({ Namespace: 'AWS/Lambda' });
        return await this.testServiceConnectivity('CloudWatch', client, command);
    }

    async testSecretsManagerConnectivity() {
        this.log('🔑 Testing Secrets Manager connectivity...', 'info');
        const client = new SecretsManagerClient({ region: this.region });
        const command = new ListSecretsCommand({});
        return await this.testServiceConnectivity('Secrets Manager', client, command);
    }

    async testRegionCompatibility() {
        this.log('🌍 Testing region compatibility...', 'info');

        const services = [
            { name: 'DynamoDB', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
            { name: 'S3', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
            { name: 'SNS', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
            { name: 'SQS', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
            { name: 'Comprehend', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
            { name: 'Rekognition', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
            { name: 'CloudWatch', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
            { name: 'Secrets Manager', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] }
        ];

        const isCompatible = services.every(service =>
            service.regions.includes(this.region)
        );

        this.results.push({
            test: 'Region Compatibility',
            status: isCompatible ? 'SUCCESS' : 'WARNING',
            details: {
                region: this.region,
                compatible: isCompatible
            }
        });

        if (isCompatible) {
            this.log(`✅ Region ${this.region} is compatible with all services`, 'success');
        } else {
            this.log(`⚠️ Region ${this.region} may have limited service availability`, 'warning');
        }

        return isCompatible;
    }

    async testIAMPermissions() {
        this.log('🔒 Testing IAM permissions...', 'info');

        const requiredPermissions = [
            'dynamodb:ListTables',
            'dynamodb:CreateTable',
            'dynamodb:PutItem',
            'dynamodb:GetItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            's3:ListBucket',
            's3:GetObject',
            's3:PutObject',
            'sns:ListTopics',
            'sns:CreateTopic',
            'sns:Publish',
            'sqs:ListQueues',
            'sqs:CreateQueue',
            'sqs:SendMessage',
            'sqs:ReceiveMessage',
            'comprehend:DetectEntities',
            'comprehend:DetectSentiment',
            'rekognition:DetectLabels',
            'rekognition:DetectText',
            'cloudwatch:PutMetricData',
            'cloudwatch:GetMetricStatistics',
            'secretsmanager:GetSecretValue',
            'secretsmanager:CreateSecret'
        ];

        // This is a basic check - in production, you'd use IAM policy simulation
        this.results.push({
            test: 'IAM Permissions',
            status: 'INFO',
            details: {
                requiredPermissions: requiredPermissions.length,
                note: 'Manual verification required for production deployment'
            }
        });

        this.log(`ℹ️ Required permissions: ${requiredPermissions.length} actions`, 'info');
        return true;
    }

    async runAllTests() {
        this.log('🚀 Starting AWS Credentials and Connectivity Test', 'bold');
        this.log('='.repeat(60), 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log(`Start Time: ${new Date().toISOString()}`, 'info');
        this.log('='.repeat(60), 'bold');

        const tests = [
            () => this.testAWSCredentials(),
            () => this.testRegionCompatibility(),
            () => this.testDynamoDBConnectivity(),
            () => this.testS3Connectivity(),
            () => this.testSNSConnectivity(),
            () => this.testSQSConnectivity(),
            () => this.testComprehendConnectivity(),
            () => this.testRekognitionConnectivity(),
            () => this.testCloudWatchConnectivity(),
            () => this.testSecretsManagerConnectivity(),
            () => this.testIAMPermissions()
        ];

        let successCount = 0;
        let totalCount = tests.length;

        for (const test of tests) {
            try {
                const success = await test();
                if (success) successCount++;
            } catch (error) {
                this.log(`❌ Test failed with error: ${error.message}`, 'error');
            }

            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.printSummary(successCount, totalCount);
    }

    printSummary(successCount, totalCount) {
        const totalDuration = Date.now() - this.startTime;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);

        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 AWS CREDENTIALS TEST SUMMARY', 'bold');
        this.log('='.repeat(60), 'bold');

        this.log(`\nTotal Tests: ${totalCount}`, 'info');
        this.log(`Successful: ${successCount}`, 'info');
        this.log(`Failed: ${totalCount - successCount}`, 'info');
        this.log(`Success Rate: ${successRate}%`, 'info');
        this.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'info');

        this.log('\n📋 DETAILED RESULTS:', 'bold');
        this.results.forEach((result, index) => {
            const status = result.status === 'SUCCESS' ? '✅' :
                result.status === 'FAILED' ? '❌' :
                    result.status === 'WARNING' ? '⚠️' : 'ℹ️';

            console.log(`\n${index + 1}. ${status} ${result.test}`);
            if (result.details) {
                Object.entries(result.details).forEach(([key, value]) => {
                    console.log(`   ${key}: ${value}`);
                });
            }
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });

        this.log('\n🎯 NEXT STEPS:', 'bold');
        if (successCount === totalCount) {
            this.log('🎉 All AWS services are accessible! Ready for infrastructure setup.', 'success');
            this.log('   • Run: node test-dynamodb-setup.js', 'info');
            this.log('   • Configure environment variables', 'info');
        } else {
            this.log('⚠️ Some services are not accessible. Please check:', 'warning');
            this.log('   • AWS credentials configuration', 'info');
            this.log('   • IAM permissions', 'info');
            this.log('   • Region availability', 'info');
            this.log('   • Network connectivity', 'info');
        }

        this.log('\n' + '='.repeat(60), 'bold');
    }
}

// Run the test
async function main() {
    const tester = new AWSCredentialsTester();
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = AWSCredentialsTester;