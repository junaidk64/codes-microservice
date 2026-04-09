import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalTokenGuard } from '../common/guards/internal-token.guard';
import { CodesController } from './codes.controller';
import { CodesService } from './codes.service';
import { CodeEntity } from './entities/code.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CodeEntity])],
  controllers: [CodesController],
  providers: [CodesService, InternalTokenGuard],
  exports: [CodesService],
})
export class CodesModule {}
