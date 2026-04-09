import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { InternalTokenGuard } from '../common/guards/internal-token.guard'
import { CodesService } from './codes.service'
import { CreateCodeDto } from './dto/create-code.dto'
import { QueryCodesDto } from './dto/query-codes.dto'
import { UpdateCodeDto } from './dto/update-code.dto'

@ApiTags('codes')
@ApiBearerAuth()
@UseGuards(InternalTokenGuard)
@Controller('v1/codes')
export class CodesController {
	constructor(private readonly codesService: CodesService) {}

	@Post('generate/:orderId')
	generate(@Param('orderId') orderId: string) {
		return this.codesService.generateCodesOnOrderConfirmation(orderId)
	}

	@Post()
	create(@Body() createCodeDto: CreateCodeDto) {
		return this.codesService.create(createCodeDto)
	}

	@Get()
	findAll(@Query() queryDto: QueryCodesDto) {
		return this.codesService.findAll(queryDto)
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.codesService.findOne(id)
	}

	@Patch()
	update(@Body() updateCodeDto: UpdateCodeDto) {
		return this.codesService.update(updateCodeDto)
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.codesService.remove(id)
	}
}
