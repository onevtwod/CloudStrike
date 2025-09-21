# 🚨 AI-Driven Natural Disaster Alert System

A comprehensive, cost-optimized AWS serverless system that monitors social media platforms to detect and alert on natural disasters in real-time using AI/ML services.

## 🌟 Features

- **Real-time Social Media Monitoring**: Automated scraping of Twitter, Reddit, and news APIs
- **AI-Powered Analysis**: Amazon Comprehend for text analysis and Amazon Rekognition for image analysis
- **Reliable Processing**: SQS queues with dead letter queues for fault-tolerant message processing
- **Smart Verification**: Cross-reference with meteorological data and business logic
- **Instant Alerts**: SNS notifications for verified disaster events
- **Public API**: RESTful endpoints for accessing disaster data
- **Comprehensive Monitoring**: CloudWatch metrics, alarms, and centralized logging
- **Cost Optimized**: Removed high-cost, low-impact services (Cognito, Translate, EventBridge)

## 🏗️ Architecture

### Core Services
- **API Gateway**: Managed REST API endpoints
- **AWS Lambda**: Serverless compute for all processing logic
- **DynamoDB**: NoSQL database with TTL and GSI for event storage
- **Amazon SNS**: Pub/sub messaging for disaster alerts
- **Amazon SQS**: Message queuing for reliable background processing
- **Amazon S3**: Image storage and processing
- **Amazon Comprehend**: Natural language processing for disaster detection
- **Amazon Rekognition**: Computer vision for image analysis
- **CloudWatch**: Centralized logging, metrics, and alarms
- **AWS Secrets Manager**: Secure credential storage

### Cost-Optimized Design
- **CloudWatch Events** instead of EventBridge for scheduling
- **No user authentication** (public disaster alerts)
- **English-only processing** (no translation services)
- **Pay-per-request** DynamoDB billing

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or later
- AWS CLI configured with appropriate permissions
- Serverless Framework CLI

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd HackathonAWS
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd infra && npm install
   cd ../services/processing && npm install
   cd ../../scripts && npm install
   ```

3. **Configure AWS credentials**
   ```bash
   aws configure
   # Or set environment variables:
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_DEFAULT_REGION=us-east-1
   ```

4. **Test individual components** (Recommended)
   ```bash
   cd scripts
   
   # Test AWS connectivity
   npm run test-aws
   
   # Test all components
   npm run test-all
   
   # Or run individual tests
   node run-test.js aws
   node run-test.js dynamodb
   node run-test.js all
   ```

5. **Set up environment variables**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit with your values
   nano .env
   ```
   
   **Important**: The `.env` file is only used for local development. In AWS deployment, environment variables are managed through `infra/serverless.yml` and AWS Secrets Manager.

5. **Deploy the infrastructure**
   ```bash
   cd infra
   npm install
   serverless deploy
   ```

6. **Build and test locally**
   ```bash
   npm run build
   npm test
   ```

## 📁 Project Structure

```
HackathonAWS/
├── apps/
│   └── web/                    # React frontend application
├── services/
│   └── processing/             # Lambda functions and business logic
├── packages/
│   └── shared/                 # Shared utilities and types
├── infra/
│   └── serverless.yml          # Infrastructure as Code
├── scripts/                    # Development and testing scripts
├── requirements.md             # Project requirements
├── designs.md                  # System architecture
├── tasks.md                    # Development tasks
└── ui.md                       # UI/UX specifications
```

## 🔧 Development

### Available Scripts

```bash
# Build all packages
npm run build

# Run tests
npm test
npm run test:coverage

# Local development
npm run dev

# Test specific components
npm run test-local
npm run test-dynamodb
npm run test-ingestion

# Social media scraping
npm run scrape-twitter
npm run scrape-reddit
npm run scrape-advanced

# Disaster detection
npm run crowd-detect
npm run enhanced-detect
npm run verify-disaster

# Notifications
npm run sns-notifications
npm run sns-subscriptions
```

### Local Development

1. **Start local development server**
   ```bash
   npm run dev
   ```

2. **Test API endpoints**
   ```bash
   npm run test-local
   ```

3. **Test DynamoDB integration**
   ```bash
   npm run test-dynamodb
   ```

## 🌐 API Endpoints

### Public Endpoints

- `GET /events` - Retrieve verified disaster events
- `POST /ingest/twitter` - Ingest Twitter posts (webhook)
- `POST /subscribe` - Subscribe to disaster alerts

### Response Format

