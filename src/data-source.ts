import { config as dotenvConfig } from 'dotenv'
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { CodeEntity } from './codes/entities/code.entity'

dotenvConfig({ path: '.env' })

const AppDataSource = new DataSource({
	type: 'mysql',
	host: process.env.MYSQL_HOST || 'localhost',
	port: Number(process.env.MYSQL_PORT || 3306),
	username: process.env.MYSQL_USER || 'root',
	password: process.env.MYSQL_PASS || 'admin',
	database: process.env.MYSQL_NAME || 'codes_service',
	entities: [CodeEntity],
	migrations:
		process.env.NODE_ENV === 'production'
			? ['dist/migrations/*{.js,.ts}']
			: ['src/migrations/*{.ts,.js}'],
	synchronize: false,
	logging: process.env.ENVIRONMENT === 'development',
})

export default AppDataSource
