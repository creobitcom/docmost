import { IsString } from 'class-validator';

export class SaveBlockPermissionDto {
  @IsString()
  pageId: string;

  @IsString()
  blockId: string;

  @IsString()
  userId: string;

  @IsString()
  role: string;

  @IsString()
  permission: string;
}
