import { Injectable } from '@nestjs/common';
import { TotalEnergy, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EnergyService {
  constructor(private prismaService: PrismaService) {}

  async getTotalsEnergy(user: User): Promise<Array<TotalEnergy>> {
    const totals = await this.prismaService.totalEnergy.findMany({
      where: {
        userId: user.id,
      },
    });
    return totals;
  }
}
