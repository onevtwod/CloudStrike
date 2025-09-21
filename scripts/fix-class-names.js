#!/usr/bin/env node

/**
 * Fix Class Names in Test Files
 * Corrects the incorrectly generated class names and method names
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
    {
        file: 'test-dynamodb-operations.js',
        correctClass: 'DynamoDBTester',
        correctMethod: 'testDynamoDBOperations'
    },
    {
        file: 'test-comprehend-analysis.js',
        correctClass: 'ComprehendTester',
        correctMethod: 'testComprehendAnalysis'
    },
    {
        file: 'test-rekognition-image.js',
        correctClass: 'RekognitionTester',
        correctMethod: 'testRekognitionImage'
    },
    {
        file: 'test-sns-notifications.js',
        correctClass: 'SNSTester',
        correctMethod: 'testSNSNotifications'
    },
    {
        file: 'test-sqs-operations.js',
        correctClass: 'SQSTester',
        correctMethod: 'testSQSOperations'
    },
    {
        file: 'test-s3-operations.js',
        correctClass: 'S3Tester',
        correctMethod: 'testS3Operations'
    },
    {
        file: 'test-secrets-manager.js',
        correctClass: 'SecretsManagerTester',
        correctMethod: 'testSecretsManager'
    },
    {
        file: 'test-cloudwatch-operations.js',
        correctClass: 'CloudWatchTester',
        correctMethod: 'testCloudWatchOperations'
    }
];

function fixClassNames(filePath, correctClass, correctMethod) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        // Fix the main function
        const mainFunctionRegex = /async function main\(\) \{\s*const tester = new \w+\(\);\s*await tester\.\w+\(\);/;
        const newMainFunction = `async function main() {
    const tester = new ${correctClass}();
    await tester.${correctMethod}();`;

        content = content.replace(mainFunctionRegex, newMainFunction);

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Fixed: ${path.basename(filePath)}`);
            return true;
        } else {
            console.log(`☑️  No changes needed: ${path.basename(filePath)}`);
            return true;
        }
    } catch (error) {
        console.error(`❌ Error fixing ${path.basename(filePath)}:`, error.message);
        return false;
    }
}

function main() {
    console.log('🔧 Fixing class names in test files...\n');

    let fixed = 0;
    let total = testFiles.length;

    for (const testFile of testFiles) {
        const filePath = path.join(__dirname, testFile.file);
        if (fs.existsSync(filePath)) {
            if (fixClassNames(filePath, testFile.correctClass, testFile.correctMethod)) {
                fixed++;
            }
        } else {
            console.log(`⚠️  File not found: ${testFile.file}`);
        }
    }

    console.log(`\n📊 Summary: Fixed ${fixed}/${total} files`);

    if (fixed === total) {
        console.log('🎉 All test files fixed successfully!');
    } else {
        console.log('⚠️  Some files could not be fixed.');
    }
}

if (require.main === module) {
    main();
}

module.exports = { fixClassNames };



