import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ERole, User } from '@prisma/client';
import { Request } from 'express';
import { GenericResponse } from 'src/__shared__/dto';
import { IPagination } from 'src/__shared__/interfaces/pagination-interface';
import {
  AllowRoles,
  GetUser,
  PageResponse,
  Paginated,
  PaginationParams,
} from '../auth/decorators';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { CapturePaymentDto, CreatePaymentDto, FilterPaymentsDto } from './dto';
import { PaymentService } from './payment.service';
import { WebhookService } from './webhook.service';

@Controller('payment')
@ApiTags('payment')
@ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly webhookService: WebhookService,
  ) {}

  @ApiCreatedResponse({
    description: 'Payment created successfully',
    type: GenericResponse,
  })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Post('create')
  @AllowRoles(ERole.USER)
  @ApiBody({ type: CreatePaymentDto })
  @ApiOperation({ summary: 'Create a new payment' })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @GetUser() user: User,
  ) {
    const paymentData = { ...createPaymentDto, userId: user.id };
    const result = await this.paymentService.createPayment(paymentData);
    return new GenericResponse('payment created', result);
  }

  @ApiOkResponse({
    description: 'Payment captured successfully',
    type: GenericResponse,
  })
  @ApiBadRequestResponse({ description: 'Failed to capture payment' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Post('capture')
  @AllowRoles(ERole.USER)
  @ApiBody({ type: CapturePaymentDto })
  @ApiOperation({ summary: 'Capture a PayPal payment' })
  @HttpCode(200)
  async capturePayment(
    @Body() capturePaymentDto: CapturePaymentDto,
    @GetUser() user: User,
  ) {
    const captureData = { ...capturePaymentDto, userId: user.id };
    const result = await this.paymentService.capturePayment(captureData);
    return new GenericResponse('payment captured', result);
  }

  @ApiOkResponse({
    description: 'User payments retrieved successfully',
    type: GenericResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Get('user-payments')
  @AllowRoles(ERole.USER)
  @ApiOperation({ summary: 'Get all payments for the authenticated user' })
  @HttpCode(200)
  @PageResponse()
  @Paginated()
  async getUserPayments(
    @GetUser() user: User,
    @PaginationParams() options: IPagination,
    @Query() dto: FilterPaymentsDto,
  ) {
    const result = await this.paymentService.getPaymentsByUserId(
      user.id,
      options,
      dto,
    );
    return new GenericResponse('user payments', result);
  }

  @ApiOkResponse({
    description: 'Payment retrieved successfully',
    type: GenericResponse,
  })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Get(':id')
  @AllowRoles(ERole.USER)
  @ApiOperation({ summary: 'Get a specific payment by ID' })
  @HttpCode(200)
  async getPaymentById(@Param('id') id: string, @GetUser() user: User) {
    const result = await this.paymentService.getPaymentById(id, user.id);
    return new GenericResponse('payment details', result);
  }

  @ApiOkResponse({
    description: 'Payment cancelled successfully',
    type: GenericResponse,
  })
  @ApiNotFoundResponse({
    description: 'Payment not found or already processed',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Put(':id/cancel')
  @AllowRoles(ERole.USER)
  @ApiOperation({ summary: 'Cancel a pending payment' })
  @HttpCode(200)
  async cancelPayment(@Param('id') id: string, @GetUser() user: User) {
    const result = await this.paymentService.cancelPayment(id, user.id);
    return new GenericResponse('payment cancelled', result);
  }

  @ApiOkResponse({ description: 'Webhook processed successfully' })
  @ApiBadRequestResponse({
    description: 'Invalid webhook signature or payload',
  })
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'PayPal webhook endpoint for payment status updates',
  })
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const rawBody = req.body;
    const payload = rawBody.toString();
    const headers = req.headers as Record<string, string>;

    let event;
    try {
      event = JSON.parse(payload);
    } catch (error) {
      this.logger.error('Invalid JSON payload in webhook:', error.message);
      throw new BadRequestException('Invalid JSON payload');
    }

    this.logger.log(
      `Received webhook event: ${event.event_type} (${event.id})`,
    );

    await this.webhookService.processWebhook(event, payload, headers);

    return { status: 'success', eventId: event.id };
  }

  @ApiOkResponse({
    description: 'Webhook events retrieved successfully',
    type: GenericResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Get('webhooks/events')
  @AllowRoles(ERole.ADMIN, ERole.SUB_ADMIN)
  @ApiOperation({ summary: 'Get webhook events (admin only)' })
  @HttpCode(200)
  async getWebhookEvents(@Query('paymentId') paymentId?: string) {
    const result = await this.webhookService.getWebhookEvents(paymentId);
    return new GenericResponse('webhook events', result);
  }

  @ApiOkResponse({
    description: 'Webhook retry successful',
    type: GenericResponse,
  })
  @ApiNotFoundResponse({ description: 'Webhook event not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Post('webhooks/:eventId/retry')
  @AllowRoles(ERole.ADMIN, ERole.SUB_ADMIN)
  @ApiOperation({ summary: 'Retry failed webhook processing (admin only)' })
  @HttpCode(200)
  async retryWebhook(@Param('eventId') eventId: string) {
    await this.webhookService.retryFailedWebhook(eventId);
    return new GenericResponse('webhook retry successful', null);
  }
}
