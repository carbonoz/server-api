import { Injectable } from '@nestjs/common';
import { ERole, Prisma, User } from '@prisma/client';
import { EUserStatus } from 'src/__shared__/enums';
import { IPagination } from 'src/__shared__/interfaces/pagination-interface';
import { paginate } from 'src/__shared__/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminSignUserDto, DeactivateUsersDto, FilterUsers } from './dto';
import { TransformedUser, UserTransformation } from './interface';

@Injectable()
export class AdminService {
  constructor(private readonly prismaService: PrismaService) {}

  async getUsers({ page, size }: IPagination, dto?: FilterUsers) {
    const status =
      dto.status === EUserStatus.ENABLED
        ? true
        : dto.status === EUserStatus.DISABLED
        ? false
        : true;

    const whereConditions: Prisma.UserWhereInput = {};

    if (dto?.status) {
      whereConditions.activeStatus = status;
    }

    const result = await paginate<User, Prisma.UserFindManyArgs>(
      this.prismaService.user,
      {
        orderBy: { createdAt: 'desc' },
        where: {
          role: {
            not: ERole.ADMIN,
          },
          ...whereConditions,
        },
        select: {
          id: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          activeStatus: true,
          UserInformation: {
            select: {
              firstName: true,
              lastName: true,
              customerTimezone: true,
            },
          },
        },
      },
      +page,
      +size,
    );

    const newResult = result.items.map((user: UserTransformation) => {
      const transformedUser: TransformedUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        active: user.active,
        activeStatus: user.activeStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        firstName: user.UserInformation[0]?.firstName ?? 'N/A',
        lastName: user.UserInformation[0]?.lastName ?? 'N/A',
        customerTimezone: user.UserInformation[0]?.customerTimezone ?? 'N/A',
      };
      return transformedUser;
    });

    const filteredResults = {
      items: newResult,
      totalItems: result.totalItems,
      itemCount: result.itemCount,
      itemsPerPage: result.itemsPerPage,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };

    return filteredResults;
  }

  async toogleUsersActivation(dto: DeactivateUsersDto) {
    const status = dto.status === EUserStatus.ENABLED ? true : false;
    const result = await this.prismaService.user.updateMany({
      where: {
        id: { in: dto.userIds },
      },
      data: {
        activeStatus: status,
      },
    });

    if (result.count > 0) {
      return {
        message: 'Users  deactivated successfully',
        affectedAccount: result.count,
      };
    } else {
      return {
        message: 'No users were deactivated. Check if the IDs are valid.',
      };
    }
  }

  async signUsersUp(dto: AdminSignUserDto) {
    return dto;
  }
}
