import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

class SpecDto {
  [key: string]: string;
}

export class OptimizeTitleDto {
  @IsString()
  productName!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  centerTerms?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SpecDto)
  specifications?: Record<string, string>;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  moq?: string;

  @IsOptional()
  @IsString()
  deliveryTime?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  identityUserVerified?: boolean;
}
