# Railway Deployment Checklist

Use this checklist to ensure your app is ready for deployment to Railway.

## Pre-Deployment Checklist

### ✅ Code & Configuration

- [x] `railway.json` - Railway configuration file created
- [x] `nixpacks.toml` - Nixpacks build configuration created  
- [x] `package.json` - Build and start scripts configured
- [x] `backend/server.js` - Production environment variables configured
- [x] `.railwayignore` - Unnecessary files excluded from deployment
- [ ] All changes committed to Git
- [ ] Changes pushed to GitHub/GitLab

### ✅ Environment Variables to Set in Railway

Copy these to Railway's environment variables section:

```bash
NODE_ENV=production
PORT=3001
SESSION_SECRET=<generate-a-secure-random-string>
```

To generate a secure SESSION_SECRET:

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Linux/Mac:**
```bash
openssl rand -base64 32
```

### ✅ Dependencies Check

- [x] Backend dependencies listed in `backend/package.json`
- [x] Frontend dependencies listed in `frontend/package.json`
- [x] Python dependencies listed in `backend/requirements.txt`
- [x] Python 3.11 configured in `nixpacks.toml`
- [x] Ghostscript configured for Camelot (in `nixpacks.toml`)

### ✅ Railway Project Setup

- [ ] Railway account created
- [ ] New project created from GitHub repo
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Auto-deployments enabled (optional but recommended)

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Configure Railway deployment"
   git push origin main
   ```

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect configuration and start building

3. **Add PostgreSQL Database**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Wait for provisioning
   - `DATABASE_URL` is automatically set

4. **Set Environment Variables**
   - In Railway dashboard, go to Variables tab
   - Add the environment variables listed above
   - Save changes (Railway will auto-redeploy)

5. **Monitor Deployment**
   - Watch the build logs in Railway dashboard
   - Verify PostgreSQL is connected
   - Verify no build errors
   - Wait for deployment to complete

6. **Test Your App**
   - Click "Open App" in Railway dashboard
   - Test user registration and login
   - Upload a test PDF
   - Verify data displays correctly
   - Check data persists after app restart

## Post-Deployment Checklist

- [ ] App accessible at Railway URL
- [ ] User registration working
- [ ] User login working
- [ ] PDF upload working
- [ ] Data parsing successful
- [ ] Tables display correctly
- [ ] Map view works
- [ ] Data export (Excel/JSON) works
- [ ] No console errors in browser
- [ ] No errors in Railway logs

## Quick Test Commands

Once deployed, test these endpoints:

```bash
# Replace YOUR_RAILWAY_URL with your actual Railway URL
RAILWAY_URL="https://your-app-name.up.railway.app"

# Health check
curl $RAILWAY_URL/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Troubleshooting

### Build Fails

1. Check Railway logs for specific errors
2. Verify all `package.json` files are valid JSON
3. Ensure Python dependencies are compatible
4. Check `nixpacks.toml` syntax

### App Doesn't Load

1. Check `NODE_ENV=production` is set
2. Verify `SESSION_SECRET` is set
3. Check Railway logs for runtime errors
4. Ensure frontend build completed successfully

### PDF Upload Fails

1. Check Railway logs for Python errors
2. Verify Python packages installed correctly
3. Check Ghostscript availability
4. Verify file size limits

### Data Not Persisting

- **Solution**: Add PostgreSQL database in Railway
- **Check**: Verify `DATABASE_URL` is set
- **Verify**: Check logs show "Using PostgreSQL database"

## Estimated Deployment Time

- **First deployment**: 5-10 minutes
- **Subsequent deployments**: 2-5 minutes

## Cost Estimate

Railway pricing (as of 2024):
- **Hobby**: $5/month (500 hours, suitable for personal projects)
- **Usage-based**: Pay for what you use

Check current pricing: https://railway.app/pricing

## Next Steps After Deployment

1. ✅ Test all features thoroughly
2. ✅ Set up custom domain (optional)
3. ✅ Configure database persistence (if needed)
4. ✅ Set up monitoring and alerts
5. ✅ Configure automated backups (if using PostgreSQL)

## Need Help?

- 📖 Full guide: See `RAILWAY_DEPLOYMENT.md`
- 🐛 Issues: Check Railway logs first
- 💬 Support: Railway Discord or project repository

---

**Ready to deploy?** Just push to GitHub and create a new Railway project! 🚀

