export interface IAppConfig {
  port?: number;
  databaseUrl: string;
  env?: any;
  jwt?: JwtConfig;
  swaggerEnabled?: boolean;
}

interface JwtConfig {
  secret: string;
}
