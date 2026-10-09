import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import crypto from 'crypto';

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(inputPassword: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(inputPassword, hashedPassword);
}

export function generateAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, env.jwt.accessToken, { expiresIn: env.jwt.accessExpiresIn } as SignOptions);
}

export function generateRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, env.jwt.refreshToken, { expiresIn: env.jwt.refreshExpiresIn } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.accessToken) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshToken) as JwtPayload;
}

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOTP(otp: string) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}
