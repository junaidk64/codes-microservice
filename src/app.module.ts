import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CodesModule } from './codes/codes.module';
import { CodeEntity } from './codes/entities/code.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('MYSQL_HOST', 'localhost'),
        port: Number(configService.get<string>('MYSQL_PORT', '3306')),
        username: configService.get<string>('MYSQL_USER', 'root'),
        password: configService.get<string>('MYSQL_PASS', 'admin'),
        database: configService.get<string>('MYSQL_NAME', 'codes_service'),
        entities: [CodeEntity],
        migrations: ['dist/migrations/*{.js,.ts}'],
        synchronize: false,
        logging: configService.get<string>('ENVIRONMENT') === 'development',
      }),
    }),
    CodesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
