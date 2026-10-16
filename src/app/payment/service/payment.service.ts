import { inject, injectable } from 'tsyringe';
import { UnAuthorizedError } from '../../../lib/auth/errors';
import { TOKENS } from '../../../lib/di/tokens';
import { IPaginationParams } from '../../../lib/http/pagination/cursor-pagination';
import { IPaymentProvider } from '../../../pkg/payments/payment.interface';
import { OrderRepository } from '../../order/repository/order.repository';
import { OrderEntity } from '../../order/entity/order.entity';
import { OrderNotFoundError } from '../../order/errors';
import { OrderStatus, PaymentMethod } from '../../order/types';
import { RestaurantMemberRepository } from '../../rbac/repository/restaurant_member.repository';
import { UserRepository } from '../../user/repository/user.repository';
import { InitPaymentDTO, RefundRequestDTO } from '../dto/payment-req.dto';
import { PaymentInitResponseDTO, PaymentResponseDTO, RefundResponseDTO } from '../dto/payment-res.dto';
import { TransactionEntity } from '../entity/transaction.entity';
import { KASHIER_PROVIDER_ID, PaymentMethodType, PaymentSessionStatus, TransactionStatus, TransactionType } from '../enums';
import {
  AmountMismatchError,
  InvalidOrderStatusForPaymentError,
  KashierGatewayError,
  OrderMustBeOnlinePaymentError,
  PaymentAlreadyExistsError,
  PaymentSessionNotFoundError,
  RefundExceedsPaidError,
  RefundNotAllowedError,
  UnauthorizedPaymentAccessError,
} from '../errors';
import { PaymentSessionRepository } from '../repository/payment-session.repository';
import { TransactionRepository } from '../repository/transaction.repository';
import { IListRestaurantPaymentsFilter } from '../types';

@injectable()
export class PaymentService {
  constructor(
    @inject(TOKENS.PaymentSessionRepository)
    private paymentSessionRepository: PaymentSessionRepository,
    @inject(TOKENS.TransactionRepository)
    private transactionRepository: TransactionRepository,
    @inject(TOKENS.OrderRepository)
    private orderRepository: OrderRepository,
    @inject(TOKENS.UserRepository)
    private userRepository: UserRepository,
    @inject(TOKENS.RestaurantMemberRepository)
    private memberRepository: RestaurantMemberRepository,
    @inject(TOKENS.PaymentProvider)
    private paymentProvider: IPaymentProvider,
  ) {}

  initPayment = async (
    restaurantId: number,
    branchId: number,
    orderIdentifier: string,
    dto: InitPaymentDTO,
    userId: number,
    userRole: string,
  ) => {
    const order = await this.findOrder(orderIdentifier);
    if (!order) {
      throw OrderNotFoundError;
    }

    if (
      restaurantId > 0 &&
      branchId > 0 &&
      (Number(order.restaurantId) !== Number(restaurantId) || Number(order.branchId) !== Number(branchId))
    ) {
      throw OrderNotFoundError;
    }

    await this.assertOrderAccess(order, userId, userRole);

    if (order.paymentMethod !== PaymentMethod.ONLINE) {
      throw OrderMustBeOnlinePaymentError;
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw InvalidOrderStatusForPaymentError;
    }

    const existingSession = await this.paymentSessionRepository.findByOrderId(order.id);
    if (
      existingSession &&
      (existingSession.status === PaymentSessionStatus.CAPTURED ||
        existingSession.status === PaymentSessionStatus.INITIALIZED ||
        existingSession.status === PaymentSessionStatus.PENDING)
    ) {
      throw PaymentAlreadyExistsError;
    }

    const customer = await this.userRepository.findById(order.customerId);
    const customerEmail = customer?.email || 'customer@example.com';
    const customerName = customer?.name || 'Customer';

    try {
      const sessionResult = await this.paymentProvider.createSession({
        orderId: order.publicId,
        amount: order.total,
        currency: 'EGP',
        customer: {
          email: customerEmail,
          reference: String(order.customerId),
          name: customerName,
        },
        merchantRedirect: dto.redirectUrl,
        description: `Order ${order.publicId}`,
        metadata: {
          orderId: order.id,
          branchId: order.branchId,
          restaurantId: order.restaurantId,
        },
      });

      const session = await this.paymentSessionRepository.create({
        orderId: order.id,
        providerId: KASHIER_PROVIDER_ID,
        providerSessionId: sessionResult.sessionId,
        redirectUrl: sessionResult.sessionUrl,
        amount: order.total,
        currency: 'EGP',
        status: PaymentSessionStatus.INITIALIZED,
        rawInitPayload: sessionResult.raw,
        failureAttempts: 0,
        maxFailureAttempts: 3,
      });

      return {
        message: 'Payment session created successfully',
        data: new PaymentInitResponseDTO({
          sessionId: session.providerSessionId,
          redirectUrl: session.redirectUrl,
          expireAt: sessionResult.expireAt,
        }),
      };
    } catch (err: any) {
      if (err.name === 'AppError') throw err;
      throw KashierGatewayError(err?.message || 'Failed to create payment session');
    }
  };

