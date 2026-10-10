export class PermissionEntity {
  id: number;
  resource: string;
  action: string;
  createdAt: Date;

  constructor(data: Partial<PermissionEntity>) {
    this.id = data.id!;
    this.resource = data.resource!;
    this.action = data.action!;
    this.createdAt = data.createdAt ?? new Date();
  }
}
