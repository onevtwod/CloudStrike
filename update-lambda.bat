@echo off
echo Updating CloudStrike Lambda function with DynamoDB integration...

cd /d "C:\MMU\AWS\CloudStrike\lambda-function"

echo Installing dependencies...
npm install

echo Creating deployment package...
cd /d "C:\MMU\AWS\CloudStrike"
if exist lambda-deployment.zip del lambda-deployment.zip

echo Packaging Lambda function with dependencies...
powershell -Command "Compress-Archive -Path 'lambda-function\*' -DestinationPath 'lambda-deployment.zip' -Force"

echo Updating Lambda function...
aws lambda update-function-code ^
    --function-name cloudstrike-api ^
    --zip-file fileb://lambda-deployment.zip ^
    --region us-east-1

if %ERRORLEVEL% EQU 0 (
    echo ✅ Lambda function updated successfully!
    echo.
    echo Waiting for function to be ready...
    timeout /t 5 >nul
    
    echo Testing the updated API...
    powershell -Command "Invoke-WebRequest -Uri 'https://t5llkka6x3.execute-api.us-east-1.amazonaws.com/prod/events' -Method GET"
) else (
    echo ❌ Failed to update Lambda function
    exit /b 1
)

echo.
echo Done!