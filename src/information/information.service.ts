import { ConflictException, Injectable } from '@nestjs/common';
import { User, UserAdditionalInformation } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserInfoDto } from './dto';

@Injectable()
export class InformationService {
  constructor(private readonly prismaService: PrismaService) {}

  async createAdditionalInformation(
    dto: RegisterUserInfoDto,
    user: User,
  ): Promise<UserAdditionalInformation> {
    const isInfoThere =
      await this.prismaService.userAdditionalInformation.findFirst({
        where: {
          userId: user.id,
        },
      });

    if (isInfoThere) {
      throw new ConflictException('Information  already exists for this user');
    } else {
      return await this.prismaService.userAdditionalInformation.create({
        data: {
          userId: user.id,
          ...dto,
        },
      });
    }
  }

  async getAdditionalInformation(
    user: User,
  ): Promise<UserAdditionalInformation> {
    return await this.prismaService.userAdditionalInformation.findFirst({
      where: {
        userId: user.id,
      },
    });
  }
}
