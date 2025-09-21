# 🚀 Disaster Detection System - Complete Startup Guide

This guide will help you run the complete disaster detection system with the web frontend.

## 📋 Prerequisites

### 1. **AWS Credentials Setup**
```bash
cd scripts
node setup-aws-credentials.js
```
Or manually set environment variables:
```bash
set AWS_ACCESS_KEY_ID=your_access_key_here
set AWS_SECRET_ACCESS_KEY=your_secret_key_here
set AWS_REGION=us-east-1
```

### 2. **Create DynamoDB Tables**
```bash
cd scripts
node create-dynamodb-tables.js
```

### 3. **Install Dependencies**
```bash
# Backend dependencies
cd scripts
npm install

# Frontend dependencies
cd apps/web
npm install
```

## 🚀 Running the Complete System

### **Option 1: Automated Startup (Recommended)**
```bash
cd scripts
node start-full-system.js
```

This script will:
- ✅ Check AWS credentials
- ✅ Verify DynamoDB tables exist
- ✅ Start the disaster detection system
- ✅ Start the API server
- ✅ Display all available endpoints

### **Option 2: Manual Startup**

#### **Step 1: Start Backend API Server**
```bash
cd scripts
node api-server.js
```

#### **Step 2: Configure Web Frontend**
Create `apps/web/.env` file:
```bash
VITE_API_BASE_URL=http://localhost:3001
VITE_MAPS_EMBED_API_KEY=your_google_maps_api_key_here
```

#### **Step 3: Start Web Frontend**
```bash
cd apps/web
npm run dev
```

## 🌐 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   API Server    │    │ Disaster System │
│   (React/Vite)  │◄──►│  (Express.js)   │◄──►│   (main.js)     │
│   Port: 5173    │    │   Port: 3001    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   DynamoDB      │
                       │   (AWS)         │
                       └─────────────────┘
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/events` | Get all disaster events |
| `GET` | `/events/recent` | Get events from last 24 hours |
| `GET` | `/events/location/:location` | Get events by location |
| `POST` | `/subscribe` | Subscribe to alerts |
| `GET` | `/stats` | Get system statistics |
| `POST` | `/ingest/twitter` | Manual event ingestion |

## 🔧 Troubleshooting

### **Common Issues:**

#### 1. **"AWS credentials not found"**
```bash
cd scripts
node test-aws-credentials.js
```

#### 2. **"DynamoDB tables don't exist"**
```bash
cd scripts
node create-dynamodb-tables.js
```

#### 3. **"API connection failed" in web app**
- Check if API server is running on port 3001
- Verify `VITE_API_BASE_URL` in web app's `.env` file
- Check browser console for detailed errors

#### 4. **"Rate limiting errors" from AWS Comprehend**
- The system now includes automatic retry logic
- Wait a few minutes for rate limits to reset
- Consider upgrading AWS account limits

## 📊 Monitoring

### **Check System Status:**
```bash
curl http://localhost:3001/health
curl http://localhost:3001/stats
```

### **View Events:**
```bash
curl http://localhost:3001/events
curl http://localhost:3001/events/recent
```

## 🎯 Testing the System

### **1. Manual Event Creation:**
```bash
curl -X POST http://localhost:3001/ingest/twitter \
  -H "Content-Type: application/json" \
  -d '{"text": "Flood warning in downtown area, roads blocked", "author": "test_user", "location": "downtown"}'
```

### **2. Subscribe to Alerts:**
```bash
curl -X POST http://localhost:3001/subscribe \
  -H "Content-Type: application/json" \
  -d '{"kind": "email", "value": "your@email.com"}'
```

### **3. Check Web Frontend:**
Open `http://localhost:5173` in your browser

## 📁 File Structure

```
HackathonAWS/
├── scripts/
│   ├── main.js                    # Main disaster detection system
│   ├── api-server.js              # API server for web frontend
│   ├── start-full-system.js       # Automated startup script
│   ├── aws-comprehend-analyzer.js # AWS Comprehend integration
│   ├── dynamodb-storage.js        # Database operations
│   ├── reddit-news-scraper.js     # Reddit data scraping
│   └── ...
├── apps/web/
│   ├── src/
│   │   ├── App.tsx                # Main React component
│   │   ├── utils/api.ts           # API client
│   │   └── ...
│   └── .env                       # Frontend environment variables
└── README.md
```

## 🔄 Data Flow

1. **Data Collection**: Reddit scraper collects posts
2. **Analysis**: AWS Comprehend analyzes text for disaster content
3. **Storage**: Events stored in DynamoDB
4. **API**: Express server exposes REST endpoints
5. **Frontend**: React app displays events with maps

## 🚨 Production Deployment

For production deployment:

1. **Set up AWS infrastructure** (Lambda, API Gateway, etc.)
2. **Configure environment variables** for production
3. **Deploy backend** using Serverless Framework
4. **Deploy frontend** to a static hosting service
5. **Set up monitoring** and alerting

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly

---

**🎉 You're now ready to run the complete disaster detection system!**
