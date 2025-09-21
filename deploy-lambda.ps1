# PowerShell script to build and deploy Lambda functions

param(
    [string]$ConfigFile = "deployment-config.txt"
)

# Load configuration
if (Test-Path $ConfigFi# Save API URL to config
Add-Content -Path "..\..\deployment-config.txt" -Value "API_URL=$apiUrl"

Write-Host "✅ API URL saved to deployment-config.txt" -ForegroundColor Green

Set-Location "..\.."
    Get-Content $ConfigFile | ForEach-Object {
        if ($_ -match "^(.+)=(.+)$") {
            Set-Variable -Name $matches[1] -Value $matches[2]
        }
    }
} else {
    Write-Error "Configuration file not found. Please run deploy-infrastructure.bat first."
    exit 1
}

Write-Host "🔨 Building and deploying Lambda functions..." -ForegroundColor Green

# Get AWS Account ID
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$LAMBDA_ROLE_ARN = "arn:aws:iam::${ACCOUNT_ID}:role/${LAMBDA_ROLE_NAME}"

Write-Host "Account ID: $ACCOUNT_ID" -ForegroundColor Yellow
Write-Host "Lambda Role ARN: $LAMBDA_ROLE_ARN" -ForegroundColor Yellow

# Build the application
Write-Host "📦 Building application..." -ForegroundColor Cyan
Set-Location "packages\shared"
npm run build
Set-Location "..\..\services\processing"

# Create a simple deployment package without TypeScript compilation
Write-Host "📋 Creating deployment package..." -ForegroundColor Cyan

# Create deployment directory
if (Test-Path "deployment") { Remove-Item "deployment" -Recurse -Force }
New-Item -ItemType Directory -Path "deployment" | Out-Null

# Copy source files (we'll use JavaScript directly)
Copy-Item "src\*" "deployment\" -Recurse -Force
Copy-Item "package.json" "deployment\"
Copy-Item "..\..\packages\shared\dist\*" "deployment\shared\" -Recurse -Force

# Create a minimal package.json for deployment
$deploymentPackageJson = @{
    name = "cloudstrike-lambda"
    version = "1.0.0"
    main = "index.js"
    dependencies = @{
        "@aws-sdk/client-bedrock-runtime" = "^3.893.0"
        "@aws-sdk/client-dynamodb" = "^3.673.0"
        "@aws-sdk/client-sns" = "^3.673.0"
        "@aws-sdk/client-sqs" = "^3.673.0"
        "@aws-sdk/client-rekognition" = "^3.673.0"
        "@aws-sdk/client-s3" = "^3.673.0"
        "@aws-sdk/client-iam" = "^3.673.0"
        "@aws-sdk/client-lambda" = "^3.673.0"
        "@aws-sdk/client-secrets-manager" = "^3.673.0"
        "@aws-sdk/lib-dynamodb" = "^3.673.0"
    }
}

$deploymentPackageJson | ConvertTo-Json -Depth 3 | Set-Content "deployment\package.json"

# Install production dependencies
Set-Location "deployment"
npm install --production

# Create ZIP files for each Lambda function
$functions = @(
    @{name="processTweet"; handler="handlers/processTweet.handler"},
    @{name="getEvents"; handler="handlers/getEvents.handler"},
    @{name="subscribe"; handler="handlers/subscribe.handler"},
    @{name="analyzeImage"; handler="handlers/analyzeImage.handler"},
    @{name="socialMediaScraper"; handler="handlers/socialMediaScraper.handler"},
    @{name="processQueue"; handler="handlers/processQueue.handler"},
    @{name="scheduledTasks"; handler="handlers/scheduledTasks.handler"}
)

