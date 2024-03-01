import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prismaService: PrismaService) {}

  async sendTopics(socket: Socket): Promise<void> {
    const topics = await this.prismaService.topic.findMany();
    socket.emit('topics', topics);
  }
}
