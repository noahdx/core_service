import { Router } from 'express';
import { healthRouter } from './app/health/health.route';

export const routes = Router();
routes.get('/health', healthRouter);