```json
{
  "events": [
    {
      "id": "event-uuid",
      "type": "flood",
      "severity": "high",
      "location": {
        "lat": 3.1390,
        "lng": 101.6869,
        "address": "Kuala Lumpur, Malaysia"
      },
      "description": "Severe flooding reported in downtown area",
      "verified": true,
      "timestamp": "2024-01-15T10:30:00Z",
      "sources": ["twitter", "reddit"],
      "confidence": 0.95
    }
  ],
  "total": 1,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

## 🧪 Testing

The system includes comprehensive testing scripts to verify each component individually before deployment.

### Quick Testing
```bash
cd scripts

# Test all components
npm run test-all

# Test individual components
npm run test-aws          # AWS credentials and connectivity
npm run test-dynamodb     # DynamoDB operations
npm run test-comprehend   # Amazon Comprehend analysis
npm run test-rekognition  # Amazon Rekognition image analysis
npm run test-sns          # SNS notifications
npm run test-sqs          # SQS queue operations
npm run test-s3           # S3 storage operations
npm run test-secrets      # AWS Secrets Manager
npm run test-cloudwatch   # CloudWatch monitoring
```

### Test Components
- **AWS Credentials**: Verifies AWS connectivity and service access
- **DynamoDB**: Tests CRUD operations, GSI queries, and batch operations
- **Comprehend**: Tests text analysis, entity detection, and sentiment analysis
- **Rekognition**: Tests image analysis, label detection, and text extraction
- **SNS**: Tests topic creation, subscriptions, and message publishing
- **SQS**: Tests message sending/receiving and batch operations
- **S3**: Tests object upload/download and disaster image storage
- **Secrets Manager**: Tests secret creation, retrieval, and rotation
- **CloudWatch**: Tests metrics, logs, and alarms

### Test Features
- ✅ Individual component testing
- ⏱️ Performance benchmarking
- 🧹 Automatic cleanup of test resources
- 📊 Detailed success/failure reporting
- 🔍 Comprehensive error diagnostics

For detailed testing instructions, see [TESTING_GUIDE.md](TESTING_GUIDE.md) and [scripts/README.md](scripts/README.md).

## 🔍 Monitoring & Alerts

### CloudWatch Metrics
- Lambda function invocations, errors, and duration
- DynamoDB read/write capacity and throttles
- SQS queue depth and processing metrics
- Custom business metrics for disaster events

### CloudWatch Alarms
- High error rates
- Function timeouts
- Queue backup alerts
- High disaster event counts

### Logging
- Centralized logging in CloudWatch Logs
- Structured JSON logs with correlation IDs
- Error tracking and debugging information

## 🔐 Security

- **AWS Secrets Manager** for API credentials
- **IAM roles** with least privilege access
- **VPC endpoints** for private communication
- **Encryption at rest** for all data storage
- **HTTPS only** for all API communications

## 🌍 Environment Variables

### **Local Development**
- Use `.env` file for local development
- Copy `.env.example` to `.env` and fill in your values
- Never commit `.env` to version control

### **AWS Deployment**
- Environment variables defined in `infra/serverless.yml`
- Sensitive data stored in AWS Secrets Manager
- Automatically injected into Lambda functions

### **Quick Setup**
```bash
# Local development
cp .env.example .env
# Edit .env with your API keys

# AWS deployment
export MAPS_API_KEY="your_google_maps_api_key"
serverless deploy
```

For detailed environment variable management, see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).

## 💰 Cost Optimization

### Removed Services
- ❌ Amazon Cognito (no user authentication needed)
- ❌ Amazon Translate (English-only processing)
- ❌ Amazon EventBridge (using CloudWatch Events)

### Cost-Saving Features
- **Pay-per-request** DynamoDB billing
- **Scheduled Lambda functions** for efficient resource usage
- **S3 lifecycle policies** for automatic cleanup
- **CloudWatch log retention** (30 days)

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:coverage
```

### Load Testing
```bash
npm run test-ingestion
```

## 📊 Performance

- **Sub-second response times** for API endpoints
- **99.9% availability** with AWS managed services
- **Auto-scaling** based on demand
- **Dead letter queues** for fault tolerance

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the [documentation](docs/) folder
- Review the [troubleshooting guide](DYNAMODB_TROUBLESHOOTING.md)

## 🗺️ Roadmap

- [ ] Mobile app integration
- [ ] Multi-language support
- [ ] Advanced ML models
- [ ] Real-time mapping integration
- [ ] Community reporting features

---

**Built with ❤️ for disaster preparedness and community safety**
