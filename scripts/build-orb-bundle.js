// Build script for the shared Opus Orb bundle
const esbuild = require('esbuild');
const path = require('path');

async function buildOrbBundle() {
  try {
    console.log('Building Opus Orb shared bundle...');
    
    const buildResult = await esbuild.build({
      entryPoints: [path.resolve(__dirname, '../client/src/embed/opus-orb.tsx')],
      bundle: true,
      outfile: path.resolve(__dirname, '../public/embed/opus-orb.js'),
      format: 'iife',
      globalName: 'OpusOrb',
      platform: 'browser',
      target: 'es2020',
      minify: process.env.NODE_ENV === 'production',
      sourcemap: process.env.NODE_ENV !== 'production',
      external: [], // Bundle everything for standalone use
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      },
      jsx: 'automatic',
      jsxImportSource: 'react',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.js': 'js',
        '.jsx': 'jsx'
      },
      banner: {
        js: `
/* Opus Orb Shared Bundle - v1.0.0 */
/* Mount with: OpusOrb.mount(selector, config) */
`
      }
    });

    console.log('✅ Opus Orb bundle built successfully');
    
    if (buildResult.warnings.length > 0) {
      console.warn('Build warnings:');
      buildResult.warnings.forEach(warning => {
        console.warn(`  ${warning.text}`);
      });
    }

  } catch (error) {
    console.error('❌ Failed to build Opus Orb bundle:', error);
    process.exit(1);
  }
}

// Run the build
buildOrbBundle();

module.exports = { buildOrbBundle };