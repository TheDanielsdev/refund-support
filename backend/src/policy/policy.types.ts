import { ClaimType, Decision, OrderStatus } from '@prisma/client';

export type Verification = 'ok' | 'order_not_found' | 'email_mismatch';

export interface PolicyItem {
  sku: string;
  name: string;
  priceCents: number;
  quantity: number;
  isFinalSale: boolean;
}

export interface PolicyInput {
  verification: Verification;
  injectionFlagged: boolean;
  order?: { status: OrderStatus; deliveredAt: Date | null; items: PolicyItem[] };
  claimType: ClaimType;
  /** SKUs the customer referred to. Empty = whole order. */
  requestedSkus: string[];
  recentRefundCount: number;
  priorApprovedForOrder: number;
  now?: Date;
}

export interface RuleResult {
  rule: string;
  outcome: 'pass' | 'fail' | 'flag';
  detail: string;
}

export interface PolicyOutcome {
  decision: Decision;
  refundCents: number;
  refundedSkus: string[];
  /** Safe to show the customer (no internal details). */
  customerReason: string;
  rules: RuleResult[];
}
