import { NextFunction, Request, Response } from 'express';
import { NotAuthenticated } from './errors';
import { SystemRole } from '../../app/user/types';
import { container } from '../di/container';
import { tokens } from '../di/tokens';
import { PermissionCacheService } from '../../app/rbac/service/permission-cache.service';

export interface RBACOptions {
  resource: string;
  action: string;
  allowSystemAdmin?: boolean; // by default will be true
}

export function rbac(options: RBACOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // req.user is not there , that's mean not authenticate
      if (!req.user) {
        throw NotAuthenticated;
      }

      const { resource, action, allowSystemAdmin = true } = options;

      // if he is a system admin -> bypass
      // if restaurant user
      // 1. fetch permissions
      // 2. check if the permissions has the action for this resource

      if (req.user.role == SystemRole.SYSTEM_ADMIN && allowSystemAdmin) {
        return next();
      }

      if (req.user.role == SystemRole.RESTAURANT_USER) {
        const permissionCacheService = container.resolve<PermissionCacheService>(tokens.PermissionCacheService);
        const permissions = await permissionCacheService.getPermission(req.user.restaurantRole!);
        if (permissionCacheService.hasPermission(permissions, resource, action)) {
          return next();
        }

        // if not restaurant user -> throw err
        return res.status(403).json({ message: 'Permission denied' });
      }
    } catch (error) {
      next(error);
    }
  };
}

export function requireRestaurantMember(paramName: string = 'restaurantId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw NotAuthenticated;
    }

    if (req.user.role == SystemRole.SYSTEM_ADMIN) {
      return next();
    }

    if (req.user.role == SystemRole.RESTAURANT_USER) {
      const restaurantId = parseInt(req.params[paramName] as string);

      if (Number(req.user.restaurantId) === Number(restaurantId)) {
        return next();
      }
    }

    return res.status(403).json({ message: 'Permission denied' });
  };
}

export function requireBranchAccess(paramName: string = 'branchId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw NotAuthenticated;
    }

    if (req.user.role == SystemRole.SYSTEM_ADMIN) {
      return next();
    }

    if (req.user.role == SystemRole.RESTAURANT_USER) {
      const branchId = parseInt(req.params[paramName] as string);

      if (Number(req.user.branchIds) == Number(branchId)) {
        return next();
      }
    }

    return res.status(403).json({ message: 'Permission denied' });
  };
}
