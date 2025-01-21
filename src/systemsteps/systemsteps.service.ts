import { Injectable } from '@nestjs/common';
import { ESteps, SystemSteps, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterSystemStep } from './dto';

@Injectable()
export class SystemstepsService {
  constructor(private readonly prismaService: PrismaService) {}

  async registerStep(
    dto: RegisterSystemStep,
    user: User,
  ): Promise<SystemSteps> {
    if (dto.step === ESteps.LAST_STEP) {
      return await this.prismaService.systemSteps.create({
        data: {
          ...dto,
          userId: user.id,
          status: true,
        },
      });
    } else {
      return await this.prismaService.systemSteps.create({
        data: {
          ...dto,
          userId: user.id,
        },
      });
    }
  }

  async getUserStep(user: User): Promise<Array<SystemSteps>> {
    return await this.prismaService.systemSteps.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
