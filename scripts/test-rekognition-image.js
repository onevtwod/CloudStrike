#!/usr/bin/env node

/**
 * Test Amazon Rekognition Image Analysis
 * This script tests image analysis, label detection, and text extraction using Amazon Rekognition
 */

const { RekognitionClient, DetectLabelsCommand, DetectTextCommand, DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');
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

class RekognitionTester {
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.rekognition = new RekognitionClient({ region: this.region });
        this.results = [];

        // Sample images for testing (you can replace these with actual disaster images)
        this.testImages = [
            {
                name: 'flood-sample',
                description: 'Flood disaster image',
                path: this.createSampleImage('flood'),
                expectedLabels: ['Water', 'Flood', 'Disaster']
            },
            {
                name: 'fire-sample',
                description: 'Fire disaster image',
                path: this.createSampleImage('fire'),
                expectedLabels: ['Fire', 'Smoke', 'Disaster']
            },
            {
                name: 'earthquake-sample',
                description: 'Earthquake damage image',
                path: this.createSampleImage('earthquake'),
                expectedLabels: ['Building', 'Damage', 'Disaster']
            }
        ];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const color = type === 'success' ? colors.green :
            type === 'error' ? colors.red :
                type === 'warning' ? colors.yellow : colors.blue;

        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    createSampleImage(type) {
        // Create a simple test image file (in real scenario, you'd use actual disaster images)
        const testDir = path.join(__dirname, 'test-images');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const imagePath = path.join(testDir, `${type}-test.jpg`);

        // Create a minimal JPEG file for testing (1x1 pixel)
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

        if (!fs.existsSync(imagePath)) {
            fs.writeFileSync(imagePath, jpegData);
        }

        return imagePath;
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

    async testLabelDetection() {
        this.log('🏷️  Testing Label Detection', 'bold');

        for (const image of this.testImages) {
            if (!fs.existsSync(image.path)) {
                this.log(`   Skipping ${image.name} - file not found`, 'warning');
                continue;
            }

            const imageBytes = fs.readFileSync(image.path);

            const result = await this.testOperation(
                `Label Detection (${image.description})`,
                () => this.rekognition.send(new DetectLabelsCommand({
                    Image: { Bytes: imageBytes },
                    MaxLabels: 10,
                    MinConfidence: 50
                })),
                `Detect labels in ${image.name}`
            );

            if (result && result.Labels) {
                this.log(`   Found ${result.Labels.length} labels:`, 'info');
                result.Labels.forEach(label => {
                    this.log(`     - ${label.Name} (Confidence: ${(label.Confidence).toFixed(1)}%)`, 'info');
                });
            }
        }
    }

    async testTextDetection() {
        this.log('📝 Testing Text Detection', 'bold');

        for (const image of this.testImages) {
            if (!fs.existsSync(image.path)) {
                this.log(`   Skipping ${image.name} - file not found`, 'warning');
                continue;
            }

            const imageBytes = fs.readFileSync(image.path);

            const result = await this.testOperation(
                `Text Detection (${image.description})`,
                () => this.rekognition.send(new DetectTextCommand({
                    Image: { Bytes: imageBytes }
                })),
                `Extract text from ${image.name}`
            );

            if (result && result.TextDetections) {
                this.log(`   Found ${result.TextDetections.length} text detections:`, 'info');
                result.TextDetections.forEach(text => {
                    this.log(`     - "${text.DetectedText}" (Confidence: ${(text.Confidence).toFixed(1)}%)`, 'info');
                });
            }
        }
    }

    async testModerationDetection() {
        this.log('🛡️  Testing Moderation Detection', 'bold');

        for (const image of this.testImages) {
            if (!fs.existsSync(image.path)) {
                this.log(`   Skipping ${image.name} - file not found`, 'warning');
                continue;
            }

            const imageBytes = fs.readFileSync(image.path);

            const result = await this.testOperation(
                `Moderation Detection (${image.description})`,
                () => this.rekognition.send(new DetectModerationLabelsCommand({
                    Image: { Bytes: imageBytes },
                    MinConfidence: 50
                })),
                `Check moderation labels in ${image.name}`
            );

            if (result && result.ModerationLabels) {
                if (result.ModerationLabels.length > 0) {
                    this.log(`   Found ${result.ModerationLabels.length} moderation labels:`, 'warning');
                    result.ModerationLabels.forEach(label => {
                        this.log(`     - ${label.Name} (Confidence: ${(label.Confidence).toFixed(1)}%)`, 'warning');
                    });
                } else {
                    this.log(`   No moderation issues detected`, 'success');
                }
            }
        }
    }

    async testDisasterImageAnalysis() {
        this.log('🚨 Testing Disaster-Specific Image Analysis', 'bold');

        // Test with different disaster scenarios
        const disasterScenarios = [
            {
                name: 'flood',
                description: 'Flood disaster scenario',
                expectedLabels: ['Water', 'Flood', 'Disaster', 'Emergency']
            },
            {
                name: 'fire',
                description: 'Fire disaster scenario',
                expectedLabels: ['Fire', 'Smoke', 'Disaster', 'Emergency']
            },
            {
                name: 'earthquake',
                description: 'Earthquake damage scenario',
                expectedLabels: ['Building', 'Damage', 'Disaster', 'Emergency']
            }
        ];

        for (const scenario of disasterScenarios) {
            const imagePath = this.createSampleImage(scenario.name);

            if (!fs.existsSync(imagePath)) {
                this.log(`   Skipping ${scenario.name} - file not found`, 'warning');
                continue;
            }

            const imageBytes = fs.readFileSync(imagePath);

            const result = await this.testOperation(
                `Disaster Analysis (${scenario.description})`,
                () => this.rekognition.send(new DetectLabelsCommand({
                    Image: { Bytes: imageBytes },
                    MaxLabels: 20,
                    MinConfidence: 30
                })),
                `Analyze ${scenario.name} disaster image`
            );

            if (result && result.Labels) {
                const disasterLabels = result.Labels.filter(label =>
                    scenario.expectedLabels.some(expected =>
                        label.Name.toLowerCase().includes(expected.toLowerCase())
                    )
                );

                this.log(`   Disaster-related labels found:`, 'info');
                disasterLabels.forEach(label => {
                    this.log(`     - ${label.Name} (Confidence: ${(label.Confidence).toFixed(1)}%)`, 'info');
                });
            }
        }
    }

    async testBatchImageProcessing() {
        this.log('📦 Testing Batch Image Processing', 'bold');

        const imagePaths = this.testImages.map(img => img.path).filter(path => fs.existsSync(path));

        if (imagePaths.length === 0) {
            this.log('   No test images available for batch processing', 'warning');
            return;
        }

        await this.testOperation(
            'Batch Image Processing',
            async () => {
                const promises = imagePaths.map(imagePath => {
                    const imageBytes = fs.readFileSync(imagePath);
                    return this.rekognition.send(new DetectLabelsCommand({
                        Image: { Bytes: imageBytes },
                        MaxLabels: 5,
                        MinConfidence: 50
                    }));
                });
                return Promise.all(promises);
            },
            `Process ${imagePaths.length} images in parallel`
        );
    }

    async testRekognitionAnalysis() {
        this.log('👁️  Testing Amazon Rekognition Image Analysis', 'bold');
        this.log(`Region: ${this.region}`, 'info');
        this.log('='.repeat(60), 'info');

        await this.testLabelDetection();
        await this.testTextDetection();
        await this.testModerationDetection();
        await this.testDisasterImageAnalysis();
        await this.testBatchImageProcessing();

        this.cleanup();
        this.printSummary();
    }

    cleanup() {
        // Clean up test images
        const testDir = path.join(__dirname, 'test-images');
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    }

    printSummary() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 REKOGNITION TEST SUMMARY', 'bold');
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
            this.log('\n🎉 All Rekognition operations successful!', 'success');
        } else {
            this.log('\n⚠️  Some operations failed. Check Rekognition service availability.', 'warning');
        }
    }
}

// Run the test
async function main() {
    const tester = new RekognitionTester();
    await tester.testRekognitionImage();
    
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

module.exports = RekognitionTester;
