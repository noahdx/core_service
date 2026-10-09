declare namespace Express {
  interface Request {
    correlationID?: string;
    user?: {
      userId: number;
      email: string;
      role: string;
    };
  }
}
