#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const frontendDir = path.join(rootDir, 'frontend');
const distDir = path.join(frontendDir, 'dist');
const backendDir = path.join(rootDir, 'backend');
const deployDir = path.join(rootDir, 'deploy');

const skipBuild = process.argv.includes('--skip-build');

console.log('🚀 ============================================');
console.log('📦  MAKING PRODUCTION DEPLOY FOLDER');
console.log('🚀 ============================================\n');

// 1. Build Frontend
if (!skipBuild) {
  console.log('🔨 Step 1: Building frontend (Vite & TypeScript)...');
  try {
    execSync('npm run build', {
      cwd: frontendDir,
      stdio: 'inherit',
    });
    console.log('✅ Frontend build completed successfully.\n');
  } catch (err) {
    console.error('❌ Frontend build failed:', err.message);
    process.exit(1);
  }
} else {
  console.log('⏩ Step 1: Skipping frontend build (--skip-build flag passed).\n');
}

if (!fs.existsSync(distDir)) {
  console.error(`❌ Dist directory not found at: ${distDir}`);
  process.exit(1);
}

// 2. Ensure deploy folder exists
if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

// 3. Remove obsolete legacy directories (e.g. deploy/public)
const obsoleteDirs = [path.join(deployDir, 'public')];
for (const dir of obsoleteDirs) {
  if (fs.existsSync(dir)) {
    console.log(`🧹 Removing obsolete legacy directory: ${path.relative(rootDir, dir)}...`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 4. Clean deploy/assets so only currently active chunks are kept
const deployAssetsDir = path.join(deployDir, 'assets');
if (fs.existsSync(deployAssetsDir)) {
  fs.rmSync(deployAssetsDir, { recursive: true, force: true });
}

// 5. Copy frontend dist files into deploy/
console.log('📂 Step 2: Copying frontend dist files to deploy/...');
fs.cpSync(distDir, deployDir, { recursive: true });
console.log('✅ Frontend assets and HTML copied to deploy/.\n');

// 6. Ensure .htaccess exists
const htaccessPath = path.join(deployDir, '.htaccess');
if (!fs.existsSync(htaccessPath)) {
  console.log('📝 Creating production .htaccess in deploy/...');
  const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Ensure HTTP Authorization header is passed to PHP FastCGI/FPM
  RewriteCond %{HTTP:Authorization} .
  RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

  # 1. API and Backend routes redirected to backend/index.php
  RewriteRule ^api/(.*)$ backend/index.php [QSA,L]
  RewriteRule ^backend/(.*)$ backend/index.php [QSA,L]

  # 2. Existing files and directories are served directly
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # 3. Missing uploaded files must return HTTP 404, never fallback to React SPA index.html
  RewriteRule ^uploads/ - [R=404,L]

  # 4. All other application requests fallback to React SPA index.html
  RewriteRule ^ index.html [L]
</IfModule>

# MIME type mapping
<IfModule mod_mime.c>
  AddType application/pdf .pdf
</IfModule>

# Security: Deny direct access to SQL and database migration files
<FilesMatch "\\.(sql|log|md)$">
  Order allow,deny
  Deny from all
</FilesMatch>

# Enable GZIP compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
`;
  fs.writeFileSync(htaccessPath, htaccessContent, 'utf-8');
}

// 7. Synchronize backend into deploy/backend
console.log('📂 Step 3: Synchronizing backend files to deploy/backend/...');
const deployBackendDir = path.join(deployDir, 'backend');
if (!fs.existsSync(deployBackendDir)) {
  fs.mkdirSync(deployBackendDir, { recursive: true });
}

// Backend items to copy
const backendItems = [
  'index.php',
  'config',
  'controllers',
  'core',
  'data',
  'database',
];

for (const item of backendItems) {
  const src = path.join(backendDir, item);
  const dest = path.join(deployBackendDir, item);
  if (fs.existsSync(src)) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}
console.log('✅ Backend controllers, core, config, and router synced.\n');

// 8. Summary statistics
function getDirStats(dir) {
  let count = 0;
  let totalBytes = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = getDirStats(fullPath);
      count += sub.count;
      totalBytes += sub.totalBytes;
    } else {
      count++;
      totalBytes += fs.statSync(fullPath).size;
    }
  }
  return { count, totalBytes };
}

const stats = getDirStats(deployDir);
const totalMB = (stats.totalBytes / (1024 * 1024)).toFixed(2);

console.log('🎉 ============================================');
console.log('✨  DEPLOY FOLDER CREATED & READY');
console.log('🎉 ============================================');
console.log(`📁 Location:   ${deployDir}`);
console.log(`📄 Total files: ${stats.count}`);
console.log(`💾 Total size:  ${totalMB} MB`);
console.log(`
Deploy structure:
  deploy/
    ├── .htaccess           (SPA routing & API rewrite)
    ├── index.html          (React SPA entrypoint)
    ├── manifest.json       (PWA manifest)
    ├── sw.js               (Service Worker)
    ├── assets/             (Optimized frontend JS & CSS bundles)
    └── backend/            (PHP API endpoints, controllers & core)
`);
console.log('👉 To deploy to live server: npm run deploy');
