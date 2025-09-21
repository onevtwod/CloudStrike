#!/usr/bin/env node

/**
 * Fix Test Exit Codes
 * Updates all test files to exit with non-zero code when tests fail
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
    'test-aws-credentials.js',
    'test-dynamodb-operations.js',
    'test-comprehend-analysis.js',
    'test-rekognition-image.js',
    'test-sns-notifications.js',
    'test-sqs-operations.js',
    'test-s3-operations.js',
    'test-secrets-manager.js',
    'test-cloudwatch-operations.js'
];

function fixTestExitCode(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');

        // Check if the file already has the exit code fix
        if (content.includes('process.exit(1)')) {
            console.log(`✅ Already fixed: ${path.basename(filePath)}`);
            return true;
        }

        // Find the main function and add exit code logic
        const mainFunctionRegex = /async function main\(\) \{\s*const tester = new \w+\(\);\s*await tester\.\w+\(\);\s*\}/;
        const match = content.match(mainFunctionRegex);

        if (match) {
            const newMainFunction = `async function main() {
    const tester = new ${getTesterClassName(filePath)}();
    await tester.${getTestMethodName(filePath)}();
    
    // Exit with non-zero code if any tests failed
    const successCount = tester.results.filter(r => r.status === 'SUCCESS').length;
    const totalCount = tester.results.length;
    
    if (successCount !== totalCount) {
        process.exit(1);
    }
}`;

            content = content.replace(mainFunctionRegex, newMainFunction);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Fixed: ${path.basename(filePath)}`);
            return true;
        } else {
            console.log(`⚠️  Could not find main function in: ${path.basename(filePath)}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error fixing ${path.basename(filePath)}:`, error.message);
        return false;
    }
}

function getTesterClassName(filePath) {
    const filename = path.basename(filePath, '.js');
    const parts = filename.split('-');
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('') + 'Tester';
}

function getTestMethodName(filePath) {
    const filename = path.basename(filePath, '.js');
    const parts = filename.split('-');
    return 'test' + parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function main() {
    console.log('🔧 Fixing test exit codes...\n');

    let fixed = 0;
    let total = testFiles.length;

    for (const file of testFiles) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            if (fixTestExitCode(filePath)) {
                fixed++;
            }
        } else {
            console.log(`⚠️  File not found: ${file}`);
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

module.exports = { fixTestExitCode };
