const bcrypt = require('bcryptjs');
const path = require('path');

// Determine which database to use based on environment
const DATABASE_URL = process.env.DATABASE_URL;
const USE_POSTGRES = !!DATABASE_URL;

let db;
let dbType;

if (USE_POSTGRES) {
  // PostgreSQL setup
  const { Pool } = require('pg');
  dbType = 'PostgreSQL';
  
  db = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false // Railway requires this
    } : false
  });

  console.log('✓ Using PostgreSQL database');
  initializePostgresTables();
} else {
  // SQLite setup (for local development)
  const sqlite3 = require('sqlite3').verbose();
  dbType = 'SQLite';
  const DB_PATH = path.join(__dirname, 'sewer_inspection.db');
  
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err);
    } else {
      console.log('✓ Using SQLite database (development)');
      initializeSQLiteTables();
    }
  });
}

// ============================================
// PostgreSQL Table Initialization
// ============================================
async function initializePostgresTables() {
  try {
    // Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table
    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(500) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        file_size BIGINT,
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Parsed data table
    await db.query(`
      CREATE TABLE IF NOT EXISTS parsed_data (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
        section_profile JSONB,
        inspection_reports JSONB,
        metadata JSONB,
        parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Session table for connect-pg-simple
    await db.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire)
    `);

    console.log('✓ PostgreSQL tables initialized');
    await createDefaultUser();
  } catch (error) {
    console.error('Error initializing PostgreSQL tables:', error);
  }
}

// ============================================
// SQLite Table Initialization
// ============================================
function initializeSQLiteTables() {
  db.serialize(() => {
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

    console.log('✓ SQLite tables initialized');
    createDefaultUser();
  });
}

