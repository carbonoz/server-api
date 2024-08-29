import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { addDays, startOfDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import * as FormData from 'form-data';
import { lastValueFrom } from 'rxjs';
import { IAppConfig } from 'src/__shared__/interfaces';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedexAuthResponse, RedexFileUplaodResponse } from './interface';

@Injectable()
export class RedexService {
  private readonly logger = new Logger(RedexService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<IAppConfig>,
  ) {}

  async generateRedexToken() {
    const body = {
      GrantType: 'api_key',
      ApiKey: this.configService.get('redex').apiKey,
      ClientId: this.configService.get('redex').clientId,
      ClientSecret: this.configService.get('redex').clientSecret,
    };

    try {
      const authResponse = (
        await lastValueFrom(
          this.httpService.post<RedexAuthResponse>(
            `${this.configService.get('redex').url}/connect/token`,
            body,
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          ),
        )
      ).data;
      return authResponse.Data.AccessToken;
    } catch (error) {
      this.logger.error('Error generating Redex token', error);
      if (error.response) {
        this.logger.error('Error response data:', error.response.data);
        this.logger.error('Error response status:', error.response.status);
        this.logger.error('Error response headers:', error.response.headers);
      } else if (error.request) {
        this.logger.error('No response received:', error.request);
      } else {
        this.logger.error('Axios error:', error.message);
      }
      throw new BadRequestException({
        message: 'Failed to generate Redex token',
        error: error.message,
      });
    }
  }

  async uplaodFile(file: Express.Multer.File, user: User) {
    const token = await this.generateRedexToken();
    const formData = new FormData();
    formData.append('File', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const headers = {
      ...formData.getHeaders(),
      Authorization: `Bearer ${token}`,
    };

    try {
      const response = (
        await lastValueFrom(
          this.httpService.post<RedexFileUplaodResponse>(
            `${this.configService.get('redex').url}/documents/devices`,
            formData,
            { headers },
          ),
        )
      ).data;
      const redexInfo = await this.prismaService.redexInformation.create({
        data: {
          userId: user.id,
          redexFileId: response.Data.Id,
          ValidationCode: response.Data.ValidationCode,
        },
      });
      return redexInfo;
    } catch (error) {
      this.logger.error('Error uplaoding Redex file', error);
      if (error.response) {
        this.logger.error('Error response data:', error.response.data);
        this.logger.error('Error response status:', error.response.status);
        this.logger.error('Error response headers:', error.response.headers);
      } else if (error.request) {
        this.logger.error('No response received:', error.request);
      } else {
        this.logger.error('Axios error:', error.message);
      }
      throw new BadRequestException({
        message: 'Failed to upload file to  Redex',
        error: error.message,
      });
    }
  }

  async getTotals() {
    const timeZone = 'Indian/Mauritius';
    const normalizeDate = () => {
      const startOfDayInTimeZone = startOfDay(new Date());
      const formattedStartOfDay = formatInTimeZone(
        startOfDayInTimeZone,
        timeZone,
        "yyyy-MM-dd'T'HH:mm:ssXXX",
      );
      return formattedStartOfDay;
    };

    const date = normalizeDate();

    const users = await this.prismaService.user.findMany({
      include: {
        Box: true,
        UserPorts: true,
      },
    });
    const results = [];
    for (const user of users) {
      const { Box, UserPorts } = user;

      for (const port of UserPorts) {
        const totalEnergy = await this.prismaService.totalEnergy.findMany({
          where: {
            port: port.port,
            date: {
              gte: date,
              lt: addDays(new Date(date), 1).toISOString(),
            },
          },
          select: {
            pvPower: true,
            date: true,
          },
        });

        results.push({
          userId: user.id,
          serialNumber: Box.map((b) => b.serialNumber).join(', '),
          port: port.port,
          totalEnergy,
        });
      }
    }
    return results;
  }
}
