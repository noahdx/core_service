import { OrderEntity } from '../../order/entity/order.entity';
import { OrderItemEntity } from '../../order/entity/order-item.entity';
import { AgentEarningEntity } from '../entity/agent-earning.entity';
import { RestaurantBalanceEntity } from '../entity/restaurant-balance.entity';

export class DeliveryTaskDTO {
  orderId!: string;
  status!: string;
  branch!: {
    id: number;
    name: string;
    lat: number;
    lng: number;
  };
  customer!: {
    name: string;
    phone: string;
    lat: number;
    lng: number;
    address: string;
  };
  items!: {
    name: string;
    quantity: number;
  }[];
  assignedAt!: string | null;
  pickedAt!: string | null;

  static from(
    order: OrderEntity,
    items: OrderItemEntity[],
    branchInfo?: { name: string; lat: number; lng: number },
    customerInfo?: { name: string; phone: string },
  ): DeliveryTaskDTO {
    const dto = new DeliveryTaskDTO();
    dto.orderId = order.publicId;
    dto.status = order.status;
    dto.branch = {
      id: order.branchId,
      name: branchInfo?.name || `Branch #${order.branchId}`,
      lat: branchInfo?.lat || 0,
      lng: branchInfo?.lng || 0,
    };
    dto.customer = {
      name: customerInfo?.name || 'Customer',
      phone: customerInfo?.phone || '',
      lat: order.deliveryLat,
      lng: order.deliveryLng,
      address: order.deliveryAddressTextSnapshot,
    };
    dto.items = items.map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
    }));
    dto.assignedAt = order.assignedAt ? order.assignedAt.toISOString() : null;
    dto.pickedAt = order.pickedAt ? order.pickedAt.toISOString() : null;
    return dto;
  }
}

export class AgentEarningsDTO {
  id!: number;
  orderId!: string;
  amount!: number;
  currency!: string;
  earnedAt!: string;

  static from(entity: AgentEarningEntity, orderPublicId?: string): AgentEarningsDTO {
    const dto = new AgentEarningsDTO();
    dto.id = entity.id;
    dto.orderId = orderPublicId || String(entity.orderId);
    dto.amount = entity.amount;
    dto.currency = entity.currency;
    dto.earnedAt = entity.earnedAt.toISOString();
    return dto;
  }
}

export class AgentEarningsSummaryDTO {
  total!: number;
  currency!: string;
  count!: number;
}

export class RestaurantBalanceDTO {
  restaurantId!: number;
  balance!: number;
  currency!: string;
  updatedAt!: string;

  static from(entity: RestaurantBalanceEntity): RestaurantBalanceDTO {
    const dto = new RestaurantBalanceDTO();
    dto.restaurantId = entity.restaurantId;
    dto.balance = entity.balance;
    dto.currency = 'EGP';
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
