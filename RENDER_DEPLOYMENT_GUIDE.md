# Render Deployment Guide for Cloud Edge OS Backend

## Quick Fix for Current Error

The error `Cannot find module '/opt/render/project/src/server.js'` means Render is looking in the wrong directory.

### Solution: Configure Root Directory in Render Dashboard

1. Go to your Render dashboard: https://dashboard.render.com/
2. Select your `cloud-edge-os-backend` service
3. Click **Settings** (left sidebar)
4. Scroll to **Build & Deploy** section
5. Set **Root Directory** to: `backend`
6. Click **Save Changes**
7. Go to **Manual Deploy** and click **Deploy latest commit**

## Complete Deployment Steps

### Option 1: Deploy from GitHub (Recommended)

#### Step 1: Push Backend to GitHub

Make sure your `backend` folder is in your repository:

```bash
git add backend/
git commit -m "Add backend server"
git push origin main
```

#### Step 2: Create New Web Service on Render

1. Go to https://dashboard.render.com/
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:

**Basic Settings:**
- **Name**: `cloud-edge-os-backend`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend` ⚠️ **IMPORTANT**
- **Runtime**: `Node`

**Build & Deploy:**
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

**Instance Type:**
- Select **Free** plan

#### Step 3: Set Environment Variables

In the **Environment** section, add:

```
NODE_ENV=production
PORT=3001
```

#### Step 4: Deploy

Click **Create Web Service** and wait for deployment to complete.

### Option 2: Deploy from Local Directory

If you're deploying directly without GitHub:

1. Make sure you're in the `backend` directory:
   ```bash
   cd backend
   ```

2. Initialize git if needed:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. Follow Render's manual deployment instructions

## Verify Deployment

Once deployed, test your backend:

### 1. Check Health Endpoint

```bash
curl https://your-app-name.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 123,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Test File Upload

```bash
curl -X POST https://your-app-name.onrender.com/api/upload \
  -F "file=@test.txt"
```

Expected response:
```json
{
  "success": true,
  "url": "https://files.catbox.moe/abc123.txt",
  "filename": "test.txt",
  "size": 1024,
  "mimetype": "text/plain"
}
```

## Common Issues & Solutions

### Issue 1: "Cannot find module" Error

**Problem**: Render can't find server.js

**Solution**: 
- Set **Root Directory** to `backend` in Render settings
- Make sure `server.js` exists in the `backend` folder

### Issue 2: Port Binding Error

**Problem**: App crashes with port error

**Solution**: 
- Render automatically sets the PORT environment variable
- Update server.js to use `process.env.PORT`:

```javascript
const PORT = process.env.PORT || 3001;
```

### Issue 3: Module Not Found (Dependencies)

**Problem**: Missing npm packages

**Solution**:
- Ensure `package.json` is in the `backend` folder
- Set Build Command to `npm install`
- Check that all dependencies are in `dependencies` (not `devDependencies`)

### Issue 4: CORS Errors

**Problem**: Frontend can't connect to backend

**Solution**: Already configured in server.js with:
```javascript
app.use(cors());
```

### Issue 5: Cold Starts (Free Tier)

**Problem**: First request takes 30+ seconds

**Explanation**: 
- Render free tier spins down after 15 minutes of inactivity
- First request wakes up the service
- Subsequent requests are fast

**Solutions**:
- Upgrade to paid plan for always-on service
- Use a ping service to keep it awake
- Accept the cold start delay

## File Structure

Your repository should look like this:

```
your-repo/
├── backend/
│   ├── server.js          ← Main server file
│   ├── package.json       ← Dependencies
│   ├── .env.example       ← Environment template
│   ├── .gitignore         ← Git ignore rules
│   └── README.md          ← Documentation
├── src/                   ← Frontend code
└── ...
```

## Render Configuration Files

### render.yaml (Optional)

Create `backend/render.yaml` for infrastructure as code:

```yaml
services:
  - type: web
    name: cloud-edge-os-backend
    env: node
    region: oregon
    plan: free
    rootDir: backend
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
```

Then deploy with:
```bash
render deploy
```

## Update Frontend Configuration

After deployment, update your frontend to use the new URL:

### 1. Update .env file

```bash
# .env or .env.local
VITE_API_URL=https://your-app-name.onrender.com
```

### 2. Update catbox.ts (Already Done)

The default is already set to your Render URL:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'https://backend-for-cloud-edge.onrender.com';
```

### 3. Rebuild Frontend

```bash
npm run build
```

## Monitoring & Logs

### View Logs

1. Go to Render dashboard
2. Select your service
3. Click **Logs** tab
4. View real-time logs

### Monitor Performance

1. Click **Metrics** tab
2. View:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

## Automatic Deployments

Render automatically deploys when you push to GitHub:

```bash
git add backend/
git commit -m "Update backend"
git push origin main
```

Render will:
1. Detect the push
2. Run build command
3. Deploy new version
4. Zero-downtime deployment

## Custom Domain (Optional)

To use a custom domain:

1. Go to **Settings** → **Custom Domain**
2. Add your domain
3. Update DNS records as instructed
4. Wait for SSL certificate provisioning

## Scaling (Paid Plans)

To handle more traffic:

1. Upgrade to **Starter** or higher plan
2. Increase instance size
3. Add horizontal scaling (multiple instances)

## Backup & Disaster Recovery

### Backup Strategy

- Code is in GitHub (version controlled)
- No database to backup (stateless service)
- Catbox.moe handles file storage

### Disaster Recovery

If service goes down:
1. Check Render status page
2. View logs for errors
3. Redeploy from dashboard
4. Rollback to previous version if needed

## Cost Breakdown

### Free Tier
- 750 hours/month (enough for 1 service)
- Spins down after 15 min inactivity
- 512 MB RAM
- Shared CPU
- **Cost**: $0/month

### Starter Plan
- Always on (no spin down)
- 512 MB RAM
- Shared CPU
- **Cost**: $7/month

### Standard Plan
- 2 GB RAM
- Dedicated CPU
- **Cost**: $25/month

## Support

If you need help:
- Render Docs: https://render.com/docs
- Render Community: https://community.render.com/
- GitHub Issues: Your repository issues page

## Checklist

Before deploying, ensure:

- [ ] `backend/server.js` exists
- [ ] `backend/package.json` has all dependencies
- [ ] Root Directory set to `backend` in Render
- [ ] Environment variables configured
- [ ] `.gitignore` excludes `node_modules` and `.env`
- [ ] Code pushed to GitHub
- [ ] Health endpoint works after deployment
- [ ] Frontend updated with new backend URL

## Next Steps

After successful deployment:

1. ✅ Test all upload endpoints
2. ✅ Update frontend environment variables
3. ✅ Test file uploads from frontend
4. ✅ Monitor logs for errors
5. ✅ Set up custom domain (optional)
6. ✅ Configure automatic deployments
