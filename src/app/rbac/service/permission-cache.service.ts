import { inject, injectable } from 'tsyringe';
import { toMs } from '../../../pkg/utils/time';
import { tokens } from '../../../lib/di/tokens';
import { PermissionRepository } from '../repository/permission.repository';

@injectable()
export class PermissionCacheService {
  private cache: Map<string, { permissions: string[]; cachedAt: number }> = new Map();

  private readonly TTL: number = toMs(1, 'h');

  constructor(@inject(tokens.PermissionRepository) private readonly permissionRepository: PermissionRepository) {}

  async getPermission(roleName: string): Promise<string[]> {
    // check cache, if it is in the cache, return it, if not fetch from db
    const cached = this.cache.get(roleName);

    if (cached && Date.now() - cached.cachedAt < this.TTL) {
      return cached.permissions;
    }

    const permissions = await this.permissionRepository.findPermissionsByRoleName(roleName);
    this.cache.set(roleName, { permissions, cachedAt: Date.now() });
    return permissions;
  }

  hasPermission(permissions: string[], resource: string, action: string): boolean {
    return permissions.includes(`${resource}:${action}`);
  }
}
