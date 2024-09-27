import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import * as argon from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { resetPasswordDto } from './dto';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async resetPassword(dto: resetPasswordDto, user: User) {
    const password = await argon.hash(dto.password);
    dto.password = password;
    const newUser = await this.prismaService.user.update({
      where: {
        email: user.email,
      },
      data: {
        password: dto.password,
      },
    });
    return newUser;
  }
}
