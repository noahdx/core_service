declare namespace Express {
  interface Request {
    correlationID?: string;
    user?: {
      userID: number;
      email: string;
      SystemRole: string;
    };
  }
}
