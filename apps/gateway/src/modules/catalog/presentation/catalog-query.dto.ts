import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  CATALOG_SORTS,
  CATALOG_SECTIONS,
  type CatalogSection,
  type CatalogSort,
} from '@tea/contracts';
const numeric = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
const boolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CatalogQueryDto {
  @ApiPropertyOptional({ enum: CATALOG_SECTIONS })
  @IsOptional()
  @IsIn(CATALOG_SECTIONS)
  section?: CatalogSection;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(160)
  category?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trimmed) @IsString() @Length(1, 100) q?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(1, 150)
  origin?: string;
  @ApiPropertyOptional({ description: 'Minimum product from-price in integer kopecks' })
  @IsOptional()
  @Transform(numeric)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minPrice?: number;
  @ApiPropertyOptional({ description: 'Maximum product from-price in integer kopecks' })
  @IsOptional()
  @Transform(numeric)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  maxPrice?: number;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(boolean)
  @IsBoolean()
  onSale?: boolean;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(boolean)
  @IsBoolean()
  inStock?: boolean;
  @ApiPropertyOptional({ enum: CATALOG_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn(CATALOG_SORTS)
  sort?: CatalogSort;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(numeric)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;
  @ApiPropertyOptional({ default: 12, maximum: 48 })
  @IsOptional()
  @Transform(numeric)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize?: number;
}
export class ProductSlugDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(160) slug!: string;
}
