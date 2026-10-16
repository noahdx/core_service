import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { db } from '../../../lib/knex/knex';
import { IFilterParams, IPaginationParams } from '../../../lib/http/pagination/cursor-pagination';
import { OrderRepository } from '../../order/repository/order.repository';
import { OrderItemRepository } from '../../order/repository/order-item.repository';
import { BranchRepository } from '../../branch/repository/branch.repository';
import { UserRepository } from '../../user/repository/user.repository';
import { OrderStatus } from '../../order/types';
import { OrderNotFoundError } from '../../order/errors';
import { AgentEarningRepository } from '../repository/agent-earning.repository';
import { PresenceService } from './presence.service';
import { AssignmentService } from './assignment.service';
import { SettlementService } from './settlement.service';
import { AgentNotAssignedToOrder, InvalidAgentStatusTransition } from '../errors';
import { PresenceOnlineDTO, PresencePingDTO } from '../dto/agent-request.dto';
import { AgentEarningsDTO, AgentEarningsSummaryDTO, DeliveryTaskDTO } from '../dto/agent-response.dto';
import { OrderEntity } from '../../order/entity/order.entity';

@injectable()
export class AgentService {
  constructor(
    @inject(tokens.OrderRepository) private readonly orderRepository: OrderRepository,
    @inject(tokens.OrderItemRepository) private readonly orderItemRepository: OrderItemRepository,
    @inject(tokens.BranchRepository) private readonly branchRepository: BranchRepository,
    @inject(tokens.UserRepository) private readonly userRepository: UserRepository,
    @inject(tokens.AgentEarningRepository) private readonly earningRepository: AgentEarningRepository,
    @inject(tokens.PresenceService) private readonly presenceService: PresenceService,
    @inject(tokens.AssignmentService) private readonly assignmentService: AssignmentService,
    @inject(tokens.SettlementService) private readonly settlementService: SettlementService,
  ) {}

  goOnline = async (agentId: number, data: PresenceOnlineDTO) => {
    const result = await this.presenceService.goOnline(agentId, data.lat, data.lng);
    return {
      message: 'Online',
      data: { message: 'Online', ttl: result.ttl },
    };
  };

  ping = async (agentId: number, data: PresencePingDTO) => {
    await this.presenceService.ping(agentId, data.lat, data.lng);
    return {
      message: 'Ping received',
      data: { success: true },
    };
  };

  goOffline = async (agentId: number) => {
    await this.presenceService.goOffline(agentId);
    return {
      message: 'Offline',
      data: { success: true },
    };
  };

  accept = async (orderPublicId: string, agentId: number) => {
    const order = await this.assignmentService.claim(orderPublicId, agentId);
    const task = await this.buildTaskDTO(order);
    return {
      message: 'Order accepted successfully',
      data: task,
    };
  };

  reject = async (orderPublicId: string, agentId: number) => {
    await this.assignmentService.reject(orderPublicId, agentId);
    return {
      message: 'Order rejected',
      data: { success: true },
    };
  };

  transitionStatus = async (orderPublicId: string, agentId: number, newStatus: 'picked' | 'delivered') => {
    const order = await this.orderRepository.findByPublicId(orderPublicId);
    if (!order) {
      throw OrderNotFoundError;
    }

    if (order.agentId !== agentId) {
      throw AgentNotAssignedToOrder;
    }

    // Validate state machine: assigned -> picked -> delivered
    if (newStatus === 'picked') {
      if (order.status !== OrderStatus.ASSIGNED) {
        throw InvalidAgentStatusTransition;
      }

      const updated = await this.orderRepository.updateStatus(orderPublicId, OrderStatus.PICKED, 'picked_at');
      const task = await this.buildTaskDTO(updated);
      return {
        message: 'Order marked as picked up',
        data: task,
      };
    }

    if (newStatus === 'delivered') {
      if (order.status !== OrderStatus.PICKED) {
        throw InvalidAgentStatusTransition;
      }

      let updatedOrder: OrderEntity;
      const trx = await db.transaction();
      try {
        updatedOrder = await this.orderRepository.updateStatus(orderPublicId, OrderStatus.DELIVERED, 'delivered_at', trx);

        await this.settlementService.settleOrder(updatedOrder, trx);

        await trx.commit();
      } catch (error) {
        await trx.rollback();
        throw error;
      }

      const task = await this.buildTaskDTO(updatedOrder);
      return {
        message: 'Order delivered and settled successfully',
        data: task,
      };
    }

    throw InvalidAgentStatusTransition;
  };

  getTasks = async (agentId: number, pagination: IPaginationParams, filters: IFilterParams[] = [], statuses?: string[]) => {
    const result = await this.orderRepository.findAgentTasks(agentId, pagination, filters, statuses);
    const orderIds = result.data.map((o) => o.id);
    const items = await this.orderItemRepository.findByOrderIds(orderIds);

    const itemsByOrderId = new Map<number, any[]>();
    for (const item of items) {
      const list = itemsByOrderId.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }

    // Batch query branches and customers
    const branchIds = [...new Set(result.data.map((o) => o.branchId))];
    const customerIds = [...new Set(result.data.map((o) => o.customerId))];

    const [branches, customers] = await Promise.all([
      this.branchRepository.findByIds(branchIds),
      this.userRepository.findByIds(customerIds),
    ]);

    const branchMap = new Map(branches.filter(Boolean).map((b) => [b!.id, b!]));
    const customerMap = new Map(customers.filter(Boolean).map((c) => [c!.id, c!]));

    const tasks = result.data.map((o) => {
      const b = branchMap.get(o.branchId);
      const c = customerMap.get(o.customerId);
      return DeliveryTaskDTO.from(
        o,
        itemsByOrderId.get(o.id) ?? [],
        b ? { name: b.label, lat: b.lat, lng: b.lng } : undefined,
        c ? { name: c.name, phone: c.phone } : undefined,
      );
    });

    return {
      message: 'Agent tasks retrieved successfully',
      data: tasks,
      meta: result.meta,
    };
  };

  getEarnings = async (agentId: number, pagination: IPaginationParams, filters: IFilterParams[] = [], from?: Date, to?: Date) => {
    const result = await this.earningRepository.listByAgent(agentId, pagination, filters, from, to);
    const earnings = result.data.map((e) => AgentEarningsDTO.from(e));

    return {
      message: 'Agent earnings retrieved successfully',
      data: earnings,
      meta: result.meta,
    };
  };

  getEarningsSummary = async (agentId: number, from?: Date, to?: Date) => {
    const summary = await this.earningRepository.sumByAgent(agentId, from, to);
    return {
      message: 'Agent earnings summary retrieved successfully',
      data: {
        total: summary.total,
        currency: 'EGP',
        count: summary.count,
      },
    };
  };

  adminAssign = async (orderPublicId: string, agentId: number) => {
    const order = await this.assignmentService.adminAssign(orderPublicId, agentId);
    const task = await this.buildTaskDTO(order);
    return {
      message: 'Order assigned to agent successfully',
      data: task,
    };
  };

  private buildTaskDTO = async (order: OrderEntity): Promise<DeliveryTaskDTO> => {
    const [items, branch, customer] = await Promise.all([
      this.orderItemRepository.findByOrderIds([order.id]),
      this.branchRepository.findById(order.branchId),
      this.userRepository.findById(order.customerId),
    ]);

    return DeliveryTaskDTO.from(
      order,
      items,
      branch ? { name: branch.label, lat: branch.lat, lng: branch.lng } : undefined,
      customer ? { name: customer.name, phone: customer.phone } : undefined,
    );
  };
}
