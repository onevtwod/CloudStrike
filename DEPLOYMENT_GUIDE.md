# 🚀 Disaster Alert System - Complete Deployment Guide

This guide explains the entire source code structure and deployment process for the AI-driven natural disaster alert system.

## 📁 Project Structure Overview

```
HackathonAWS/
├── 📦 Root Package (Monorepo)
│   ├── package.json                    # Workspace configuration
│   ├── tsconfig.base.json             # TypeScript base config
│   └── README.md                      # Main documentation
│
├── 🏗️ Infrastructure (AWS Resources)
│   ├── infra/
│   │   ├── package.json               # Serverless Framework deps
│   │   ├── serverless.yml             # Main infrastructure config
│   │   └── serverless-staging.yml     # Staging environment config
│
├── ⚙️ Backend Services (Lambda Functions)
│   ├── services/processing/
│   │   ├── src/handlers/              # Lambda function handlers
│   │   │   ├── processTweet.ts        # Twitter ingestion endpoint
│   │   │   ├── getEvents.ts           # Public API for events
│   │   │   ├── subscribe.ts           # SNS subscription endpoint
│   │   │   ├── socialMediaScraper.ts  # Scheduled social media scraper
│   │   │   ├── processQueue.ts        # SQS queue processor
│   │   │   ├── analyzeImage.ts        # Rekognition image analysis
│   │   │   ├── scheduledTasks.ts      # Maintenance tasks
│   │   │   ├── cloudWatchAlarms.ts    # Monitoring setup
│   │   │   ├── secretsManager.ts      # Credential management
│   │   │   └── iamPermissions.ts      # IAM role management
│   │   ├── dist/                      # Compiled JavaScript (auto-generated)
│   │   └── tsconfig.json              # TypeScript config
│
├── 📚 Shared Libraries
│   ├── packages/shared/
│   │   ├── src/
│   │   │   ├── index.ts               # Main exports
│   │   │   └── logger.ts              # Centralized logging
│   │   ├── dist/                      # Compiled output
│   │   └── package.json               # Shared utilities
│
├── 🌐 Frontend Application
│   ├── apps/web/
│   │   ├── src/
│   │   │   ├── App.tsx                # Main React component
│   │   │   ├── utils/api.ts           # API client functions
│   │   │   ├── main.tsx               # React entry point
│   │   │   └── test/                  # Frontend tests
│   │   ├── dist/                      # Built frontend (auto-generated)
│   │   ├── public/                    # Static assets
│   │   └── package.json               # Frontend dependencies
│
├── 🧪 Testing & Scripts
│   ├── scripts/
│   │   ├── test-*.js                  # Individual component tests
│   │   ├── test-all-components.js     # Comprehensive test runner
│   │   ├── run-test.js                # Simple test runner
│   │   ├── *.js                       # Utility scripts
│   │   └── package.json               # Test dependencies
│
└── 📋 Documentation
    ├── TESTING_GUIDE.md               # Testing instructions
    ├── DEPLOYMENT_GUIDE.md            # This file
    ├── requirements.md                # System requirements
    ├── tasks.md                       # Development tasks
    ├── designs.md                     # System architecture
    └── ui.md                          # UI specifications
```

## 🏗️ Architecture Components

### 1. **Infrastructure Layer** (`infra/`)
**Purpose**: Defines all AWS resources using Serverless Framework

**Key Files**:
- `serverless.yml` - Main infrastructure configuration
- `serverless-staging.yml` - Staging environment overrides

**AWS Resources Created**:
- **API Gateway**: REST API endpoints
- **Lambda Functions**: 9 serverless functions
- **DynamoDB**: `disaster-events` table with GSI
- **SNS**: `disaster-alerts` topic for notifications
- **SQS**: 3 queues (main, priority, dead letter)
- **S3**: Image storage bucket
- **CloudWatch**: Logs, metrics, and alarms
- **Secrets Manager**: API credentials storage
- **IAM**: Roles and permissions

### 2. **Backend Services** (`services/processing/`)
**Purpose**: Lambda functions that process disaster data

#### **Core Handlers**:

**`processTweet.ts`** - Twitter Ingestion Endpoint
```typescript
// POST /ingest/twitter
// Processes individual social media posts
// Uses Amazon Comprehend for text analysis
// Cross-validates with meteorological data
// Stores verified events in DynamoDB
// Sends SNS alerts for verified disasters
```

**`getEvents.ts`** - Public API Endpoint
```typescript
// GET /events
// Returns verified disaster events
// Queries DynamoDB using GSI
// Fallback to table scan if GSI fails
// Used by frontend to display events
```

