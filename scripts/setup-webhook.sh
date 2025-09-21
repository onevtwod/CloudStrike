#!/bin/bash

# Setup script for Social Media Webhook Integration
# This script helps you set up the webhook receiver and test the social media ingestion

echo "🚀 Setting up Social Media Webhook Integration"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies for webhook receiver
echo ""
echo "📦 Installing webhook receiver dependencies..."
cd scripts
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if API_BASE_URL is set
if [ -z "$API_BASE_URL" ]; then
    echo ""
    echo "⚠️  API_BASE_URL environment variable is not set"
    echo "Please set it to your deployed API Gateway URL:"
    echo "export API_BASE_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com"
    echo ""
    read -p "Enter your API Gateway URL: " API_URL
    if [ ! -z "$API_URL" ]; then
        export API_BASE_URL="$API_URL"
        echo "export API_BASE_URL=\"$API_URL\"" >> ~/.bashrc
        echo "✅ API_BASE_URL set to: $API_BASE_URL"
    fi
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Available commands:"
echo "  1. Start webhook receiver:"
echo "     cd scripts && npm start"
echo ""
echo "  2. Run tests:"
echo "     cd scripts && API_BASE_URL=$API_BASE_URL node test-ingestion.js"
echo ""
echo "  3. Access dashboard:"
echo "     http://localhost:3000/dashboard"
echo ""
echo "📡 Webhook endpoints:"
echo "  - Twitter: http://localhost:3000/webhook/twitter"
echo "  - Facebook: http://localhost:3000/webhook/facebook"
echo "  - Instagram: http://localhost:3000/webhook/instagram"
echo ""
echo "🔧 Environment variables:"
echo "  - API_BASE_URL: $API_BASE_URL"
echo "  - PORT: 3000 (default)"
echo "  - TWITTER_WEBHOOK_SECRET: (optional, for Twitter webhook verification)"
echo ""
echo "📖 For detailed documentation, see: SOCIAL_MEDIA_INTEGRATION.md"
