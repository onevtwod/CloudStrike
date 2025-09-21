#!/usr/bin/env node

/**
 * Test S3 Operations
 * This script tests S3 bucket creation, object upload/download, and image storage functionality
 */

const { S3Client, CreateBucketCommand, ListBucketsCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteBucketCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class S3Tester {
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.s3 = new S3Client({ region: this.region });
        this.results = [];
        this.testBucketName = `disaster-alert-test-${Date.now()}`;
        this.testFiles = [];
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

    createTestFile(filename, content) {
        const testDir = path.join(__dirname, 'test-files');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const filePath = path.join(testDir, filename);
        fs.writeFileSync(filePath, content);
        this.testFiles.push(filePath);
        return filePath;
    }

    async testBucketCreation() {
        this.log('🪣 Testing S3 Bucket Creation', 'bold');

        const result = await this.testOperation(
            'Create Bucket',
            () => this.s3.send(new CreateBucketCommand({
                Bucket: this.testBucketName,
                CreateBucketConfiguration: {
                    LocationConstraint: this.region === 'us-east-1' ? undefined : this.region
                }
            })),
            `Create test bucket: ${this.testBucketName}`
        );

        if (result && result.Location) {
            this.log(`   Bucket Location: ${result.Location}`, 'info');
        }

        return result;
    }

    async testListBuckets() {
        this.log('📋 Testing List Buckets', 'bold');

        const result = await this.testOperation(
            'List Buckets',
            () => this.s3.send(new ListBucketsCommand({})),
            'List all S3 buckets'
        );

        if (result && result.Buckets) {
            this.log(`   Found ${result.Buckets.length} buckets:`, 'info');
            result.Buckets.forEach(bucket => {
                this.log(`     - ${bucket.Name} (Created: ${bucket.CreationDate})`, 'info');
            });
        }

        return result;
    }

    async testObjectUpload() {
        this.log('📤 Testing Object Upload', 'bold');

        // Create test files
        const testFiles = [
            {
                key: 'disaster-images/flood-test.jpg',
                content: this.createTestImage('flood'),
                description: 'Flood disaster image'
            },
            {
                key: 'disaster-images/fire-test.jpg',
                content: this.createTestImage('fire'),
                description: 'Fire disaster image'
            },
            {
                key: 'disaster-data/test-event.json',
                content: JSON.stringify({
                    id: 'test-event-1',
                    type: 'flood',
                    location: 'Kuala Lumpur',
                    timestamp: new Date().toISOString(),
                    severity: 'high',
                    description: 'Test disaster event data'
                }, null, 2),
                description: 'Disaster event JSON data'
            },
            {
                key: 'processed-data/analysis-results.json',
                content: JSON.stringify({
                    eventId: 'test-event-1',
                    analysisResults: {
                        entities: ['flood', 'Kuala Lumpur', 'emergency'],
                        sentiment: 'negative',
                        confidence: 0.85
                    },
                    processedAt: new Date().toISOString()
                }, null, 2),
                description: 'Processed analysis results'
            }
        ];

        const uploadResults = [];

        for (const file of testFiles) {
            const result = await this.testOperation(
                `Upload Object (${file.description})`,
                () => this.s3.send(new PutObjectCommand({
                    Bucket: this.testBucketName,
                    Key: file.key,
                    Body: file.content,
                    ContentType: file.key.endsWith('.json') ? 'application/json' : 'image/jpeg',
                    Metadata: {
                        'disaster-type': file.key.includes('flood') ? 'flood' :
                            file.key.includes('fire') ? 'fire' : 'unknown',
                        'upload-timestamp': new Date().toISOString()
                    }
                })),
                `Upload ${file.description} to S3`
            );

            if (result && result.ETag) {
                this.log(`   ETag: ${result.ETag}`, 'info');
            }

            uploadResults.push(result);
        }

        return uploadResults;
    }

    async testObjectDownload() {
        this.log('📥 Testing Object Download', 'bold');

        const testKeys = [
            'disaster-data/test-event.json',
            'processed-data/analysis-results.json'
        ];

        const downloadResults = [];

        for (const key of testKeys) {
            const result = await this.testOperation(
                `Download Object (${key})`,
                async () => {
                    const response = await this.s3.send(new GetObjectCommand({
                        Bucket: this.testBucketName,
                        Key: key
                    }));

                    // Convert stream to string
                    const chunks = [];
                    for await (const chunk of response.Body) {
                        chunks.push(chunk);
                    }
                    const content = Buffer.concat(chunks).toString();

                    return {
                        content,
                        contentType: response.ContentType,
                        metadata: response.Metadata
                    };
                },
                `Download ${key} from S3`
            );

            if (result && result.content) {
                this.log(`   Content Type: ${result.contentType}`, 'info');
                this.log(`   Content Length: ${result.content.length} bytes`, 'info');
                if (result.metadata) {
                    this.log(`   Metadata:`, 'info');
                    Object.entries(result.metadata).forEach(([key, value]) => {
                        this.log(`     ${key}: ${value}`, 'info');
                    });
                }
            }

            downloadResults.push(result);
        }

        return downloadResults;
    }

    async testObjectMetadata() {
        this.log('📊 Testing Object Metadata', 'bold');

        const testKey = 'disaster-images/flood-test.jpg';

        const result = await this.testOperation(
            'Get Object Metadata',
            () => this.s3.send(new HeadObjectCommand({
                Bucket: this.testBucketName,
                Key: testKey
            })),
            `Get metadata for ${testKey}`
        );

        if (result) {
            this.log(`   Object Metadata:`, 'info');
            this.log(`     Content Type: ${result.ContentType}`, 'info');
            this.log(`     Content Length: ${result.ContentLength} bytes`, 'info');
            this.log(`     Last Modified: ${result.LastModified}`, 'info');
            this.log(`     ETag: ${result.ETag}`, 'info');
            if (result.Metadata) {
                this.log(`     Custom Metadata:`, 'info');
                Object.entries(result.Metadata).forEach(([key, value]) => {
                    this.log(`       ${key}: ${value}`, 'info');
                });
            }
        }

        return result;
    }

    async testDisasterImageStorage() {
        this.log('🚨 Testing Disaster Image Storage', 'bold');

        const disasterImages = [
            {
                key: 'disaster-images/flood-2024-01-15-001.jpg',
                content: this.createTestImage('flood'),
                metadata: {
                    'disaster-type': 'flood',
                    'location': 'Kuala Lumpur',
                    'severity': 'high',
                    'timestamp': new Date().toISOString(),
                    'source': 'social_media'
                }
            },
            {
                key: 'disaster-images/earthquake-2024-01-15-002.jpg',
                content: this.createTestImage('earthquake'),
                metadata: {
                    'disaster-type': 'earthquake',
                    'location': 'Sabah',
                    'severity': 'medium',
                    'timestamp': new Date().toISOString(),
                    'source': 'news_api'
                }
            }
        ];

        const storageResults = [];

        for (const image of disasterImages) {
            const result = await this.testOperation(
                `Store Disaster Image (${image.metadata['disaster-type']})`,
                () => this.s3.send(new PutObjectCommand({
                    Bucket: this.testBucketName,
                    Key: image.key,
                    Body: image.content,
                    ContentType: 'image/jpeg',
                    Metadata: image.metadata
                })),
                `Store ${image.metadata['disaster-type']} disaster image`
            );

            if (result && result.ETag) {
                this.log(`   Stored: ${image.key}`, 'info');
                this.log(`   ETag: ${result.ETag}`, 'info');
            }

            storageResults.push(result);
        }

        return storageResults;
    }

    async testBatchOperations() {
        this.log('📦 Testing Batch Operations', 'bold');

        const batchFiles = Array.from({ length: 3 }, (_, i) => ({
            key: `batch-test/file-${i}.json`,
            content: JSON.stringify({
                id: `batch-file-${i}`,
                timestamp: new Date().toISOString(),
                data: `Batch test data ${i}`
            })
        }));

        const result = await this.testOperation(
            'Batch Upload',
            async () => {
                const promises = batchFiles.map(file =>
                    this.s3.send(new PutObjectCommand({
                        Bucket: this.testBucketName,
                        Key: file.key,
                        Body: file.content,
                        ContentType: 'application/json'
                    }))
                );
                return Promise.all(promises);
            },
            `Upload ${batchFiles.length} files in batch`
        );

        if (result) {
            this.log(`   Uploaded ${result.length} files successfully`, 'info');
        }

        return result;
    }

    createTestImage(type) {
        // Create a minimal JPEG file for testing
        const jpegData = Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
            0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
            0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
            0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x00, 0xFF, 0xD9
        ]);

        return jpegData;
    }

    async testS3Operations() {
        this.log('🪣 Testing S3 Operations', 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log(`Test Bucket: ${this.testBucketName}`, 'info');
        this.log('='.repeat(60), 'info');

        await this.testListBuckets();
        await this.testBucketCreation();
        await this.testObjectUpload();
        await this.testObjectDownload();
        await this.testObjectMetadata();
        await this.testDisasterImageStorage();
        await this.testBatchOperations();

        // Cleanup
        await this.cleanup();

        this.printSummary();
    }

    async cleanup() {
        this.log('🧹 Cleaning up test resources...', 'info');

        try {
            // Delete all objects in the bucket
            const objects = [
                'disaster-images/flood-test.jpg',
                'disaster-images/fire-test.jpg',
                'disaster-data/test-event.json',
                'processed-data/analysis-results.json',
                'disaster-images/flood-2024-01-15-001.jpg',
                'disaster-images/earthquake-2024-01-15-002.jpg'
            ];

            for (const key of objects) {
                try {
                    await this.s3.send(new DeleteObjectCommand({
                        Bucket: this.testBucketName,
                        Key: key
                    }));
                } catch (error) {
                    // Ignore errors for objects that don't exist
                }
            }

            // Delete the bucket
            await this.s3.send(new DeleteBucketCommand({
                Bucket: this.testBucketName
            }));

            this.log('   Test bucket and objects deleted successfully', 'success');
        } catch (error) {
            this.log(`   Failed to cleanup: ${error.message}`, 'warning');
        }

        // Clean up local test files
        const testDir = path.join(__dirname, 'test-files');
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    }

    printSummary() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 S3 TEST SUMMARY', 'bold');
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
            this.log('\n🎉 All S3 operations successful!', 'success');
        } else {
            this.log('\n⚠️  Some operations failed. Check S3 service availability.', 'warning');
        }
    }
}

// Run the test
async function main() {
    const tester = new S3Tester();
    await tester.testS3Operations();
    
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

module.exports = S3Tester;
