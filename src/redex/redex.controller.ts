import { Controller, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
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
}
