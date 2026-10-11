import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { rbac, requireRestaurantMember } from '../../lib/auth/rbac';

import { tokens } from '../../lib/di/tokens';
import { container } from '../../lib/di/container';
import { MemberController } from './controller/member.controller';

export const rbacRouter = Router();

const memberController = container.resolve<MemberController>(tokens.MemberController);

// Internal (service-to-service)
// rbacRouter.get('/internal/rbac/permissions', memberController.getPermissionsByRole);

// GET /roles/:role/permissions — public
rbacRouter.get('/roles/:role/permissions', memberController.getRolePermissions);

// POST /restaurants/:restaurantId/members — create/invite member
rbacRouter.post(
  '/restaurants/:restaurantId/members',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:member', action: 'create' }),
  memberController.createMember,
);

// GET /restaurants/:restaurantId/members — list members
rbacRouter.get(
  '/restaurants/:restaurantId/members',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:member', action: 'read' }),
  memberController.listMembers,
);

// PATCH /restaurants/:restaurantId/members/:memberId — update member
rbacRouter.patch(
  '/restaurants/:restaurantId/members/:memberId',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:member', action: 'update' }),
  memberController.updateMember,
);

// DELETE /restaurants/:restaurantId/members/:memberId — delete member
rbacRouter.delete(
  '/restaurants/:restaurantId/members/:memberId',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:member', action: 'delete' }),
  memberController.deleteMember,
);

// PUT /restaurants/:restaurantId/members/:memberId/branches — update branch assignments
rbacRouter.put(
  '/restaurants/:restaurantId/members/:memberId/branches',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:member', action: 'update' }),
  memberController.updateMemberBranches,
);
