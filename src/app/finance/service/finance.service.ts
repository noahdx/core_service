import { inject, injectable } from 'tsyringe';
import { db } from '../../../lib/knex/knex';
import { tokens } from '../../../lib/di/tokens';
import { IFilterParams, IPaginationParams } from '../../../lib/http/pagination/cursor-pagination';
import { RestaurantRepository } from '../../restaurant/repository/restaurant.repository';
import { RestaurantNotFoundError } from '../../restaurant/errors';
import { RestaurantBalanceRepository } from '../repository/restaurant-balance.repository';
import { TransactionRepository } from '../../payment/repository/transaction.repository';
import { TransactionEntity } from '../../payment/entity/transaction.entity';
import { PaymentMethodType, TransactionStatus, TransactionType } from '../../payment/enums';
import { CreatePayoutRequestDTO } from '../dto/finance-req.dto';
import { PayoutResponseDTO, RestaurantBalanceResponseDTO } from '../dto/finance-res.dto';
import { InsufficientBalanceError } from '../errors';

@injectable()
export class FinanceService {
  constructor(
    @inject(tokens.RestaurantBalanceRepository)
    private readonly balanceRepository: RestaurantBalanceRepository,
    @inject(tokens.TransactionRepository)
    private readonly transactionRepository: TransactionRepository,
    @inject(tokens.RestaurantRepository)
    private readonly restaurantRepository: RestaurantRepository,
  ) {}

  getBalance = async (restaurantId: number) => {
    const restaurant = await this.restaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw RestaurantNotFoundError;
    }

    const balance = await this.balanceRepository.findByRestaurantId(restaurantId);
    const balanceAmount = balance ? balance.balance : 0;

    return {
      message: 'Restaurant balance retrieved successfully',
      data: RestaurantBalanceResponseDTO.from(restaurantId, balanceAmount),
    };
  };

  listPayouts = async (
    restaurantId: number,
    from?: Date,
    to?: Date,
    pagination?: IPaginationParams,
    extraFilters: IFilterParams[] = [],
  ) => {
    const restaurant = await this.restaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw RestaurantNotFoundError;
    }

    const { data: transactions, meta } = await this.transactionRepository.findPayoutsByOwnerId(
      restaurant.ownerId,
      from,
      to,
      pagination,
      extraFilters,
    );

    return {
      message: 'Payouts retrieved successfully',
      data: transactions.map((t: TransactionEntity) => PayoutResponseDTO.from(t, restaurantId)),
      meta,
    };
  };

  recordPayout = async (restaurantId: number, data: CreatePayoutRequestDTO, idempotencyKey?: string) => {
    const restaurant = await this.restaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw RestaurantNotFoundError;
    }

    const trx = await db.transaction();
    let tx: any;

    try {
      const balance = await this.balanceRepository.getForUpdate(restaurantId, trx);
      if (!balance || balance.balance < data.amount) {
        throw InsufficientBalanceError;
      }

      await this.balanceRepository.decrement(restaurantId, data.amount, trx);

      tx = await this.transactionRepository.create(
        {
          transactionType: TransactionType.PAYOUT,
          method: PaymentMethodType.BANK_TRANSFER,
          status: TransactionStatus.SUCCEEDED,
          amount: data.amount,
          currency: data.currency || 'EGP',
          srcAccId: null,
          dstAccId: restaurant.ownerId,
          providerReferenceId: data.providerReferenceId,
          idempotencyKey,
        },
        trx,
      );

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }

    return {
      message: 'Payout recorded successfully',
      data: PayoutResponseDTO.from(tx, restaurantId),
    };
  };
}
