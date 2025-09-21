#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Disaster Alert System
 * This script runs all individual component tests in sequence
 */

const { execSync } = require('child_process');
const path = require('path');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    cyan: '\x1b[36m'
};

class ComprehensiveTester {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
        this.scriptsDir = __dirname;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const color = type === 'success' ? colors.green :
            type === 'error' ? colors.red :
                type === 'warning' ? colors.yellow :
                    type === 'info' ? colors.blue : colors.cyan;

        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async runTest(testName, scriptPath, description) {
        this.log(`\n🧪 Running ${testName}...`, 'bold');
        this.log(`   Description: ${description}`, 'info');
        this.log(`   Script: ${scriptPath}`, 'info');
        this.log('   ' + '─'.repeat(50), 'info');

        try {
            const startTime = Date.now();
            const output = execSync(`node "${scriptPath}"`, {
                encoding: 'utf8',
                cwd: this.scriptsDir,
                stdio: 'pipe'
            });
            const duration = Date.now() - startTime;

            this.results.push({
                test: testName,
                status: 'SUCCESS',
                duration: `${duration}ms`,
                description,
                output: output.substring(0, 500) + (output.length > 500 ? '...' : '')
            });

            this.log(`✅ ${testName} completed successfully (${duration}ms)`, 'success');
            return true;

        } catch (error) {
            const duration = Date.now() - Date.now();

            this.results.push({
                test: testName,
                status: 'FAILED',
                duration: `${duration}ms`,
                description,
                error: error.message,
                output: error.stdout ? error.stdout.substring(0, 500) : '',
                stderr: error.stderr ? error.stderr.substring(0, 500) : ''
            });

            this.log(`❌ ${testName} failed: ${error.message}`, 'error');
            if (error.stdout) {
                this.log(`   Output: ${error.stdout.substring(0, 200)}...`, 'warning');
            }
            if (error.stderr) {
                this.log(`   Error: ${error.stderr.substring(0, 200)}...`, 'error');
            }
            return false;
        }
    }

    async runAllTests() {
        this.log('🚀 Starting Comprehensive Disaster Alert System Testing', 'bold');
        this.log('='.repeat(80), 'bold');
        this.log(`Start Time: ${new Date().toISOString()}`, 'info');
        this.log(`Test Directory: ${this.scriptsDir}`, 'info');
        this.log('='.repeat(80), 'bold');

        const tests = [
            {
                name: 'AWS Credentials Test',
                script: 'test-aws-credentials.js',
                description: 'Test AWS credentials and basic service connectivity'
            },
            {
                name: 'DynamoDB Operations Test',
                script: 'test-dynamodb-operations.js',
                description: 'Test DynamoDB table operations and GSI functionality'
            },
            {
                name: 'Comprehend Analysis Test',
                script: 'test-comprehend-analysis.js',
                description: 'Test Amazon Comprehend text analysis and entity detection'
            },
            {
                name: 'Rekognition Image Test',
                script: 'test-rekognition-image.js',
                description: 'Test Amazon Rekognition image analysis and label detection'
            },
            {
                name: 'SNS Notifications Test',
                script: 'test-sns-notifications.js',
                description: 'Test SNS topic creation and notification publishing'
            },
            {
                name: 'SQS Queue Test',
                script: 'test-sqs-operations.js',
                description: 'Test SQS queue operations and message processing'
            },
            {
                name: 'S3 Storage Test',
                script: 'test-s3-operations.js',
                description: 'Test S3 bucket operations for image storage'
            },
            {
                name: 'Secrets Manager Test',
                script: 'test-secrets-manager.js',
                description: 'Test AWS Secrets Manager integration'
            },
            {
                name: 'CloudWatch Test',
                script: 'test-cloudwatch-operations.js',
                description: 'Test CloudWatch metrics and monitoring'
            }
        ];

        let successCount = 0;
        let totalCount = tests.length;

        for (const test of tests) {
            const success = await this.runTest(test.name, test.script, test.description);
            if (success) successCount++;

            // Add a small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.printFinalSummary(successCount, totalCount);
    }

    printFinalSummary(successCount, totalCount) {
        const totalDuration = Date.now() - this.startTime;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);

        this.log('\n' + '='.repeat(80), 'bold');
        this.log('📊 COMPREHENSIVE TEST SUMMARY', 'bold');
        this.log('='.repeat(80), 'bold');

        this.log(`\nTotal Tests: ${totalCount}`, 'info');
        this.log(`Successful: ${colors.green}${successCount}${colors.reset}`, 'info');
        this.log(`Failed: ${colors.red}${totalCount - successCount}${colors.reset}`, 'info');
        this.log(`Success Rate: ${successRate}%`, 'info');
        this.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'info');

        this.log('\n📋 DETAILED RESULTS:', 'bold');
        this.results.forEach((result, index) => {
            const status = result.status === 'SUCCESS' ?
                `${colors.green}✅${colors.reset}` :
                `${colors.red}❌${colors.reset}`;

            console.log(`\n${index + 1}. ${status} ${result.test}`);
            console.log(`   Description: ${result.description}`);
            console.log(`   Duration: ${result.duration}`);

            if (result.status === 'FAILED') {
                if (result.error) {
                    console.log(`   Error: ${colors.red}${result.error}${colors.reset}`);
                }
                if (result.stderr) {
                    console.log(`   Details: ${colors.red}${result.stderr}${colors.reset}`);
                }
            }
        });

        this.log('\n🎯 NEXT STEPS:', 'bold');
        if (successCount === totalCount) {
            this.log('🎉 All tests passed! Your disaster alert system is ready for deployment.', 'success');
            this.log('   • Deploy your infrastructure using: npm run deploy', 'info');
            this.log('   • Test API endpoints after deployment', 'info');
            this.log('   • Set up monitoring and alerting', 'info');
        } else {
            this.log('⚠️  Some tests failed. Please address the issues before deployment:', 'warning');
            this.log('   • Check AWS credentials and permissions', 'info');
            this.log('   • Verify service availability in your region', 'info');
            this.log('   • Review error messages above for specific issues', 'info');
        }

        this.log('\n📚 TEST DOCUMENTATION:', 'bold');
        this.log('   • Individual test scripts are available in the scripts/ directory', 'info');
        this.log('   • Each test can be run independently for debugging', 'info');
        this.log('   • Check the logs above for detailed error information', 'info');

        this.log('\n' + '='.repeat(80), 'bold');
        this.log(`Test completed at: ${new Date().toISOString()}`, 'info');
        this.log('='.repeat(80), 'bold');
    }
}

// Run all tests
async function main() {
    const tester = new ComprehensiveTester();
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ComprehensiveTester;
