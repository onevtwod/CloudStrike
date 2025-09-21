#!/usr/bin/env node

/**
 * Simple Test Runner
 * Usage: node run-test.js [component-name]
 * 
 * Available components:
 * - aws, dynamodb, comprehend, rekognition, sns, sqs, s3, secrets, cloudwatch, all
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

const testComponents = {
    'aws': 'test-aws-credentials.js',
    'dynamodb': 'test-dynamodb-operations.js',
    'comprehend': 'test-comprehend-analysis.js',
    'rekognition': 'test-rekognition-image.js',
    'sns': 'test-sns-notifications.js',
    'sqs': 'test-sqs-operations.js',
    's3': 'test-s3-operations.js',
    'secrets': 'test-secrets-manager.js',
    'cloudwatch': 'test-cloudwatch-operations.js',
    'all': 'test-all-components.js'
};

function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const color = type === 'success' ? colors.green :
        type === 'error' ? colors.red :
            type === 'warning' ? colors.yellow :
                type === 'info' ? colors.blue : colors.cyan;

    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function showUsage() {
    console.log('\n🧪 Disaster Alert System Test Runner');
    console.log('=====================================\n');
    console.log('Usage: node run-test.js [component-name]\n');
    console.log('Available components:');
    console.log('  aws         - Test AWS credentials and connectivity');
    console.log('  dynamodb    - Test DynamoDB operations');
    console.log('  comprehend  - Test Amazon Comprehend analysis');
    console.log('  rekognition - Test Amazon Rekognition image analysis');
    console.log('  sns         - Test SNS notifications');
    console.log('  sqs         - Test SQS queue operations');
    console.log('  s3          - Test S3 storage operations');
    console.log('  secrets     - Test AWS Secrets Manager');
    console.log('  cloudwatch  - Test CloudWatch monitoring');
    console.log('  all         - Run all component tests\n');
    console.log('Examples:');
    console.log('  node run-test.js aws');
    console.log('  node run-test.js all');
    console.log('  node run-test.js dynamodb\n');
}

function runTest(component) {
    const scriptName = testComponents[component];

    if (!scriptName) {
        log(`Unknown component: ${component}`, 'error');
        showUsage();
        process.exit(1);
    }

    const scriptPath = path.join(__dirname, scriptName);

    log(`Running ${component} test...`, 'info');
    log(`Script: ${scriptName}`, 'info');
    log('='.repeat(50), 'info');

    try {
        const startTime = Date.now();
        execSync(`node "${scriptPath}"`, {
            encoding: 'utf8',
            cwd: __dirname,
            stdio: 'inherit'
        });
        const duration = Date.now() - startTime;

        log(`\n✅ ${component} test completed successfully (${(duration / 1000).toFixed(2)}s)`, 'success');

    } catch (error) {
        log(`\n❌ ${component} test failed`, 'error');
        if (error.stdout) {
            console.log('Output:', error.stdout);
        }
        if (error.stderr) {
            console.log('Error:', error.stderr);
        }
        process.exit(1);
    }
}

function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        showUsage();
        process.exit(0);
    }

    const component = args[0].toLowerCase();

    if (component === 'help' || component === '-h' || component === '--help') {
        showUsage();
        process.exit(0);
    }

    runTest(component);
}

if (require.main === module) {
    main();
}

module.exports = { runTest, showUsage };
