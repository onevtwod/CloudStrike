@echo off
REM AWS CLI Direct Deployment Script for CloudStrike (Windows)

REM Set variables
set REGION=us-east-1
set STACK_NAME=cloudstrike-disaster-system
for /f %%i in ('powershell -command "Get-Date -UFormat %%s"') do set TIMESTAMP=%%i
set S3_BUCKET=cloudstrike-deployment-%TIMESTAMP%
set LAMBDA_ROLE_NAME=CloudStrikeLambdaRole
set API_GATEWAY_NAME=cloudstrike-api

echo 🚀 Starting CloudStrike AWS Deployment...

REM 1. Create S3 bucket for deployment artifacts
echo 📦 Creating S3 bucket for deployment...
aws s3 mb s3://%S3_BUCKET% --region %REGION%

REM 2. Create IAM Role for Lambda
echo 🔐 Creating IAM role for Lambda functions...
aws iam create-role --role-name %LAMBDA_ROLE_NAME% --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"lambda.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}"

REM Attach policies to the role
aws iam attach-role-policy --role-name %LAMBDA_ROLE_NAME% --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam attach-role-policy --role-name %LAMBDA_ROLE_NAME% --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam attach-role-policy --role-name %LAMBDA_ROLE_NAME% --policy-arn arn:aws:iam::aws:policy/AmazonSNSFullAccess
aws iam attach-role-policy --role-name %LAMBDA_ROLE_NAME% --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess
aws iam attach-role-policy --role-name %LAMBDA_ROLE_NAME% --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-role-policy --role-name %LAMBDA_ROLE_NAME% --policy-arn arn:aws:iam::aws:policy/AmazonRekognitionFullAccess
aws iam attach-role-policy --role-name %LAMBDA_ROLE_NAME% --policy-arn arn:aws:iam::aws:policy/ComprehendFullAccess

REM 3. Create DynamoDB Table
echo 🗄️ Creating DynamoDB table...
aws dynamodb create-table --table-name disaster-events --attribute-definitions AttributeName=id,AttributeType=S AttributeName=timestamp,AttributeType=S AttributeName=location,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --global-secondary-indexes IndexName=LocationIndex,KeySchema=[{AttributeName=location,KeyType=HASH},{AttributeName=timestamp,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} IndexName=TimestampIndex,KeySchema=[{AttributeName=timestamp,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 --region %REGION%

REM 4. Create SNS Topic
echo 📡 Creating SNS topic...
for /f "tokens=*" %%a in ('aws sns create-topic --name disaster-alerts --region %REGION% --output text --query TopicArn') do set SNS_TOPIC_ARN=%%a
echo SNS Topic ARN: %SNS_TOPIC_ARN%

REM 5. Create SQS Queues
echo 📬 Creating SQS queues...
for /f "tokens=*" %%a in ('aws sqs create-queue --queue-name social-media-queue --region %REGION% --output text --query QueueUrl') do set MAIN_QUEUE_URL=%%a
for /f "tokens=*" %%b in ('aws sqs create-queue --queue-name priority-queue --region %REGION% --output text --query QueueUrl') do set PRIORITY_QUEUE_URL=%%b
for /f "tokens=*" %%c in ('aws sqs create-queue --queue-name dead-letter-queue --region %REGION% --output text --query QueueUrl') do set DLQ_URL=%%c

echo Main Queue URL: %MAIN_QUEUE_URL%
echo Priority Queue URL: %PRIORITY_QUEUE_URL%
echo Dead Letter Queue URL: %DLQ_URL%

REM 6. Create S3 bucket for images
echo 🖼️ Creating S3 bucket for images...
for /f %%i in ('powershell -command "Get-Date -UFormat %%s"') do set IMG_TIMESTAMP=%%i
set IMAGE_BUCKET=cloudstrike-images-%IMG_TIMESTAMP%
aws s3 mb s3://%IMAGE_BUCKET% --region %REGION%

echo ✅ Infrastructure created successfully!
echo 📝 Next steps:
echo 1. Build and zip your Lambda functions
echo 2. Upload them to S3: %S3_BUCKET%
echo 3. Create Lambda functions using the uploaded code
echo 4. Create API Gateway and connect to Lambda functions

REM Save important values for next steps
(
echo REGION=%REGION%
echo S3_BUCKET=%S3_BUCKET%
echo LAMBDA_ROLE_NAME=%LAMBDA_ROLE_NAME%
echo SNS_TOPIC_ARN=%SNS_TOPIC_ARN%
echo MAIN_QUEUE_URL=%MAIN_QUEUE_URL%
echo PRIORITY_QUEUE_URL=%PRIORITY_QUEUE_URL%
echo DLQ_URL=%DLQ_URL%
echo IMAGE_BUCKET=%IMAGE_BUCKET%
) > deployment-config.txt

echo 🔧 Configuration saved to deployment-config.txt