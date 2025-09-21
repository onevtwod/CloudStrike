# System Design

## Architecture Overview
- **API Gateway** -> Lambda functions (`processTweet`, `getEvents`, `socialMediaScraper`, `processQueue`)
- **Lambda** -> Comprehend for entity extraction, Rekognition for image analysis
- **DynamoDB** `disaster-events` with GSI `verified-index` and TTL for data lifecycle
- **SNS** `disaster-alerts` for notifications to subscribers
- **SQS** for reliable background job processing with dead letter queues
- **S3** for image storage and processing
- **CloudWatch** for centralized logging, metrics, and alarms
- **Secrets Manager** for secure API credential storage
- **Providers layer** in `packages/shared` for meteo + maps

## Cost-Optimized Services
- **CloudWatch Events** for scheduling (instead of EventBridge)
- **No user authentication** (public disaster alerts)
- **English-only processing** (no translation services)

## Sequence Diagram

```mermaid
sequenceDiagram
  title AI-Driven Natural Disaster Alert System (Cost-Optimized)
  actor User as Social Media User
  participant Platform as Social Media Platform
  participant APIGW as API Gateway
  participant Scraper as Social Media Scraper Lambda
  participant Queue as SQS Queue
  participant Processor as Queue Processor Lambda
  participant Comp as Amazon Comprehend
  participant Rek as Amazon Rekognition
  participant DDB as Amazon DynamoDB
  participant SNS as Amazon SNS
  participant CW as CloudWatch
  actor Responder as End User / Rescue Team

  Note over Scraper: Scheduled every 5 minutes
  Scraper->>Platform: Scrape social media posts
  Platform-->>Scraper: Posts data
  Scraper->>Queue: Send posts to SQS
  Scraper->>CW: Log metrics

  Note over Processor: Scheduled every minute
  Processor->>Queue: Poll for messages
  Queue-->>Processor: Social media posts
  Processor->>Comp: Analyze text for entities
  Comp-->>Processor: Disaster entities
  Processor->>Rek: Analyze images (if present)
  Rek-->>Processor: Image analysis results
  Processor->>DDB: Store processed event
  alt Verified disaster
    Processor->>SNS: Publish alert
    SNS-->>Responder: Notification
  end
  Processor->>CW: Log metrics and alarms

  Responder->>APIGW: GET /events
  APIGW->>Processor: getEvents
  Processor->>DDB: Query verified events
  DDB-->>Processor: Events data
  Processor-->>APIGW: JSON response
  APIGW-->>Responder: Disaster events data
```

## Data Flow
1. **Ingestion**: Social media scraper collects posts from Twitter, Reddit, News APIs
2. **Queue Processing**: Posts are queued in SQS for reliable processing
3. **Analysis**: Text analysis with Comprehend, image analysis with Rekognition
4. **Storage**: Processed events stored in DynamoDB with TTL
5. **Verification**: Business logic determines if event is verified disaster
6. **Alerting**: Verified disasters trigger SNS notifications
7. **Monitoring**: CloudWatch tracks all metrics and system health
8. **API**: Public API exposes verified events to clients
