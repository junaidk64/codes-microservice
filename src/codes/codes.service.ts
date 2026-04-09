import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as AWS from 'aws-sdk'
import axios from 'axios'
import { randomBytes } from 'crypto'
import ExcelJS from 'exceljs'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { DataSource, In, Repository } from 'typeorm'
import { CreateCodeDto } from './dto/create-code.dto'
import { QueryCodesDto } from './dto/query-codes.dto'
import { UpdateCodeDto } from './dto/update-code.dto'
import { CodeEntity, CodeType } from './entities/code.entity'

type FormationPayload = {
	formationId: string
	quantity: number
	displayBoxes: number
	products: number
}

type MainOrderFormation = {
	formationId: {
		_id: string
		displayBoxes: number
		products: number
	}
	quantity: number
}

type MainOrderResponse = {
	success: boolean
	message?: string
	order: {
		_id: string
		status: string
		formations: MainOrderFormation[]
	}
}

type GenerateCodesResponse = {
	success: boolean
	totalCodesCreated: number
	codesExcelUrl: string
	message: string
}

@Injectable()
export class CodesService {
	private readonly codeInsertChunkSize = 5000

	constructor(
		@InjectRepository(CodeEntity)
		private readonly codesRepository: Repository<CodeEntity>,
		private readonly dataSource: DataSource,
	) {}

	private get mainApiBaseUrl(): string {
		return process.env.MAIN_API_BASE_URL || 'http://localhost:3002'
	}

	private get mainApiToken(): string | undefined {
		return process.env.MAIN_API_TOKEN
	}

	private get storageProvider(): 'aws' | 'local' {
		return (process.env.STORAGE_PROVIDER || 'aws') as 'aws' | 'local'
	}

	private get storagePath(): string {
		return process.env.STORAGE_PATH || './media'
	}

	private get localStorageUrl(): string {
		return process.env.STORAGE_LOCAL_URL || 'http://localhost:4001/api/media/'
	}

	private get awsBucketName(): string {
		return process.env.STORAGE_S3_BUCKET_NAME || ''
	}

	private get awsAccessKey(): string {
		return process.env.STORAGE_ACCESS_KEY || ''
	}

	private get awsSecretAccessKey(): string {
		return process.env.STORAGE_SECRET_ACCESS_KEY || ''
	}

	private get awsPublicUrl(): string {
		return process.env.STORAGE_AWS_URL || ''
	}

	private get useS3Acl(): boolean {
		return process.env.STORAGE_S3_USE_ACL === 'true'
	}

	private get orderUpdatePathTemplate(): string {
		return (
			process.env.MAIN_API_ORDER_UPDATE_PATH ||
			'/api/admin/orders/:orderId/codes-generated'
		)
	}

	private get orderFetchPathTemplate(): string {
		return (
			process.env.MAIN_API_ORDER_GET_PATH ||
			'/api/code-microservice/orders/:orderId'
		)
	}

	private get httpHeaders() {
		const headers: Record<string, string> = { Accept: 'application/json' }
		if (this.mainApiToken) {
			headers.Authorization = `Bearer ${this.mainApiToken}`
		}
		return headers
	}

	private buildMainApiUrl(template: string, orderId: string): string {
		return `${this.mainApiBaseUrl}${template.replace(':orderId', orderId)}`
	}

	private getS3Client() {
		if (!this.awsBucketName || !this.awsAccessKey || !this.awsSecretAccessKey) {
			throw new InternalServerErrorException(
				'AWS storage is not configured for codes-service',
			)
		}

		return new AWS.S3({
			accessKeyId: this.awsAccessKey,
			secretAccessKey: this.awsSecretAccessKey,
			region: process.env.STORAGE_AWS_REGION || 'us-east-1',
		})
	}

