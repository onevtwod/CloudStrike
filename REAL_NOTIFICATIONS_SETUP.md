# 📧📱 Real Email/SMS Notifications Setup Guide

This guide shows you how to set up **real email and SMS notifications** using AWS SES and SNS services.

## 🚀 **What's New**

The enhanced system now sends **REAL emails and SMS** to subscribers stored in DynamoDB:

- ✅ **Real emails** via AWS SES (Simple Email Service)
- ✅ **Real SMS** via AWS SNS (Simple Notification Service)  
- ✅ **Beautiful HTML emails** with severity-based styling
- ✅ **Professional SMS formatting** with sender ID
- ✅ **Comprehensive error handling** for delivery issues
- ✅ **DynamoDB subscriber management** with preferences

## 🔧 **Setup Requirements**

### 1. **AWS Services Setup**

You need these AWS services configured:

```bash
# Required AWS Services
- AWS SES (Simple Email Service) - for emails
- AWS SNS (Simple Notification Service) - for SMS
- AWS DynamoDB - for subscriber storage
- AWS IAM - for permissions
```

### 2. **Environment Variables**

Set these environment variables:

```cmd
# Required AWS Credentials
set AWS_ACCESS_KEY_ID=AKIA...
set AWS_SECRET_ACCESS_KEY=...
set AWS_REGION=us-east-1

# Optional: SES Configuration
set SES_SENDER_EMAIL=your-verified-email@yourdomain.com

# Optional: Test Contacts (for testing)
set TEST_EMAIL_1=your-test-email@example.com
set TEST_PHONE_1=+1234567890
```

### 3. **AWS SES Email Setup**

#### **Step 1: Verify Email Addresses**

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Navigate to "Verified identities"
3. Click "Create identity"
4. Choose "Email address"
5. Enter your sender email (e.g., `alerts@yourdomain.com`)
6. Check your email and click the verification link

#### **Step 2: Request Production Access (Optional)**

For production use:
1. In SES Console, go to "Account dashboard"
2. Click "Request production access"
3. Fill out the form for higher sending limits

#### **Step 3: Set Environment Variable**

```cmd
set SES_SENDER_EMAIL=your-verified-email@yourdomain.com
```

### 4. **AWS SNS SMS Setup**

#### **Step 1: Enable SMS**

1. Go to [AWS SNS Console](https://console.aws.amazon.com/sns/)
2. Navigate to "Text messaging (SMS)"
3. Configure your SMS preferences
4. Set up spending limits (recommended)

#### **Step 2: Test Phone Number Format**

Use international format:
```
✅ Correct: +1234567890, +60123456789
❌ Wrong: 1234567890, 0123456789
```

### 5. **IAM Permissions**

Your AWS user needs these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "sns:Publish",
                "sns:CreateTopic",
                "sns:Subscribe"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:UpdateItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/disaster-subscribers"
        }
    ]
}
```

## 🧪 **Testing Real Notifications**

### **Quick Test**

```bash
# Test with real email/SMS
node scripts/test-real-notifications.js
```

### **Full System Test**

```bash
# Test complete subscriber system
node scripts/test-subscriber-notifications.js
```

## 📧 **Email Features**

### **Beautiful HTML Emails**

Emails include:
- 🎨 **Severity-based color coding** (Critical=Red, High=Orange, etc.)
- 📍 **Location information**
- ⏰ **Timestamp**
- 🚨 **Professional formatting**
- 📱 **Emergency contact numbers**
- ⚠️ **Disclaimers and verification notices**

### **Email Example**

```html
🚨 DISASTER ALERT

📍 Location: Kuala Lumpur
⚠️  Severity: HIGH (0.70)
📊 Events: 1
🔍 Status: ⏳ PENDING VERIFICATION
⏰ Time: 2024-01-20 15:30:00

Heavy flooding reported in downtown area. 
Water level rising rapidly. Evacuation ordered.

