import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In Electron, assets are relative to the app path
  const distPath = process.env.APP_PATH
    ? path.join(process.env.APP_PATH, "dist", "renderer")
    : path.resolve(__dirname, "renderer");

  console.log(`Serving static assets from: ${distPath}`);

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
