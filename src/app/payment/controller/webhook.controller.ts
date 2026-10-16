import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { tokens } from '../../../lib/di/tokens';
import { KashierWebhookService } from '../service/kashier-webhook.service';

@injectable()
export class WebhookController {
  constructor(
    @inject(tokens.KashierWebhookService)
    private readonly webhookService: KashierWebhookService,
  ) {}

  handleKashierWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = (req.headers['x-kashier-signature'] || req.headers['x-signature'] || req.headers['kashier-hash']) as
        string | undefined;

      const result = await this.webhookService.handleWebhook(req.body, signature);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
