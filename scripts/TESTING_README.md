# Real AWS System Testing Guide

This directory contains comprehensive test cases for testing your disaster detection system with real AWS services.

## ⚠️ Important Warnings

- **COSTS**: These tests will make real API calls to AWS services and may incur costs
- **RATE LIMITS**: Tests include rate limiting to respect AWS service limits
- **CREDENTIALS**: Ensure AWS credentials are properly configured
- **CLEANUP**: Some tests may create data that needs manual cleanup

## 🧪 Test Suites

### 1. Bedrock Analysis Tests (`test-bedrock-real.js`)
Tests AWS Bedrock analysis with real API calls.

**What it tests:**
- Disaster vs non-disaster classification
- JSON parsing and response handling
- Rate limiting and retry logic
- Error handling and fallback mechanisms

**Run:**
```bash
node scripts/test-bedrock-real.js
```

### 2. Integration Tests (`test-integration-real.js`)
Tests the complete integration between all AWS services.

**What it tests:**
- Complete disaster detection workflow
- SQS queue processing
- DynamoDB operations
- SNS alert system
- Duplicate detection
- Error recovery
- Performance under load

**Run:**
```bash
node scripts/test-integration-real.js
```

### 3. Complete System Tests (`test-real-aws-system.js`)
Comprehensive testing of all system components.

**What it tests:**
- AWS Bedrock analysis
- DynamoDB storage
- SQS operations
- SNS notifications
- End-to-end workflows
- Rate limiting
- Error handling
- Duplicate detection

**Run:**
```bash
node scripts/test-real-aws-system.js
```

### 4. All Tests (`run-all-tests.js`)
Runs all test suites in sequence.

**Run:**
```bash
node scripts/run-all-tests.js
```

## 🔧 Prerequisites

### Required Environment Variables
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

### Optional Environment Variables
```bash
export AWS_SESSION_TOKEN="your-session-token"  # For temporary credentials
export SOCIAL_MEDIA_QUEUE_URL="your-sqs-queue-url"
export ALERTS_TOPIC_ARN="your-sns-topic-arn"
export EVENTS_TABLE="your-dynamodb-table-name"
```

### AWS Permissions Required
- `bedrock:InvokeModel` - For Bedrock analysis
- `dynamodb:PutItem` - For storing data
- `dynamodb:Query` - For duplicate detection
- `sqs:SendMessage` - For queue operations
- `sqs:ReceiveMessage` - For queue processing
- `sqs:DeleteMessage` - For message cleanup
- `sns:Publish` - For sending alerts

## 📊 Test Data

### Disaster Posts (Should be classified as disasters)
- "Heavy flooding in KL! Water level rising rapidly, need immediate evacuation!"
- "Earthquake felt in Penang! My house shook for 30 seconds, everyone is safe."
- "Fire broke out in shopping mall! Smoke everywhere, people evacuating!"
- "Storm damage in Selangor! Trees down, power outages reported."

### Non-Disaster Posts (Should NOT be classified as disasters)
- "Uncle saved us from KL traffic today. Was stuck in a jam for 30 minutes."
- "Looking for good restaurants in PJ area. Any recommendations?"
- "Just had lunch at a nice cafe in KL. Food was amazing!"
- "Meeting at office tomorrow at 9 AM. Don't forget the presentation!"

### Edge Cases
- "Stuck in traffic due to road closure for construction work."
- "Heavy rain causing minor flooding in my garden."
- "Emergency services called to shopping mall for medical emergency."

## 🎯 Expected Results

### Accuracy Targets
- **Disaster Detection**: 80% accuracy
- **Non-Disaster Detection**: 90% accuracy
- **Overall Success Rate**: 95%

### Performance Targets
- **Average Response Time**: < 10 seconds
- **Max Response Time**: < 30 seconds
- **Rate Limiting**: 0.5 requests per second

## 📈 Monitoring

### CloudWatch Logs
Check AWS CloudWatch for detailed logs:
- `/aws/lambda/disaster-alert-system` - Lambda function logs
- Bedrock API call logs
- DynamoDB operation logs
- SQS processing logs

### Cost Monitoring
Monitor AWS costs in the billing dashboard:
- Bedrock API calls
- DynamoDB read/write operations
- SQS message processing
- SNS notifications

## 🚨 Troubleshooting

### Common Issues

1. **AWS Credentials Not Found**
   ```
   Error: AWS credentials not configured
   ```
   **Solution**: Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY

2. **Rate Limiting Errors**
   ```
   Error: ThrottlingException
   ```
   **Solution**: Tests include rate limiting, but you may need to increase delays

3. **Permission Denied**
   ```
   Error: AccessDeniedException
   ```
   **Solution**: Check IAM permissions for Bedrock, DynamoDB, SQS, SNS

4. **Service Not Available**
   ```
   Error: ServiceUnavailableException
   ```
   **Solution**: Check if services are available in your region

### Debug Mode
Set environment variable for detailed logging:
```bash
export LOG_LEVEL=debug
node scripts/test-bedrock-real.js
```

## 🧹 Cleanup

After testing, you may want to clean up test data:

### DynamoDB Cleanup
```bash
# Delete test items (replace with your table name)
aws dynamodb scan --table-name disaster-events --filter-expression "begins_with(id, :prefix)" --expression-attribute-values '{":prefix":{"S":"test_"}}' --query "Items[].id" --output text | xargs -I {} aws dynamodb delete-item --table-name disaster-events --key '{"id":{"S":"{}"}}'
```

### SQS Cleanup
```bash
# Purge test messages (replace with your queue URL)
aws sqs purge-queue --queue-url YOUR_QUEUE_URL
```

## 📝 Test Reports

Each test generates a detailed report including:
- Pass/fail counts
- Performance metrics
- Error details
- Recommendations

Save test results for future reference:
```bash
node scripts/run-all-tests.js > test-results-$(date +%Y%m%d).log 2>&1
```

## 🔄 Continuous Testing

For ongoing testing, consider:
- Running tests in a separate AWS account
- Using AWS CodeBuild for automated testing
- Setting up CloudWatch alarms for test failures
- Implementing test data cleanup automation

## 📞 Support

If you encounter issues:
1. Check AWS CloudWatch logs
2. Verify AWS permissions
3. Review test configuration
4. Check AWS service status
5. Contact AWS support if needed