  getPaymentByOrder = async (
    restaurantId: number,
    branchId: number,
    orderIdentifier: string,
    userId: number,
    userRole: string,
  ) => {
    const order = await this.findOrder(orderIdentifier);
    if (!order) {
      throw OrderNotFoundError;
    }

    if (
      restaurantId > 0 &&
      branchId > 0 &&
      (Number(order.restaurantId) !== Number(restaurantId) || Number(order.branchId) !== Number(branchId))
    ) {
      throw OrderNotFoundError;
    }

    await this.assertOrderAccess(order, userId, userRole);

    const session = await this.paymentSessionRepository.findByOrderId(order.id);
    if (!session) {
      throw PaymentSessionNotFoundError;
    }

    const transactions = await this.transactionRepository.findByOrderId(order.id);

    return {
      message: 'Payment retrieved successfully',
      data: PaymentResponseDTO.from(session, order.publicId, transactions),
    };
  };

  requestRefund = async (paymentId: number, dto: RefundRequestDTO, userId: number, userRole: string) => {
    await this.assertRefundPermission(userId, userRole);

    const session = await this.paymentSessionRepository.findById(paymentId);
    if (!session) {
      throw PaymentSessionNotFoundError;
    }

    const order = await this.orderRepository.findById(session.orderId);
    if (!order) {
      throw OrderNotFoundError;
    }

    // Refund not allowed if order never paid/captured or cancelled before payment
    if (session.status !== PaymentSessionStatus.CAPTURED && session.status !== PaymentSessionStatus.AUTHORIZED) {
      throw RefundNotAllowedError;
    }

    const alreadyRefunded = await this.transactionRepository.sumRefundedByOrderId(order.id);
    if (alreadyRefunded + dto.amount > session.amount) {
      throw RefundExceedsPaidError;
    }

    try {
      const refundResult = await this.paymentProvider.refundOrder(
        session.providerSessionId || order.publicId,
        dto.amount,
        dto.reason,
      );

      const existingTransactions = await this.transactionRepository.findByOrderId(order.id);
      const chargeTx = existingTransactions.find((t) => t.transactionType === TransactionType.CHARGE);
      const status = refundResult.status === 'SUCCESS' ? TransactionStatus.SUCCEEDED : TransactionStatus.PENDING;

      const tx = await this.transactionRepository.create({
        orderId: session.orderId,
        transactionType: TransactionType.REFUND,
        method: PaymentMethodType.ONLINE,
        providerId: session.providerId,
        providerReferenceId: refundResult.transactionId || null,
        status,
        amount: dto.amount,
        currency: session.currency,
        srcAccId: null,
        dstAccId: order.customerId,
        isRefunded: false,
        refundedPaymentId: chargeTx ? chargeTx.id : null,
        idempotencyKey: `refund:${session.id}:${dto.amount}:${Date.now()}`,
      });

      if (status === TransactionStatus.SUCCEEDED && chargeTx?.providerReferenceId) {
        await this.transactionRepository.markRefunded(chargeTx.providerReferenceId);
      }

      return {
        message: 'Refund requested successfully',
        data: new RefundResponseDTO({
          refundId: tx.id,
          paymentId: session.id,
          amount: dto.amount,
          currency: session.currency,
          status: tx.status,
        }),
      };
    } catch (err: any) {
      if (err.name === 'AppError') throw err;
      throw KashierGatewayError(err?.message || 'Failed to refund order');
    }
  };

