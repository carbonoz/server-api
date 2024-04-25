import { Controller, Get, HttpCode, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ERole, User } from '@prisma/client';
import { GenericResponse } from 'src/__shared__/dto';
import { AllowRoles, GetUser } from 'src/auth/decorators';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { EnergyService } from './energy.service';

@Controller('energy')
@ApiTags('energy')
@UseGuards(JwtGuard, RolesGuard)
@AllowRoles(ERole.USER)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
export class EnergyController {
  constructor(private readonly energyService: EnergyService) {}

  @ApiOkResponse({ description: 'energy data retrieved successfully' })
  @HttpCode(200)
  @ApiOperation({ summary: 'user retrieve energy data for boxes' })
  @Get('energy-data')
  async topics(@GetUser() user: User) {
    const result = await this.energyService.getTotalsEnergy(user);
    return new GenericResponse('energy-data', result);
  }
}
