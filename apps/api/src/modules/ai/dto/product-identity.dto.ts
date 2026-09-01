import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { OptimizeTitleDto } from './optimize-title.dto';

export class ConfirmProductIdentityDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  userVerified?: boolean;
}

export class KeywordGateDto extends OptimizeTitleDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gateKeywords?: string[];
}
