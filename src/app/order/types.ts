export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PLACED = 'placed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  PREPARING = 'preparing',
  READY = 'ready',
  ASSIGNED = 'assigned',
  PICKED = 'picked',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  ONLINE = 'online',
  COD = 'cod',
}

export enum StatusActor {
  CUSTOMER = 'customer',
  RESTAURANT_MEMBER = 'restaurant_member',
  AGENT = 'agent',
  SYSTEM = 'system',
  ADMIN = 'admin',
}

export interface IOrderItemDraft {
  productId: number;
  productBranchDetailId: number;
  quantity: number;
  unitPriceSnapshot: number;
  nameSnapshot: string;
  imageUrlSnapshot: string | null;
  lineTotal: number;
}
