import {
  Body,
  Controller,
  Get,
  HttpCode,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiRequestTimeoutResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ERole, User } from '@prisma/client';
import { GenericResponse } from 'src/__shared__/dto';
import { AssetService } from 'src/asset/asset.service';
import { RegisterUserAssetsDto } from 'src/asset/dto';
import { AllowRoles, GetUser } from 'src/auth/decorators';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { BoxService } from 'src/box/box.service';
import { RegisterUserInfoDto } from 'src/information/dto';
import { InformationService } from 'src/information/information.service';
import { RedexService } from 'src/redex/redex.service';

@Controller('user')
@ApiTags('user')
@UseGuards(JwtGuard, RolesGuard)
@AllowRoles(ERole.USER)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
@ApiRequestTimeoutResponse({ description: 'Internet Error' })
export class UserController {
  constructor(
    private readonly assetService: AssetService,
    private readonly additionalInfo: InformationService,
    private readonly redexService: RedexService,
    private readonly boxService: BoxService,
  ) {}

  @ApiOkResponse({
    description: 'user additional assets retrieved successfully',
    type: GenericResponse,
  })
  @HttpCode(200)
  @ApiOperation({ summary: 'user assets' })
  @Get('assets')
  async getAssets(@GetUser() user: User) {
    const result = await this.assetService.getAllAssets(user);
    return new GenericResponse('user-assets', result);
  }

  @ApiCreatedResponse({
    description: 'user created additional assets',
    type: GenericResponse,
  })
  @Post('asset')
  @ApiBody({ type: RegisterUserAssetsDto })
  @ApiOperation({ summary: 'user create asset' })
  async createAsset(@Body() dto: RegisterUserAssetsDto, @GetUser() user: User) {
    console.log({ dto });
    const result = await this.assetService.registerAssets(dto, user);
    return new GenericResponse('created-asset', result);
  }

  @ApiOkResponse({
    description: 'user additional infos retrieved successfully',
    type: GenericResponse,
  })
  @HttpCode(200)
  @ApiOperation({ summary: 'user aditional information' })
  @Get('infos')
  async getAdditionalInformation(@GetUser() user: User) {
    const result = await this.additionalInfo.getAdditionalInformation(user);
    return new GenericResponse('user-infos', result);
  }

  @ApiCreatedResponse({
    description: 'user created additional infos',
    type: GenericResponse,
  })
  @Post('info')
  @ApiBody({ type: RegisterUserInfoDto })
  @ApiOperation({ summary: 'user create additional info' })
  @ApiConflictResponse({
    description: 'Information  already exists for this user',
  })
  async createAdditionalInfo(
    @Body() dto: RegisterUserInfoDto,
    @GetUser() user: User,
  ) {
    const result = await this.additionalInfo.createAdditionalInformation(
      dto,
      user,
    );
    return new GenericResponse('created-info', result);
  }

  @ApiBody({
    description: 'File to upload',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload file and send it to redex',
  })
  @ApiCreatedResponse({ description: 'File uploaded' })
  @UseInterceptors(FileInterceptor('file'))
  @Post('redex-file')
  async uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: new RegExp('^.*.(pdf)$', 'i'),
        })
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024,
        })
        .build({
          errorHttpStatusCode: 400,
        }),
    )
    file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    const result = await this.redexService.uplaodFile(file, user);
    return new GenericResponse('File uplaoded', result);
  }

  @ApiOkResponse({
    description: 'user Ports retrieved successfully',
    type: GenericResponse,
  })
  @HttpCode(200)
  @ApiOperation({ summary: 'user ports' })
  @Get('ports')
  async getUserPorts(@GetUser() user: User) {
    const result = await this.boxService.getUserPorts(user);
    return new GenericResponse('user-ports', result);
  }
}
