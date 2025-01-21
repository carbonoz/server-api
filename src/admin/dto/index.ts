import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { EUserStatus } from 'src/__shared__/enums';

export class FilterUsers {
  @IsOptional()
  @IsEnum(EUserStatus)
  @ApiPropertyOptional({ required: false, enum: EUserStatus })
  status: EUserStatus;
}

export class DeactivateUsersDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @ApiProperty({
    type: [String],
    required: true,
    default: ['user1', 'user2'],
  })
  userIds: string[];
  @IsOptional()
  @IsEnum(EUserStatus)
  @ApiPropertyOptional({ required: false, enum: EUserStatus })
  status: EUserStatus;
}

export class AdminSignUserDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    required: true,
    default: 'christiannseko@gmail.com',
  })
  email: string;
}
