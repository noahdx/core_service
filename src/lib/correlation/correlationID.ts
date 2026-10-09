import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function correlationID(req: Request, res: Response, next: NextFunction): void {
  const id = uuidv4();
  req.correlationID = id;
  res.setHeader('X-Correlation-ID', id);
}
