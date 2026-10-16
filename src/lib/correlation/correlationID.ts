import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export function correlationID(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  req.correlationID = id;
  res.setHeader('X-Correlation-ID', id);
  next();
}
