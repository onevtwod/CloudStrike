# Disaster Alert System - Testing Scripts

This directory contains comprehensive testing scripts for the disaster alert system. Each script tests a specific AWS service or component individually.

## 🚀 Quick Start

### Run All Tests
```bash
npm run test-all
# or
node test-all-components.js
```

### Run Individual Tests
```bash
# Using npm scripts
npm run test-aws
npm run test-dynamodb
npm run test-comprehend
npm run test-rekognition
npm run test-sns
npm run test-sqs
npm run test-s3
npm run test-secrets
npm run test-cloudwatch

# Using the test runner
node run-test.js aws
node run-test.js dynamodb
node run-test.js all
```

## 📁 Test Scripts

| Script | Purpose | Tests |
|--------|---------|-------|
| `test-aws-credentials.js` | AWS connectivity | STS, DynamoDB, SNS, SQS, S3, Comprehend, Rekognition, Secrets Manager, CloudWatch |
| `test-dynamodb-operations.js` | DynamoDB operations | CRUD operations, GSI queries, batch operations |
| `test-comprehend-analysis.js` | Text analysis | Entity detection, sentiment analysis, language detection |
| `test-rekognition-image.js` | Image analysis | Label detection, text extraction, moderation |
| `test-sns-notifications.js` | Notifications | Topic creation, subscriptions, message publishing |
| `test-sqs-operations.js` | Queue processing | Message sending/receiving, batch operations |
| `test-s3-operations.js` | File storage | Object upload/download, metadata, disaster images |
| `test-secrets-manager.js` | Credential management | Secret creation, retrieval, rotation |
| `test-cloudwatch-operations.js` | Monitoring | Metrics, logs, alarms |
| `test-all-components.js` | Comprehensive testing | All components in sequence |

## 🔧 Prerequisites

### AWS Credentials
Ensure your AWS credentials are configured:
```bash
aws configure
# or set environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1
```

### Required AWS Services
- DynamoDB (with `disaster-events` table)
- SNS
- SQS
- S3
- Amazon Comprehend
- Amazon Rekognition
- AWS Secrets Manager
- CloudWatch

### IAM Permissions
Your AWS user/role needs permissions for:
- DynamoDB: `dynamodb:*`
- SNS: `sns:*`
- SQS: `sqs:*`
- S3: `s3:*`
- Comprehend: `comprehend:*`
- Rekognition: `rekognition:*`
- Secrets Manager: `secretsmanager:*`
- CloudWatch: `cloudwatch:*`
- CloudWatch Logs: `logs:*`

## 📊 Test Output

Each test script provides:
- ✅ Success indicators for each operation
- ⏱️ Performance metrics (execution time)
- 📋 Detailed results summary
- 🧹 Automatic cleanup of test resources
- ❌ Clear error messages for failures

### Example Output
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

## 🐛 Troubleshooting

### Common Issues

1. **Credentials Not Found**
   ```
   Error: Credentials not found
   Solution: Run `aws configure` or set environment variables
   ```

2. **Table Not Found**
   ```
   Error: ResourceNotFoundException: Requested resource not found
   Solution: Deploy infrastructure first with `npm run deploy`
   ```

3. **Insufficient Permissions**
   ```
   Error: AccessDenied
   Solution: Check IAM permissions for required services
   ```

4. **Region Mismatch**
   ```
   Error: The security token included in the request is invalid
   Solution: Ensure all resources are in the same region
   ```

### Debug Mode
Run tests with verbose output:
```bash
DEBUG=1 node test-aws-credentials.js
```

## 🧹 Cleanup

All test scripts automatically clean up test resources:
- Test DynamoDB items are deleted
- Test S3 buckets and objects are removed
- Test SNS topics are deleted
- Test SQS queues are removed
- Test CloudWatch alarms are deleted
- Test log groups are removed
- Test secrets are deleted

## 📈 Performance Benchmarks

Expected performance for each service:
- AWS API calls: < 500ms
- DynamoDB operations: < 200ms
- Comprehend analysis: < 1000ms
- Rekognition analysis: < 2000ms
- S3 operations: < 1000ms
- SNS operations: < 300ms
- SQS operations: < 200ms

## 🔄 Continuous Testing

For continuous integration, you can run tests in sequence:
```bash
# Run all tests
npm run test-all

# Run specific component tests
npm run test-aws && npm run test-dynamodb && npm run test-comprehend
```

## 📝 Test Data

Test scripts use realistic disaster scenarios:
- **Flood reports**: "Heavy flooding reported in Kuala Lumpur city center"
- **Earthquake reports**: "Earthquake magnitude 5.2 hits Sabah"
- **Fire reports**: "Forest fire spreading rapidly in Cameron Highlands"
- **Tornado warnings**: "Tornado warning issued for Selangor"

## 🚀 Next Steps

After successful testing:
1. Deploy the system: `cd infra && npm run deploy`
2. Test API endpoints
3. Verify end-to-end functionality
4. Set up monitoring and alerting

## 📚 Additional Resources

- [AWS SDK Documentation](https://docs.aws.amazon.com/sdk-for-javascript/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [CloudWatch Monitoring](https://docs.aws.amazon.com/cloudwatch/)
- [SNS Best Practices](https://docs.aws.amazon.com/sns/latest/dg/sns-best-practices.html)