	private async uploadXlsx(
		orderId: string,
		tempFilePath: string,
	): Promise<{ url: string; key: string }> {
		const fileBuffer = await fs.promises.readFile(tempFilePath)
		const fileName = `order-codes-${orderId}.xlsx`

		if (this.storageProvider === 'local') {
			await fs.promises.mkdir(this.storagePath, { recursive: true })
			const targetPath = path.join(this.storagePath, fileName)
			await fs.promises.writeFile(targetPath, fileBuffer)
			return {
				url: `${this.localStorageUrl}${fileName}`,
				key: fileName,
			}
		}

		const s3 = this.getS3Client()
		const key = `codes/${fileName}`

		const uploadParams: AWS.S3.PutObjectRequest = {
			Bucket: this.awsBucketName,
			Key: key,
			Body: fileBuffer,
			ContentType:
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		}

		if (this.useS3Acl) {
			uploadParams.ACL = 'public-read'
		}

		await s3.upload(uploadParams).promise()

		const url = this.awsPublicUrl
			? `${this.awsPublicUrl.replace(/\/$/, '')}/${key}`
			: `https://${this.awsBucketName}.s3.amazonaws.com/${key}`

		return { url, key }
	}

	private async deleteUploadedFile(key: string) {
		if (!key) {
			return
		}

		if (this.storageProvider === 'local') {
			await fs.promises
				.unlink(path.join(this.storagePath, key))
				.catch(() => undefined)
			return
		}

		const s3 = this.getS3Client()
		await s3.deleteObject({ Bucket: this.awsBucketName, Key: key }).promise()
	}

	private async fetchOrder(
		orderId: string,
	): Promise<MainOrderResponse['order']> {
		const url = this.buildMainApiUrl(this.orderFetchPathTemplate, orderId)
		const { data } = await axios.get<MainOrderResponse>(url, {
			headers: this.httpHeaders,
			timeout: 30000,
		})

		if (!data?.success || !data.order) {
			throw new BadRequestException('Unable to load order from main API')
		}

		return data.order
	}

	private async updateOrderOnMainApi(params: {
		orderId: string
		codesExcelUrl: string
		totalCodesCreated: number
	}) {
		const url = this.buildMainApiUrl(
			this.orderUpdatePathTemplate,
			params.orderId,
		)

		await axios.patch(
			url,
			{
				status: 'confirmed',
				codesExcelUrl: params.codesExcelUrl,
				totalCodesCreated: params.totalCodesCreated,
			},
			{
				headers: this.httpHeaders,
				timeout: 30000,
			},
		)
	}

	private generateSecurityCode(): string {
		return `${new Date().getTime().toString(36)}${randomBytes(4)
			.toString('hex')
			.toUpperCase()}`
	}

	private padBagNumber(value: number): string {
		return String(value).padStart(3, '0')
	}

	private padSerialNumber(value: number): string {
		return String(value).padStart(11, '0')
	}

	private async writeXlsxFile(
		tempFilePath: string,
		rows: Array<{
			bag_number: string
			serial_number: string
			type: CodeType
			parent_serial: string | null
			security_code: string
			verified: boolean
			count: number
			orderId: string
		}>,
	) {
		const workbook = new ExcelJS.Workbook()
		const worksheet = workbook.addWorksheet('Codes')

		worksheet.columns = [
			{ header: 'bag_number', key: 'bag_number', width: 15 },
			{ header: 'serial_number', key: 'serial_number', width: 18 },
			{ header: 'type', key: 'type', width: 12 },
			{ header: 'parent_serial', key: 'parent_serial', width: 18 },
			{ header: 'security_code', key: 'security_code', width: 24 },
			{ header: 'verified', key: 'verified', width: 12 },
			{ header: 'count', key: 'count', width: 10 },
			{ header: 'orderId', key: 'orderId', width: 24 },
		]

		worksheet.getRow(1).font = { bold: true }
		worksheet.views = [{ state: 'frozen', ySplit: 1 }]

		for (const row of rows) {
			worksheet.addRow(row)
		}

		await workbook.xlsx.writeFile(tempFilePath)
	}

	private buildCodeRow(params: {
		bagNumber: string
		serialNumber: string
		type: CodeType
		parentSerial: string | null
		orderId: string
	}): CodeEntity {
		return this.codesRepository.create({
			bag_number: params.bagNumber,
			serial_number: params.serialNumber,
			type: params.type,
			parent_serial: params.parentSerial,
			security_code: this.generateSecurityCode(),
			verified: false,
			count: 0,
			orderId: params.orderId,
		})
	}

