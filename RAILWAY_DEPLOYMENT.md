# Railway Deployment Guide

This guide will help you deploy the Sewer Inspection App to Railway.

## Prerequisites

- A [Railway](https://railway.app) account
- Git repository containing this project (GitHub, GitLab, or Bitbucket)
- Railway CLI installed (optional, but recommended): `npm install -g @railway/cli`

## Deployment Steps

### 1. Create a New Project on Railway

1. Log in to [Railway](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Select your repository
5. Railway will automatically detect your project and start deploying

### 2. Configure Environment Variables

In your Railway project dashboard, go to the "Variables" tab and add the following environment variables:

```bash
# Required Environment Variables
NODE_ENV=production
PORT=3001
SESSION_SECRET=your-secure-random-session-secret-change-this

# Optional: If you need to specify frontend URL (usually auto-detected)
# FRONTEND_URL will be auto-set by Railway using RAILWAY_PUBLIC_DOMAIN
```

**Important:** Generate a secure random string for `SESSION_SECRET`. You can use:
```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 3. Configure Build Settings

Railway should automatically detect the configuration from `railway.json` and `nixpacks.toml`. 

The build process will:
1. Install Node.js dependencies
2. Install Python 3.11 and required packages (camelot, pandas, opencv)
3. Build the frontend React app
4. Start the backend server which serves the frontend

### 4. Deploy

Railway will automatically deploy your application. You can monitor the deployment logs in the Railway dashboard.

The deployment process:
- **Build phase**: Installs all dependencies and builds the frontend
- **Deploy phase**: Starts the Node.js backend server
- **Serving**: Backend serves both API endpoints and the built frontend

### 5. Access Your Application

Once deployed, Railway will provide you with a public URL (e.g., `https://your-app-name.up.railway.app`).

Your application will be accessible at this URL, and all API endpoints will be available at:
- `https://your-app-name.up.railway.app/api/*`

## Important Notes

### Database (SQLite)

The application uses SQLite by default. **Important**: Railway's filesystem is ephemeral, meaning:

- **Data will be lost on redeployments** unless you use Railway's persistent volumes
- For production use, consider migrating to Railway's PostgreSQL service

To add persistent storage:
1. In Railway dashboard, click "New" → "Database" → "Add PostgreSQL"
2. Update `backend/database.js` to use PostgreSQL instead of SQLite (you'll need to modify the database connection)

### File Uploads

Uploaded PDF files are stored in the `backend/uploads/` directory. These are also ephemeral. Options:

1. **Railway Volumes** (recommended): Add a persistent volume in Railway
2. **Cloud Storage**: Integrate with AWS S3, Google Cloud Storage, or similar
3. **Process and delete**: Keep the current behavior (files are deleted after processing)

Currently, the app deletes uploaded PDFs after processing, so this shouldn't be an issue.

### Python Dependencies

The application requires Python 3.11 and several packages for PDF parsing:
- `camelot-py` - For table extraction from PDFs
- `opencv-python` - Image processing for Camelot
- `pdfminer.six` - PDF text extraction

These are automatically installed during the build process via `nixpacks.toml`.

### CORS Configuration

The backend is configured to automatically handle CORS for Railway:
- Development: Accepts requests from `http://localhost:3000`
- Production: Accepts requests from the Railway public domain (auto-detected)

### Session Management

Sessions use in-memory storage by default. For production with multiple instances, consider:
- Railway Redis for session storage
- Configure `express-session` to use Redis store

## Testing the Deployment

After deployment, test the following:

1. **Frontend loads**: Visit your Railway URL
2. **User registration**: Create a new account
3. **Login**: Log in with your credentials
4. **PDF upload**: Upload a sewer inspection PDF
5. **Data viewing**: View the parsed data in tables and map
6. **Data export**: Export data to Excel/JSON

## Troubleshooting

### Build Failures

If the build fails:
1. Check Railway logs for specific error messages
2. Verify all dependencies are listed in `package.json` and `requirements.txt`
3. Ensure Python packages are compatible with Python 3.11

### Runtime Errors

If the app deploys but doesn't work:
1. Check Railway logs for runtime errors
2. Verify environment variables are set correctly
3. Check CORS configuration if frontend can't reach API
4. Ensure `NODE_ENV=production` is set

### Python Script Errors

If PDF parsing fails:
1. Check that Python and dependencies are installed correctly
2. View logs for Python script errors
3. Verify Ghostscript is available (required by Camelot)

### Database Issues

If data isn't persisting:
1. Remember: SQLite on Railway is ephemeral
2. Consider migrating to PostgreSQL for production
3. Or set up Railway volumes for persistence

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | development | Set to `production` for Railway |
| `PORT` | No | 3001 | Port for the backend server |
| `SESSION_SECRET` | Yes | - | Secret key for session encryption |
| `FRONTEND_URL` | No | Auto-detected | Frontend URL for CORS (auto-set by Railway) |
| `RAILWAY_PUBLIC_DOMAIN` | No | Auto-set | Auto-set by Railway |

## Updating Your Deployment

To update your deployed application:

1. **Push to GitHub**: Railway auto-deploys on push to main branch
2. **Manual deploy**: Use Railway dashboard or CLI to trigger a redeploy
3. **Rollback**: Use Railway dashboard to rollback to previous deployments

## Local Development

To run the app locally:

```bash
# Install all dependencies
npm run install-all

# Set up Python virtual environment (first time only)
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Mac/Linux

# Install Python dependencies
pip install -r requirements.txt
cd ..

# Run development servers
npm run dev
```

## Cost Considerations

Railway pricing:
- **Hobby Plan**: $5/month for basic usage
- **Pro Plan**: Pay-as-you-go based on usage
- Check [Railway pricing](https://railway.app/pricing) for current rates

## Support

For issues:
1. Check Railway documentation: https://docs.railway.app
2. Railway community Discord: https://discord.gg/railway
3. GitHub issues for this project

## Security Recommendations

1. **Change SESSION_SECRET**: Use a strong, random secret
2. **HTTPS Only**: Railway provides HTTPS by default
3. **Environment Variables**: Never commit secrets to Git
4. **User Authentication**: The app includes authentication - keep it enabled
5. **Rate Limiting**: Consider adding rate limiting for production
6. **Input Validation**: The app validates PDF uploads, but consider additional checks

## Next Steps

After successful deployment:

1. ✅ Test all functionality
2. ✅ Set up monitoring (Railway provides basic metrics)
3. ✅ Configure custom domain (optional)
4. ✅ Set up database persistence if needed
5. ✅ Configure backups for production data
6. ✅ Set up CI/CD for automated testing

## Useful Railway Commands

```bash
# Login to Railway CLI
railway login

# Link to your project
railway link

# View logs
railway logs

# Open your deployment in browser
railway open

# Run commands in Railway environment
railway run <command>
```

---

**Deployed successfully?** Your Sewer Inspection App should now be live on Railway! 🎉

