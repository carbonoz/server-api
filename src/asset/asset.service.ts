import { Injectable } from '@nestjs/common';
import { User, UserAssetInformation } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserAssetsDto } from './dto';

@Injectable()
export class AssetService {
  constructor(private prismaService: PrismaService) {}

  async registerAssets(
    dto: RegisterUserAssetsDto,
    user: User,
  ): Promise<UserAssetInformation> {
    return await this.prismaService.userAssetInformation.create({
      data: {
        userId: user.id,
        ...dto,
      },
    });
  }

  async getAllAssets(user: User): Promise<Array<UserAssetInformation>> {
    return await this.prismaService.userAssetInformation.findMany({
      where: {
        userId: user.id,
      },
    });
  }
}
