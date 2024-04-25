import { Module } from '@nestjs/common';
import { BoxController } from './box.controller';
import { BoxService } from './box.service';

@Module({
  controllers: [BoxController],
  providers: [BoxService]
})
export class BoxModule {}
