declare namespace Express {
  interface Request {
    correlationID?: string;
    user?: {
      userId: number;
      email: string;
      role: string;
      // for restaurant users only
      restaurantId?: string;
      restaurantRole?: string;
      branchIds?: number[];
    };
  }
}
