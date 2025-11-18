# Environment Variables Setup

This guide explains all environment variables needed for the Sewer Inspection App.

## 🔧 Quick Setup

### Local Development (SQLite)
No environment variables needed! The app uses SQLite by default.

### Production (Railway with PostgreSQL)
Set these in Railway dashboard → Variables:

```bash
NODE_ENV=production
PORT=3001
SESSION_SECRET=<your-secure-random-string>
DATABASE_URL=<automatically-set-by-railway>
```

## 📋 Environment Variables Reference

### Required for Production

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | development | Set to `production` for Railway deployment |
| `PORT` | No | 3001 | Port for the backend server (Railway sets automatically) |
| `SESSION_SECRET` | Yes | - | Secure random string for session encryption |
| `DATABASE_URL` | Auto-set | - | PostgreSQL connection string (Railway sets this) |

### Optional

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FRONTEND_URL` | No | Auto-detected | Frontend URL for CORS (auto-set by Railway) |
| `RAILWAY_PUBLIC_DOMAIN` | No | Auto-set | Auto-set by Railway |
| `PYTHON_PATH` | No | Auto-detected | Path to Python executable |

## 🔐 Generating SESSION_SECRET

The `SESSION_SECRET` should be a secure, random string. Generate one using:

### Windows PowerShell
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Mac/Linux
```bash
openssl rand -base64 32
```

### Node.js
```javascript
require('crypto').randomBytes(32).toString('base64')
```

**Example output:**
```
a7K9mP2vX8qR4tY6wZ3nB5cD1eF7gH9j
```

## 🗄️ Database Configuration

### Automatic Detection

The app automatically detects which database to use:

- **`DATABASE_URL` is set** → Uses PostgreSQL
- **`DATABASE_URL` is not set** → Uses SQLite (development)

### PostgreSQL Connection String Format

Railway automatically provides `DATABASE_URL` in this format:

```
postgresql://username:password@host:port/database
```

You don't need to set this manually on Railway!

### SQLite (Local Development)

For local development, no configuration needed:
- Database file: `backend/sewer_inspection.db`
- Created automatically on first run
- Data persists between restarts

## 🚀 Railway Setup Steps

### 1. Add PostgreSQL Database

In your Railway project:
1. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway automatically sets `DATABASE_URL` environment variable
3. Your app will detect and use PostgreSQL automatically

### 2. Set Required Variables

In Railway dashboard → **Variables** tab:

```bash
NODE_ENV=production
SESSION_SECRET=<paste-your-generated-secret>
```

### 3. Optional Variables

These are automatically set by Railway, but you can override if needed:

```bash
# Override frontend URL (usually not needed)
FRONTEND_URL=https://your-custom-domain.com

# Override port (usually not needed)
# PORT=3001
```

## 🔄 Development vs Production

### Local Development

**Uses SQLite:**
```bash
# No DATABASE_URL set
# SQLite database: backend/sewer_inspection.db
# In-memory sessions
```

**To test with PostgreSQL locally:**
```bash
# Install PostgreSQL locally
# Create a database
# Set DATABASE_URL
DATABASE_URL=postgresql://username:password@localhost:5432/sewer_inspection
```

### Production (Railway)

**Uses PostgreSQL:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://... # Set by Railway
SESSION_SECRET=<your-secret>
```

## 📝 Local Development Setup

### Option 1: No Environment File (Default)
Just run the app - uses SQLite:
```bash
cd backend
npm start
```

### Option 2: Create Local .env File
Create `backend/.env`:
```bash
# Local development settings
PORT=3001
NODE_ENV=development
SESSION_SECRET=local-dev-secret-not-for-production

# Leave empty for SQLite, or set for PostgreSQL
DATABASE_URL=
```

**Note:** `.env` files are gitignored for security

## 🔍 Verifying Configuration

When you start the server, check the console output:

### Using SQLite (Development)
```
✓ Using SQLite database (development)
✓ SQLite tables initialized
✓ Using in-memory session store (development)
🚰 Sewer Inspection API running on http://localhost:3001
📊 Environment: development
💾 Database: SQLite
```

### Using PostgreSQL (Production)
```
✓ Using PostgreSQL database
✓ PostgreSQL tables initialized
✓ Using PostgreSQL session store
🚰 Sewer Inspection API running on http://localhost:3001
📊 Environment: production
💾 Database: PostgreSQL
```

## 🛠️ Troubleshooting

### "Error connecting to database"

**SQLite:**
- Check write permissions in `backend/` directory
- Delete `backend/sewer_inspection.db` and restart

**PostgreSQL:**
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running (on Railway)
- Check connection string format

### "Session store error"

**Development:**
- Should use in-memory store (no setup needed)
- Restart the server

**Production:**
- Verify PostgreSQL is running
- Check `session` table was created
- Review Railway logs for errors

### "Cannot find module 'pg'"

```bash
cd backend
npm install
```

## 📊 Database Tables

Both SQLite and PostgreSQL create the same tables:

### users
- id (PRIMARY KEY)
- username (UNIQUE)
- password_hash
- email
- created_at

### projects
- id (PRIMARY KEY)
- user_id (FOREIGN KEY → users)
- filename
- upload_date
- file_size

### parsed_data
- id (PRIMARY KEY)
- project_id (FOREIGN KEY → projects)
- section_profile (JSON/JSONB)
- inspection_reports (JSON/JSONB)
- metadata (JSON/JSONB)
- parsed_at

### session (PostgreSQL only)
- sid (PRIMARY KEY)
- sess (JSON)
- expire (TIMESTAMP)

## 🔐 Security Best Practices

1. **Never commit `.env` files** (already in `.gitignore`)
2. **Use strong SESSION_SECRET** (32+ random characters)
3. **Rotate SESSION_SECRET** periodically in production
4. **Use HTTPS in production** (Railway provides this)
5. **Don't share DATABASE_URL** (contains credentials)

## 🎯 Summary

**For Local Development:**
- No environment setup needed
- Uses SQLite automatically
- Great for testing and development

**For Railway Production:**
- Add PostgreSQL database in Railway
- Set `NODE_ENV=production`
- Set `SESSION_SECRET` to secure random string
- `DATABASE_URL` set automatically by Railway
- Persistent data storage with PostgreSQL

---

Need help? Check `RAILWAY_DEPLOYMENT.md` for complete deployment guide.

