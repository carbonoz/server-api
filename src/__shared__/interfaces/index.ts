export interface IAppConfig {
  port?: number;
  databaseUrl: string;
  env?: any;
  jwt?: JwtConfig;
  swaggerEnabled?: boolean;
  redex?: IRedexConfig;
  frontedUrl: string;
  admin: amdinConfig;
  carbonDensityUrl: string;
  payPal?: {
    clientId: string;
    clientSecret: string;
    brandName?: string;
    webhookUrl?: string;
    webhookId?: string;
  };
}

interface JwtConfig {
  secret: string;
}

interface IRedexConfig {
  url: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
}

interface amdinConfig {
  email: string;
  password: string;
}
