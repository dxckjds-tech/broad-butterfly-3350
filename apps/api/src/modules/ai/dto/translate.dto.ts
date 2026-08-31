import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class TranslateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  text!: string;

  @IsIn(['zh-CN', 'en'])
  targetLanguage!: 'zh-CN' | 'en';
}
