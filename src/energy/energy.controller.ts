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

  @ApiOkResponse({
    description: 'energy data for last 30 days retrieved successfully',
  })
  @HttpCode(200)
  @ApiOperation({ summary: 'energy data for last 30 days ' })
  @Get('total/30')
  async topicsForlast30Days(@GetUser() user: User) {
    const result = await this.energyService.getTotalsEnergyLast30Days(user);
    return new GenericResponse('energy-data for 30 days', result);
  }
  @ApiOkResponse({
    description: 'energy data for last 12 months retrieved successfully',
  })
  @HttpCode(200)
  @ApiOperation({ summary: 'energy data for last 12 months ' })
  @Get('total/12')
  async topicsForlast12Months(@GetUser() user: User) {
    const result = await this.energyService.getTotalsEnergyLast12Months(user);
    return new GenericResponse('energy-data for last 12 months', result);
  }

  @ApiOkResponse({
    description: 'energy data for last 10 years retrieved successfully',
  })
  @HttpCode(200)
  @ApiOperation({ summary: 'energy data for last 10 years ' })
  @Get('total/year/10')
  async topicsForlastTenYears(@GetUser() user: User) {
    const result = await this.energyService.getTotalsEnergyLast10Years(user);
    return new GenericResponse('energy-data for last 10 years', result);
  }
}
