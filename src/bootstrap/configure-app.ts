import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import express from "express";
import helmet from "helmet";

// Shared by the local server (main.ts) and the Vercel handler (serverless.ts).
// Body parsing is set up here (the app is created with bodyParser:false).
// Large files never pass through the API (they go straight to storage
// through pre-signed URLs). Photos the browser already shrank do, as base64:
// the limit fits one of them (space photos: 1.2 MB) and nothing much bigger.
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  app.enableCors(app.get(ConfigService).get("cors"));
  app.enableShutdownHooks();
}