**`socialMediaScraper.ts`** - Scheduled Scraper
```typescript
// Runs every 5 minutes (CloudWatch Events)
// Scrapes Twitter, Reddit, News APIs
// Uses credentials from Secrets Manager
// Queues posts for processing
// Logs metrics to CloudWatch
```

**`processQueue.ts`** - Queue Processor
```typescript
// Runs every minute (CloudWatch Events)
// Processes messages from SQS queues
// Uses Amazon Comprehend for analysis
// Calculates disaster scores
// Stores processed events
// Sends alerts for verified disasters
```

**`analyzeImage.ts`** - Image Analysis
```typescript
// Analyzes disaster images using Rekognition
// Detects labels, text, and moderation content
// Processes images from S3
// Returns analysis results
```

**`subscribe.ts`** - Subscription Management
```typescript
// POST /subscribe
// Manages SNS subscriptions
// Supports email and SMS subscriptions
// Handles subscription confirmations
```

**`scheduledTasks.ts`** - Maintenance Tasks
```typescript
// Runs every 10 minutes + daily cleanup
// Performs system maintenance
// Cleans up old data
// Generates reports
// Monitors system health
```

**`cloudWatchAlarms.ts`** - Monitoring Setup
```typescript
// Configures CloudWatch alarms
// Sets up monitoring dashboards
// Defines alert thresholds
// Manages notification channels
```

**`secretsManager.ts`** - Credential Management
```typescript
// Manages API credentials
// Rotates secrets
// Validates credential access
// Handles credential updates
```

**`iamPermissions.ts`** - IAM Management
```typescript
// Manages IAM roles and policies
// Ensures least privilege access
// Handles permission updates
// Manages service accounts
```

### 3. **Shared Libraries** (`packages/shared/`)
**Purpose**: Reusable utilities and types

**`index.ts`** - Main Exports
```typescript
// Type definitions for disaster events
// Meteorological data fetching functions
// Maps API integration
// ID generation utilities
// Logger configuration
```

**`logger.ts`** - Centralized Logging
```typescript
// Structured logging with correlation IDs
// CloudWatch integration
// Log level management
// Error tracking
```

### 4. **Frontend Application** (`apps/web/`)
**Purpose**: React-based web interface for disaster events

**`App.tsx`** - Main Component
```typescript
// Displays verified disaster events
// Shows event details and locations
// Integrates Google Maps for visualization
// Provides subscription interface
// Handles error states and loading
```

**`utils/api.ts`** - API Client
```typescript
// HTTP client for backend API
// Error handling and retry logic
// Type-safe API calls
// Environment configuration
```

### 5. **Testing Suite** (`scripts/`)
**Purpose**: Comprehensive testing for all components

**Individual Test Scripts**:
- `test-aws-credentials.js` - AWS connectivity
- `test-dynamodb-operations.js` - Database operations
- `test-comprehend-analysis.js` - Text analysis
- `test-rekognition-image.js` - Image analysis
- `test-sns-notifications.js` - Notification system
- `test-sqs-operations.js` - Queue processing
- `test-s3-operations.js` - File storage
- `test-secrets-manager.js` - Credential management
- `test-cloudwatch-operations.js` - Monitoring

**Test Runners**:
- `test-all-components.js` - Runs all tests
- `run-test.js` - Simple test runner

## 🚀 Deployment Process

### **Step 1: Prerequisites**
```bash
# Install Node.js 20.x+
node --version

# Install AWS CLI
aws --version

# Install Serverless Framework
npm install -g serverless

# Configure AWS credentials
aws configure
```

### **Step 2: Environment Setup**
```bash
# Clone repository
git clone <repository-url>
cd HackathonAWS

# Install all dependencies
npm install
cd infra && npm install
cd ../services/processing && npm install
cd ../../packages/shared && npm install
cd ../../apps/web && npm install
cd ../../scripts && npm install
```

### **Step 3: Configuration**
```bash
# Set up environment variables
cp .env.example .env

# Edit .env with your values:
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
# AWS_DEFAULT_REGION=us-east-1
# MAPS_API_KEY=your_google_maps_key
```

### **Step 4: Testing** (Recommended)
```bash
cd scripts

# Test AWS connectivity
npm run test-aws

# Test all components
npm run test-all

# Or test individually
node run-test.js aws
node run-test.js dynamodb
node run-test.js all
```

### **Step 5: Build**
```bash
# Build shared libraries
cd packages/shared
npm run build

# Build Lambda functions
cd ../../services/processing
npm run build

# Build frontend
cd ../../apps/web
npm run build
```

