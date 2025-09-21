#!/usr/bin/env node

/**
 * S3 Operations Test
 * This test verifies S3 bucket operations for image storage and processing
 * 
 * Data Flow Position: 4 - Storage layer
 * Dependencies: AWS Credentials (test-aws-credentials.js)
 * Tests: Bucket creation, object upload/download, image processing, lifecycle policies
 */

const { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, PutBucketLifecycleConfigurationCommand } = require('@aws-sdk/client-s3');
const { GetObjectCommand: GetObjectCommandV3 } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

class S3OperationsTester {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.bucketName = process.env.S3_BUCKET || `disaster-alert-images-${Date.now()}`;
        this.client = new S3Client({ region: this.region });
        this.testObjects = [];
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

    async testBucketCreation() {
        this.log('🪣 Testing S3 bucket creation...', 'bold');

        try {
            // Check if bucket already exists
            try {
                const headCommand = new HeadBucketCommand({ Bucket: this.bucketName });
                await this.client.send(headCommand);
                this.log(`⚠️ Bucket ${this.bucketName} already exists`, 'warning');

                this.results.push({
                    test: 'Bucket Creation',
                    status: 'EXISTS',
                    details: {
                        bucketName: this.bucketName,
                        region: this.region
                    }
                });
                return true;
            } catch (error) {
                if (error.name !== 'NotFound') {
                    throw error;
                }
            }

            const command = new CreateBucketCommand({
                Bucket: this.bucketName,
                CreateBucketConfiguration: {
                    LocationConstraint: this.region === 'us-east-1' ? undefined : this.region
                }
            });

            const response = await this.client.send(command);

            this.results.push({
                test: 'Bucket Creation',
                status: 'SUCCESS',
                details: {
                    bucketName: this.bucketName,
                    region: this.region,
                    location: response.Location
                }
            });

            this.log(`✅ Bucket ${this.bucketName} created successfully`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Bucket Creation',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Bucket creation failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testObjectUpload() {
        this.log('📤 Testing object upload...', 'bold');

        try {
            // Create test image data (simulated)
            const testImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

            const testObjects = [
                {
                    key: 'test-images/earthquake-test.jpg',
                    body: testImageData,
                    contentType: 'image/jpeg',
                    metadata: {
                        'disaster-type': 'earthquake',
                        'location': 'test-location',
                        'timestamp': new Date().toISOString()
                    }
                },
                {
                    key: 'test-images/flood-test.jpg',
                    body: testImageData,
                    contentType: 'image/jpeg',
                    metadata: {
                        'disaster-type': 'flood',
                        'location': 'test-location-2',
                        'timestamp': new Date().toISOString()
                    }
                },
                {
                    key: 'test-images/fire-test.jpg',
                    body: testImageData,
                    contentType: 'image/jpeg',
                    metadata: {
                        'disaster-type': 'fire',
                        'location': 'test-location-3',
                        'timestamp': new Date().toISOString()
                    }
                }
            ];

            for (const obj of testObjects) {
                const command = new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: obj.key,
                    Body: obj.body,
                    ContentType: obj.contentType,
                    Metadata: obj.metadata
                });

                const response = await this.client.send(command);
                this.testObjects.push(obj.key);

                this.log(`   ✅ Uploaded: ${obj.key}`, 'success');
            }

            this.results.push({
                test: 'Object Upload',
                status: 'SUCCESS',
                details: {
                    objectsUploaded: testObjects.length,
                    bucketName: this.bucketName,
                    objectKeys: testObjects.map(obj => obj.key)
                }
            });

            this.log(`✅ Uploaded ${testObjects.length} test objects successfully`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Object Upload',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Object upload failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testObjectDownload() {
        this.log('📥 Testing object download...', 'bold');

        if (this.testObjects.length === 0) {
            this.log('⚠️ No test objects available for download test', 'warning');
            return false;
        }

        try {
            const testKey = this.testObjects[0];
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: testKey
            });

            const response = await this.client.send(command);
            const chunks = [];

            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }

            const objectData = Buffer.concat(chunks);
            const metadata = response.Metadata || {};

            this.results.push({
                test: 'Object Download',
                status: 'SUCCESS',
                details: {
                    objectKey: testKey,
                    size: objectData.length,
                    contentType: response.ContentType,
                    metadata: metadata,
                    lastModified: response.LastModified
                }
            });

            this.log(`✅ Downloaded ${testKey} (${objectData.length} bytes)`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Object Download',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Object download failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testObjectListing() {
        this.log('📋 Testing object listing...', 'bold');

        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: 'test-images/',
                MaxKeys: 100
            });

            const response = await this.client.send(command);
            const objects = response.Contents || [];

            this.results.push({
                test: 'Object Listing',
                status: 'SUCCESS',
                details: {
                    totalObjects: objects.length,
                    bucketName: this.bucketName,
                    prefix: 'test-images/',
                    objectKeys: objects.map(obj => obj.Key)
                }
            });

            this.log(`✅ Listed ${objects.length} objects in bucket`, 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Object Listing',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Object listing failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testImageMetadata() {
        this.log('🏷️ Testing image metadata...', 'bold');

        if (this.testObjects.length === 0) {
            this.log('⚠️ No test objects available for metadata test', 'warning');
            return false;
        }

        try {
            const testKey = this.testObjects[0];
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: testKey
            });

