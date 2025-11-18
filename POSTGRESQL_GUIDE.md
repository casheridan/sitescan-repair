# PostgreSQL Setup Guide

Your Sewer Inspection App now supports both SQLite (development) and PostgreSQL (production) with automatic detection!

## 🎯 Quick Summary

- **Local Development**: Uses SQLite automatically (no setup needed)
- **Production (Railway)**: Uses PostgreSQL when `DATABASE_URL` is set
- **Automatic Detection**: No code changes needed - works out of the box!

## 🚀 Railway PostgreSQL Setup (Recommended for Production)

### Step 1: Add PostgreSQL to Railway

1. Open your Railway project dashboard
2. Click **"New"** button
3. Select **"Database"** → **"Add PostgreSQL"**
4. Wait for provisioning (usually 30-60 seconds)

### Step 2: Verify Configuration

Railway automatically sets the `DATABASE_URL` environment variable:
- Format: `postgresql://username:password@host:port/database`
- Your app detects this and uses PostgreSQL automatically
- No manual configuration needed!

### Step 3: Deploy

Push your code or trigger a redeploy:
```bash
git push origin main
```

Railway will:
1. ✅ Connect to PostgreSQL
2. ✅ Create database tables automatically
3. ✅ Create default admin user
4. ✅ Start your application

### Step 4: Verify

Check the Railway logs for:
```
✓ Using PostgreSQL database
✓ PostgreSQL tables initialized
✓ Using PostgreSQL session store
💾 Database: PostgreSQL
```

## 💾 Database Features

### Automatic Table Creation

On first run, the app creates these tables:

#### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### projects
```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_size BIGINT
);
```

#### parsed_data
```sql
CREATE TABLE parsed_data (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  section_profile JSONB,          -- Native JSON support!
  inspection_reports JSONB,
  metadata JSONB,
  parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### session
```sql
CREATE TABLE session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IDX_session_expire ON session (expire);
```

### PostgreSQL Advantages

✅ **Persistent Storage** - Data survives deployments  
✅ **Native JSON Support** - Faster queries with JSONB  
✅ **Better Performance** - Optimized for production  
✅ **Concurrent Users** - Handle multiple users simultaneously  
✅ **Persistent Sessions** - Sessions survive server restarts  
✅ **Data Integrity** - ACID compliant transactions  
✅ **Scalability** - Easy to upgrade storage/performance

## 🏠 Local Development

### Option 1: SQLite (Default - Recommended)

Just run the app - no setup needed!

```bash
cd backend
npm start
```

SQLite is perfect for:
- ✅ Local development
- ✅ Quick testing
- ✅ No database setup
- ✅ Portable (single file)

### Option 2: Local PostgreSQL

To test with PostgreSQL locally:

#### Windows (using Chocolatey)
```powershell
choco install postgresql
```

#### Mac (using Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### Create Database
```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE sewer_inspection;

# Create user
CREATE USER sewerapuser WITH PASSWORD 'your_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE sewer_inspection TO sewerapp;

# Exit
\q
```

#### Configure Connection
Create `backend/.env`:
```bash
DATABASE_URL=postgresql://sewerapp:your_password@localhost:5432/sewer_inspection
```

#### Initialize Database
```bash
cd backend
npm run init-db
```

## 🔧 Database Management Scripts

### Initialize Database
```bash
cd backend
npm run init-db
```

Creates all tables and default admin user.

### Reset Database
```bash
npm run init-db:reset
```

**⚠️ WARNING:** Drops all tables and recreates them. All data will be lost!

### Create Test Data
```bash
npm run init-db:test
```

Creates sample projects and data for testing.

## 🔍 Verifying Your Database

### Check Which Database is Running

When you start the server, look for:

**SQLite:**
```
✓ Using SQLite database (development)
✓ SQLite tables initialized
✓ Using in-memory session store (development)
💾 Database: SQLite
```

**PostgreSQL:**
```
✓ Using PostgreSQL database
✓ PostgreSQL tables initialized
✓ Using PostgreSQL session store
💾 Database: PostgreSQL
```

### Test Database Connection

```bash
# Railway PostgreSQL
railway run node -e "require('./backend/database.js')"

