import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './lib/config/env';
import { correlationID } from './lib/correlation/correlationID';
import { errorHandler } from './lib/error/errorHandler';
import { routes } from './routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use(cookieParser());
  app.use(correlationID);
  app.use('/api', routes);
  app.use(errorHandler);

  return app;
}
