export class PasswordResetEntity {
  id: number;
  userId: number;
  otpHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;

  constructor(data: Partial<PasswordResetEntity>) {
    this.id = data.id!;
    this.userId = data.userId!;
    this.otpHash = data.otpHash!;
    this.createdAt = data.createdAt!;
    this.expiresAt = data.expiresAt!;
    this.consumedAt = data.consumedAt ?? null;
  }

  isExpired() {
    return this.expiresAt >= new Date();
  }
}
