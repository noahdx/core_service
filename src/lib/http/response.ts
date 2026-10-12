import { Response } from 'express';
import { IPaginationMeta } from './pagination/cursor-pagination';

interface IApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: Object;
}

export function sendSuccess<T>(res: Response, message: string, data: T, statusCode: number = 200, meta?: Object) {
  const body: IApiResponse<T> = { success: true, data: data };

  if (meta) {
    body.meta = meta;
  }

  res.status(statusCode).json(body);
}

export function sendPaginated<T>(res: Response, data: T[], meta?: IPaginationMeta) {
  res.status(200).json({ success: true, data: data, meta });
}
