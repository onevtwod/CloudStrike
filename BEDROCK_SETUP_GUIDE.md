# 🤖 Amazon Bedrock Analysis Setup Guide

This guide explains how to set up Amazon Bedrock for disaster-related post analysis in the disaster detection system.

## 🎯 Overview

The system now uses **Amazon Bedrock** with **Amazon Titan Text** for comprehensive analysis of disaster-related posts, replacing Amazon Comprehend for entity detection, sentiment analysis, and key phrase extraction.

## 🔧 Prerequisites

### 1. **AWS Account Setup**
- Active AWS account with billing enabled
- AWS CLI configured or environment variables set
- Appropriate IAM permissions

### 2. **AWS Credentials**
```bash
# Set these environment variables
export AWS_ACCESS_KEY_ID=your_access_key_here
export AWS_SECRET_ACCESS_KEY=your_secret_key_here
export AWS_REGION=us-east-1  # or us-west-2
```

## 🚀 Step-by-Step Setup

### **Step 1: Enable Bedrock Model Access**

1. **Go to AWS Bedrock Console**
   - Navigate to: https://console.aws.amazon.com/bedrock/
   - Select your region (us-east-1 or us-west-2 recommended)

2. **Request Model Access**
   - Go to "Model access" in the left sidebar
   - Find "Amazon Titan Text G1"
   - Click "Request model access"
   - Select "Titan Text G1 Express" model
   - Submit the request (usually approved within minutes)

### **Step 2: Configure IAM Permissions**

The system automatically configures IAM permissions for Bedrock access through the serverless.yml configuration. The Lambda functions have the following permissions:

```yaml
- Effect: Allow
  Action:
    - bedrock:InvokeModel
  Resource:
    - 'arn:aws:bedrock:${self:provider.region}::foundation-model/amazon.titan-text-express-v1'
```

For manual setup, create or update IAM policy for Bedrock access:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel"
            ],
            "Resource": [
                "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-text-express-v1"
            ]
        }
    ]
}
```

### **Step 3: Install Dependencies**

Dependencies are already configured in the package.json files:

```bash
# For scripts (already installed)
cd scripts
npm install @aws-sdk/client-bedrock-runtime

# For processing service
cd services/processing
npm install @aws-sdk/client-bedrock-runtime
```

### **Step 4: Test Bedrock Integration**

```bash
# Test Bedrock analysis functionality
npm run test-bedrock

# Test the new Bedrock analyzer
cd scripts
node aws-bedrock-analyzer.js
```

### **Step 5: Run the Full System**

```bash
# Start the complete disaster detection system
npm run start-full
```

## 🧪 Testing

### **Test Translation Only**
```bash
cd scripts
node test-bedrock-translation.js
```

### **Test with Real Data**
```bash
cd scripts
node main.js
```

## 📊 Expected Output

When working correctly, you should see:

```
🤖 Amazon Bedrock analysis configured
🔍 Processing reddit post: "Banjir berlaku di Kuala Lumpur..."
   🤖 Analyzing with AWS Bedrock (Titan Text)...
   ✅ Bedrock analysis successful: 
   - Entities: [{"text":"Kuala Lumpur","type":"LOCATION","confidence":0.9}]
   - Sentiment: {"sentiment":"NEGATIVE","confidence":0.8}
   - Key Phrases: [{"text":"flood occurred","confidence":0.9}]
   - Disaster Keywords: ["flood","banjir"]
```

## 🔍 Troubleshooting

### **Common Issues:**

#### 1. **"Model not available in region"**
```
❌ Amazon Bedrock translation failed: ValidationException
💡 Amazon Titan model not available in region us-west-1. Try us-east-1 or us-west-2
```
**Solution:** Use us-east-1 or us-west-2 regions

#### 2. **"Access denied"**
```
❌ Amazon Bedrock analysis failed: AccessDeniedException
💡 Access denied. Ensure Bedrock permissions for Amazon Titan model are configured
```
**Solution:** Check IAM permissions and model access

#### 3. **"Model access not granted"**
```
❌ Amazon Bedrock analysis failed: ValidationException
```
**Solution:** Request Amazon Titan Text G1 Express model access in Bedrock console

#### 4. **"AWS credentials not found"**
```
❌ AWS credentials not found. Please set:
   AWS_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY
   AWS_REGION
```
**Solution:** Set AWS environment variables

## 💰 Cost Considerations

### **Bedrock Pricing (as of 2024):**
- **Amazon Titan Text G1 Express**: ~$0.65 per 1M input tokens, ~$0.87 per 1M output tokens
- **Typical Reddit post**: ~100-500 tokens
- **Estimated cost**: $0.0001-0.0004 per post

### **Cost Optimization:**
1. **Language Detection**: Only translate if Malay detected
2. **Text Length Limits**: Truncate very long posts
3. **Caching**: Consider caching translations for similar text

## 🔄 Fallback Behavior

If Bedrock translation fails, the system will:
1. Log the error with specific details
2. Continue processing with the original Malay text
3. AWS Comprehend will still analyze the text (though less accurately)
4. System continues normal operation

## 📋 System Architecture

```
Social Media Post → Language Detection → Bedrock Analysis → Event Creation
                                        ↓
                                   Weather Cross-check → Final Event
```

**Bedrock Analysis includes:**
- Entity Detection (PERSON, LOCATION, ORGANIZATION, EVENT)
- Sentiment Analysis (POSITIVE/NEGATIVE/NEUTRAL)
- Key Phrase Extraction
- Disaster Keyword Detection
- Confidence Scoring

## 🎯 Benefits of Bedrock Integration

1. **Comprehensive Analysis**: Single API call provides entity detection, sentiment analysis, and key phrase extraction
2. **Better Accuracy**: Amazon Titan Text provides more accurate analysis than traditional NLP services
3. **AWS Native**: No external API dependencies, fully integrated with AWS ecosystem
4. **Cost Effective**: More affordable than using multiple separate services
5. **Scalable**: Handles high-volume analysis requests with built-in rate limiting
6. **Context Aware**: Better understanding of disaster-related terminology and context
7. **Fast Performance**: Optimized for speed and accuracy
8. **Wide Availability**: Titan models are available in more AWS regions
9. **Unified Interface**: Single service replaces multiple Comprehend operations

## 📞 Support

If you encounter issues:

1. **Check AWS Bedrock Console** for Amazon Titan Text G1 Express model access status
2. **Verify IAM permissions** for Bedrock service
3. **Test with simple Malay text** using the test script
4. **Check AWS CloudWatch logs** for detailed error messages
5. **Ensure billing is enabled** on your AWS account

---

**🎉 Your disaster detection system now uses Amazon Bedrock with Titan Text for comprehensive disaster-related post analysis!**