	private async getLastCounters(repository: Repository<CodeEntity>) {
		const [bagRow, serialRow] = await Promise.all([
			repository
				.createQueryBuilder('code')
				.select('COALESCE(MAX(CAST(code.bag_number AS UNSIGNED)), 0)', 'maxBag')
				.getRawOne<{ maxBag: string | number }>(),
			repository
				.createQueryBuilder('code')
				.select(
					'COALESCE(MAX(CAST(code.serial_number AS UNSIGNED)), 0)',
					'maxSerial',
				)
				.getRawOne<{ maxSerial: string | number }>(),
		])

		return {
			bagCounter: Number(bagRow?.maxBag || 0) + 1,
			serialCounter: Number(serialRow?.maxSerial || 0) + 1,
		}
	}

	async generateCodesOnOrderConfirmation(
		orderId: string,
	): Promise<GenerateCodesResponse> {
		if (!orderId) {
			throw new BadRequestException('Order id is required')
		}

		const order = await this.fetchOrder(orderId)

		const formations = order.formations.map((entry) => ({
			formationId: entry.formationId._id,
			quantity: entry.quantity,
			displayBoxes: entry.formationId.displayBoxes,
			products: entry.formationId.products,
		}))

		const existing = await this.codesRepository.find({
			where: { orderId },
			select: ['id'],
			take: 1,
		})

		if (existing.length > 0) {
			return {
				success: true,
				totalCodesCreated: 0,
				codesExcelUrl: '',
				message: `Codes already exist for order ${orderId}`,
			}
		}

		const queryRunner = this.dataSource.createQueryRunner()
		await queryRunner.connect()
		await queryRunner.startTransaction()

		let tempFilePath = ''
		let uploadedKey = ''

		try {
			const transactionalRepository =
				queryRunner.manager.getRepository(CodeEntity)

			const transactionalExisting = await transactionalRepository.find({
				where: { orderId },
				select: ['id'],
				take: 1,
			})

			if (transactionalExisting.length > 0) {
				await queryRunner.rollbackTransaction()
				return {
					success: true,
					totalCodesCreated: 0,
					codesExcelUrl: '',
					message: `Codes already exist for order ${orderId}`,
				}
			}

			const {
				bagCounter: initialBagCounter,
				serialCounter: initialSerialCounter,
			} = await this.getLastCounters(transactionalRepository)

			let bagCounter = initialBagCounter
			let serialCounter = initialSerialCounter
			const rows: CodeEntity[] = []

			tempFilePath = path.join(
				os.tmpdir(),
				`order-codes-${orderId}-${Date.now()}.xlsx`,
			)

			for (const formEntry of formations) {
				for (
					let quantityIndex = 0;
					quantityIndex < formEntry.quantity;
					quantityIndex++
				) {
					const bagNumber = this.padBagNumber(bagCounter++)
					const parentSerial = this.padSerialNumber(serialCounter++)

					const parentRow = this.buildCodeRow({
						bagNumber,
						serialNumber: parentSerial,
						type: 'parent',
						parentSerial: null,
						orderId,
					})
					rows.push(parentRow)

					const displaySerials: string[] = []
					for (
						let displayIndex = 0;
						displayIndex < formEntry.displayBoxes;
						displayIndex++
					) {
						const displaySerial = this.padSerialNumber(serialCounter++)
						displaySerials.push(displaySerial)
						const displayRow = this.buildCodeRow({
							bagNumber,
							serialNumber: displaySerial,
							type: 'display',
							parentSerial,
							orderId,
						})
						rows.push(displayRow)
					}

					if (formEntry.displayBoxes > 0 && formEntry.products > 0) {
						const basePerDisplay = Math.floor(
							formEntry.products / formEntry.displayBoxes,
						)
						const remainder = formEntry.products % formEntry.displayBoxes

						for (
							let displayIndex = 0;
							displayIndex < formEntry.displayBoxes;
							displayIndex++
						) {
							const numForDisplay =
								basePerDisplay + (displayIndex < remainder ? 1 : 0)

							for (
								let productIndex = 0;
								productIndex < numForDisplay;
								productIndex++
							) {
								const productSerial = this.padSerialNumber(serialCounter++)
								const productRow = this.buildCodeRow({
									bagNumber,
									serialNumber: productSerial,
									type: 'product',
									parentSerial: displaySerials[displayIndex] || parentSerial,
									orderId,
								})
								rows.push(productRow)
							}
						}
					} else if (formEntry.products > 0) {
						for (
							let productIndex = 0;
							productIndex < formEntry.products;
							productIndex++
						) {
							const productSerial = this.padSerialNumber(serialCounter++)
							const productRow = this.buildCodeRow({
								bagNumber,
								serialNumber: productSerial,
								type: 'product',
								parentSerial,
								orderId,
							})
							rows.push(productRow)
						}
					}
				}
			}

			await transactionalRepository.save(rows, {
				chunk: this.codeInsertChunkSize,
			})

			await this.writeXlsxFile(
				tempFilePath,
				rows.map((row) => ({
					bag_number: row.bag_number,
					serial_number: row.serial_number,
					type: row.type,
					parent_serial: row.parent_serial,
					security_code: row.security_code,
					verified: row.verified,
					count: row.count,
					orderId: row.orderId,
				})),
			)

			const uploadedFile = await this.uploadXlsx(orderId, tempFilePath)
			uploadedKey = uploadedFile.key

			await queryRunner.commitTransaction()
			let orderUpdateResult: any
			try {
				orderUpdateResult = await this.updateOrderOnMainApi({
					orderId,
					codesExcelUrl: uploadedFile.url,
					totalCodesCreated: rows.length,
				})
			} catch (orderUpdateError) {
				await this.codesRepository.delete({ orderId })
				await this.deleteUploadedFile(uploadedKey)
				throw orderUpdateError
			}

			return {
				success: orderUpdateResult?.success ?? true,
				totalCodesCreated: rows.length,
				codesExcelUrl: uploadedFile.url,
				message: `Successfully created ${rows.length} code documents for order ${orderId}.`,
			}
		} catch (error) {
			if (queryRunner.isTransactionActive) {
				await queryRunner.rollbackTransaction()
			}
			if (uploadedKey) {
				await this.deleteUploadedFile(uploadedKey).catch(() => undefined)
			}
			throw error
		} finally {
			if (tempFilePath) {
				await fs.promises.unlink(tempFilePath).catch(() => undefined)
			}
			await queryRunner.release()
		}
	}

