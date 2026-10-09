import express from 'express';
import { correlationID } from './lib/correlation/correlationID';
import { errorHandler } from './lib/error/errorHandler';
import { routes } from './routes';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(correlationID);
  app.use('/api', routes);
  app.use(errorHandler);

  return app;
}
