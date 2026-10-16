export class AgentEarningEntity {
  id: number;
  agentId: number;
  orderId: number;
  amount: number;
  currency: string;
  earnedAt: Date;

  constructor(data: {
    id: number;
    agentId: number;
    orderId: number;
    amount: number;
    currency: string;
    earnedAt: Date;
  }) {
    this.id = data.id;
    this.agentId = data.agentId;
    this.orderId = data.orderId;
    this.amount = data.amount;
    this.currency = data.currency;
    this.earnedAt = data.earnedAt;
  }
}