# Local PostgreSQL
DATABASE_URL=postgresql://... node -e "require('./backend/database.js')"
```

## 📊 Accessing Your Data

### Railway PostgreSQL

#### Via Railway Dashboard
1. Go to your PostgreSQL service in Railway
2. Click "Data" tab
3. Run SQL queries in the web interface

#### Via psql
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Connect to database
railway connect postgres
```

### Local SQLite

#### Via Command Line
```bash
cd backend
sqlite3 sewer_inspection.db

# List tables
.tables

# View users
SELECT * FROM users;

# View projects
SELECT * FROM projects;

# Exit
.quit
```

#### Via SQLite Browser (GUI)
Download [DB Browser for SQLite](https://sqlitebrowser.org/)
Open `backend/sewer_inspection.db`

## 🔄 Migrating Between Databases

### SQLite to PostgreSQL

1. **Export data from SQLite:**
```bash
cd backend
sqlite3 sewer_inspection.db .dump > backup.sql
```

2. **Convert SQL syntax** (SQLite → PostgreSQL)
- Change `AUTOINCREMENT` to `SERIAL`
- Update data types if needed

3. **Import to PostgreSQL:**
```bash
psql $DATABASE_URL < backup.sql
```

### PostgreSQL to SQLite (Not Recommended)

PostgreSQL has features SQLite doesn't support. Migration could lose data.

## 🛠️ Troubleshooting

### "Error connecting to PostgreSQL"

**Check DATABASE_URL:**
```bash
# Railway
railway variables

# Local
echo $DATABASE_URL
```

**Verify Format:**
```
postgresql://username:password@host:port/database
```

**Test Connection:**
```bash
psql $DATABASE_URL
```

### "Table does not exist"

Run initialization:
```bash
cd backend
npm run init-db
```

### "Permission denied"

PostgreSQL user needs proper permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE sewer_inspection TO your_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO your_user;
```

### "Connection refused"

**Check PostgreSQL is running:**
```bash
# Linux
sudo systemctl status postgresql

# Mac
brew services list

# Railway
Check service status in dashboard
```

### "Too many connections"

PostgreSQL has connection limits. The app uses connection pooling to manage this.

**Check active connections:**
```sql
SELECT count(*) FROM pg_stat_activity;
```

## 📈 Performance Tips

### Connection Pooling

The app uses `pg.Pool` for efficient connection management:
- Reuses connections
- Prevents connection exhaustion
- Automatic connection recycling

### JSONB Indexing

For better query performance on large datasets:

```sql
-- Index section profile data
CREATE INDEX idx_section_profile ON parsed_data USING gin(section_profile);

-- Index inspection reports
CREATE INDEX idx_inspection_reports ON parsed_data USING gin(inspection_reports);
```

### Query Optimization

```sql
-- Find projects for a user (already optimized)
SELECT p.*, 
       CASE WHEN pd.id IS NOT NULL THEN true ELSE false END as has_data
FROM projects p
LEFT JOIN parsed_data pd ON p.id = pd.project_id
WHERE p.user_id = $1
ORDER BY p.upload_date DESC;
```

## 🔐 Security Best Practices

1. **Never commit DATABASE_URL** (already in `.gitignore`)
2. **Use strong passwords** for PostgreSQL users
3. **Limit database access** to app only
4. **Regular backups** (Railway provides automatic backups)
5. **Monitor queries** for SQL injection attempts
6. **Use parameterized queries** (already implemented)

## 📊 Monitoring

### Railway Dashboard

- View database size
- Monitor query performance
- Check connection count
- Review error logs

### Query Logging

Enable in PostgreSQL for debugging:
```sql
ALTER DATABASE sewer_inspection SET log_statement = 'all';
```

## 🎓 Learn More

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Railway PostgreSQL Guide](https://docs.railway.app/databases/postgresql)
- [pg (node-postgres) Documentation](https://node-postgres.com/)
- [connect-pg-simple Documentation](https://github.com/voxpelli/node-connect-pg-simple)

## ✅ Summary

Your app is now **production-ready** with PostgreSQL!

**What you get:**
- ✅ Persistent data storage
- ✅ Automatic database detection
- ✅ Production-grade performance
- ✅ Persistent user sessions
- ✅ ACID compliant transactions
- ✅ Easy local development (SQLite)
- ✅ Seamless Railway deployment

**No code changes needed** - the app automatically detects and uses the right database!

---

Questions? Check `ENV_SETUP.md` for environment variable details or `RAILWAY_DEPLOYMENT.md` for deployment help.

