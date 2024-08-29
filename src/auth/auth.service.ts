import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon from 'argon2';
import { IAppConfig } from 'src/__shared__/interfaces';
import { EventService } from 'src/event/event.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto, LoginUserDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly Jwt: JwtService,
    private readonly config: ConfigService<IAppConfig>,
    private readonly eventBus: EventService,
  ) {}

  public generateToken(
    user: User,
    userPort?: string,
  ): {
    data: { user: User; token: string };
  } {
    const { id, role, email } = user;
    const token = this.Jwt.sign(
      { id, role, email, userPort },
      { secret: this.config.get('jwt').secret },
    );
    delete user.password;
    this.eventBus.publish({ type: 'userLoggedIn', payload: user });
    return {
      data: {
        user,
        token,
      },
    };
  }

  async createUser(dto: CreateUserDto) {
    const userExist = await this.prismaService.user.findFirst({
      where: { email: dto.email },
    });
    if (userExist)
      throw new ConflictException('User with this email already exists');
    const password = await argon.hash(dto.password);
    dto.password = password;
    const user = await this.prismaService.user.create({
      data: {
        ...dto,
      },
    });

    return this.generateToken(user);
  }

  async loginUser(dto: LoginUserDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    else if (!(await argon.verify(user.password, dto.password))) {
      throw new ForbiddenException('Wrong User password');
    } else {
      const userPort = await this.prismaService.userPorts.findFirst({
        where: {
          userId: user.id,
        },
      });
      return this.generateToken(user, userPort?.port);
    }
  }
}
