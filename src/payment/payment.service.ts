import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EPaymentMethod, EPaymentStatus, Prisma } from '@prisma/client';
import { lastValueFrom } from 'rxjs';
import { IAppConfig } from 'src/__shared__/interfaces';
import { IPagination } from 'src/__shared__/interfaces/pagination-interface';
import { paginate } from 'src/__shared__/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CapturePaymentDto, CreatePaymentDto, FilterPaymentsDto } from './dto';
import { PayPalCaptureResponse, PayPalOrderResponse } from './interface';
import { PayPalConfigService } from './paypal.config';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private paypalConfig: PayPalConfigService,
    private readonly config: ConfigService<IAppConfig>,
    private readonly httpService: HttpService,
  ) {}

  async createPayment(createPaymentDto: CreatePaymentDto & { userId: string }) {
    this.logger.log(`Creating payment for user: ${createPaymentDto.userId}`);

    // Validate input
    if (createPaymentDto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    if (createPaymentDto.amount > 10000) {
      throw new BadRequestException('Payment amount cannot exceed $10,000');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: createPaymentDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId: createPaymentDto.userId,
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency || 'USD',
        status: EPaymentStatus.PENDING,
        paymentMethod: EPaymentMethod.PAYPAL,
        description: createPaymentDto.description,
      },
      include: { user: true },
    });

    this.logger.log(`Payment created with ID: ${payment.id}`);

    try {
      const paypalOrder = await this.createPayPalOrder({
        amount: createPaymentDto.amount.toString(),
        currency: createPaymentDto.currency || 'USD',
        description: createPaymentDto.description || 'Purchase',
        referenceId: payment.id,
      });

      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paypalOrderId: paypalOrder.id },
        include: { user: true },
      });

      return {
        payment: updatedPayment,
        paypalOrder,
        approvalUrl: paypalOrder.links.find((link) => link.rel === 'approve')
          ?.href,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create PayPal order: ${error.message}`,
        error.stack,
      );
      await this.prisma.payment.delete({
        where: { id: payment.id },
      });
      throw new InternalServerErrorException(
        `Failed to create PayPal order: ${error.message}`,
      );
    }
  }

  async capturePayment(
    capturePaymentDto: CapturePaymentDto & { userId: string },
  ) {
    this.logger.log(
      `Capturing payment for order: ${capturePaymentDto.paypalOrderId}`,
    );

    if (!capturePaymentDto.paypalOrderId) {
      throw new BadRequestException('PayPal order ID is required');
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        paypalOrderId: capturePaymentDto.paypalOrderId,
        userId: capturePaymentDto.userId,
        status: EPaymentStatus.PENDING,
      },
      include: { user: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found or already processed');
    }

    try {
      const captureResponse = await this.capturePayPalOrder(
        capturePaymentDto.paypalOrderId,
      );

      const isCompleted = captureResponse.status === EPaymentStatus.COMPLETED;
      const transactionId = isCompleted
        ? captureResponse.purchase_units[0]?.payments?.captures[0]?.id
        : null;

      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: isCompleted
            ? EPaymentStatus.COMPLETED
            : EPaymentStatus.FAILED,
          transactionId,
          updatedAt: new Date(),
        },
        include: { user: true },
      });

      return {
        payment: updatedPayment,
        captureResponse,
        success: isCompleted,
      };
    } catch (error) {
      this.logger.error(
        `Failed to capture payment: ${error.message}`,
        error.stack,
      );
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: EPaymentStatus.FAILED,
          updatedAt: new Date(),
        },
      });

      throw new BadRequestException(
        `Failed to capture payment: ${error.message}`,
      );
    }
  }

  private async createPayPalOrder(orderData: {
    amount: string;
    currency: string;
    description: string;
    referenceId: string;
  }): Promise<PayPalOrderResponse> {
    const accessToken = await this.paypalConfig.getAccessToken();

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: orderData.referenceId,
          amount: {
            currency_code: orderData.currency,
            value: orderData.amount,
          },
          description: orderData.description,
        },
      ],
      application_context: {
        return_url: `${this.config.get('frontedUrl')}/payment/success`,
        cancel_url: `${this.config.get('frontedUrl')}/payment/cancel`,
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: this.config.get('payPal').brandName,
      },
    };

    const response = await lastValueFrom(
      this.httpService.post(
        `${this.paypalConfig.getBaseUrl()}/v2/checkout/orders`,
        orderPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    if (response.status < 200 || response.status >= 300) {
      this.logger.error(
        `PayPal Order Creation Failed: ${JSON.stringify(response.data)}`,
      );
      throw new Error(
        `PayPal order creation failed: ${
          response.data?.message || 'Unknown error'
        }`,
      );
    }

    return response.data as PayPalOrderResponse;
  }

  private async capturePayPalOrder(
    orderId: string,
  ): Promise<PayPalCaptureResponse> {
    const accessToken = await this.paypalConfig.getAccessToken();

    const response = await lastValueFrom(
      this.httpService.post(
        `${this.paypalConfig.getBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
        {}, // Empty body for capture endpoint
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    if (response.status < 200 || response.status >= 300) {
      this.logger.error(
        `PayPal Capture Failed: ${JSON.stringify(response.data)}`,
      );

      if (response.status === 404) {
        throw new Error(
          'PayPal order not found - it may have expired or been processed already',
        );
      } else if (response.status === 422) {
        throw new Error('PayPal order cannot be captured - check order status');
      } else {
        throw new Error(
          `PayPal capture failed: ${response.data?.message || 'Unknown error'}`,
        );
      }
    }

    return response.data;
  }

  async getPaymentsByUserId(
    userId: string,
    { page, size }: IPagination,
    dto?: FilterPaymentsDto,
  ) {
    const whereConditions: Prisma.PaymentWhereInput = {
      userId,
    };

    if (dto?.status) {
      whereConditions.status = dto.status as EPaymentStatus;
    }

    const result = await paginate(
      this.prisma.payment,
      {
        where: whereConditions,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      },
      page,
      size,
    );

    return result;
  }

  async getPaymentById(id: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, userId },
      include: { user: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async cancelPayment(id: string, userId: string) {
    this.logger.log(`Cancelling payment: ${id} for user: ${userId}`);

    const payment = await this.prisma.payment.findFirst({
      where: { id, userId, status: EPaymentStatus.PENDING },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found or already processed');
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: {
        status: EPaymentStatus.CANCELLED,
        updatedAt: new Date(),
      },
      include: { user: true },
    });

    this.logger.log(`Payment ${id} cancelled successfully`);
    return updatedPayment;
  }
}
