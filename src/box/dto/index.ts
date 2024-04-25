import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RegisterBoxDto {
  @IsNotEmpty()
  @ApiProperty({ type: String, required: true, default: '123cfvdxcsdr676767' })
  serialNumber: string;
  @IsNotEmpty()
  @ApiProperty({ type: String, required: true })
  photoProof: string;
}
