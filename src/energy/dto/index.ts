import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class FilterTimeEnergyDTO {
  @IsOptional()
  @ApiPropertyOptional({ type: String, default: '12/01/2018' })
  from: string;
  @IsOptional()
  @ApiPropertyOptional({
    type: String,
    default: '12/01/2020',
  })
  to: string;
}
