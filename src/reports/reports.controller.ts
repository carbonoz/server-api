import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ERole, User } from '@prisma/client';
import { Response } from 'express';
import { AllowRoles, GetUser } from 'src/auth/decorators';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { EnergyService } from 'src/energy/energy.service';

@Controller('reports')
@ApiTags('reports')
@UseGuards(JwtGuard, RolesGuard)
@AllowRoles(ERole.USER)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
export class ReportsController {
  constructor(private readonly energyService: EnergyService) {}
  @Get('download/csv/7')
  async downloadCsv7days(@Res() res: Response, @GetUser() user: User) {
    const { file, fileName } =
      await this.energyService.generateCsvFileForLastSevenDays(user);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=${fileName}.csv`,
    });
    res.send(file);
  }

  @Get('download/csv/30')
  async downloadCsv30days(@Res() res: Response, @GetUser() user: User) {
    const { file, fileName } =
      await this.energyService.generateCsvFileForLast30Days(user);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=${fileName}.csv`,
    });
    res.send(file);
  }

  @Get('download/csv/12')
  async downloadCsv12Months(@Res() res: Response, @GetUser() user: User) {
    const { file, fileName } =
      await this.energyService.generateCsvFileForLast12Months(user);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=${fileName}.csv`,
    });
    res.send(file);
  }
}
