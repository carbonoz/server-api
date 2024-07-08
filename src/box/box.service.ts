import { Injectable } from '@nestjs/common';
import { Box, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterBoxDto } from './dto';

@Injectable()
export class BoxService {
  constructor(private readonly prismaService: PrismaService) {}

  async registerBox(dto: RegisterBoxDto, user: User): Promise<Box> {
    const box = await this.prismaService.box.create({
      data: {
        userId: user.id,
        serialNumber: dto.serialNumber,
        photoProof: dto.photoProof,
      },
    });
    return box;
  }

  async getBoxesRegistered(user: User): Promise<Array<Box>> {
    const boxes = await this.prismaService.box.findMany({
      where: {
        userId: user.id,
      },
    });
    return boxes;
  }
}
