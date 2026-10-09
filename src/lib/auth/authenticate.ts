import { NextFunction, Request, Response } from 'express';

import { NotAuthenticated } from './errors';
import { verifyAccessToken } from '../utils/common';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.access_token;
  if (!token) {
    throw NotAuthenticated;
  }

  req.user = verifyAccessToken(token);
  next();
}
