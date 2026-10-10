import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { CustomerAddressService } from '../service/customer-address.service';
import { NextFunction, Request, Response } from 'express';
import { validateBody } from '../../../lib/validation/validate';
import { CreateAddressDTO, UpdateAddressDTO } from '../dto/customer-address-req.dto';

@injectable()
export class CustomerAddressController {
  constructor(@inject(tokens.CustomerAddressService) private readonly customerAddressService: CustomerAddressService) {}

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.addressId);
      const result = await this.customerAddressService.getById(id);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
    } catch (error) {
      next(error);
    }
    const userId = Number(req.user?.userId);
    const result = await this.customerAddressService.getAll(userId);
    res.status(200).send(result);
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = Number(req.user?.userId);
      const data = await validateBody(CreateAddressDTO, req.body);
      const result = await this.customerAddressService.create(userId, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.addressId);
      const data = await validateBody(UpdateAddressDTO, req.body);
      const result = await this.customerAddressService.update(id, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.addressId);
      const result = await this.customerAddressService.delete(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
