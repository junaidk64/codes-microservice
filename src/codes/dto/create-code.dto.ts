import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCodeDto {
  @ApiProperty({ example: '001' })
  @IsString()
  bag_number!: string;

  @ApiProperty({ example: '00000000001' })
  @IsString()
  serial_number!: string;

  @ApiProperty({ enum: ['parent', 'display', 'product'] })
  @IsEnum(['parent', 'display', 'product'])
  type!: 'parent' | 'display' | 'product';

  @ApiPropertyOptional({ nullable: true, example: null })
  @IsOptional()
  @IsString()
  parent_serial?: string | null;

  @ApiProperty({ example: 'A1B2C3D4' })
  @IsString()
  security_code!: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  verified!: boolean;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  count!: number;

  @ApiProperty({ example: '65fbde0d4fe4d3eebf573ce1' })
  @IsMongoId()
  orderId!: string;
}
