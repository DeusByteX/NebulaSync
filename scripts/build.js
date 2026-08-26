const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  console.log('1. Installing client dependencies...');
  execSync('npm install', { cwd: path.join(__dirname, '../client'), stdio: 'inherit' });

  console.log('2. Building client production bundle...');
  execSync('npm run build', { cwd: path.join(__dirname, '../client'), stdio: 'inherit' });

  console.log('3. Moving distribution bundle to root directory cross-platform...');
  const src = path.join(__dirname, '../client/dist');
  const dest = path.join(__dirname, '../dist');

  // Clean root dest directory if it exists
  if (fs.existsSync(dest)) {
    console.log('Clearing old root dist directory...');
    fs.rmSync(dest, { recursive: true, force: true });
  }

  // Rename/move client/dist to root dist
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest);
    console.log('✓ Distribution bundle moved successfully.');
  } else {
    throw new Error('Build output directory "client/dist" was not found!');
  }

  console.log('✓ Cross-platform build completed successfully.');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
