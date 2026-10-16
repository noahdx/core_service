import { NextFunction, Request, Response } from 'express';

import { NotAuthenticated } from './errors';
import { verifyAccessToken } from '../utils/common';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.access_token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  }
  if (!token) {
    throw NotAuthenticated;
  }

  req.user = verifyAccessToken(token);
  next();
}
