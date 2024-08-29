import { Injectable } from '@nestjs/common';
import { Box, User, UserPorts } from '@prisma/client';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterBoxDto } from './dto';

@Injectable()
export class BoxService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async registerBox(
    dto: RegisterBoxDto,
    user: User,
  ): Promise<{
    data: { user: User; token: string };
  }> {
    await this.prismaService.box.create({
      data: {
        userId: user.id,
        serialNumber: dto.serialNumber,
        photoProof: dto.photoProof,
      },
    });
    const userPort = await this.prismaService.userPorts.create({
      data: {
        userId: user.id,
        port: dto.mqttIpAddress,
        mqttUsername: dto.mqttUsername,
        mqttPassword: dto.mqttPassword,
        mqttPort: dto.mqttPort,
      },
    });
    return this.authService.generateToken(user, userPort.port);
  }

  async getBoxesRegistered(user: User): Promise<Array<Box>> {
    const boxes = await this.prismaService.box.findMany({
      where: {
        userId: user.id,
      },
    });
    return boxes;
  }

  async getUserPorts(user: User): Promise<Array<UserPorts>> {
    const userPorts = await this.prismaService.userPorts.findMany({
      where: {
        userId: user.id,
      },
    });
    return userPorts;
  }
}