// ============================================
// Create Default User
// ============================================
async function createDefaultUser() {
  const defaultPassword = 'admin123';
  
  try {
    let userCount;
    
    if (USE_POSTGRES) {
      const result = await db.query('SELECT COUNT(*) as count FROM users');
      userCount = parseInt(result.rows[0].count);
    } else {
      userCount = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
    }
    
    if (userCount === 0) {
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      if (USE_POSTGRES) {
        await db.query(
          'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3)',
          ['admin', passwordHash, 'admin@example.com']
        );
      } else {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
            ['admin', passwordHash, 'admin@example.com'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      console.log('✓ Default admin user created (username: admin, password: admin123)');
      console.log('⚠️  Please change the default password after first login!');
    }
  } catch (error) {
    console.error('Error creating default user:', error);
  }
}

// ============================================
// User Operations
// ============================================
const userOperations = {
  register: async (username, password, email) => {
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      
      if (USE_POSTGRES) {
        const result = await db.query(
          'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email',
          [username, passwordHash, email]
        );
        return result.rows[0];
      } else {
        return new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
            [username, passwordHash, email],
            function(err) {
              if (err) {
                if (err.message.includes('UNIQUE constraint')) {
                  reject(new Error('Username already exists'));
                } else {
                  reject(err);
                }
              } else {
                resolve({ id: this.lastID, username, email });
              }
            }
          );
        });
      }
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique violation
        throw new Error('Username already exists');
      }
      throw error;
    }
  },

  login: async (username, password) => {
    try {
      let user;
      
      if (USE_POSTGRES) {
        const result = await db.query(
          'SELECT id, username, password_hash, email FROM users WHERE username = $1',
          [username]
        );
        user = result.rows[0];
      } else {
        user = await new Promise((resolve, reject) => {
          db.get(
            'SELECT id, username, password_hash, email FROM users WHERE username = ?',
            [username],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
      }
      
      if (!user) {
        throw new Error('Invalid username or password');
      }
      
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        throw new Error('Invalid username or password');
      }
      
      return { id: user.id, username: user.username, email: user.email };
    } catch (error) {
      throw error;
    }
  },

  getById: async (userId) => {
    if (USE_POSTGRES) {
      const result = await db.query(
        'SELECT id, username, email, created_at FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0];
    } else {
      return new Promise((resolve, reject) => {
        db.get(
          'SELECT id, username, email, created_at FROM users WHERE id = ?',
          [userId],
          (err, user) => {
            if (err) reject(err);
            else resolve(user);
          }
        );
      });
    }
  }
};

// ============================================
// Project Operations
// ============================================
const projectOperations = {
  create: async (userId, filename, fileSize) => {
    if (USE_POSTGRES) {
      const result = await db.query(
        'INSERT INTO projects (user_id, filename, file_size) VALUES ($1, $2, $3) RETURNING id, user_id, filename',
        [userId, filename, fileSize]
      );
      return { id: result.rows[0].id, userId, filename };
    } else {
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO projects (user_id, filename, file_size) VALUES (?, ?, ?)',
          [userId, filename, fileSize],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, userId, filename });
          }
        );
      });
    }
  },

  getAllByUser: async (userId) => {
    if (USE_POSTGRES) {
      const result = await db.query(
        `SELECT p.*, 
                CASE WHEN pd.id IS NOT NULL THEN true ELSE false END as has_data
         FROM projects p
         LEFT JOIN parsed_data pd ON p.id = pd.project_id
         WHERE p.user_id = $1
         ORDER BY p.upload_date DESC`,
        [userId]
      );
      return result.rows;
    } else {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT p.*, 
                  CASE WHEN pd.id IS NOT NULL THEN 1 ELSE 0 END as has_data
           FROM projects p
           LEFT JOIN parsed_data pd ON p.id = pd.project_id
           WHERE p.user_id = ?
           ORDER BY p.upload_date DESC`,
          [userId],
          (err, projects) => {
            if (err) reject(err);
            else resolve(projects);
          }
        );
      });
    }
  },

  getById: async (projectId, userId) => {
    if (USE_POSTGRES) {
      const result = await db.query(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );
      return result.rows[0];
    } else {
      return new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM projects WHERE id = ? AND user_id = ?',
          [projectId, userId],
          (err, project) => {
            if (err) reject(err);
            else resolve(project);
          }
        );
      });
    }
  },

  delete: async (projectId, userId) => {
    if (USE_POSTGRES) {
      const result = await db.query(
        'DELETE FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );
      return { deleted: result.rowCount };
    } else {
      return new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM projects WHERE id = ? AND user_id = ?',
          [projectId, userId],
          function(err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes });
          }
        );
      });
    }
  }
};

// ============================================
// Parsed Data Operations
// ============================================
const dataOperations = {
  save: async (projectId, data) => {
    const { sectionProfile, inspectionReports, metadata } = data;
    
    if (USE_POSTGRES) {
      // PostgreSQL uses JSONB natively
      const result = await db.query(
        `INSERT INTO parsed_data 
         (project_id, section_profile, inspection_reports, metadata) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id) 
         DO UPDATE SET 
           section_profile = $2,
           inspection_reports = $3,
           metadata = $4,
           parsed_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          projectId,
          JSON.stringify(sectionProfile),
          JSON.stringify(inspectionReports),
          JSON.stringify(metadata)
        ]
      );
      return { id: result.rows[0].id };
    } else {
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO parsed_data 
           (project_id, section_profile, inspection_reports, metadata) 
           VALUES (?, ?, ?, ?)`,
          [
            projectId,
            JSON.stringify(sectionProfile),
            JSON.stringify(inspectionReports),
            JSON.stringify(metadata)
          ],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });
    }
  },

  getByProjectId: async (projectId) => {
    if (USE_POSTGRES) {
      const result = await db.query(
        'SELECT * FROM parsed_data WHERE project_id = $1',
        [projectId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        projectId: row.project_id,
        sectionProfile: row.section_profile, // Already parsed from JSONB
        inspectionReports: row.inspection_reports,
        metadata: row.metadata,
        parsedAt: row.parsed_at
      };
    } else {
      return new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM parsed_data WHERE project_id = ?',
          [projectId],
          (err, row) => {
            if (err) {
              reject(err);
            } else if (!row) {
              resolve(null);
            } else {
              resolve({
                id: row.id,
                projectId: row.project_id,
                sectionProfile: JSON.parse(row.section_profile),
                inspectionReports: JSON.parse(row.inspection_reports),
                metadata: JSON.parse(row.metadata),
                parsedAt: row.parsed_at
              });
            }
          }
        );
      });
    }
  },

  delete: async (projectId) => {
    if (USE_POSTGRES) {
      const result = await db.query(
        'DELETE FROM parsed_data WHERE project_id = $1',
        [projectId]
      );
      return { deleted: result.rowCount };
    } else {
      return new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM parsed_data WHERE project_id = ?',
          [projectId],
          function(err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes });
          }
        );
      });
    }
  }
};

// ============================================
// Graceful Shutdown
// ============================================
async function closeDatabase() {
  if (USE_POSTGRES) {
    await db.end();
    console.log('✓ PostgreSQL connection closed');
  } else {
    return new Promise((resolve) => {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('✓ SQLite database closed');
        resolve();
      });
    });
  }
}

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

module.exports = {
  db,
  dbType,
  userOperations,
  projectOperations,
  dataOperations,
  closeDatabase
};
