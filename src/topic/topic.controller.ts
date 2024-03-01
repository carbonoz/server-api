import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ERole, User } from '@prisma/client';
import { GenericResponse } from 'src/__shared__/dto';
import { AllowRoles, GetUser } from 'src/auth/decorators';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { CreateTopicDto } from './dto';
import { TopicService } from './topic.service';

@Controller('topic')
@ApiTags('topic')
@UseGuards(JwtGuard, RolesGuard)
@AllowRoles(ERole.USER)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @ApiOkResponse({ description: 'topics retrieved successfully' })
  @HttpCode(200)
  @Get('topic')
  async topics(@GetUser() user: User) {
    const result = await this.topicService.listTopics(user);
    return new GenericResponse('notifications', result);
  }

  @ApiCreatedResponse({ description: 'topic created successfully' })
  @ApiBody({ type: CreateTopicDto })
  @Post('topic')
  async topic(@Body() dto: CreateTopicDto, @GetUser() user: User) {
    const result = await this.topicService.createTopic(dto, user);
    return new GenericResponse('notified', result);
  }
}
