import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  CaslAction,
  CaslObject,
} from 'src/core/casl/interfaces/permission-ability.type';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(CaslAction)
  action: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(CaslObject)
  object: string;

  @IsString()
  @IsOptional()
  @IsUUID('all')
  spaceId: string;

  @IsString()
  @IsOptional()
  @IsUUID('all')
  pageId: string;

  @IsString()
  @IsOptional()
  @IsUUID('all')
  userId: string;

  @IsString()
  @IsOptional()
  @IsUUID('all')
  groupId: string;
}
