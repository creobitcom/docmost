import { IsNotEmpty, IsString } from 'class-validator';

export class PermissionIdDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
