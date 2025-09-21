# Disaster Alert System - Testing Guide

This guide provides comprehensive testing instructions for each component of the disaster alert system. You can test individual components or run all tests together.

## 🚀 Quick Start

### Run All Tests
```bash
cd scripts
npm run test-all
```

### Run Individual Component Tests
```bash
cd scripts
npm run test-aws          # Test AWS credentials
npm run test-dynamodb     # Test DynamoDB operations
npm run test-comprehend   # Test Amazon Comprehend
npm run test-rekognition  # Test Amazon Rekognition
npm run test-sns          # Test SNS notifications
npm run test-sqs          # Test SQS queues
npm run test-s3           # Test S3 storage
npm run test-secrets      # Test Secrets Manager
npm run test-cloudwatch   # Test CloudWatch monitoring
```

## 📋 Test Components Overview

### 1. AWS Credentials Test (`test-aws-credentials.js`)
**Purpose**: Verify AWS credentials and basic service connectivity

**What it tests**:
- AWS STS identity verification
- DynamoDB service access
- SNS service access
- SQS service access
- S3 service access
- Comprehend service access
- Rekognition service access
- Secrets Manager access
- CloudWatch access

**Prerequisites**:
- Valid AWS credentials configured
- Appropriate IAM permissions

**Expected Output**:
```
🔐 Testing AWS Credentials and Basic Connectivity
Region: us-east-1
============================================================
✓ STS - Get AWS account identity (45ms)
✓ DynamoDB - List DynamoDB tables (123ms)
✓ SNS - List SNS topics (67ms)
...
🎉 All tests passed! AWS credentials are properly configured.
```

### 2. DynamoDB Operations Test (`test-dynamodb-operations.js`)
**Purpose**: Test DynamoDB table operations and GSI functionality

**What it tests**:
- Put item operations
- Get item operations
- Query by GSI (verified index)
- Scan table operations
- Batch operations
- Complex queries with filters
- Update operations
- Delete operations

**Prerequisites**:
- DynamoDB table `disaster-events` exists
- GSI `verified-index` configured
- Appropriate IAM permissions

**Expected Output**:
```
🗄️  Testing DynamoDB Operations
Table: disaster-events
Region: us-east-1
============================================================
✓ Put Item - Insert test disaster event (89ms)
✓ Get Item - Retrieve test disaster event by ID (45ms)
✓ Query GSI - Query verified events using GSI (67ms)
...
🎉 All DynamoDB operations successful!
```

### 3. Comprehend Analysis Test (`test-comprehend-analysis.js`)
**Purpose**: Test Amazon Comprehend text analysis and entity detection

**What it tests**:
- Language detection (English/Malay)
- Entity detection for disaster scenarios
- Sentiment analysis
- Disaster-specific entity extraction
- Batch processing

**Test Data**:
- Flood reports in English and Malay
- Earthquake reports
- Fire disaster reports
- Tornado warnings

**Expected Output**:
```
🧠 Testing Amazon Comprehend Analysis
Region: us-east-1
============================================================
✓ Language Detection (English flood report) - Detect language (123ms)
✓ Entity Detection (English flood report) - Extract entities (156ms)
   Found 4 entities:
     - LOCATION: "Kuala Lumpur" (Confidence: 95.2%)
     - EVENT: "flooding" (Confidence: 87.3%)
...
🎉 All Comprehend operations successful!
```

### 4. Rekognition Image Test (`test-rekognition-image.js`)
**Purpose**: Test Amazon Rekognition image analysis and label detection

**What it tests**:
- Label detection for disaster images
- Text detection in images
- Moderation detection
- Disaster-specific image analysis
- Batch image processing

**Test Data**:
- Sample flood images
- Sample fire images
- Sample earthquake damage images

**Expected Output**:
```
👁️  Testing Amazon Rekognition Image Analysis
Region: us-east-1
============================================================
✓ Label Detection (Flood disaster image) - Detect labels (234ms)
   Found 8 labels:
     - Water (Confidence: 89.2%)
     - Flood (Confidence: 76.5%)
...
🎉 All Rekognition operations successful!
```

### 5. SNS Notifications Test (`test-sns-notifications.js`)
**Purpose**: Test SNS topic creation and notification publishing

**What it tests**:
- Topic creation
- Subscription management (email, SMS, HTTP)
- Message publishing
- Disaster alert message formatting
- Batch publishing

**Expected Output**:
```
📢 Testing SNS Service
Region: us-east-1
============================================================
✓ Create Topic - Create test topic (123ms)
✓ Email Subscription - Subscribe email endpoint (89ms)
✓ Publish Message (Flood disaster alert) - Publish message (67ms)
   Message ID: 12345678-1234-1234-1234-123456789012
...
🎉 All SNS operations successful!
```

### 6. SQS Operations Test (`test-sqs-operations.js`)
**Purpose**: Test SQS queue operations and message processing

**What it tests**:
- Queue creation
- Message sending
- Message receiving
- Message processing simulation
- Queue attributes
- Batch operations

