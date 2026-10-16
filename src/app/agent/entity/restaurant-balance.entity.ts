export class RestaurantBalanceEntity {
  restaurantId: number;
  balance: number;
  updatedAt: Date;

  constructor(data: { restaurantId: number; balance: number; updatedAt: Date }) {
    this.restaurantId = data.restaurantId;
    this.balance = data.balance;
    this.updatedAt = data.updatedAt;
  }
}