⚠️ Important: Verify with official sources before taking action.

📱 Emergency Contacts:
• 999 - Emergency Services
• 03-12345678 - Local Emergency
```

## 📱 **SMS Features**

### **Professional SMS Format**

SMS includes:
- 📱 **Transactional SMS type** (not promotional)
- 🏷️ **Sender ID: "DISASTER"**
- 📝 **Concise, clear messaging**
- 🚨 **Urgency indicators**

### **SMS Example**

```
🚨 DISASTER ALERT

📍 Location: Kuala Lumpur
⚠️  Severity: HIGH (0.70)
📊 Events: 1
🔍 Status: ⏳ PENDING VERIFICATION
⏰ Time: 2024-01-20 15:30:00

Heavy flooding reported in downtown area. 
Water level rising rapidly. Evacuation ordered.

⚠️ Verify with official sources before taking action.

📱 Emergency: 999
```

## 🎯 **Subscriber Management**

### **Add Subscribers**

```javascript
const subscriber = {
    email: 'user@example.com',
    phone: '+1234567890',
    type: 'both', // 'email', 'sms', or 'both'
    preferences: {
        disasterAlerts: true,
        emergencyAlerts: true,
        verifications: true,
        systemStatus: false
    },
    location: 'Kuala Lumpur' // Optional: for location-specific alerts
};

await system.storage.storeSubscriber(subscriber);
```

### **Subscriber Types**

1. **Email Only**: `type: 'email'`
2. **SMS Only**: `type: 'sms'`  
3. **Both**: `type: 'both'` (sends to both email and SMS)

### **Preference Filtering**

Subscribers only receive notifications they've opted into:
- `disasterAlerts`: General disaster notifications
- `emergencyAlerts`: High-priority emergency alerts
- `verifications`: Verified disaster confirmations
- `systemStatus`: System health updates

## 🚨 **Error Handling**

The system handles common AWS errors:

### **SES Email Errors**
- `MessageRejected`: Invalid email address
- `MailFromDomainNotVerifiedException`: Sender domain not verified
- `ConfigurationSetDoesNotExistException`: SES configuration issue

### **SNS SMS Errors**
- `InvalidParameter`: Invalid phone number format
- `OptedOut`: Phone number opted out of SMS
- `Throttled`: Rate limit exceeded

## 💰 **Cost Considerations**

### **AWS SES Pricing**
- **Free Tier**: 62,000 emails/month (if sent from EC2)
- **Paid**: $0.10 per 1,000 emails
- **Data transfer**: $0.12 per GB

### **AWS SNS Pricing**
- **SMS**: $0.0075 per SMS (US), varies by country
- **Free Tier**: No free SMS messages
- **Monthly charges**: None

### **DynamoDB Pricing**
- **Free Tier**: 25 GB storage, 25 read/write capacity units
- **On-demand**: Pay per request

## 🔍 **Monitoring & Troubleshooting**

### **CloudWatch Metrics**

Monitor these metrics:
- SES: `Send`, `Bounce`, `Complaint`, `Delivery`
- SNS: `NumberOfMessagesSent`, `NumberOfMessagesFailed`
- DynamoDB: `ConsumedReadCapacityUnits`, `ConsumedWriteCapacityUnits`

### **Common Issues**

1. **Emails not sending**: Check SES verification status
2. **SMS not sending**: Verify phone number format (+1234567890)
3. **Access denied**: Check IAM permissions
4. **Rate limits**: Implement throttling in your application

## 🎉 **Success!**

Your disaster detection system now sends **real emails and SMS** to subscribers based on their preferences and location. The system:

✅ Fetches subscribers from DynamoDB  
✅ Filters by notification preferences  
✅ Sends beautiful HTML emails via AWS SES  
✅ Sends professional SMS via AWS SNS  
✅ Tracks notification delivery  
✅ Handles errors gracefully  
✅ Scales automatically with AWS services  

**Ready for production use!** 🚀
