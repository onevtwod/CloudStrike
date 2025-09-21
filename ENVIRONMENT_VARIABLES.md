# Environment Variables Management

This document explains how environment variables are managed in the AWS disaster detection system.

## 🏗️ **Architecture Overview**

### **Local Development** (.env file)
- Used only for local development
- Contains API keys and configuration
- **Never committed to git**

### **AWS Deployment** (Serverless Framework)
- Environment variables defined in `infra/serverless.yml`
- Automatically injected into Lambda functions
- Sensitive data stored in AWS Secrets Manager

## 📁 **File Structure**

```
HackathonAWS/
├── .env                    # Local development (gitignored)
├── .env.example           # Template for local setup
├── infra/
│   └── serverless.yml     # AWS environment variables
└── ENVIRONMENT_VARIABLES.md # This file
```

## 🔧 **Local Development Setup**

### **1. Create .env file**
```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

### **2. .env.example template**
```bash
# External API Keys
MAPS_API_KEY=your_google_maps_api_key_here

# Application Configuration
NODE_ENV=development
LOG_LEVEL=debug

# AWS Configuration (for local testing)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Social Media API Credentials (for local testing)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
NEWS_API_KEY=your_news_api_key
```

## ☁️ **AWS Deployment Configuration**

### **Environment Variables in serverless.yml**

```yaml
provider:
  environment:
    # DynamoDB
    EVENTS_TABLE: ${self:resources.Resources.EventsTable.Properties.TableName}
    
    # SNS
    ALERTS_TOPIC_ARN: { Ref: AlertsTopic }
    
    # SQS Queues
    SOCIAL_MEDIA_QUEUE_URL: { Ref: SocialMediaQueue }
    PRIORITY_QUEUE_URL: { Ref: PriorityQueue }
    DEAD_LETTER_QUEUE_URL: { Ref: DeadLetterQueue }
    
    # S3
    IMAGES_BUCKET: { Ref: ImagesBucket }
    
    # External APIs (from local .env for deployment)
    MAPS_API_KEY: ${env:MAPS_API_KEY, ''}
    
    # AWS Secrets Manager
    SOCIAL_MEDIA_CREDENTIALS_SECRET: disaster-alert/social-media-credentials
    
    # AWS Account Info
    AWS_ACCOUNT_ID: { Ref: AWS::AccountId }
    AWS_REGION: ${self:provider.region}
    
    # Application Configuration
    NODE_ENV: ${env:NODE_ENV, 'production'}
    LOG_LEVEL: ${env:LOG_LEVEL, 'info'}
    
    # CloudWatch
    CLOUDWATCH_LOG_GROUP: /aws/lambda/disaster-alert-system
```

## 🔐 **Sensitive Data Management**

### **AWS Secrets Manager**

Sensitive credentials are stored in AWS Secrets Manager, not environment variables:

```typescript
// Example: Retrieving secrets in Lambda functions
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getSocialMediaCredentials() {
  const command = new GetSecretValueCommand({
    SecretId: process.env.SOCIAL_MEDIA_CREDENTIALS_SECRET
  });
  
  const result = await secretsManager.send(command);
  return JSON.parse(result.SecretString || '{}');
}
```

### **Secret Structure**
```json
{
  "twitterBearerToken": "your_twitter_bearer_token",
  "redditClientId": "your_reddit_client_id", 
  "redditClientSecret": "your_reddit_client_secret",
  "newsApiKey": "your_news_api_key"
}
```

## 🚀 **Deployment Process**

### **1. Set Local Environment Variables**
```bash
# Set required environment variables for deployment
export MAPS_API_KEY="your_google_maps_api_key"
export NODE_ENV="production"
export LOG_LEVEL="info"
```

### **2. Deploy to AWS**
```bash
cd infra
serverless deploy
```

### **3. Verify Environment Variables**
```bash
# Check Lambda function environment variables
aws lambda get-function-configuration \
  --function-name disaster-alert-system-processTweet \
  --query 'Environment.Variables'
```

## 🔄 **Environment-Specific Configuration**

### **Development Environment**
```yaml
# serverless-dev.yml
provider:
  environment:
    NODE_ENV: development
    LOG_LEVEL: debug
    MAPS_API_KEY: ${env:MAPS_API_KEY_DEV, ''}
