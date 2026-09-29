import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Decision } from '@prisma/client';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundsService } from './refunds.service';

@Controller('refunds')
export class RefundsController {
  constructor(private readonly refunds: RefundsService) { }

  /** Customer-facing: submit a refund request. */
  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateRefundDto) {
    return this.refunds.process(dto);
  }

  /** Admin: recent requests, optionally filtered by decision. */
  @Get()
  list(@Query('decision') decisionRaw?: string, @Query('limit') limitRaw?: string) {
    const decision =
      decisionRaw && (Object.values(Decision) as string[]).includes(decisionRaw)
        ? (decisionRaw as Decision)
        : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.refunds.list(decision, Number.isFinite(limit) ? limit : undefined);
  }

  @Get('stats')
  stats() {
    return this.refunds.stats();
  }

  /** Admin: full detail incl. audit trail. */
  @Get(':id')
  get(@Param('id') id: string) {
    return this.refunds.get(id);
  }
}
