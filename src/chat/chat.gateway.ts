import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { EventService } from 'src/event/event.service';
import { TopicService } from 'src/topic/topic.service';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: ['http:localhost:8000'] } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly chatService: ChatService,
    private readonly topicService: TopicService,
    private readonly eventBus: EventService,
    private readonly authService: AuthService,
  ) {
    this.topicService.onTopicCreated().subscribe(({ user }) => {
      this.refreshDatabase();
    });
  }

  @WebSocketServer() server: Server;

  async handleConnection(socket: Socket) {
    this.eventBus.subscribe(async (event) => {
      if (event.type === 'userLoggedIn') {
        if (event.payload) {
          console.log('CONNECTION SUCCESS from server 1');
          await this.refreshDatabase(socket);
        } else {
          this.handleDisconnect();
        }
      }
    });
    this.refreshDatabase();
  }

  handleDisconnect() {
    console.log('CONNECTION REMOVED');
  }

  async refreshDatabase(socket?: Socket) {
    const topics = await this.topicService.listTopics();
    if (socket) {
      socket.emit('topics', topics);
    } else {
      this.server.emit('topics', topics);
    }
  }
}