  listPaymentsByRestaurant = async (
    restaurantId: number,
    filter: IListRestaurantPaymentsFilter,
    pagination: IPaginationParams,
    userId: number,
    userRole: string,
  ) => {
    await this.assertRestaurantAccess(restaurantId, userId, userRole);

    const result = await this.paymentSessionRepository.findByRestaurant(filter, pagination);
    const orderIds = [...new Set(result.data.map((session) => session.orderId))];

    const [orders, transactions] = await Promise.all([
      this.orderRepository.findByIds(orderIds),
      this.transactionRepository.findByOrderIds(orderIds),
    ]);

    const orderMap = new Map<number, OrderEntity>(orders.map((o) => [o.id, o]));
    const txMap = new Map<number, TransactionEntity[]>();
    for (const tx of transactions) {
      if (tx.orderId) {
        const list = txMap.get(tx.orderId) ?? [];
        list.push(tx);
        txMap.set(tx.orderId, list);
      }
    }

    const data = result.data.map((session) => {
      const order = orderMap.get(session.orderId);
      const txs = txMap.get(session.orderId) ?? [];
      return PaymentResponseDTO.from(session, order?.publicId || String(session.orderId), txs);
    });

    return {
      message: 'Payments retrieved successfully',
      data,
      meta: result.meta,
    };
  };

  // --- Private Helpers ---
  private findOrder = async (identifier: string): Promise<OrderEntity | undefined> => {
    // If UUID
    if (identifier.includes('-')) {
      return this.orderRepository.findByPublicId(identifier);
    }
    const numId = Number(identifier);
    if (!isNaN(numId)) {
      return (await this.orderRepository.findById(numId)) || (await this.orderRepository.findByPublicId(identifier));
    }
    return this.orderRepository.findByPublicId(identifier);
  };

  private assertOrderAccess = async (order: OrderEntity, userId: number, userRole: string) => {
    if (userRole === 'system_admin') return;
    if (order.customerId === userId) return;

    if (userRole === 'restaurant_user') {
      const memberData = await this.memberRepository.findRestaurantMemberWithRole(userId);
      if (memberData && Number(memberData.member.restaurantId) === Number(order.restaurantId)) {
        return;
      }
    }

    throw UnAuthorizedError;
  };

  private assertRestaurantAccess = async (restaurantId: number, userId: number, userRole: string) => {
    if (userRole === 'system_admin') return;

    if (userRole === 'restaurant_user') {
      const memberData = await this.memberRepository.findRestaurantMemberWithRole(userId);
      if (memberData && Number(memberData.member.restaurantId) === Number(restaurantId)) {
        return;
      }
    }

    throw UnAuthorizedError;
  };

  private assertRefundPermission = async (userId: number, userRole: string) => {
    if (userRole === 'system_admin') return;

    if (userRole === 'restaurant_user') {
      const memberData = await this.memberRepository.findRestaurantMemberWithRole(userId);
      if (memberData && memberData.roleName.toLowerCase().includes('owner')) {
        return;
      }
    }

    throw UnauthorizedPaymentAccessError;
  };
}