**Expected Output**:
```
📦 Testing SQS Operations
Region: us-east-1
============================================================
✓ Create Queue - Create test queue (156ms)
✓ Send Message (Flood disaster message) - Send message (45ms)
✓ Receive Messages - Receive messages (123ms)
   Received 3 messages:
     Message 1:
       ID: 12345678-1234-1234-1234-123456789012
       Body: {"id":"msg-1","type":"flood"...
...
🎉 All SQS operations successful!
```

### 7. S3 Storage Test (`test-s3-operations.js`)
**Purpose**: Test S3 bucket operations for image storage

**What it tests**:
- Bucket creation
- Object upload (images, JSON data)
- Object download
- Object metadata
- Disaster image storage
- Batch operations

**Expected Output**:
```
🪣 Testing S3 Operations
Region: us-east-1
Test Bucket: disaster-alert-test-1234567890
============================================================
✓ Create Bucket - Create test bucket (234ms)
✓ Upload Object (Flood disaster image) - Upload image (123ms)
   ETag: "d41d8cd98f00b204e9800998ecf8427e"
...
🎉 All S3 operations successful!
```

### 8. Secrets Manager Test (`test-secrets-manager.js`)
**Purpose**: Test AWS Secrets Manager integration

**What it tests**:
- Secret creation
- Secret retrieval
- Secret updates
- Secret validation
- Disaster alert specific secrets
- Secret rotation simulation

**Expected Output**:
```
🔐 Testing AWS Secrets Manager
Region: us-east-1
Test Secret: disaster-alert-test-secret-1234567890
============================================================
✓ Create Secret - Create test secret (156ms)
✓ Get Secret Value - Retrieve secret value (89ms)
   Retrieved secret with 6 keys:
     twitterBearerToken: test-...345
     redditClientId: test-...id
...
🎉 All Secrets Manager operations successful!
```

### 9. CloudWatch Test (`test-cloudwatch-operations.js`)
**Purpose**: Test CloudWatch metrics and monitoring

**What it tests**:
- Custom metrics publishing
- Metric statistics retrieval
- Log group creation
- Log events publishing
- Alarm creation
- Disaster alert specific metrics

**Expected Output**:
```
☁️  Testing CloudWatch Operations
Region: us-east-1
Test Log Group: /aws/lambda/disaster-alert-test-1234567890
Test Alarm: disaster-alert-test-alarm-1234567890
============================================================
✓ Put Custom Metrics - Publish 4 custom disaster alert metrics (234ms)
✓ Create Log Group - Create test log group (123ms)
✓ Put Log Events - Publish 5 log events (89ms)
...
🎉 All CloudWatch operations successful!
```

## 🔧 Troubleshooting

### Common Issues

#### 1. AWS Credentials Not Found
**Error**: `Credentials not found`
**Solution**: 
```bash
aws configure
# or
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1
```

#### 2. DynamoDB Table Not Found
**Error**: `ResourceNotFoundException: Requested resource not found`
**Solution**: 
```bash
cd infra
npm run deploy
# or create table manually
```

#### 3. Insufficient Permissions
**Error**: `AccessDenied`
**Solution**: Check IAM permissions for the required services

#### 4. Region Mismatch
**Error**: `The security token included in the request is invalid`
**Solution**: Ensure all resources are in the same region

### Debug Mode

Run individual tests with verbose output:
```bash
DEBUG=1 node test-aws-credentials.js
```

## 📊 Test Results Interpretation

### Success Indicators
- ✅ All operations completed successfully
- ✅ No error messages in output
- ✅ All expected data structures returned
- ✅ Performance within acceptable limits

### Failure Indicators
- ❌ Error messages in output
- ❌ Missing expected data
- ❌ Timeout errors
- ❌ Permission denied errors

### Performance Benchmarks
- AWS API calls: < 500ms
- DynamoDB operations: < 200ms
- Comprehend analysis: < 1000ms
- Rekognition analysis: < 2000ms
- S3 operations: < 1000ms

## 🚀 Next Steps After Testing

1. **All Tests Pass**: Deploy the system
   ```bash
   cd infra
   npm run deploy
   ```

2. **Some Tests Fail**: Fix issues before deployment
   - Check AWS credentials and permissions
   - Verify service availability in your region
   - Review error messages for specific issues

3. **Integration Testing**: Test the complete flow
   - Deploy the system
   - Test API endpoints
   - Verify end-to-end functionality

## 📝 Test Data Cleanup

All test scripts automatically clean up test resources:
- Test DynamoDB items are deleted
- Test S3 buckets and objects are removed
- Test SNS topics are deleted
- Test SQS queues are removed
- Test CloudWatch alarms are deleted
- Test log groups are removed
- Test secrets are deleted

## 🔍 Monitoring Test Results

The comprehensive test runner provides detailed reporting:
- Individual test results
- Performance metrics
- Error details
- Success/failure rates
- Total execution time

Use this information to identify bottlenecks and optimize your system before deployment.
