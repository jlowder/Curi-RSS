#!/bin/bash

# Build script for Curi-RSS Electron AppImage
set -e

echo "Building Curi-RSS Electron for Linux/x64 AppImage..."

# Build TypeScript
echo "Compiling TypeScript..."
npx tsc

# Build Vite renderer
echo "Building Vite renderer..."
npx vite build

# Build Electron AppImage
echo "Building Electron AppImage..."
npx electron-builder --linux --x64

echo "Build complete!"
echo "AppImage output is in dist-electron/"