import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class RegisterBoxDto {
  @IsNotEmpty()
  @ApiProperty({ type: String, required: true, default: '123cfvdxcsdr676767' })
  serialNumber: string;
  @IsNotEmpty()
  @IsArray()
  @ApiProperty({ type: Array, required: true })
  photoProof: Array<string>;
}
