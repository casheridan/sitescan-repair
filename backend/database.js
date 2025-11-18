const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'sewer_inspection.db');

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✓ Connected to SQLite database');
    initializeTables();
  }
});

// Create tables
function initializeTables() {
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

    // Projects/Documents table
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

    // Parsed data table (stores JSON)
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

    // Create default admin user if none exists
    createDefaultUser();
  });
}

// Create default user
function createDefaultUser() {
  const defaultPassword = 'admin123';
  
  db.get('SELECT COUNT(*) as count FROM users', [], async (err, row) => {
    if (err) {
      console.error('Error checking users:', err);
      return;
    }
    
    if (row.count === 0) {
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      db.run(
        'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
        ['admin', passwordHash, 'admin@hays.com'],
        (err) => {
          if (err) {
            console.error('Error creating default user:', err);
          } else {
            console.log('✓ Default admin user created (username: admin, password: admin123)');
          }
        }
      );
    }
  });
}

// User operations
const userOperations = {
  // Register new user
  register: (username, password, email) => {
    return new Promise(async (resolve, reject) => {
      try {
        const passwordHash = await bcrypt.hash(password, 10);
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
      } catch (error) {
        reject(error);
      }
    });
  },

  // Login user
  login: (username, password) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, password_hash, email FROM users WHERE username = ?',
        [username],
        async (err, user) => {
          if (err) {
            reject(err);
          } else if (!user) {
            reject(new Error('Invalid username or password'));
          } else {
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (isValid) {
              resolve({ id: user.id, username: user.username, email: user.email });
            } else {
              reject(new Error('Invalid username or password'));
            }
          }
        }
      );
    });
  },

  // Get user by ID
  getById: (userId) => {
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
};

// Project operations
const projectOperations = {
  // Create new project
  create: (userId, filename, fileSize) => {
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
  },

  // Get all projects for a user
  getAllByUser: (userId) => {
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
  },

  // Get project by ID
  getById: (projectId, userId) => {
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
  },

  // Delete project
  delete: (projectId, userId) => {
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
};

// Parsed data operations
const dataOperations = {
  // Save parsed data
  save: (projectId, data) => {
    return new Promise((resolve, reject) => {
      const { sectionProfile, inspectionReports, metadata } = data;
      
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
  },

  // Get parsed data by project ID
  getByProjectId: (projectId) => {
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
  },

  // Delete parsed data
  delete: (projectId) => {
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
};

module.exports = {
  db,
  userOperations,
  projectOperations,
  dataOperations
};