```

### **Production Environment**
```yaml
# serverless-prod.yml  
provider:
  environment:
    NODE_ENV: production
    LOG_LEVEL: info
    MAPS_API_KEY: ${env:MAPS_API_KEY_PROD, ''}
```

### **Deploy to Different Environments**
```bash
# Deploy to development
serverless deploy --config serverless-dev.yml

# Deploy to production
serverless deploy --config serverless-prod.yml
```

## 🛡️ **Security Best Practices**

### **✅ DO**
- Store sensitive data in AWS Secrets Manager
- Use IAM roles for AWS service access
- Encrypt secrets at rest
- Rotate credentials regularly
- Use least privilege access

### **❌ DON'T**
- Store secrets in environment variables
- Commit .env files to git
- Hardcode credentials in code
- Use root AWS credentials in production

## 🔍 **Accessing Environment Variables in Code**

### **Lambda Functions**
```typescript
// Environment variables are automatically available
const eventsTable = process.env.EVENTS_TABLE;
const alertsTopicArn = process.env.ALERTS_TOPIC_ARN;
const mapsApiKey = process.env.MAPS_API_KEY;

// AWS resource ARNs are provided by CloudFormation
const queueUrl = process.env.SOCIAL_MEDIA_QUEUE_URL;
```

### **Local Development**
```typescript
// Load from .env file using dotenv
import dotenv from 'dotenv';
dotenv.config();

const mapsApiKey = process.env.MAPS_API_KEY;
```

## 🧪 **Testing Environment Variables**

### **Unit Tests**
```typescript
// Mock environment variables in tests
process.env.EVENTS_TABLE = 'test-events-table';
process.env.ALERTS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-topic';
```

### **Integration Tests**
```typescript
// Set test environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
});
```

## 📊 **Monitoring Environment Variables**

### **CloudWatch Logs**
Environment variables are logged in Lambda function logs:
```bash
# View Lambda logs
aws logs tail /aws/lambda/disaster-alert-system-processTweet --follow
```

### **AWS Console**
1. Go to Lambda console
2. Select your function
3. Go to Configuration → Environment variables
4. View all environment variables

## 🔧 **Troubleshooting**

### **Common Issues**

1. **Missing Environment Variable**
   ```bash
   Error: Environment variable EVENTS_TABLE is not defined
   ```
   **Solution**: Check `serverless.yml` configuration

2. **Secret Not Found**
   ```bash
   Error: Secret disaster-alert/social-media-credentials not found
   ```
   **Solution**: Create secret in AWS Secrets Manager

3. **Permission Denied**
   ```bash
   Error: User is not authorized to perform secretsmanager:GetSecretValue
   ```
   **Solution**: Add IAM permissions for Secrets Manager

### **Debug Commands**
```bash
# List all environment variables
aws lambda get-function-configuration \
  --function-name disaster-alert-system-processTweet \
  --query 'Environment.Variables' \
  --output table

# Check secret exists
aws secretsmanager describe-secret \
  --secret-id disaster-alert/social-media-credentials

# View CloudFormation stack outputs
aws cloudformation describe-stacks \
  --stack-name disaster-alert-system-dev \
  --query 'Stacks[0].Outputs'
```

## 📝 **Environment Variable Reference**

| Variable | Source | Description | Required |
|----------|--------|-------------|----------|
| `EVENTS_TABLE` | CloudFormation | DynamoDB table name | Yes |
| `ALERTS_TOPIC_ARN` | CloudFormation | SNS topic ARN | Yes |
| `SOCIAL_MEDIA_QUEUE_URL` | CloudFormation | SQS queue URL | Yes |
| `IMAGES_BUCKET` | CloudFormation | S3 bucket name | Yes |
| `MAPS_API_KEY` | Local .env | Google Maps API key | No |
| `SOCIAL_MEDIA_CREDENTIALS_SECRET` | Static | Secrets Manager secret name | Yes |
| `AWS_ACCOUNT_ID` | CloudFormation | AWS account ID | Yes |
| `AWS_REGION` | CloudFormation | AWS region | Yes |
| `NODE_ENV` | Local .env | Node environment | No |
| `LOG_LEVEL` | Local .env | Logging level | No |

---

**Remember**: Environment variables in AWS are managed through the Serverless Framework configuration, not .env files! 🚀