            const response = await this.client.send(command);
            const metadata = response.Metadata || {};

            // Check for disaster-specific metadata
            const hasDisasterType = metadata['disaster-type'] !== undefined;
            const hasLocation = metadata['location'] !== undefined;
            const hasTimestamp = metadata['timestamp'] !== undefined;

            this.results.push({
                test: 'Image Metadata',
                status: hasDisasterType && hasLocation ? 'SUCCESS' : 'WARNING',
                details: {
                    objectKey: testKey,
                    metadata: metadata,
                    hasDisasterType: hasDisasterType,
                    hasLocation: hasLocation,
                    hasTimestamp: hasTimestamp
                }
            });

            if (hasDisasterType && hasLocation) {
                this.log(`✅ Image metadata complete - Type: ${metadata['disaster-type']}, Location: ${metadata['location']}`, 'success');
            } else {
                this.log(`⚠️ Image metadata incomplete`, 'warning');
            }

            return hasDisasterType && hasLocation;

        } catch (error) {
            this.results.push({
                test: 'Image Metadata',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Image metadata test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testLifecyclePolicy() {
        this.log('⏰ Testing lifecycle policy...', 'bold');

        try {
            const command = new PutBucketLifecycleConfigurationCommand({
                Bucket: this.bucketName,
                LifecycleConfiguration: {
                    Rules: [
                        {
                            ID: 'DisasterImageCleanup',
                            Status: 'Enabled',
                            Filter: {
                                Prefix: 'test-images/'
                            },
                            Expiration: {
                                Days: 7
                            },
                            Transitions: [
                                {
                                    Days: 1,
                                    StorageClass: 'STANDARD_IA'
                                },
                                {
                                    Days: 3,
                                    StorageClass: 'GLACIER'
                                }
                            ]
                        }
                    ]
                }
            });

            await this.client.send(command);

            this.results.push({
                test: 'Lifecycle Policy',
                status: 'SUCCESS',
                details: {
                    bucketName: this.bucketName,
                    policyId: 'DisasterImageCleanup',
                    expirationDays: 7,
                    transitions: ['STANDARD_IA', 'GLACIER']
                }
            });

            this.log('✅ Lifecycle policy configured successfully', 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Lifecycle Policy',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Lifecycle policy configuration failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testBucketPermissions() {
        this.log('🔒 Testing bucket permissions...', 'bold');

        try {
            // Test read permission
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucketName,
                MaxKeys: 1
            });
            await this.client.send(listCommand);

            // Test write permission
            const testKey = 'permission-test-' + Date.now() + '.txt';
            const putCommand = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: testKey,
                Body: 'Permission test content'
            });
            await this.client.send(putCommand);

            // Test delete permission
            const deleteCommand = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: testKey
            });
            await this.client.send(deleteCommand);

            this.results.push({
                test: 'Bucket Permissions',
                status: 'SUCCESS',
                details: {
                    readPermission: true,
                    writePermission: true,
                    deletePermission: true
                }
            });

            this.log('✅ Bucket permissions are correct', 'success');
            return true;

        } catch (error) {
            this.results.push({
                test: 'Bucket Permissions',
                status: 'FAILED',
                error: error.message
            });

            this.log(`❌ Permission test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async cleanupTestObjects() {
        this.log('🧹 Cleaning up test objects...', 'info');

        let cleanedCount = 0;

        for (const objectKey of this.testObjects) {
            try {
                const command = new DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: objectKey
                });

                await this.client.send(command);
                cleanedCount++;
                this.log(`   ✅ Deleted: ${objectKey}`, 'success');

            } catch (error) {
                this.log(`   ⚠️ Failed to delete ${objectKey}: ${error.message}`, 'warning');
            }
        }

        this.log(`✅ Cleaned up ${cleanedCount} test objects`, 'success');
        return cleanedCount;
    }

    async runAllTests() {
        this.log('🚀 Starting S3 Operations Test', 'bold');
        this.log('='.repeat(60), 'bold');
        this.log(`Bucket: ${this.bucketName}`, 'info');
        this.log(`Region: ${this.region}`, 'info');
        this.log(`Start Time: ${new Date().toISOString()}`, 'info');
        this.log('='.repeat(60), 'bold');

        const tests = [
            () => this.testBucketCreation(),
            () => this.testObjectUpload(),
            () => this.testObjectDownload(),
            () => this.testObjectListing(),
            () => this.testImageMetadata(),
            () => this.testLifecyclePolicy(),
            () => this.testBucketPermissions()
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
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Cleanup test objects
        await this.cleanupTestObjects();

        this.printSummary(successCount, totalCount);
    }

    printSummary(successCount, totalCount) {
        const totalDuration = Date.now() - this.startTime;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);

        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 S3 OPERATIONS TEST SUMMARY', 'bold');
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
            this.log('🎉 S3 operations complete! Ready for image processing.', 'success');
            this.log('   • Run: node test-sns-setup.js', 'info');
            this.log('   • Configure S3_BUCKET environment variable', 'info');
        } else {
            this.log('⚠️ Some tests failed. Please check:', 'warning');
            this.log('   • AWS permissions for S3', 'info');
            this.log('   • Bucket naming conventions', 'info');
            this.log('   • Region configuration', 'info');
        }

        this.log('\n' + '='.repeat(60), 'bold');
    }
}

// Run the test
async function main() {
    const tester = new S3OperationsTester();
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = S3OperationsTester;