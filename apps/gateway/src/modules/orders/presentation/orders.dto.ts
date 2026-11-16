import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class CartItemDto {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) @Max(99) quantity!: number;
}
export class CartDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
class DeliverySelectionDto {
  @IsIn(['NOVA_POSHTA', 'UKRPOSHTA']) carrier!: 'NOVA_POSHTA' | 'UKRPOSHTA';
  @IsString() @MinLength(1) @MaxLength(64) cityId!: string;
  @IsString() @MinLength(1) @MaxLength(64) pointId!: string;
}
export class DeliveryDto {
  @IsIn([
    'NOVA_POSHTA_BRANCH',
    'NOVA_POSHTA_COURIER',
    'PICKUP',
    'CARRIER_POINT',
    'UKRPOSHTA_BRANCH',
  ])
  method!:
    'NOVA_POSHTA_BRANCH' | 'NOVA_POSHTA_COURIER' | 'PICKUP' | 'CARRIER_POINT' | 'UKRPOSHTA_BRANCH';
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliverySelectionDto)
  selection?: DeliverySelectionDto;
  @IsString()
  @MaxLength(100)
  @ValidateIf((x: DeliveryDto) => x.method !== 'PICKUP' && x.method !== 'CARRIER_POINT')
  @MinLength(2)
  city!: string;
  @IsString()
  @MaxLength(300)
  @ValidateIf((x: DeliveryDto) => x.method !== 'PICKUP' && x.method !== 'CARRIER_POINT')
  @MinLength(1)
  address!: string;
}
export class CreateOrderDto extends CartDto {
  @ArrayMinSize(1) declare items: CartItemDto[];
  @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  @Matches(/^\+380\d{9}$/) phone!: string;
  @IsEmail() @MaxLength(320) email!: string;
  @ValidateNested() @Type(() => DeliveryDto) delivery!: DeliveryDto;
  @IsIn(['CASH_ON_DELIVERY', 'ONLINE_CARD']) paymentMethod!: 'CASH_ON_DELIVERY' | 'ONLINE_CARD';
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) expectedDeliveryTotal?: number;
  @IsBoolean() marketingConsent!: boolean;
  @Equals(true) acceptTerms!: true;
}
export class OrderNumberDto {
  @Matches(/^TE-[A-F0-9]{32}$/) number!: string;
}
export class OrderTokenDto {
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{43}$/) token?: string;
}

export class PaymentCommandDto extends OrderNumberDto {
  @IsIn(['retry', 'cod']) action!: 'retry' | 'cod';
}

export class OrderLookupDto extends OrderNumberDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
export class OrderListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
}
