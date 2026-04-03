# SafeStep Backend Deployment Guide

## Option 1: Deploy to Render.com (FREE, Permanent URL)

### Step 1: Push server code to GitHub
1. Create a new GitHub repository called `safestep-server`
2. Push only the `server/` folder contents

### Step 2: Deploy on Render
1. Go to https://render.com and sign up with GitHub
2. Click **New → Web Service**
3. Connect your `safestep-server` repo
4. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click **Advanced → Add Environment Variables**:
   - `TWILIO_ACCOUNT_SID` = your SID
   - `TWILIO_AUTH_TOKEN` = your auth token
   - `TWILIO_PHONE_NUMBER` = your Twilio number
6. Click **Create Web Service**
7. In ~2 minutes you get a permanent URL like: `https://safestep-server.onrender.com`

## Option 2: Deploy to Railway.app (FREE, Permanent URL)

1. Go to https://railway.app
2. Sign in with GitHub
3. Click **New Project → Deploy from GitHub repo**
4. Select your server folder
5. Add environment variables (same as above)
6. Get permanent URL like: `https://safestep-server.up.railway.app`

## After Deployment
Update these 2 files with your permanent URL:
- `client/src/pages/Dashboard.jsx` - replace the pinggy URL
- `client/src/pages/EvidenceCapture.jsx` - replace the pinggy URL
