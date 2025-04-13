import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  name: string;

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