foreach ($func in $functions) {
    Write-Host "📦 Creating ZIP for $($func.name)..." -ForegroundColor Cyan
    
    # Create function-specific directory
    $funcDir = "lambda-$($func.name)"
    if (Test-Path $funcDir) { Remove-Item $funcDir -Recurse -Force }
    New-Item -ItemType Directory -Path $funcDir | Out-Null
    
    # Copy all files to function directory
    Copy-Item "*" $funcDir -Recurse -Force -Exclude "lambda-*"
    
    # Create ZIP
    Compress-Archive -Path "$funcDir\*" -DestinationPath "$($func.name).zip" -Force
    
    # Upload to S3
    Write-Host "☁️ Uploading $($func.name).zip to S3..." -ForegroundColor Blue
    aws s3 cp "$($func.name).zip" "s3://$S3_BUCKET/$($func.name).zip" --region $REGION
    
    # Create Lambda function
    Write-Host "🚀 Creating Lambda function $($func.name)..." -ForegroundColor Green
    
    $createResult = aws lambda create-function `
        --function-name "cloudstrike-$($func.name)" `
        --runtime "nodejs20.x" `
        --role $LAMBDA_ROLE_ARN `
        --handler $func.handler `
        --code "S3Bucket=$S3_BUCKET,S3Key=$($func.name).zip" `
        --timeout 300 `
        --memory-size 1024 `
        --environment "Variables={EVENTS_TABLE=disaster-events,ALERTS_TOPIC_ARN=$SNS_TOPIC_ARN,SOCIAL_MEDIA_QUEUE_URL=$MAIN_QUEUE_URL,PRIORITY_QUEUE_URL=$PRIORITY_QUEUE_URL,DEAD_LETTER_QUEUE_URL=$DLQ_URL,IMAGES_BUCKET=$IMAGE_BUCKET,AWS_REGION=$REGION,NODE_ENV=production}" `
        --region $REGION 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Lambda function $($func.name) created successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Lambda function $($func.name) might already exist, updating..." -ForegroundColor Yellow
        aws lambda update-function-code `
            --function-name "cloudstrike-$($func.name)" `
            --s3-bucket $S3_BUCKET `
            --s3-key "$($func.name).zip" `
            --region $REGION
    }
}

Write-Host "✅ All Lambda functions deployed!" -ForegroundColor Green

# Create API Gateway
Write-Host "🌐 Creating API Gateway..." -ForegroundColor Cyan

$apiId = (aws apigatewayv2 create-api --name "cloudstrike-api" --protocol-type HTTP --cors-configuration "AllowOrigins=*,AllowMethods=*,AllowHeaders=*" --region $REGION --output text --query 'ApiId')

Write-Host "API Gateway ID: $apiId" -ForegroundColor Yellow

# Create routes and integrations
$routes = @(
    @{path="/events"; method="GET"; function="cloudstrike-getEvents"},
    @{path="/ingest/twitter"; method="POST"; function="cloudstrike-processTweet"},
    @{path="/subscribe"; method="POST"; function="cloudstrike-subscribe"}
)

foreach ($route in $routes) {
    Write-Host "🔗 Creating route $($route.method) $($route.path)..." -ForegroundColor Cyan
    
    # Get Lambda function ARN
    $functionArn = (aws lambda get-function --function-name $route.function --region $REGION --output text --query 'Configuration.FunctionArn')
    
    # Create integration
    $integrationId = (aws apigatewayv2 create-integration --api-id $apiId --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version "2.0" --region $REGION --output text --query 'IntegrationId')
    
    # Create route
    aws apigatewayv2 create-route --api-id $apiId --route-key "$($route.method) $($route.path)" --target "integrations/$integrationId" --region $REGION | Out-Null
    
    # Add permission for API Gateway to invoke Lambda
    aws lambda add-permission --function-name $route.function --statement-id "api-gateway-invoke-$($route.function)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${apiId}/*/*" --region $REGION 2>$null
}

# Create and deploy stage
aws apigatewayv2 create-stage --api-id $apiId --stage-name "prod" --auto-deploy --region $REGION | Out-Null

$apiUrl = "https://${apiId}.execute-api.${REGION}.amazonaws.com/prod"

Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "📡 API Endpoint: $apiUrl" -ForegroundColor Yellow
Write-Host "🔗 Available endpoints:" -ForegroundColor Cyan
Write-Host "  GET  $apiUrl/events" -ForegroundColor White
Write-Host "  POST $apiUrl/ingest/twitter" -ForegroundColor White
Write-Host "  POST $apiUrl/subscribe" -ForegroundColor White

# Save API URL to config
Add-Content -Path "..\..\deployment-config.txt" -Value "API_URL=$apiUrl"

Write-Host "✅ API URL saved to deployment-config.txt" -ForegroundColor Green

Set-Location "..\..\"