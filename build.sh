#!/bin/bash

# Build script for Curi-RSS Electron AppImage
set -e

echo "Building Curi-RSS Electron for Linux/x64 AppImage..."

# Build main process (TypeScript)
echo "Compiling main process..."
npx tsc -p tsconfig.main.json

# Copy main.js to dist/main.js (as expected by electron-builder)
echo "Preparing main.js..."
cp dist/index.js dist/main.js

# Build preload process (TypeScript)
echo "Compiling preload..."
npx tsc -p tsconfig.preload.json

# Build backend server
echo "Compiling backend server..."
npx esbuild server/index.ts --platform=node --bundle --format=cjs --outfile=dist/server.js --external:better-sqlite3 --external:keytar --external:puppeteer --external:electron --external:vite --external:../vite.config --external:@vitejs/plugin-react

# Build Vite renderer
echo "Building Vite renderer..."
npx vite build

# Copy client/index.html to dist/client for proper bundling
echo "Copying client assets..."
mkdir -p dist/client
cp client/index.html dist/client/

# Copy assets to dist/assets for proper bundling
echo "Copying assets..."
mkdir -p dist/assets
cp -r assets/* dist/assets/ 2>/dev/null || true

# Build Electron AppImage
echo "Building Electron AppImage..."
npx electron-builder --linux --x64

echo "Build complete!"
echo "AppImage output is in dist-electron/"