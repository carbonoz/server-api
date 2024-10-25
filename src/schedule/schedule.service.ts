import { Injectable, OnModuleInit } from '@nestjs/common';
import * as schedule from 'node-schedule';

@Injectable()
export class ScheduleService implements OnModuleInit {
  onModuleInit() {
    schedule.scheduleJob('*/5 * * * * *', () => {
      // this.runEveryFiveSeconds();
    });
  }

  private runEveryFiveSeconds() {
    console.log('Task is running every 5 seconds...');
  }
}
