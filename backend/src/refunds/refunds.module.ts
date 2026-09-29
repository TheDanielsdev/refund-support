import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  imports: [LlmModule],
  controllers: [RefundsController],
  providers: [RefundsService],
})
export class RefundsModule {}