	async create(createCodeDto: CreateCodeDto) {
		const code = await this.codesRepository.save(
			this.codesRepository.create({
				...createCodeDto,
			}),
		)

		return {
			success: true,
			message: 'Code created successfully',
			code,
		}
	}

	async findAll(queryDto: QueryCodesDto) {
		const where: Record<string, unknown> = {}

		if (queryDto.orderId) {
			where.orderId = queryDto.orderId
		}

		if (queryDto.type) {
			where.type = queryDto.type
		}
		if (queryDto.status) {
			if (queryDto.status === 'active') {
				where.verified = false
			} else if (queryDto.status === 'inactive') {
				where.verified = true
			} else if (queryDto.status === 'unused') {
				where.verified = false
				where.count = 0
			}
		}
		if (queryDto.security_code) {
			const codes = Array.isArray(queryDto.security_code)
				? queryDto.security_code
				: queryDto.security_code.split(',').map((code) => code.trim())
			where.security_code = codes.length === 1 ? codes[0] : In(codes)
		}

		const codes = await this.codesRepository.find({
			where,
			order: { createdAt: 'DESC' },
		})
		// console.log(codes)

		return {
			success: true,
			message: 'Codes fetched successfully',
			codes,
		}
	}

	async findOne(id: string) {
		const code = await this.codesRepository.findOne({
			where: { id: Number(id) },
		})

		if (!code) {
			throw new NotFoundException('Code not found')
		}

		return {
			success: true,
			message: 'Code fetched successfully',
			code,
		}
	}

	async update(updateCodeDto: UpdateCodeDto) {
		const bags = updateCodeDto.bags
		if (!bags || bags.length === 0) {
			throw new BadRequestException('Bags field is required for update')
		}
		const codes = await this.codesRepository.find({
			where: { bag_number: In(bags) },
		})

		if (!codes || codes.length === 0) {
			throw new NotFoundException('Code not found')
		}

		await this.codesRepository.save(
			codes.map((code) => ({ ...code, ...updateCodeDto })),
		)

		return {
			success: true,
			message: 'Code updated successfully',
		}
	}

	async remove(id: string) {
		const code = await this.codesRepository.findOne({
			where: { id: Number(id) },
		})

		if (!code) {
			throw new NotFoundException('Code not found')
		}

		await this.codesRepository.remove(code)

		return {
			success: true,
			message: 'Code deleted successfully',
		}
	}
}
