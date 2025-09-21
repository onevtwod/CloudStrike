# 🚀 CloudStrike Direct AWS Deployment Guide

## Quick Deployment Steps

### **Step 1: Deploy Infrastructure**
Run this command to create all AWS resources:

```cmd
cd C:\MMU\AWS\CloudStrike
deploy-infrastructure.bat
```

This will create:
- ✅ DynamoDB table (`disaster-events`)
- ✅ SNS topic (`disaster-alerts`)
- ✅ SQS queues (main, priority, dead-letter)
- ✅ S3 buckets (deployment, images)
- ✅ IAM roles and policies

### **Step 2: Deploy Lambda Functions**
Run this PowerShell script to build and deploy Lambda functions:

```powershell
cd C:\MMU\AWS\CloudStrike
.\deploy-lambda.ps1
```

This will:
- ✅ Build the application
- ✅ Create deployment packages
- ✅ Upload to S3
- ✅ Create 7 Lambda functions
- ✅ Set up API Gateway with routes
- ✅ Configure permissions

### **Step 3: Test the Deployment**
After deployment, test your API:

```bash
# Get your API URL from deployment-config.txt
# Test the health endpoint
curl https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod/events

# Test event ingestion
curl -X POST https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod/ingest/twitter \
  -H "Content-Type: application/json" \
  -d '{"text": "Earthquake in California!", "location": "California"}'
```

## Alternative: Manual AWS Console Deployment

### **Option 1: DynamoDB Table**
1. Go to AWS Console → DynamoDB
2. Create table: `disaster-events`
3. Primary key: `id` (String)
4. Add Global Secondary Indexes:
   - `LocationIndex`: Partition key `location`, Sort key `timestamp`
   - `TimestampIndex`: Partition key `timestamp`

### **Option 2: Lambda Functions**
1. Go to AWS Console → Lambda
2. Create function from scratch
3. Runtime: Node.js 20.x
4. Upload ZIP files (created by deploy-lambda.ps1)
5. Set environment variables:
   ```
   EVENTS_TABLE=disaster-events
   ALERTS_TOPIC_ARN=arn:aws:sns:us-east-1:ACCOUNT:disaster-alerts
   AWS_REGION=us-east-1
   ```

### **Option 3: API Gateway**
1. Go to AWS Console → API Gateway
2. Create HTTP API
3. Add routes:
   - `GET /events` → Link to `getEvents` Lambda
   - `POST /ingest/twitter` → Link to `processTweet` Lambda
   - `POST /subscribe` → Link to `subscribe` Lambda
4. Deploy to stage `prod`

## Environment Variables Needed

Create these in Lambda function configuration:
```
EVENTS_TABLE=disaster-events
ALERTS_TOPIC_ARN=arn:aws:sns:us-east-1:ACCOUNT_ID:disaster-alerts
SOCIAL_MEDIA_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/social-media-queue
PRIORITY_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/priority-queue
DEAD_LETTER_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/dead-letter-queue
IMAGES_BUCKET=cloudstrike-images-TIMESTAMP
AWS_REGION=us-east-1
NODE_ENV=production
```

## Required AWS Permissions

Your AWS user/role needs these permissions:
- `AmazonDynamoDBFullAccess`
- `AmazonSNSFullAccess`
- `AmazonSQSFullAccess`
- `AmazonS3FullAccess`
- `AWSLambdaFullAccess`
- `AmazonAPIGatewayAdministrator`
- `IAMFullAccess`
- `AmazonRekognitionFullAccess`
- `ComprehendFullAccess`

## Cost Optimization

- Use DynamoDB On-Demand pricing for variable workloads
- Set up CloudWatch alarms for cost monitoring
- Use S3 lifecycle policies for image cleanup
- Configure Lambda reserved concurrency if needed

## Monitoring

After deployment, monitor via:
- CloudWatch Logs for Lambda functions
- CloudWatch Metrics for API Gateway
- DynamoDB metrics for table performance
- SNS delivery metrics for notifications

## Troubleshooting

If deployment fails:
1. Check AWS CLI configuration: `aws configure list`
2. Verify permissions: `aws sts get-caller-identity`
3. Check region settings: All resources must be in same region
4. Review CloudWatch Logs for Lambda errors
5. Test individual components before full integration