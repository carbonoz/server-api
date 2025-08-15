import { Module } from '@nestjs/common';
import { DensityController } from './density.controller';
import { DensityService } from './density.service';

@Module({
  providers: [DensityService],
  controllers: [DensityController],
})
export class DensityModule {}
