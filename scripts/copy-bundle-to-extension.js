// Copy the built Opus Orb bundle to the extension directory
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sourceFile = path.resolve(__dirname, '../public/embed/opus-orb.js');
const targetFile = path.resolve(__dirname, '../extension/opus-orb.js');

try {
  console.log('Copying Opus Orb bundle to extension...');
  
  // Check if source file exists
  if (!fs.existsSync(sourceFile)) {
    console.error('❌ Source bundle not found. Run build-orb-bundle.js first.');
    process.exit(1);
  }
  
  // Copy the file
  fs.copyFileSync(sourceFile, targetFile);
  
  console.log('✅ Opus Orb bundle copied to extension directory');
  console.log('   From:', sourceFile);
  console.log('   To:  ', targetFile);
  
} catch (error) {
  console.error('❌ Failed to copy bundle:', error);
  process.exit(1);
}