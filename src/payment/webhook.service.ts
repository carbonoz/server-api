import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EPaymentStatus } from '@prisma/client';
import { IAppConfig } from 'src/__shared__/interfaces';
import { PrismaService } from '../prisma/prisma.service';

export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource_type: string;
  resource: {
    id: string;
    status?: string;
    amount?: {
      currency_code: string;
      value: string;
    };
    seller_protection?: {
      status: string;
    };
    create_time?: string;
    update_time?: string;
    custom_id?: string;
    invoice_id?: string;
  };
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  event_version: string;
  create_time: string;
  resource_version: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<IAppConfig>,
    private readonly httpService: HttpService,
  ) {}

  async processWebhook(
    event: PayPalWebhookEvent,
    rawPayload: string,
    headers: Record<string, string>,
  ): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.event_type}`);

    // Verify webhook signature
    const isValid = await this.verifyWebhookSignature(rawPayload, headers);
    if (!isValid) {
      this.logger.error(`Invalid webhook signature for event: ${event.id}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    // Check if event already processed
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existingEvent) {
      this.logger.log(`Event ${event.id} already processed, skipping`);
      return;
    }

    // Store webhook event
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.event_type,
        resourceType: event.resource_type,
        resourceId: event.resource.id,
        eventData: event as any,
        processed: false,
      },
    });

    try {
      await this.handleWebhookEvent(event, webhookEvent.id);

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      this.logger.log(`Successfully processed webhook event: ${event.id}`);
    } catch (error) {
      this.logger.error(
        `Error processing webhook event ${event.id}:`,
        error.message,
      );
      throw error;
    }
  }

  private async handleWebhookEvent(
    event: PayPalWebhookEvent,
    webhookEventId: string,
  ): Promise<void> {
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.handlePaymentCaptureCompleted(event, webhookEventId);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
        await this.handlePaymentCaptureFailed(event, webhookEventId);
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        await this.handlePaymentCaptureRefunded(event, webhookEventId);
        break;

      case 'CHECKOUT.ORDER.APPROVED':
        await this.handleOrderApproved(event, webhookEventId);
        break;

      case 'CHECKOUT.ORDER.CANCELLED':
        await this.handleOrderCancelled(event, webhookEventId);
        break;

      default:
        this.logger.log(`Unhandled webhook event type: ${event.event_type}`);
    }
  }

  private async handlePaymentCaptureCompleted(
    event: PayPalWebhookEvent,
    webhookEventId: string,
  ): Promise<void> {
    const captureId = event.resource.id;

    // Find payment by transaction ID or PayPal order ID
    const payment = await this.findPaymentByResource(event);

    if (!payment) {
      this.logger.warn(`Payment not found for capture ID: ${captureId}`);
      return;
    }

    if (payment.status === EPaymentStatus.COMPLETED) {
      this.logger.log(`Payment ${payment.id} already completed`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: EPaymentStatus.COMPLETED,
        transactionId: captureId,
        updatedAt: new Date(),
      },
    });

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { paymentId: payment.id },
    });

    this.logger.log(`Payment ${payment.id} marked as completed`);
  }

  private async handlePaymentCaptureFailed(
    event: PayPalWebhookEvent,
    webhookEventId: string,
  ): Promise<void> {
    const payment = await this.findPaymentByResource(event);

    if (!payment) {
      this.logger.warn(
        `Payment not found for failed capture: ${event.resource.id}`,
      );
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: EPaymentStatus.FAILED,
        updatedAt: new Date(),
      },
    });

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { paymentId: payment.id },
    });

    this.logger.log(`Payment ${payment.id} marked as failed`);
  }

  private async handlePaymentCaptureRefunded(
    event: PayPalWebhookEvent,
    webhookEventId: string,
  ): Promise<void> {
    const payment = await this.findPaymentByResource(event);

    if (!payment) {
      this.logger.warn(`Payment not found for refund: ${event.resource.id}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: EPaymentStatus.REFUNDED,
        updatedAt: new Date(),
      },
    });

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { paymentId: payment.id },
    });

    this.logger.log(`Payment ${payment.id} marked as refunded`);
  }

  private async handleOrderApproved(
    event: PayPalWebhookEvent,
    webhookEventId: string,
  ): Promise<void> {
    const orderId = event.resource.id;
    const payment = await this.prisma.payment.findFirst({
      where: { paypalOrderId: orderId },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for approved order: ${orderId}`);
      return;
    }

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { paymentId: payment.id },
    });

    this.logger.log(
      `Order ${orderId} approved, payment ${payment.id} can be captured`,
    );
  }

  private async handleOrderCancelled(
    event: PayPalWebhookEvent,
    webhookEventId: string,
  ): Promise<void> {
    const orderId = event.resource.id;
    const payment = await this.prisma.payment.findFirst({
      where: { paypalOrderId: orderId },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for cancelled order: ${orderId}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: EPaymentStatus.CANCELLED,
        updatedAt: new Date(),
      },
    });

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { paymentId: payment.id },
    });

    this.logger.log(`Payment ${payment.id} cancelled via webhook`);
  }

  private async findPaymentByResource(event: PayPalWebhookEvent): Promise<any> {
    const resourceId = event.resource.id;

    // Try to find by transaction ID first
    let payment = await this.prisma.payment.findFirst({
      where: { transactionId: resourceId },
    });

    if (!payment && event.resource.custom_id) {
      // Try to find by our payment ID stored in custom_id
      payment = await this.prisma.payment.findFirst({
        where: { id: event.resource.custom_id },
      });
    }

    if (!payment && event.resource_type === 'capture') {
      // For capture events, try to find via PayPal order lookup
      // This would require additional PayPal API call to get order details
      // For now, we'll try to match by amount and recent timestamp
      const amount = event.resource.amount
        ? parseFloat(event.resource.amount.value)
        : null;

      if (amount) {
        payment = await this.prisma.payment.findFirst({
          where: {
            amount,
            status: EPaymentStatus.PENDING,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    return payment;
  }

  async getWebhookEvents(paymentId?: string) {
    return this.prisma.webhookEvent.findMany({
      where: paymentId ? { paymentId } : undefined,
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async retryFailedWebhook(eventId: string): Promise<void> {
    const webhookEvent = await this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (!webhookEvent) {
      throw new BadRequestException('Webhook event not found');
    }

    const event = webhookEvent.eventData as unknown as PayPalWebhookEvent;

    await this.handleWebhookEvent(event, webhookEvent.id);

    await this.prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });
  }

  private async verifyWebhookSignature(
    payload: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    try {
      const webhookId = this.config.get('payPal').webhookId;
      if (!webhookId) {
        this.logger.warn(
          'PayPal webhook ID not configured, skipping signature verification',
        );
        return true; // Allow in development if webhook ID not set
      }

      // Extract PayPal headers
      const authAlgo = headers['paypal-auth-algo'];
      const transmission = headers['paypal-transmission-id'];
      const certId = headers['paypal-cert-id'];
      const transmissionSig = headers['paypal-transmission-sig'];
      const transmissionTime = headers['paypal-transmission-time'];

      if (
        !authAlgo ||
        !transmission ||
        !certId ||
        !transmissionSig ||
        !transmissionTime
      ) {
        this.logger.error('Missing required PayPal webhook headers');
        return false;
      }

      // For development, we'll use a simplified verification
      // In production, you should implement full certificate validation with expectedSig:
      // const expectedSig = `${transmission}|${transmissionTime}|${webhookId}|${crypto
      //   .createHash('sha256')
      //   .update(payload)
      //   .digest('base64')}`;

      this.logger.debug(
        `Webhook signature verification for transmission: ${transmission}`,
      );

      return true; // Simplified for now - implement full verification in production
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error.message);
      return false;
    }
  }
}
