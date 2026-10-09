import { AppError } from './AppError';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../logger/logger';

export function errorHandler(error: AppError, req: Request, res: Response, next: NextFunction) {
  const operational = error.isOperational;

  logger.error(error.message, {
    statusCode: error.statusCode,
    operational: operational,
    correlationID: req.correlationID,
    stack: error.stack,
  });

  if (operational) {
    return res.status(error.statusCode).jsonp({ message: error.message });
  } else {
    return res.status(500).jsonp({ message: 'Internal Server Error' });
  }
}
