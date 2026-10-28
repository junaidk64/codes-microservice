import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from '@jest/globals'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { CodesService } from './codes.service'

const upload = jest.fn<(params: unknown) => Promise<unknown>>()

jest.mock('aws-sdk', () => ({
	S3: jest.fn().mockImplementation(() => ({
		upload: (params: unknown) => ({ promise: () => upload(params) }),
	})),
}))

describe('CodesService.uploadXlsx', () => {
	const envKeys = [
		'STORAGE_PROVIDER',
		'STORAGE_PATH',
		'STORAGE_LOCAL_URL',
		'STORAGE_S3_BUCKET_NAME',
		'STORAGE_ACCESS_KEY',
		'STORAGE_SECRET_ACCESS_KEY',
		'STORAGE_AWS_URL',
	]
	const savedEnv: Record<string, string | undefined> = {}
	let tempDir: string
	let tempFile: string
	let service: CodesService

	const uploadXlsx = (name?: string) =>
		(service as any).uploadXlsx('order1', tempFile, name) as Promise<{
			url: string
			key: string
		}>

	beforeEach(async () => {
		envKeys.forEach((key) => {
			savedEnv[key] = process.env[key]
			delete process.env[key]
		})
		tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codes-spec-'))
		tempFile = path.join(tempDir, 'in.xlsx')
		await fs.promises.writeFile(tempFile, 'data')
		process.env.STORAGE_PATH = path.join(tempDir, 'media')
		upload.mockReset().mockResolvedValue({})
		service = new CodesService({} as any, {} as any)
	})

	afterEach(async () => {
		envKeys.forEach((key) => {
			if (savedEnv[key] === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = savedEnv[key]
			}
		})
		await fs.promises.rm(tempDir, { recursive: true, force: true })
	})

	const names: Array<[string, string | undefined, string]> = [
		['spaces', 'Acme Foods Ltd', 'Acme-Foods-Ltd-'],
		['ampersand and apostrophe', "Tom & Jerry's", 'Tom-Jerry-s-'],
		['non-ASCII', 'Café Zürich 東京', 'Cafe-Zu-rich-'],
		['empty', '', 'codes-'],
		['undefined', undefined, 'codes-'],
		['only symbols', '&&& ###', 'codes-'],
	]

	describe.each(names)('business name: %s', (_label, name, prefix) => {
		it('local provider returns a valid URL without spaces', async () => {
			process.env.STORAGE_PROVIDER = 'local'
			process.env.STORAGE_LOCAL_URL = 'http://localhost:4001/api/media/'

			const { url, key } = await uploadXlsx(name)

			expect(() => new URL(url)).not.toThrow()
			expect(url).not.toMatch(/\s/)
			expect(key.startsWith(prefix)).toBe(true)
			expect(url).toBe(`http://localhost:4001/api/media/${key}`)
			expect(fs.existsSync(path.join(tempDir, 'media', key))).toBe(true)
		})

		it('S3 with default bucket URL returns a valid URL without spaces', async () => {
			process.env.STORAGE_PROVIDER = 'aws'
			process.env.STORAGE_S3_BUCKET_NAME = 'bucket'
			process.env.STORAGE_ACCESS_KEY = 'k'
			process.env.STORAGE_SECRET_ACCESS_KEY = 's'

			const { url, key } = await uploadXlsx(name)

			expect(() => new URL(url)).not.toThrow()
			expect(url).not.toMatch(/\s/)
			expect(key.startsWith(`codes/${prefix}`)).toBe(true)
			expect(url).toBe(`https://bucket.s3.amazonaws.com/${key}`)
			expect(upload).toHaveBeenCalledWith(expect.objectContaining({ Key: key }))
		})

		it('S3 with STORAGE_AWS_URL returns a valid URL without spaces', async () => {
			process.env.STORAGE_PROVIDER = 'aws'
			process.env.STORAGE_S3_BUCKET_NAME = 'bucket'
			process.env.STORAGE_ACCESS_KEY = 'k'
			process.env.STORAGE_SECRET_ACCESS_KEY = 's'
			process.env.STORAGE_AWS_URL = 'https://cdn.example.com/'

			const { url, key } = await uploadXlsx(name)

			expect(() => new URL(url)).not.toThrow()
			expect(url).not.toMatch(/\s/)
			expect(url).toBe(`https://cdn.example.com/${key}`)
		})
	})

	it('keeps the key unencoded and encodes each URL segment', async () => {
		process.env.STORAGE_PROVIDER = 'aws'
		process.env.STORAGE_S3_BUCKET_NAME = 'bucket'
		process.env.STORAGE_ACCESS_KEY = 'k'
		process.env.STORAGE_SECRET_ACCESS_KEY = 's'

		const { url, key } = await uploadXlsx('Acme')

		expect(key.startsWith('codes/')).toBe(true)
		expect(url).toContain('/codes/')
		expect(url).not.toContain('codes%2F')
	})

	it('assertValidUrl rejects relative or empty URLs', () => {
		expect(() => (service as any).assertValidUrl('/uploads/a.xlsx')).toThrow()
		expect(() => (service as any).assertValidUrl('')).toThrow()
		expect(() =>
			(service as any).assertValidUrl('http://localhost/a.xlsx'),
		).not.toThrow()
	})
})
