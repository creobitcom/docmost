import { IsBoolean, IsIP, IsOptional, IsString } from 'class-validator';
import { SpaceIdDto } from './page.dto';
import { isString } from '@tiptap/core';

export class SidebarPageDto extends SpaceIdDto {
  @IsOptional()
  @IsString()
  pageId: string;
}

export class SidebarPageResultDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  slugId: string;

  @IsString()
  icon: string;

  @IsString()
  position: string;

  @IsString()
  parentPageId: string;

  @IsString()
  spaceId: string;

  @IsString()
  creator_id: string;

  @IsBoolean()
  isSynced: boolean;

  @IsString()
  color?: string;
}
