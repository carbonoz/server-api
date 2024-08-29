import { Controller, Get, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GenericResponse } from 'src/__shared__/dto';
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
}
