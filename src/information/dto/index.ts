import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RegisterUserInfoDto {
  @ApiPropertyOptional({ type: String, default: 'Engineer' })
  @IsOptional()
  @IsString()
  jobTitle: string;
  @ApiPropertyOptional({ type: String, default: 'Akashi chris' })
  @IsOptional()
  @IsString()
  names: string;
  @ApiPropertyOptional({ type: String, default: 'KG 67' })
  @IsOptional()
  @IsString()
  address: string;
  @ApiPropertyOptional({ type: String, default: '00000' })
  @IsOptional()
  @IsString()
  postalCode: string;
  @ApiPropertyOptional({ type: String, default: 'KIgali' })
  @IsOptional()
  @IsString()
  city: string;
  @ApiPropertyOptional({ type: String, default: 'Rwanda' })
  @IsOptional()
  @IsString()
  country: string;
  @ApiPropertyOptional({ type: String, default: '+250781273704' })
  @IsOptional()
  @IsString()
  phone: string;
}
