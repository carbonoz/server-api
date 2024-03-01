import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { User } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { EventService } from 'src/event/event.service';
import { TopicService } from 'src/topic/topic.service';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: ['http:localhost:8000'] } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private user: User;

  constructor(
    private readonly chatService: ChatService,
    private readonly topicService: TopicService,
    private readonly eventBus: EventService,
    private readonly authService: AuthService,
  ) {
    this.topicService.onTopicCreated().subscribe(({ user }) => {
      this.refreshDatabase(user);
    });
  }

  @WebSocketServer() server: Server;

  async handleConnection(socket: Socket) {
    this.eventBus.subscribe(async (event) => {
      if (event.type === 'userLoggedIn') {
        if (event.payload) {
          console.log('CONNECTION SUCCESS from server 1');
          await this.refreshDatabase(event.payload, socket);
        } else {
          this.handleDisconnect();
        }
      }
    });
  }

  handleDisconnect() {
    console.log('CONNECTION REMOVED');
  }

  async refreshDatabase(user?: User, socket?: Socket) {
    console.log('Refreshing database...');
    const topics = await this.topicService.listTopics(user);
    if (socket) {
      socket.emit('topics', topics);
    } else {
      this.server.emit('topics', topics);
    }
  }
}
