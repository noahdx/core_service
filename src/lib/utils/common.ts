import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import crypto from 'crypto';

export interface IPayload {
  userId: number;
  email: string;
  systemRole: string;
}

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(inputPassword: string, hashedPassword: string) {
  return await bcrypt.compare(inputPassword, hashedPassword);
}

export function generateAccessToken(payload: IPayload) {
  return jwt.sign(payload, env.jwt.accessToken, { expiresIn: env.jwt.accessExpiresIn } as SignOptions);
}

export function generateRefreshToken(payload: IPayload) {
  return jwt.sign(payload, env.jwt.refreshToken, { expiresIn: env.jwt.refreshExpiresIn } as SignOptions);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwt.accessToken);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.jwt.refreshToken);
}

export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOTP(otp: string) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}
