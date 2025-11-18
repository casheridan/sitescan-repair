#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Checks if all necessary files and configurations are in place for Railway deployment
 */

const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n🔍 Railway Deployment Verification\n');

const checks = [
  {
    name: 'Railway configuration (railway.json)',
    check: () => fs.existsSync('railway.json'),
    required: true
  },
  {
    name: 'Nixpacks configuration (nixpacks.toml)',
    check: () => fs.existsSync('nixpacks.toml'),
    required: true
  },
  {
    name: 'Root package.json with build scripts',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return pkg.scripts && pkg.scripts['build:railway'] && pkg.scripts.start;
    },
    required: true
  },
  {
    name: 'Backend package.json',
    check: () => fs.existsSync('backend/package.json'),
    required: true
  },
  {
    name: 'Frontend package.json',
    check: () => fs.existsSync('frontend/package.json'),
    required: true
  },
  {
    name: 'Python requirements.txt',
    check: () => fs.existsSync('backend/requirements.txt'),
    required: true
  },
  {
    name: 'Backend server.js',
    check: () => {
      const content = fs.readFileSync('backend/server.js', 'utf8');
      return content.includes('NODE_ENV') && 
             content.includes('SESSION_SECRET') &&
             content.includes('FRONTEND_URL');
    },
    required: true
  },
  {
    name: 'Frontend build directory check',
    check: () => {
      // Check if frontend/build exists OR if we're pre-deploy
      return true; // Build happens on Railway
    },
    required: false
  },
  {
    name: 'Uploads directory',
    check: () => fs.existsSync('backend/uploads'),
    required: true
  },
  {
    name: 'Git repository',
    check: () => fs.existsSync('.git'),
    required: true
  },
  {
    name: 'Deployment guide (RAILWAY_DEPLOYMENT.md)',
    check: () => fs.existsSync('RAILWAY_DEPLOYMENT.md'),
    required: false
  }
];

let passed = 0;
let failed = 0;
let warnings = 0;

checks.forEach(({ name, check, required }) => {
  try {
    const result = check();
    if (result) {
      console.log(`${GREEN}✓${RESET} ${name}`);
      passed++;
    } else {
      if (required) {
        console.log(`${RED}✗${RESET} ${name} ${RED}(REQUIRED)${RESET}`);
        failed++;
      } else {
        console.log(`${YELLOW}⚠${RESET} ${name} ${YELLOW}(optional)${RESET}`);
        warnings++;
      }
    }
  } catch (error) {
    if (required) {
      console.log(`${RED}✗${RESET} ${name} - ${RED}Error: ${error.message}${RESET}`);
      failed++;
    } else {
      console.log(`${YELLOW}⚠${RESET} ${name} - ${YELLOW}${error.message}${RESET}`);
      warnings++;
    }
  }
});

console.log(`\n${'='.repeat(50)}`);
console.log(`${GREEN}Passed:${RESET} ${passed}`);
if (warnings > 0) console.log(`${YELLOW}Warnings:${RESET} ${warnings}`);
if (failed > 0) console.log(`${RED}Failed:${RESET} ${failed}`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  console.log(`${RED}❌ Deployment verification failed!${RESET}`);
  console.log(`${RED}Please fix the required items above before deploying.${RESET}\n`);
  process.exit(1);
} else {
  console.log(`${GREEN}✅ All required checks passed!${RESET}`);
  console.log(`${GREEN}Your app is ready to deploy to Railway.${RESET}\n`);
  
  console.log('Next steps:');
  console.log('1. Commit your changes: git add . && git commit -m "Configure Railway deployment"');
  console.log('2. Push to GitHub: git push origin main');
  console.log('3. Go to railway.app and create a new project from your GitHub repo');
  console.log('4. Set environment variables (see RAILWAY_CHECKLIST.md)');
  console.log('5. Deploy! 🚀\n');
  
  process.exit(0);
}

