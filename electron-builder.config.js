/**
 * electron-builder configuration for Curi-RSS AppImage build.
 *
 * Builds the Express + React app as an Electron desktop application
 * and packages it as a Linux AppImage.
 */

const config = {
  /**
   * App metadata
   */
  appId: "com.curirss.app",
  productName: "Curi-RSS",
  copyright: "Copyright © 2025",

  /**
   * Files to include in the Electron build.
   * - dist/**          : Built client (Vite output) + compiled server files
   * - electron/dist/** : Compiled Electron main process
   * - node_modules/    : Dependencies (pruned by electron-builder)
   */
  files: [
    "dist/**/*",
    "electron/dist/**/*",
    "node_modules/**/*",
    "package.json",
  ],

  /**
   * Native modules pre-built by prebuild script during electron:build
   */
  buildDependenciesFromSource: false,
  npmRebuild: false,

  /**
   * Files to exclude from the build
   */
  fileAssociations: [],



  /**
   * Extra resources (icons, etc.)
   */
  extraResources: [
    { from: "client/public", to: "public" },
  ],

  /**
   * AppImage-specific configuration
   */
  linux: {
    // Target AppImage (default on Linux)
    target: ["AppImage"],
    // MIME types the app can handle
    mimeTypes: [],
    // Desktop - Freedesktop category
    category: "Network",
    description: "Curi-RSS — RSS Reader and AI-powered article analysis",
    packageCategory: "curi-rss",
    // AppImage-specific options
    executableArgs: [],
    icon: "client/public/logo.png",
  },

  /**
   * Node.js version to bundle (electron-builder will use the system one)
   */
  nodeVersion: "current",

  /**
   * AppImage output naming
   */
  artifactName: "${productName}-${version}-${arch}.${ext}",

  /**
   * Directories
   */
  directories: {
    output: "release",
  },

  /**
   * Compression
   */
  compression: "normal",


};

export default config;