### **Step 6: Deploy Infrastructure**
```bash
cd infra

# Deploy to production
npm run deploy

# Or deploy to staging
serverless deploy --config serverless-staging.yml
```

### **Step 7: Configure Secrets**
```bash
# Store API credentials in Secrets Manager
aws secretsmanager create-secret \
  --name "disaster-alert/social-media-credentials" \
  --secret-string '{
    "twitterBearerToken": "your_twitter_token",
    "redditClientId": "your_reddit_client_id",
    "redditClientSecret": "your_reddit_secret",
    "newsApiKey": "your_news_api_key"
  }'
```

### **Step 8: Deploy Frontend**
```bash
cd apps/web

# Build for production
npm run build

# Deploy to S3 or CDN
# (Configure your preferred hosting method)
```

## 🔧 Configuration Details

### **Environment Variables**

**Backend (Lambda Functions)**:
```yaml
# DynamoDB
EVENTS_TABLE: disaster-events

# SNS
ALERTS_TOPIC_ARN: arn:aws:sns:us-east-1:123456789012:disaster-alerts

# SQS Queues
SOCIAL_MEDIA_QUEUE_URL: https://sqs.us-east-1.amazonaws.com/123456789012/disaster-social-media-queue
PRIORITY_QUEUE_URL: https://sqs.us-east-1.amazonaws.com/123456789012/disaster-priority-queue
DEAD_LETTER_QUEUE_URL: https://sqs.us-east-1.amazonaws.com/123456789012/disaster-dead-letter-queue

# S3
IMAGES_BUCKET: disaster-alert-images-us-east-1-123456789012

# External APIs
MAPS_API_KEY: your_google_maps_key

# AWS Services
SOCIAL_MEDIA_CREDENTIALS_SECRET: disaster-alert/social-media-credentials
AWS_ACCOUNT_ID: 123456789012
AWS_REGION: us-east-1

# Application
NODE_ENV: production
LOG_LEVEL: info
```

**Frontend**:
```env
VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com
VITE_MAPS_EMBED_API_KEY=your_google_maps_embed_key
```

### **IAM Permissions Required**

**Lambda Execution Role**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:*",
        "sns:*",
        "sqs:*",
        "s3:*",
        "comprehend:*",
        "rekognition:*",
        "secretsmanager:GetSecretValue",
        "cloudwatch:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## 📊 Monitoring & Observability

### **CloudWatch Metrics**
- Lambda invocations, errors, duration
- DynamoDB read/write capacity
- SQS queue depth and processing
- Custom business metrics

### **CloudWatch Alarms**
- High error rates
- Function timeouts
- Queue backup alerts
- High disaster event counts

### **Logging**
- Centralized in CloudWatch Logs
- Structured JSON with correlation IDs
- Error tracking and debugging

## 🔐 Security Features

- **AWS Secrets Manager** for API credentials
- **IAM roles** with least privilege access
- **VPC endpoints** for private communication
- **Encryption at rest** for all data storage
- **HTTPS only** for all API communications

## 🌍 Multi-Environment Support

### **Production** (`serverless.yml`)
- Full resource configuration
- Production-grade monitoring
- High availability setup

### **Staging** (`serverless-staging.yml`)
- Reduced resource allocation
- Test-specific configurations
- Development monitoring

## 🚨 Disaster Event Flow

1. **Ingestion**: Social media scraper collects posts
2. **Queueing**: Posts queued in SQS for processing
3. **Analysis**: Comprehend analyzes text, Rekognition analyzes images
4. **Verification**: Cross-validates with meteorological data
5. **Storage**: Stores verified events in DynamoDB
6. **Alerting**: Sends SNS notifications for verified disasters
7. **API**: Public API exposes events to frontend
8. **Monitoring**: CloudWatch tracks all metrics and health

## 🎯 Cost Optimization

- **Pay-per-request** DynamoDB billing
- **No user authentication** (public system)
- **English-only processing** (no translation)
- **CloudWatch Events** instead of EventBridge
- **Efficient resource allocation**

## 🔄 Maintenance & Updates

### **Regular Tasks**
- Monitor CloudWatch dashboards
- Review and rotate API credentials
- Clean up old data (TTL handles this)
- Update disaster keywords
- Review and optimize costs

### **Scaling**
- DynamoDB auto-scales
- Lambda scales automatically
- SQS handles message bursts
- SNS scales with subscribers

This comprehensive system provides a robust, scalable, and cost-effective solution for real-time disaster monitoring and alerting using AWS serverless technologies.
