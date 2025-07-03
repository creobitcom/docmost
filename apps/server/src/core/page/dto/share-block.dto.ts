import { IsOptional, IsBoolean, IsEnum, IsUUID, IsISO8601 } from "class-validator"

export class ShareBlockDto {
    @IsUUID() blockId: string
    @IsUUID() userId: string
    @IsEnum(['read', 'edit']) permission: 'read' | 'edit'
    @IsBoolean() @IsOptional() includePageMember?: boolean
    @IsBoolean() @IsOptional() includeSpaceMember?: boolean
    @IsBoolean() @IsOptional() showMeta?: boolean  // передадим на фронт
    @IsISO8601() @IsOptional() expiresAt?: string
  }
