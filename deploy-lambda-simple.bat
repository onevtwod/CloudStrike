@echo off
echo 🚀 Simple Lambda Deployment for CloudStrike
echo.

REM Load configuration
if not exist deployment-config.txt (
    echo ❌ Configuration file not found. Please run deploy-infrastructure.bat first.
    exit /b 1
)

REM Parse configuration file
for /f "tokens=1,2 delims==" %%a in (deployment-config.txt) do (
    if "%%a"=="REGION" set REGION=%%b
    if "%%a"=="S3_BUCKET" set S3_BUCKET=%%b
    if "%%a"=="LAMBDA_ROLE_NAME" set LAMBDA_ROLE_NAME=%%b
    if "%%a"=="SNS_TOPIC_ARN" set SNS_TOPIC_ARN=%%b
    if "%%a"=="MAIN_QUEUE_URL" set MAIN_QUEUE_URL=%%b
    if "%%a"=="PRIORITY_QUEUE_URL" set PRIORITY_QUEUE_URL=%%b
    if "%%a"=="DLQ_URL" set DLQ_URL=%%b
    if "%%a"=="IMAGE_BUCKET" set IMAGE_BUCKET=%%b
)

REM Get AWS Account ID
for /f "tokens=*" %%a in ('aws sts get-caller-identity --query Account --output text') do set ACCOUNT_ID=%%a
set LAMBDA_ROLE_ARN=arn:aws:iam::%ACCOUNT_ID%:role/%LAMBDA_ROLE_NAME%

echo Account ID: %ACCOUNT_ID%
echo Lambda Role ARN: %LAMBDA_ROLE_ARN%
echo.

REM Create simple Lambda function
echo 📝 Creating simple Lambda handler...
mkdir temp-lambda 2>nul
cd temp-lambda

echo // Simple Lambda handler for CloudStrike > index.js
echo const AWS = require('aws-sdk'); >> index.js
echo. >> index.js
echo exports.handler = async (event, context) =^> { >> index.js
echo     console.log('Event:', JSON.stringify(event, null, 2)); >> index.js
echo     return { >> index.js
echo         statusCode: 200, >> index.js
echo         headers: { >> index.js
echo             'Content-Type': 'application/json', >> index.js
echo             'Access-Control-Allow-Origin': '*' >> index.js
echo         }, >> index.js
echo         body: JSON.stringify({ >> index.js
echo             message: 'CloudStrike API is working!', >> index.js
echo             timestamp: new Date().toISOString(), >> index.js
echo             event: event >> index.js
echo         }) >> index.js
echo     }; >> index.js
echo }; >> index.js

echo { > package.json
echo   "name": "cloudstrike-lambda", >> package.json
echo   "version": "1.0.0", >> package.json
echo   "main": "index.js", >> package.json
echo   "dependencies": { >> package.json
echo     "aws-sdk": "^2.1691.0" >> package.json
echo   } >> package.json
echo } >> package.json

REM Create ZIP file
powershell -command "Compress-Archive -Path * -DestinationPath ../cloudstrike-function.zip -Force"
cd ..

echo ☁️ Uploading to S3...
aws s3 cp cloudstrike-function.zip s3://%S3_BUCKET%/cloudstrike-function.zip --region %REGION%

echo 🚀 Creating Lambda functions...

REM Create main API function
aws lambda create-function --function-name cloudstrike-getEvents --runtime nodejs20.x --role %LAMBDA_ROLE_ARN% --handler index.handler --code S3Bucket=%S3_BUCKET%,S3Key=cloudstrike-function.zip --timeout 300 --memory-size 512 --environment Variables={EVENTS_TABLE=disaster-events,AWS_REGION=%REGION%} --region %REGION%

aws lambda create-function --function-name cloudstrike-processTweet --runtime nodejs20.x --role %LAMBDA_ROLE_ARN% --handler index.handler --code S3Bucket=%S3_BUCKET%,S3Key=cloudstrike-function.zip --timeout 300 --memory-size 512 --environment Variables={EVENTS_TABLE=disaster-events,SNS_TOPIC_ARN=%SNS_TOPIC_ARN%,AWS_REGION=%REGION%} --region %REGION%

