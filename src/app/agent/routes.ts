import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { rbac } from '../../lib/auth/rbac';
import { container } from '../../lib/di/container';
import { tokens } from '../../lib/di/tokens';
import { AgentController } from './controller/agent.controller';
import { AdminAssignmentController } from './controller/admin-assignment.controller';

const agentController = container.resolve<AgentController>(tokens.AgentController);
const adminAssignmentController = container.resolve<AdminAssignmentController>(
  tokens.AdminAssignmentController,
);

export const agentRouter = Router();

// 1. Agent Presence
agentRouter.post('/agents/presence/online', authenticate, agentController.goOnline);
agentRouter.post('/agents/presence/ping', authenticate, agentController.ping);
agentRouter.post('/agents/presence/offline', authenticate, agentController.goOffline);

// 2. Agent Orders & Tasks
agentRouter.post('/agents/orders/:publicId/accept', authenticate, agentController.accept);
agentRouter.post('/agents/orders/:publicId/reject', authenticate, agentController.reject);
agentRouter.patch('/agents/orders/:publicId/status', authenticate, agentController.updateStatus);
agentRouter.get('/agents/tasks', authenticate, agentController.getTasks);

// 3. Agent Earnings
agentRouter.get('/agents/earnings', authenticate, agentController.getEarnings);
agentRouter.get('/agents/earnings/sum', authenticate, agentController.getEarningsSummary);

// 4. Admin Manual Assignment
agentRouter.post(
  '/admin/orders/:publicId/assign',
  authenticate,
  rbac({ resource: 'core:order', action: 'update', allowSystemAdmin: true }),
  adminAssignmentController.assign,
);
