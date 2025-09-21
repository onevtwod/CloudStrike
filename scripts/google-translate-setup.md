# Google Translate API Setup Guide

## Step 1: Get Google Cloud Credentials

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** or select existing project
3. **Enable the Translate API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Cloud Translation API"
   - Click "Enable"

## Step 2: Create Service Account

1. **Go to "IAM & Admin" → "Service Accounts"**
2. **Click "Create Service Account"**
3. **Fill in details**:
   - Name: `disaster-translate-service`
   - Description: `Service account for disaster detection translation`
4. **Grant roles**:
   - `Cloud Translation API User`
5. **Create and download JSON key file**

## Step 3: Configure Environment Variables

Create a `.env` file in your project root with:

```bash
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id-here
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

## Step 4: Place Credentials File

1. **Rename your downloaded JSON file** to `google-credentials.json`
2. **Place it in the scripts directory**: `D:\PROJECTS\HackathonAWS\scripts\google-credentials.json`

## Step 5: Test the Setup

Run the test script:
```bash
node test-comprehend-analysis.js
```

## Alternative: Use API Key (Simpler)

If you prefer using an API key instead of service account:

1. **Go to "APIs & Services" → "Credentials"**
2. **Click "Create Credentials" → "API Key"**
3. **Copy the API key**
4. **Update the script** to use API key instead of service account

## Troubleshooting

- **"Project not found"**: Check your project ID
- **"Authentication failed"**: Verify credentials file path
- **"API not enabled"**: Enable Cloud Translation API
- **"Quota exceeded"**: Check your billing and quotas

## Cost Information

- **Free tier**: 500,000 characters per month
- **Paid tier**: $20 per 1M characters
- **Perfect for testing and small projects**
