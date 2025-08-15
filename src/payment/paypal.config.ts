import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Environment, LogLevel } from '@paypal/paypal-server-sdk';
import { lastValueFrom } from 'rxjs';
import { IAppConfig } from 'src/__shared__/interfaces';

@Injectable()
export class PayPalConfigService {
  private readonly logger = new Logger(PayPalConfigService.name);
  private client: Client;

  constructor(
    private readonly config: ConfigService<IAppConfig>,
    private readonly httpService: HttpService,
  ) {
    this.initializeClient();
  }

  private initializeClient(): void {
    const clientId = this.config.get('payPal').clientId;
    const clientSecret = this.config.get('payPal').clientSecret;
    const environment =
      process.env.NODE_ENV === 'production'
        ? Environment.Production
        : Environment.Sandbox;

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials are not configured');
    }

    this.client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      timeout: 30000,
      environment,
      logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
      },
    });

    this.logger.log(
      `PayPal client initialized for ${
        environment === Environment.Production ? 'production' : 'sandbox'
      } environment`,
    );
  }

  getClient(): Client {
    return this.client;
  }

  getEnvironment(): string {
    return process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
  }

  getBaseUrl(): string {
    return this.getEnvironment() === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  getCredentials(): { clientId: string; clientSecret: string } {
    const paypalConfig = this.config.get('payPal');
    return {
      clientId: paypalConfig.clientId,
      clientSecret: paypalConfig.clientSecret,
    };
  }

  async getAccessToken(): Promise<string> {
    const { clientId, clientSecret } = this.getCredentials();

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials are missing');
    }

    if (clientId.length < 10 || clientSecret.length < 10) {
      throw new Error('PayPal credentials appear to be invalid');
    }

    const auth = Buffer.from(
      `${clientId.trim()}:${clientSecret.trim()}`,
    ).toString('base64');

    try {
      const response = await lastValueFrom(
        this.httpService.post(
          `${this.getBaseUrl()}/v1/oauth2/token`,
          'grant_type=client_credentials',
          {
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      this.logger.log('PayPal access token obtained successfully');
      return response.data.access_token;
    } catch (error) {
      this.logger.error(
        'PayPal access token error:',
        error.response?.data || error.message,
      );

      if (error.response?.status === 401) {
        throw new Error('PayPal authentication failed - check credentials');
      } else if (error.response?.status >= 500) {
        throw new Error('PayPal service temporarily unavailable');
      } else {
        throw new Error(`PayPal authentication error: ${error.message}`);
      }
    }
  }
}
