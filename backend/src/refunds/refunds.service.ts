import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClaimType, Decision, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiAnalysis, LLM_PROVIDER, LlmProvider } from '../llm/llm.types';
import { heuristicAnalyze, templateReply } from '../llm/mock.provider';
import { evaluatePolicy } from '../policy/policy.engine';
import { POLICY } from '../policy/policy.constants';
import { Verification } from '../policy/policy.types';
import { sanitizeMessage, scanForInjection } from '../security/injection-filter';
import { CreateRefundDto } from './dto/create-refund.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async process(dto: CreateRefundDto) {
    const audit: { step: string; detail: Prisma.InputJsonValue }[] = [];
    const log = (step: string, detail: Prisma.InputJsonValue) => audit.push({ step, detail });

    const email = dto.email.trim().toLowerCase();
    const orderNumber = dto.orderNumber.trim().toUpperCase();
    const message = sanitizeMessage(dto.message);

    // 1. Screen untrusted input
    const scan = scanForInjection(message);
    log('input_screening', { flagged: scan.flagged, matches: scan.matches, provider: this.llm.name });

    // 2. Look up order data
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, customer: true },
    });
    let verification: Verification = 'ok';
    if (!order) verification = 'order_not_found';
    else if (order.customer.email.toLowerCase() !== email) verification = 'email_mismatch';
    log('order_lookup', { verification, orderNumber, status: order?.status ?? null });

    const matched = verification === 'ok' && order ? order : null;

    // 3. History used by policy (only for verified orders)
    let recentRefundCount = 0;
    let priorApprovedForOrder = 0;
    if (matched) {
      const cutoff = new Date(Date.now() - POLICY.SUSPICIOUS_LOOKBACK_DAYS * DAY_MS);
      const [refundedOrders, approvedRequests, priorApproved] = await Promise.all([
        this.prisma.order.count({ where: { customerId: matched.customerId, status: 'REFUNDED', deliveredAt: { gte: cutoff } } }),
        this.prisma.refundRequest.count({ where: { customerId: matched.customerId, decision: 'APPROVED', createdAt: { gte: cutoff } } }),
        this.prisma.refundRequest.count({ where: { orderId: matched.id, decision: 'APPROVED' } }),
      ]);
      recentRefundCount = refundedOrders + approvedRequests;
      priorApprovedForOrder = priorApproved;
      log('history_lookup', { recentRefundCount, priorApprovedForOrder, lookbackDays: POLICY.SUSPICIOUS_LOOKBACK_DAYS });
    }

    // 4. AI classification (skipped for unverified or flagged input: never send it to the model)
    let analysis: AiAnalysis | null = null;
    let aiUsed = false;
    if (matched && !scan.flagged) {
      const aiInput = { message, items: matched.items.map((i) => ({ sku: i.sku, name: i.name })) };
      try {
        analysis = await this.llm.analyze(aiInput);
        aiUsed = this.llm.name !== 'mock';
        log('ai_analysis', { provider: this.llm.name, ...analysis });
      } catch (err) {
        this.logger.warn(`AI analysis failed: ${(err as Error).message}`);
        analysis = heuristicAnalyze(aiInput);
        log('ai_analysis_fallback', { error: (err as Error).message, usedHeuristicClassifier: true, ...analysis });
      }
    } else {
      log('ai_analysis_skipped', { reason: !matched ? 'order not verified' : 'input flagged by screening' });
    }

    // 5. Deterministic policy decision (the authority)
    const outcome = evaluatePolicy({
      verification,
      injectionFlagged: scan.flagged,
      order: matched
        ? { status: matched.status, deliveredAt: matched.deliveredAt, items: matched.items }
        : undefined,
      claimType: analysis?.claimType ?? ClaimType.OTHER,
      requestedSkus: analysis?.mentionedSkus ?? [],
      recentRefundCount,
      priorApprovedForOrder,
    });
    log('policy_evaluation', { decision: outcome.decision, refundCents: outcome.refundCents, rules: outcome.rules as unknown as Prisma.InputJsonValue });

    // 6. Reconcile: AI may only make the outcome MORE cautious, never less
    let { decision, refundCents, customerReason } = outcome;
    if (analysis?.suspicious && decision === Decision.APPROVED) {
      decision = Decision.ESCALATED;
      refundCents = 0;
      customerReason = 'Your request needs a manual review by our support team.';
      log('ai_override_to_escalation', { reason: analysis.suspicionReason ?? 'AI flagged the request as suspicious' });
    }

    // 7. Customer-facing reply (LLM writes it; falls back to a template)
    const replyInput = { decision, refundCents, customerReason, message };
    let reply: string;
    if (matched && !scan.flagged) {
      try {
        reply = await this.llm.composeReply(replyInput);
        log('reply_generation', { provider: this.llm.name, source: 'llm' });
      } catch (err) {
        this.logger.warn(`Reply generation failed: ${(err as Error).message}`);
        reply = templateReply(replyInput);
        log('reply_generation', { source: 'template_fallback', error: (err as Error).message });
      }
    } else {
      reply = templateReply(replyInput);
      log('reply_generation', { source: 'template', reason: 'no LLM call for unverified/flagged input' });
    }

    // 8. Persist request + audit trail
    const saved = await this.prisma.refundRequest.create({
      data: {
        customerId: matched?.customerId ?? null,
        orderId: matched?.id ?? null,
        submittedEmail: email,
        submittedOrderRef: orderNumber,
        message,
        claimType: analysis?.claimType ?? null,
        decision,
        refundCents,
        reply,
        injectionFlagged: scan.flagged,
        aiUsed,
        auditLogs: { create: audit.map((a) => ({ step: a.step, detail: a.detail })) },
      },
    });

    return {
      id: saved.id,
      decision: saved.decision,
      refundCents: saved.refundCents,
      reply: saved.reply,
      createdAt: saved.createdAt,
    };
  }

  list(decision?: Decision, limit = 50) {
    return this.prisma.refundRequest.findMany({
      where: decision ? { decision } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  async get(id: string) {
    const item = await this.prisma.refundRequest.findUnique({
      where: { id },
      include: { auditLogs: { orderBy: { createdAt: 'asc' } }, order: { include: { items: true } }, customer: true },
    });
    if (!item) throw new NotFoundException('Refund request not found');
    return item;
  }

  async stats() {
    const grouped = await this.prisma.refundRequest.groupBy({ by: ['decision'], _count: { _all: true } });
    const flagged = await this.prisma.refundRequest.count({ where: { injectionFlagged: true } });
    const byDecision = { APPROVED: 0, DENIED: 0, ESCALATED: 0 } as Record<string, number>;
    grouped.forEach((g) => (byDecision[g.decision] = g._count._all));
    return { total: Object.values(byDecision).reduce((a, b) => a + b, 0), byDecision, injectionFlagged: flagged };
  }
}
