#!/usr/bin/env node

/**
 * Database Initialization Script
 * 
 * This script initializes the database (SQLite or PostgreSQL)
 * and optionally creates test data.
 * 
 * Usage:
 *   node init-db.js              - Initialize database
 *   node init-db.js --reset      - Drop and recreate all tables
 *   node init-db.js --test-data  - Create test data
 */

const bcrypt = require('bcryptjs');

// Get database configuration
const DATABASE_URL = process.env.DATABASE_URL;
const USE_POSTGRES = !!DATABASE_URL;

const args = process.argv.slice(2);
const shouldReset = args.includes('--reset');
const shouldCreateTestData = args.includes('--test-data');

console.log('\n🗄️  Database Initialization\n');
console.log(`Database Type: ${USE_POSTGRES ? 'PostgreSQL' : 'SQLite'}`);
console.log(`Reset Tables: ${shouldReset ? 'Yes' : 'No'}`);
console.log(`Create Test Data: ${shouldCreateTestData ? 'Yes' : 'No'}\n`);

if (USE_POSTGRES) {
  initializePostgreSQL();
} else {
  initializeSQLite();
}

// ============================================
// PostgreSQL Initialization
// ============================================
async function initializePostgreSQL() {
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    
    if (shouldReset) {
      console.log('⚠️  Dropping existing tables...');
      await pool.query('DROP TABLE IF EXISTS parsed_data CASCADE');
      await pool.query('DROP TABLE IF EXISTS projects CASCADE');
      await pool.query('DROP TABLE IF EXISTS users CASCADE');
      await pool.query('DROP TABLE IF EXISTS session CASCADE');
      console.log('✓ Tables dropped');
    }

    console.log('📊 Creating tables...');
    
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Users table created');

    // Projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(500) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        file_size BIGINT
      )
    `);
    console.log('✓ Projects table created');

    // Parsed data table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parsed_data (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
        section_profile JSONB,
        inspection_reports JSONB,
        metadata JSONB,
        parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Parsed data table created');

    // Session table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire)
    `);
    console.log('✓ Session table created');

    // Create default admin user
    await createDefaultUser(pool, true);

    if (shouldCreateTestData) {
      await createTestData(pool, true);
    }

    await pool.end();
    console.log('\n✅ PostgreSQL database initialized successfully!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error initializing PostgreSQL:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// ============================================
// SQLite Initialization
// ============================================
function initializeSQLite() {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const fs = require('fs');
  
  const DB_PATH = path.join(__dirname, 'sewer_inspection.db');
  
  if (shouldReset && fs.existsSync(DB_PATH)) {
    console.log('⚠️  Deleting existing database file...');
    fs.unlinkSync(DB_PATH);
    console.log('✓ Database file deleted');
  }

  const db = new sqlite3.Database(DB_PATH, async (err) => {
    if (err) {
      console.error('❌ Error opening database:', err);
      process.exit(1);
    }
    
    console.log('🔌 Connected to SQLite database');
    
    db.serialize(async () => {
      console.log('📊 Creating tables...');
      
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Users table created');

      // Projects table
      db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          file_size INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      console.log('✓ Projects table created');

      // Parsed data table
      db.run(`
        CREATE TABLE IF NOT EXISTS parsed_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL UNIQUE,
          section_profile TEXT,
          inspection_reports TEXT,
          metadata TEXT,
          parsed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);
      console.log('✓ Parsed data table created');

      // Create default user
      await createDefaultUser(db, false);

      if (shouldCreateTestData) {
        await createTestData(db, false);
      }

      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err);
          process.exit(1);
        }
        console.log('\n✅ SQLite database initialized successfully!\n');
        process.exit(0);
      });
    });
  });
}

// ============================================
// Create Default Admin User
// ============================================
async function createDefaultUser(db, isPostgres) {
  const defaultUsername = 'admin';
  const defaultPassword = 'admin123';
  const defaultEmail = 'admin@example.com';

  console.log('👤 Creating default admin user...');

  try {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    if (isPostgres) {
      // Check if user exists
      const result = await db.query('SELECT COUNT(*) as count FROM users');
      const count = parseInt(result.rows[0].count);

      if (count === 0 || shouldReset) {
        await db.query(
          'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
          [defaultUsername, passwordHash, defaultEmail]
        );
        console.log('✓ Default admin user created');
        console.log(`   Username: ${defaultUsername}`);
        console.log(`   Password: ${defaultPassword}`);
        console.log('   ⚠️  Change the password after first login!');
      } else {
        console.log('✓ Users already exist, skipping default user creation');
      }
    } else {
      // SQLite
      db.get('SELECT COUNT(*) as count FROM users', [], async (err, row) => {
        if (err) {
          console.error('❌ Error checking users:', err);
          return;
        }

        if (row.count === 0 || shouldReset) {
          db.run(
            'INSERT OR IGNORE INTO users (username, password_hash, email) VALUES (?, ?, ?)',
            [defaultUsername, passwordHash, defaultEmail],
            (err) => {
              if (err) {
                console.error('❌ Error creating default user:', err);
              } else {
                console.log('✓ Default admin user created');
                console.log(`   Username: ${defaultUsername}`);
                console.log(`   Password: ${defaultPassword}`);
                console.log('   ⚠️  Change the password after first login!');
              }
            }
          );
        } else {
          console.log('✓ Users already exist, skipping default user creation');
        }
      });
    }
  } catch (error) {
    console.error('❌ Error creating default user:', error);
  }
}

// ============================================
// Create Test Data
// ============================================
async function createTestData(db, isPostgres) {
  console.log('🧪 Creating test data...');

  try {
    if (isPostgres) {
      // Get admin user ID
      const userResult = await db.query('SELECT id FROM users WHERE username = $1', ['admin']);
      if (userResult.rows.length === 0) {
        console.log('⚠️  Admin user not found, cannot create test data');
        return;
      }
      const userId = userResult.rows[0].id;

      // Create test project
      const projectResult = await db.query(
        'INSERT INTO projects (user_id, filename, file_size) VALUES ($1, $2, $3) RETURNING id',
        [userId, 'test-inspection-report.pdf', 1024000]
      );
      const projectId = projectResult.rows[0].id;

      // Create test parsed data
      const testData = {
        sectionProfile: [
          { psr: 1001, upstreamMH: 'MH-001', downstreamMH: 'MH-002', material: 'PVC', totalLength: 100 },
          { psr: 1002, upstreamMH: 'MH-002', downstreamMH: 'MH-003', material: 'Clay', totalLength: 150 }
        ],
        inspectionReports: [
          { psr: 1001, date: '2024-01-15', opri: 2.5, surveyedBy: 'John Doe' },
          { psr: 1002, date: '2024-01-16', opri: 3.2, surveyedBy: 'Jane Smith' }
        ],
        metadata: {
          projectName: 'Test Project',
          uploadDate: new Date().toISOString()
        }
      };

      await db.query(
        'INSERT INTO parsed_data (project_id, section_profile, inspection_reports, metadata) VALUES ($1, $2, $3, $4)',
        [projectId, JSON.stringify(testData.sectionProfile), JSON.stringify(testData.inspectionReports), JSON.stringify(testData.metadata)]
      );

      console.log('✓ Test data created');
      console.log(`   Project ID: ${projectId}`);
      console.log(`   PSR entries: ${testData.sectionProfile.length}`);
    } else {
      // SQLite test data creation
      db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, user) => {
        if (err || !user) {
          console.log('⚠️  Admin user not found, cannot create test data');
          return;
        }

        db.run(
          'INSERT INTO projects (user_id, filename, file_size) VALUES (?, ?, ?)',
          [user.id, 'test-inspection-report.pdf', 1024000],
          function(err) {
            if (err) {
              console.error('❌ Error creating test project:', err);
              return;
            }

            const projectId = this.lastID;
            const testData = {
              sectionProfile: [
                { psr: 1001, upstreamMH: 'MH-001', downstreamMH: 'MH-002', material: 'PVC', totalLength: 100 },
                { psr: 1002, upstreamMH: 'MH-002', downstreamMH: 'MH-003', material: 'Clay', totalLength: 150 }
              ],
              inspectionReports: [
                { psr: 1001, date: '2024-01-15', opri: 2.5, surveyedBy: 'John Doe' },
                { psr: 1002, date: '2024-01-16', opri: 3.2, surveyedBy: 'Jane Smith' }
              ],
              metadata: {
                projectName: 'Test Project',
                uploadDate: new Date().toISOString()
              }
            };

            db.run(
              'INSERT INTO parsed_data (project_id, section_profile, inspection_reports, metadata) VALUES (?, ?, ?, ?)',
              [projectId, JSON.stringify(testData.sectionProfile), JSON.stringify(testData.inspectionReports), JSON.stringify(testData.metadata)],
              (err) => {
                if (err) {
                  console.error('❌ Error creating test data:', err);
                } else {
                  console.log('✓ Test data created');
                  console.log(`   Project ID: ${projectId}`);
                  console.log(`   PSR entries: ${testData.sectionProfile.length}`);
                }
              }
            );
          }
        );
      });
    }
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
}

