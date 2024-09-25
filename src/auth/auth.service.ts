import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon from 'argon2';
import axios from 'axios';
import { IAppConfig } from 'src/__shared__/interfaces';
import { EventService } from 'src/event/event.service';
import { MailsService } from 'src/mails/mails.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto, LoginUserDto, VerifyUserDto } from './dto';
import { JwtPayload } from './interfaces';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly Jwt: JwtService,
    private readonly config: ConfigService<IAppConfig>,
    private readonly eventBus: EventService,
    private readonly mail: MailsService,
  ) {}

  public generateToken(
    user: User,
    userPort?: string,
    verification?: boolean,
  ): { data: { user: User; token: string } } | string {
    const { id, role, email } = user;

    const token = this.Jwt.sign(
      { id, role, email, userPort },
      { secret: this.config.get('jwt').secret },
    );
    delete user.password;
    this.eventBus.publish({ type: 'userLoggedIn', payload: user });

    if (verification) {
      return token;
    }
    return {
      data: {
        user,
        token,
      },
    };
  }

  async convertImageToBase64(url: string): Promise<string> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(response.data, 'binary').toString('base64');
    return base64Image;
  }

  public async sendEmail(
    user: User,
    token: { data: { user: User; token: string } } | string,
  ) {
    const verificationUrl = `${this.config.get(
      'frontedUrl',
    )}/verify-email?token=${token}`;
    const url =
      'https://res.cloudinary.com/akashi/image/upload/v1726671139/1_wmbtla.jpg';

    const imageBase64 = await this.convertImageToBase64(url);

    const result = await this.mail.sendMail(
      `${user.email}`,
      `Confirm email`,
      '"No Reply" <solar-autopilot@carbonoz.com>',
      {
        username: user.email,
        verificationUrl,
      },
      './conformation.template.hbs',
      [
        {
          filename: 'image.png',
          content: Buffer.from(imageBase64, 'base64'),
          contentDisposition: 'inline',
          cid: 'logo@carbonoz',
        },
      ],
    );
    return result;
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
    const token = this.generateToken(user, null, true);
    return await this.sendEmail(user, token);
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

      if (user.active === false) {
        const tokenData = this.generateToken(user, userPort?.port, true);
        const message = await this.sendEmail(user, tokenData);
        return {
          data: {
            message,
            user,
          },
        };
      }
      return this.generateToken(user, userPort?.port);
    }
  }

  async verifyUser(dto: VerifyUserDto) {
    try {
      const payload: JwtPayload = this.Jwt.verify(dto.token, {
        secret: this.config.get('jwt').secret,
      });
      const user = await this.prismaService.user.findUnique({
        where: { email: payload.email },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const newUser = await this.prismaService.user.update({
        where: { email: payload.email },
        data: { active: true },
      });
      return this.generateToken(newUser);
    } catch (error) {
      throw new BadRequestException('Invalid or expired token');
    }
  }
}
