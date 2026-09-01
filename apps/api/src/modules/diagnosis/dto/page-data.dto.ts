import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class SpecificationsDto {
  [key: string]: string;
}

export class PlatformPageDataDto {
  @IsString()
  platform!: string;

  @IsString()
  pageType!: string;

  @IsString()
  url!: string;

  @IsString()
  title!: string;

  @IsString()
  companyName!: string;

  @IsString()
  productName!: string;

  @IsString()
  description!: string;

  @IsArray()
  @IsString({ each: true })
  keywords!: string[];

  @IsArray()
  @IsString({ each: true })
  images!: string[];

  @IsObject()
  specifications!: Record<string, string>;

  @IsString()
  category!: string;

  @IsString()
  moq!: string;

  @IsString()
  deliveryTime!: string;

  @IsBoolean()
  oemAvailable!: boolean;

  @IsArray()
  @IsString({ each: true })
  certifications!: string[];

  @IsString()
  rawText!: string;

  @IsString()
  capturedAt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SpecificationsDto)
  extra?: SpecificationsDto;
}
