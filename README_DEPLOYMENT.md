# Quick Start: Deploy to Railway

This is your **quick reference guide** to get the Sewer Inspection App deployed to Railway in minutes.

## 🚀 Quick Deploy (5 minutes)

### Step 1: Prepare Your Code

```bash
# Make sure all changes are committed
git add .
git commit -m "Configure Railway deployment"
git push origin main
```

### Step 2: Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will automatically start building

### Step 3: Set Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```
NODE_ENV=production
PORT=3001
SESSION_SECRET=<your-secure-random-string-here>
```

**Generate a secure SESSION_SECRET:**

Windows PowerShell:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Mac/Linux:
```bash
openssl rand -base64 32
```

### Step 4: Wait for Deployment

Railway will:
1. ✅ Install Node.js and Python dependencies
2. ✅ Build the React frontend
3. ✅ Start the backend server
4. ✅ Serve the application

This takes about 5-10 minutes on first deploy.

### Step 5: Test Your App

Click **"Open App"** in Railway dashboard and test:
- ✅ User registration
- ✅ Login
- ✅ PDF upload
- ✅ View data in tables
- ✅ View map
- ✅ Export data

## ✨ What's Configured

Your app is already configured with:

- **`railway.json`** - Railway deployment configuration
- **`nixpacks.toml`** - Python 3.11 + dependencies setup
- **`backend/server.js`** - Production environment handling
- **`.railwayignore`** - Optimized deployment size

## 📋 Files Created for Deployment

| File | Purpose |
|------|---------|
| `railway.json` | Railway build & deploy configuration |
| `nixpacks.toml` | Python environment setup |
| `.railwayignore` | Excludes unnecessary files |
| `RAILWAY_DEPLOYMENT.md` | Detailed deployment guide |
| `RAILWAY_CHECKLIST.md` | Step-by-step checklist |
| `verify-deployment.js` | Pre-deployment verification script |

## 🔧 Verify Before Deploying

Optional: Run verification script locally:

```bash
npm run verify-deployment
```

This checks if all configuration files are in place.

## ⚠️ Important Notes

### Database (SQLite)
- **Ephemeral storage**: Data will be lost on redeploy
- **For production**: Consider Railway PostgreSQL or persistent volumes
- See full guide for migration instructions

### File Uploads
- PDF files are processed then deleted (current behavior)
- No persistent storage needed for uploads
- For permanent storage: Add Railway volume or cloud storage

### Environment
- Backend serves both API and frontend
- Frontend built during deployment
- All requests go to single Railway URL

## 🆘 Troubleshooting

**Build fails?**
- Check Railway logs
- Verify all dependencies in `package.json` and `requirements.txt`

**App doesn't load?**
- Verify `NODE_ENV=production` is set
- Check SESSION_SECRET is configured
- View Railway logs for errors

**PDF upload fails?**
- Check Python dependencies installed
- Verify Ghostscript available (configured in nixpacks.toml)
- Check file size limits

## 📚 More Information

- **Full guide**: See `RAILWAY_DEPLOYMENT.md`
- **Checklist**: See `RAILWAY_CHECKLIST.md`
- **Railway docs**: https://docs.railway.app

## 🎯 Cost

- **Hobby Plan**: $5/month (great for testing)
- **Pro Plan**: Usage-based pricing
- Check current pricing: https://railway.app/pricing

## 🎉 That's It!

Your Sewer Inspection App is now deployed and accessible worldwide! 

**Your Railway URL**: `https://your-app-name.up.railway.app`

---

Need help? Check the full `RAILWAY_DEPLOYMENT.md` guide or Railway's documentation.

