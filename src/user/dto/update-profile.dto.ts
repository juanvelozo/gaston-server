// src/user/dto/update-profile.dto.ts
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsUrl()
  profileImage?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}
