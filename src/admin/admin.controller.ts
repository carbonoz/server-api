import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiRequestTimeoutResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ERole } from '@prisma/client';
import { GenericResponse } from 'src/__shared__/dto';
import { IPagination } from 'src/__shared__/interfaces/pagination-interface';
import { AuthService } from 'src/auth/auth.service';
import {
  AllowRoles,
  PageResponse,
  Paginated,
  PaginationParams,
} from 'src/auth/decorators';
import { CreateUserDto } from 'src/auth/dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { AdminService } from './admin.service';
import { DeactivateUsersDto, FilterUsers } from './dto';

@Controller('admin')
@ApiTags('admin')
@UseGuards(JwtGuard, RolesGuard)
@AllowRoles(ERole.ADMIN)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
@ApiRequestTimeoutResponse({ description: 'Internet Error' })
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminService: AdminService,
  ) {}

  @ApiOkResponse({
    description: 'user additional assets retrieved successfully',
  })
  @HttpCode(200)
  @PageResponse()
  @Paginated()
  @ApiOperation({ summary: 'admin fetch all users' })
  @Get('users')
  async getAllUsers(
    @PaginationParams() options: IPagination,
    @Query() dto: FilterUsers,
  ) {
    const result = await this.adminService.getUsers(options, dto);
    return new GenericResponse('users', result);
  }

  @ApiCreatedResponse({ description: 'Admin  created User successfully' })
  @ApiOperation({ summary: 'Admin do user registration' })
  @ApiConflictResponse({ description: 'User already exists' })
  @ApiBody({ type: CreateUserDto })
  @Post('sign-users')
  async addUser(@Body() dto: CreateUserDto) {
    const result = await this.authService.createUser(dto);
    return new GenericResponse('user created', result);
  }

  @ApiOkResponse({
    description: 'Admin  activated or deactivated User successfully',
  })
  @ApiOperation({ summary: 'Admin activate or deactivate users' })
  @ApiBody({ type: DeactivateUsersDto })
  @HttpCode(200)
  @Patch('toogle-activation')
  async toogleActivation(@Body() dto: DeactivateUsersDto) {
    const result = await this.adminService.toogleUsersActivation(dto);
    return new GenericResponse('', result);
  }
}
