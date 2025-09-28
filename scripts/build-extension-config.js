#!/usr/bin/env node

/**
 * Build script to inject environment variables into extension files
 * Replaces CONFIG placeholders with actual environment values
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env if it exists
import dotenv from 'dotenv';
dotenv.config({ path: path.join(rootDir, '.env') });

/**
 * Resolve environment configuration
 */
function getEnvironmentConfig() {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  
  let APP_ORIGIN, API_ORIGIN;
  
  if (NODE_ENV === 'production') {
    // In production, these MUST be set explicitly
    APP_ORIGIN = process.env.APP_ORIGIN;
    API_ORIGIN = process.env.API_ORIGIN;
    
    if (!APP_ORIGIN || !API_ORIGIN) {
      throw new Error('APP_ORIGIN and API_ORIGIN environment variables are required for production extension builds');
    }
  } else {
    // Development fallbacks
    APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5000';
    API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000';
  }
  
  return { APP_ORIGIN, API_ORIGIN, NODE_ENV };
}

/**
 * Replace CONFIG placeholders in a file
 */
function replaceConfigInFile(filePath, config) {
  console.log(`[ExtensionBuild] Processing ${path.relative(rootDir, filePath)}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the CONFIG object with actual values
  const configReplacement = `const CONFIG = {
  APP_ORIGIN: '${config.APP_ORIGIN}',
  API_ORIGIN: '${config.API_ORIGIN}'
};`;

  // Find and replace the CONFIG block
  content = content.replace(
    /\/\/ Configuration[\s\S]*?const CONFIG = {[\s\S]*?};/,
    configReplacement
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[ExtensionBuild] Updated ${path.relative(rootDir, filePath)} with config:`, config);
}

/**
 * Main build function
 */
function buildExtensionConfig() {
  try {
    const config = getEnvironmentConfig();
    
    console.log('[ExtensionBuild] Building extension with configuration:', config);
    
    // Files to process
    const filesToProcess = [
      path.join(rootDir, 'extension', 'background.js'),
      path.join(rootDir, 'extension', 'content.js')
    ];
    
    // Process each file
    filesToProcess.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        replaceConfigInFile(filePath, config);
      } else {
        console.warn(`[ExtensionBuild] File not found: ${filePath}`);
      }
    });
    
    console.log('[ExtensionBuild] Extension configuration build completed successfully');
    
  } catch (error) {
    console.error('[ExtensionBuild] Build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildExtensionConfig();
}

export { buildExtensionConfig };