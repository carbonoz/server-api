import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { ERole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const AllowRoles = (...roles: ERole[]) => SetMetadata(ROLES_KEY, roles);

export const GetUser = createParamDecorator(
  (_data, ctx: ExecutionContext): any => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
