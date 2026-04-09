import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import 'reflect-metadata'
import { AppModule } from './app.module'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)

	const prefix = process.env.APP_PREFIX || '/api'
	app.setGlobalPrefix(prefix.replace(/^\//, ''))

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			transform: true,
			forbidNonWhitelisted: false,
		}),
	)

	const config = new DocumentBuilder()
		.setTitle(process.env.APP_NAME || 'Codes Service')
		.setDescription('Codes microservice API')
		.setVersion('1.0')
		.addBearerAuth()
		.build()

	const document = SwaggerModule.createDocument(app, config)
	SwaggerModule.setup(process.env.DOC_PREFIX || '/doc/api', app, document)

	const port = Number(process.env.PORT || 4001)
	await app.listen(port, () => {
		console.log(`Codes service is running on port ${port}`)
	})
}

bootstrap()
