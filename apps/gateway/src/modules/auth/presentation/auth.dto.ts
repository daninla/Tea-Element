import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class LoginDto {
  @ApiProperty({ example: 'customer@example.test' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password!: string;
}
export class RegisterDto extends LoginDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  firstName!: string;
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  lastName!: string;
  @ApiPropertyOptional({ example: '+380501234567' })
  @IsOptional()
  @Matches(/^\+380\d{9}$/)
  phone?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() marketingConsent?: boolean;
}