aws lambda create-function --function-name cloudstrike-subscribe --runtime nodejs20.x --role %LAMBDA_ROLE_ARN% --handler index.handler --code S3Bucket=%S3_BUCKET%,S3Key=cloudstrike-function.zip --timeout 300 --memory-size 512 --environment Variables={SNS_TOPIC_ARN=%SNS_TOPIC_ARN%,AWS_REGION=%REGION%} --region %REGION%

echo 🌐 Creating API Gateway...
for /f "tokens=*" %%a in ('aws apigatewayv2 create-api --name cloudstrike-api --protocol-type HTTP --cors-configuration AllowOrigins=*,AllowMethods=*,AllowHeaders=* --region %REGION% --output text --query ApiId') do set API_ID=%%a

echo API Gateway ID: %API_ID%

REM Create integrations and routes
echo 🔗 Setting up API routes...

REM Get Lambda function ARNs
for /f "tokens=*" %%a in ('aws lambda get-function --function-name cloudstrike-getEvents --region %REGION% --output text --query Configuration.FunctionArn') do set GET_EVENTS_ARN=%%a
for /f "tokens=*" %%b in ('aws lambda get-function --function-name cloudstrike-processTweet --region %REGION% --output text --query Configuration.FunctionArn') do set PROCESS_TWEET_ARN=%%b
for /f "tokens=*" %%c in ('aws lambda get-function --function-name cloudstrike-subscribe --region %REGION% --output text --query Configuration.FunctionArn') do set SUBSCRIBE_ARN=%%c

REM Create integrations
for /f "tokens=*" %%a in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri %GET_EVENTS_ARN% --payload-format-version 2.0 --region %REGION% --output text --query IntegrationId') do set GET_INTEGRATION_ID=%%a
for /f "tokens=*" %%b in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri %PROCESS_TWEET_ARN% --payload-format-version 2.0 --region %REGION% --output text --query IntegrationId') do set POST_INTEGRATION_ID=%%b
for /f "tokens=*" %%c in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri %SUBSCRIBE_ARN% --payload-format-version 2.0 --region %REGION% --output text --query IntegrationId') do set SUB_INTEGRATION_ID=%%c

REM Create routes
aws apigatewayv2 create-route --api-id %API_ID% --route-key "GET /events" --target integrations/%GET_INTEGRATION_ID% --region %REGION%
aws apigatewayv2 create-route --api-id %API_ID% --route-key "POST /ingest/twitter" --target integrations/%POST_INTEGRATION_ID% --region %REGION%
aws apigatewayv2 create-route --api-id %API_ID% --route-key "POST /subscribe" --target integrations/%SUB_INTEGRATION_ID% --region %REGION%

REM Add permissions
aws lambda add-permission --function-name cloudstrike-getEvents --statement-id api-gateway-invoke-getEvents --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*ƒ --region %REGION%
aws lambda add-permission --function-name cloudstrike-processTweet --statement-id api-gateway-invoke-processTweet --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*ƒ --region %REGION%
aws lambda add-permission --function-name cloudstrike-subscribe --statement-id api-gateway-invoke-subscribe --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*ƒ --region %REGION%

REM Deploy stage
aws apigatewayv2 create-stage --api-id %API_ID% --stage-name prod --auto-deploy --region %REGION%

set API_URL=https://%API_ID%.execute-api.%REGION%.amazonaws.com/prod

echo.
echo 🎉 Deployment Complete!
echo 📡 API Endpoint: %API_URL%
echo 🔗 Available endpoints:
echo   GET  %API_URL%/events
echo   POST %API_URL%/ingest/twitter
echo   POST %API_URL%/subscribe
echo.

REM Save API URL to config
echo API_URL=%API_URL% >> deployment-config.txt

echo ✅ API URL saved to deployment-config.txt
echo 🎯 You can now test your API endpoints!

REM Cleanup
rmdir /s /q temp-lambda 2>nul
del cloudstrike-function.zip 2>nul