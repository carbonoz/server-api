import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GenericResponse } from 'src/__shared__/dto';
import { RedexRegisterDeviceDto } from './interface';
import { RedexService } from './redex.service';

@Controller('redex')
@ApiTags('redex')
@ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
export class RedexController {
  constructor(private readonly redexService: RedexService) {}

  @ApiCreatedResponse({ description: 'token retrieved successfully' })
  @ApiOperation({ summary: 'redex token' })
  @Post('token')
  async token() {
    const result = await this.redexService.generateRedexToken();
    return new GenericResponse('redex token', result);
  }

  @ApiOkResponse({ description: 'totals retrieved successfully' })
  @ApiOperation({ summary: 'totals' })
  @Get('totals')
  async getTotals() {
    const result = await this.redexService.getTotals();
    return new GenericResponse('totals', result);
  }

  @ApiCreatedResponse({ description: 'Device registered successfully' })
  @ApiOperation({ summary: 'register Devices' })
  @Post('device')
  @ApiBody({ type: RedexRegisterDeviceDto })
  async registerDevices(@Body() dto: RedexRegisterDeviceDto) {
    const result = await this.redexService.registerGroupDevice(dto);
    return new GenericResponse('Device registered', result);
  }

  // @ApiOkResponse({ description: 'reports' })
  // @ApiOperation({ summary: 'monthly report' })
  // @Get('report')
  // async getMonthlyReport() {
  //   const result = await this.redexService.getMonthlyData();
  //   return new GenericResponse('Device report', result);
  // }
}
