import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { MailsService } from 'src/mails/mails.service';

@Injectable()
export class UserService {
  constructor(private readonly mail: MailsService) {}
  async sendMail(user: User) {
    const result = await this.mail.sendMail(
      `${user.email}`,
      `Confirm email`,
      '"No Reply" solar-autopilot@carbonoz.com',
      {
        username: 'Akashi',
        password: '1234',
      },
      './conformation.template.hbs',
    );
    return result;
  }
}
