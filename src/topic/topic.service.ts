import { Injectable } from '@nestjs/common';
import { Topic, User } from '@prisma/client';
import { Subject } from 'rxjs';
import { EventService } from 'src/event/event.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTopicDto } from './dto';

@Injectable()
export class TopicService {
  private readonly topicCreatedSubject = new Subject<void>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventService: EventService,
  ) {}

  onTopicCreated() {
    return this.topicCreatedSubject.asObservable();
  }

  async createTopic(dto: CreateTopicDto, user: User): Promise<Topic> {
    const topic = await this.prismaService.topic.create({
      data: {
        topicName: dto.topicName,
        userId: user.id,
      },
    });
    this.topicCreatedSubject.next();
    return topic;
  }

  async listTopics(user: User): Promise<Topic> {
    const topics = await this.prismaService.topic.findFirst({
      where: {
        userId: user.id,
      },
    });
    return topics;
  }
}
