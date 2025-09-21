# Duplicate Detection System

## Overview

The disaster detection system now includes comprehensive duplicate detection to prevent storing and analyzing posts with the same author and text content. This helps reduce storage costs, processing overhead, and prevents duplicate alerts.

## Implementation

### 1. Database Schema Updates

**DynamoDB Table Changes:**
- Added `author` and `text` attributes to the EventsTable
- Created Global Secondary Index (GSI): `AuthorTextIndex`
- GSI Key Schema: `author` (HASH) + `text` (RANGE)

### 2. Duplicate Detection Logic

**Process Queue Handler (`services/processing/src/handlers/processQueue.ts`):**
```typescript
async function checkForDuplicate(author: string, text: string): Promise<boolean> {
    try {
        // Query DynamoDB GSI for existing posts with same author and text
        const command = new QueryCommand({
            TableName: process.env.EVENTS_TABLE,
            IndexName: 'AuthorTextIndex',
            KeyConditionExpression: 'author = :author AND text = :text',
            ExpressionAttributeValues: {
                ':author': author,
                ':text': text
            },
            Limit: 1
        });

        const result = await dynamoDb.send(command);
        return (result.Items && result.Items.length > 0);
        
    } catch (error) {
        // Fallback: Check recent posts (last 24 hours) using filter expression
        const recentTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const fallbackCommand = new QueryCommand({
            TableName: process.env.EVENTS_TABLE,
            FilterExpression: 'author = :author AND text = :text AND createdAt > :recentTime',
            ExpressionAttributeValues: {
                ':author': author,
                ':text': text,
                ':recentTime': recentTime
            },
            Limit: 1
        });

        const fallbackResult = await dynamoDb.send(fallbackCommand);
        return (fallbackResult.Items && fallbackResult.Items.length > 0);
    }
}
```

**Process Tweet Handler (`services/processing/src/handlers/processTweet.ts`):**
- Same duplicate detection logic
- Returns HTTP 200 with `duplicate: true` for duplicate posts
- Skips Bedrock analysis and DynamoDB storage

**Main Script (`scripts/main.js`):**
- In-memory duplicate detection for recent events (24-hour window)
- Checks against processed events in the current session

### 3. Processing Flow

1. **Post Ingestion**: New post arrives via API or queue
2. **Duplicate Check**: Query DynamoDB for existing author + text combination
3. **Skip if Duplicate**: Log duplicate detection and skip processing
4. **Process if New**: Continue with Bedrock analysis and storage

### 4. Benefits

- **Cost Reduction**: Prevents unnecessary Bedrock API calls
- **Storage Efficiency**: Avoids storing duplicate data in DynamoDB
- **Performance**: Reduces processing time for duplicate posts
- **Alert Prevention**: Prevents duplicate disaster alerts
- **Resource Optimization**: Reduces Lambda execution time and costs

### 5. Configuration

**Serverless.yml Updates:**
```yaml
EventsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    AttributeDefinitions:
      - AttributeName: author
        AttributeType: S
      - AttributeName: text
        AttributeType: S
    GlobalSecondaryIndexes:
      - IndexName: AuthorTextIndex
        KeySchema:
          - AttributeName: author
            KeyType: HASH
          - AttributeName: text
            KeyType: RANGE
        Projection:
          ProjectionType: ALL
```

### 6. Testing

**Test Script (`scripts/test-duplicate-detection.js`):**
- Tests duplicate detection with sample posts
- Verifies correct identification of duplicates
- Shows processing statistics

**Test Results:**
```
📊 Duplicate Detection Results:
   Total duplicates detected: 2
   Total unique posts processed: 3
   Duplicates by author:
     user1: 2 duplicates
```

### 7. Error Handling

- **GSI Not Available**: Falls back to filter expression on main table
- **Query Errors**: Logs warning and continues processing
- **Network Issues**: Graceful degradation with fallback methods

### 8. Monitoring

**Log Messages:**
- `Skipping duplicate post from {author}: "{text}..."`
- `Error checking for duplicates, using fallback method`
- `Duplicate post detected and skipped`

**Metrics:**
- Duplicate detection rate
- Processing efficiency improvements
- Cost savings from avoided Bedrock calls

## Usage

The duplicate detection is automatically enabled and requires no additional configuration. It works across all entry points:

1. **API Endpoints**: `/ingest/twitter` and other ingestion endpoints
2. **Queue Processing**: SQS message processing
3. **Direct Scripts**: Main monitoring scripts

## Future Enhancements

1. **Fuzzy Matching**: Detect near-duplicates with slight text variations
2. **Time-based Windows**: Configurable duplicate detection timeframes
3. **Content Hashing**: Use content hashes for more efficient duplicate detection
4. **Machine Learning**: Learn from user feedback to improve duplicate detection accuracy
