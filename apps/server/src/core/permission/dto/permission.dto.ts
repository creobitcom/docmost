import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import {
  CaslAction,
  CaslObject,
} from 'src/core/casl/interfaces/permission-ability.type';

export class PermissionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  userId?: string;

  @IsString()
  groupId?: string;

  @IsString()
  pageId?: string;

  @IsString()
  spaceId?: string;

  @IsString()
  @IsEnum(CaslAction)
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(CaslObject)
  object: string;
}

export class PermissionIdDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class GetPermissionDto {
  @IsEnum(CaslObject)
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  targetId: string;
}
