import { ApiProperty } from '@nestjs/swagger';
import { EFuelType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class RegisterUserAssetsDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    required: true,
    default: 'BBox',
  })
  assetName: string;
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    required: true,
    default: 'Carbonoz',
  })
  assetOwner: string;
  @IsNotEmpty()
  @IsEnum(EFuelType)
  @ApiProperty({ required: true, enum: EFuelType })
  fuelType: EFuelType;
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    required: true,
    default: 'Rwanda',
  })
  country: string;
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    required: true,
    default: 'KG v6 201N',
  })
  address: string;
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    type: Number,
    required: true,
    default: -33333342323211,
  })
  latitude: number;
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    type: Number,
    required: true,
    default: 33333342323211,
  })
  longitude: number;
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    type: Number,
    required: true,
    default: 24,
  })
  capacity: number;
}
