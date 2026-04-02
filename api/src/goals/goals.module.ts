import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal } from './goal.entity';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Goal])],
  providers: [GoalsService],
  controllers: [GoalsController],
})
export class GoalsModule {}
