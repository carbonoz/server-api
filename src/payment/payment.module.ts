import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PayPalConfigService } from './paypal.config';
import { WebhookService } from './webhook.service';

@Global()
@Module({
  imports: [HttpModule],
  controllers: [PaymentController],
  providers: [PaymentService, PayPalConfigService, WebhookService],
  exports: [PaymentService, PayPalConfigService, WebhookService],
})
export class PaymentModule {}
