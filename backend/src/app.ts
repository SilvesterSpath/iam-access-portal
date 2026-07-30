import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { AppError } from './errors.js';
import { auditLogsRouter } from './routes/auditLogs.js';
import { rolesRouter } from './routes/roles.js';
import { usersRouter } from './routes/users.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/users', usersRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/audit-logs', auditLogsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  };

  app.use(errorHandler);

  return app;
}
