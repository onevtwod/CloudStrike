#!/usr/bin/env node

/**
 * Fix string concatenation issues in test files
 * Replaces '=' * 60 with '='.repeat(60)
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
    'test-comprehend-analysis.js',
    'test-rekognition-image.js',
    'test-sns-notifications.js',
    'test-sqs-operations.js',
    'test-s3-operations.js',
    'test-secrets-manager.js',
    'test-cloudwatch-operations.js',
    'test-all-components.js',
    'run-test.js'
];

function fixStringConcat(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');

        // Replace '=' * number with '='.repeat(number)
        content = content.replace(/'=' \* (\d+)/g, "'='.repeat($1)");

        // Replace "=" * number with "=".repeat(number)
        content = content.replace(/"=" \* (\d+)/g, '"=".repeat($1)');

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed: ${filePath}`);
        return true;
    } catch (error) {
        console.error(`❌ Error fixing ${filePath}:`, error.message);
        return false;
    }
}

function main() {
    console.log('🔧 Fixing string concatenation issues in test files...\n');

    let fixed = 0;
    let total = testFiles.length;

    for (const file of testFiles) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            if (fixStringConcat(filePath)) {
                fixed++;
            }
        } else {
            console.log(`⚠️  File not found: ${file}`);
        }
    }

    console.log(`\n📊 Summary: Fixed ${fixed}/${total} files`);

    if (fixed === total) {
        console.log('🎉 All files fixed successfully!');
    } else {
        console.log('⚠️  Some files could not be fixed.');
    }
}

if (require.main === module) {
    main();
}

module.exports = { fixStringConcat };
