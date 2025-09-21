# Requirements

- Modular serverless backend on AWS: API Gateway, Lambda, DynamoDB, Comprehend, SNS, SQS, S3, Rekognition, CloudWatch.
- Ingest social posts (Twitter, Reddit, News APIs) and analyze for disaster entities.
- Cross-check with meteorological data source (Malaysian government API; pluggable provider).
- Persist raw/analyzed events; index verified events.
- Alert via SNS when verified by business logic.
- Expose GET /events for clients.
- Compute alternative routes via Maps API (stubbed now; pluggable provider).
- Image analysis for visual disaster detection using Amazon Rekognition.
- Background job processing with Amazon SQS for reliable message handling.
- Centralized logging and monitoring with Amazon CloudWatch.
- Secure credential management with AWS Secrets Manager.
- CI-ready, TypeScript, reusable components in `packages/shared`.
