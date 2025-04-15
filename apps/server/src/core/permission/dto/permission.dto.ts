import { IsNotEmpty, IsString } from 'class-validator';

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
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsNotEmpty()
  object: string;
}

export class PermissionIdDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
