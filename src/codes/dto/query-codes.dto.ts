import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsMongoId, IsOptional } from 'class-validator'

export class QueryCodesDto {
	@ApiPropertyOptional({ example: '65fbde0d4fe4d3eebf573ce1' })
	@IsOptional()
	@IsMongoId()
	orderId?: string

	@ApiPropertyOptional({ enum: ['parent', 'display', 'product'] })
	@IsOptional()
	@IsEnum(['parent', 'display', 'product'])
	type?: 'parent' | 'display' | 'product'

	@ApiPropertyOptional({ example: 'active' })
	@IsOptional()
	@IsEnum(['active', 'inactive', 'unused'])
	status?: 'active' | 'inactive' | 'unused'

	//security code
	@ApiPropertyOptional({ example: 'ABCD1234' })
	@IsOptional()
	security_code?: string
}
