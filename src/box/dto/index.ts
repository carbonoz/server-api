import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class RegisterBoxDto {
  @IsNotEmpty()
  @ApiProperty({ type: String, required: true, default: '123cfvdxcsdr676767' })
  serialNumber: string;
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    required: true,
    default: '190.160.10.0',
  })
  mqttIpAddress: string;
  @IsNotEmpty()
  @IsArray()
  @ApiProperty({ type: Array, required: true })
  photoProof: Array<string>;
  @IsNotEmpty()
  @ApiProperty({ type: String, required: true, default: 'Akashi' })
  mqttUsername: string;
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    required: true,
    default: 'Password!3aqr34#$',
  })
  mqttPassword: string;
  @IsNotEmpty()
  @ApiProperty({ type: Number, required: true, default: 78 })
  mqttPort: number;
}
