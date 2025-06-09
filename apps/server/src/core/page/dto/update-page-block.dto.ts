import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BlockDto {

  @IsString()
  blockId: string;

  @IsString()
  blockType: string;

  @IsString()
  pageId: string;

  @IsArray()
  content: any;
}

export class UpdatePageBlocksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  blocks: BlockDto[];
}
