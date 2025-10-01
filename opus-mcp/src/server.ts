import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import { HttpError, configError } from './errors.js';
import { registerTools, getToolContracts } from './tools/index.js';

const app: Express = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  process.env.APP_ORIGIN,
  process.env.API_ORIGIN,
  'http://localhost:5000',
  'http://localhost:4000'
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: false
}));
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] ${req.method} ${req.path}`);
  (req as any).requestId = requestId;
  next();
});

app.get('/healthz', (req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get('/contracts', (req: Request, res: Response) => {
  const tools = getToolContracts();
  res.json({ tools });
});

app.get('/ws', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'WebSocket support coming soon'
    }
  });
});

app.use((error: Error | HttpError, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId || 'unknown';

  if (error instanceof HttpError) {
    console.error(`[${requestId}] HTTP Error ${error.statusCode}:`, error.message);
    return res.status(error.statusCode).json(error.toJSON());
  }

  console.error(`[${requestId}] Unexpected error:`, error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

async function startServer() {
  try {
    const requiredEnvVars = [
      'MCP_SERVICE_TOKEN',
      'DATABASE_URL'
    ];

    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      throw configError(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    console.log('[MCP-Server] Registering tools...');
    await registerTools(app);

    app.listen(PORT, () => {
      console.log(`[MCP-Server] ✅ Opus MCP Service running on port ${PORT}`);
      console.log(`[MCP-Server] Health check: http://localhost:${PORT}/healthz`);
      console.log(`[MCP-Server] Contracts: http://localhost:${PORT}/contracts`);
    });
  } catch (error) {
    console.error('[MCP-Server] ❌ Failed to start:', error);
    process.exit(1);
  }
}

startServer();
