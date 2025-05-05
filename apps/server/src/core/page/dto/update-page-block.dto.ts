import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePageBlocksDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageBlockDto)
  blocks: PageBlockDto[];
}

export class PageBlockDto {
  @IsString()
  @IsNotEmpty()
  blockId: string;

  @IsString()
  @IsNotEmpty()
  blockType: string;

  @IsOptional()
  @IsString()
  content: string | null;
}

