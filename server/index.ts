import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add x-request-id to all requests (generate if not present)
app.use((req, res, next) => {
  const requestId = req.header('x-request-id') || randomUUID();
  (req as any).rid = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // API-only terminal middleware: prevents API responses from falling through to Vite catch-all
  // This ensures API routes that already sent headers stop here and don't get HTML from Vite
  app.use('/api', (req, res, next) => {
    if (res.headersSent) {
      return; // Response already sent by API route, stop here
    }
    // Unmatched API route - return JSON 404
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  // Internal-only terminal middleware: prevents internal routes from falling through to Vite
  app.use('/internal', (req, res, next) => {
    if (res.headersSent) {
      return; // Response already sent by internal route, stop here
    }
    // Unmatched internal route - return JSON 404
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
