import { ClaimType, Decision, OrderStatus } from '@prisma/client';
import { POLICY } from './policy.constants';
import { PolicyInput, PolicyOutcome, RuleResult } from './policy.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic refund policy. This is the AUTHORITY on decisions:
 * the LLM only classifies the request and writes the reply.
 * Checks run in order and stop at the first terminal outcome.
 */
export function evaluatePolicy(input: PolicyInput): PolicyOutcome {
  const rules: RuleResult[] = [];
  const now = input.now ?? new Date();

  const finish = (
    decision: Decision,
    customerReason: string,
    refundCents = 0,
    refundedSkus: string[] = [],
  ): PolicyOutcome => ({ decision, customerReason, refundCents, refundedSkus, rules });

  // 1. Verify the order exists and belongs to this customer
  if (input.verification !== 'ok' || !input.order) {
    rules.push({
      rule: 'order_verification',
      outcome: 'flag',
      detail: input.verification === 'email_mismatch' ? 'Order belongs to a different account' : 'Order number not found',
    });
    return finish(
      Decision.ESCALATED,
      "We couldn't match this request to an order on your account, so a support agent will review it.",
    );
  }
  rules.push({ rule: 'order_verification', outcome: 'pass', detail: 'Order found and matches the account email' });
  const order = input.order;

  // 2. Policy-bypass / injection attempt
  if (input.injectionFlagged) {
    rules.push({ rule: 'injection_screening', outcome: 'flag', detail: 'Message contained instruction-override patterns' });
    return finish(Decision.ESCALATED, 'Your request needs a manual review by our support team.');
  }
  rules.push({ rule: 'injection_screening', outcome: 'pass', detail: 'No override patterns detected' });

  // 3. Duplicate refund
  if (order.status === OrderStatus.REFUNDED || input.priorApprovedForOrder > 0) {
    rules.push({ rule: 'duplicate_refund', outcome: 'fail', detail: 'Order was already refunded' });
    return finish(Decision.DENIED, 'This order has already been refunded, so we cannot issue a second refund.');
  }
  rules.push({ rule: 'duplicate_refund', outcome: 'pass', detail: 'No prior refund on this order' });

  // 4. Delivery status
  if (order.status !== OrderStatus.DELIVERED || !order.deliveredAt) {
    rules.push({ rule: 'delivery_status', outcome: 'fail', detail: `Order status is ${order.status}` });
    return finish(
      Decision.DENIED,
      "This order hasn't been delivered yet, so it isn't eligible for a refund. You can cancel it or wait for delivery.",
    );
  }

  // 5. Return window (whole days since delivery)
  const daysSinceDelivery = Math.floor((now.getTime() - order.deliveredAt.getTime()) / DAY_MS);
  if (daysSinceDelivery > POLICY.RETURN_WINDOW_DAYS) {
    rules.push({
      rule: 'return_window',
      outcome: 'fail',
      detail: `Delivered ${daysSinceDelivery} days ago; window is ${POLICY.RETURN_WINDOW_DAYS} days`,
    });
    return finish(
      Decision.DENIED,
      `Refund requests must be made within ${POLICY.RETURN_WINDOW_DAYS} days of delivery, and this order is outside that window.`,
    );
  }
  rules.push({
    rule: 'return_window',
    outcome: 'pass',
    detail: `Delivered ${daysSinceDelivery} days ago (limit ${POLICY.RETURN_WINDOW_DAYS})`,
  });

  // 6. Final-sale items
  const requested = input.requestedSkus.length
    ? order.items.filter((i) => input.requestedSkus.includes(i.sku))
    : order.items;
  const scope = requested.length ? requested : order.items;
  const eligible = scope.filter((i) => !i.isFinalSale);
  const finalSale = scope.filter((i) => i.isFinalSale);

  if (eligible.length === 0) {
    rules.push({ rule: 'final_sale', outcome: 'fail', detail: `All requested items are final sale: ${finalSale.map((i) => i.sku).join(', ')}` });
    return finish(Decision.DENIED, 'The item(s) in this request were sold as final sale and are not eligible for refunds.');
  }
  rules.push({
    rule: 'final_sale',
    outcome: finalSale.length ? 'flag' : 'pass',
    detail: finalSale.length
      ? `Excluded final-sale items: ${finalSale.map((i) => i.sku).join(', ')}`
      : 'No final-sale items in scope',
  });

  // 7. Claim conflicts with order data
  if (input.claimType === ClaimType.NOT_RECEIVED) {
    rules.push({ rule: 'claim_consistency', outcome: 'flag', detail: 'Customer says item not received but order is marked delivered' });
    return finish(
      Decision.ESCALATED,
      'Our records show this order as delivered, so a support agent will investigate and get back to you.',
    );
  }
  rules.push({ rule: 'claim_consistency', outcome: 'pass', detail: `Claim type ${input.claimType} is consistent with order data` });

  // 8. Amount threshold
  const refundCents = eligible.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const refundedSkus = eligible.map((i) => i.sku);
  if (refundCents > POLICY.HUMAN_REVIEW_THRESHOLD_CENTS) {
    rules.push({
      rule: 'amount_threshold',
      outcome: 'flag',
      detail: `Refund $${(refundCents / 100).toFixed(2)} exceeds $${(POLICY.HUMAN_REVIEW_THRESHOLD_CENTS / 100).toFixed(2)} review threshold`,
    });
    return finish(
      Decision.ESCALATED,
      'Refunds of this amount require review by a member of our team, who will follow up with you.',
    );
  }
  rules.push({ rule: 'amount_threshold', outcome: 'pass', detail: `Refund $${(refundCents / 100).toFixed(2)} is within auto-approval limit` });

  // 9. Refund abuse pattern
  if (input.recentRefundCount >= POLICY.SUSPICIOUS_REFUND_COUNT) {
    rules.push({
      rule: 'refund_frequency',
      outcome: 'flag',
      detail: `${input.recentRefundCount} refunds in the last ${POLICY.SUSPICIOUS_LOOKBACK_DAYS} days (limit ${POLICY.SUSPICIOUS_REFUND_COUNT - 1})`,
    });
    return finish(Decision.ESCALATED, 'Your request needs a manual review by our support team.');
  }
  rules.push({ rule: 'refund_frequency', outcome: 'pass', detail: `${input.recentRefundCount} recent refunds` });

  // 10. All checks passed
  const partial = finalSale.length > 0;
  return finish(
    Decision.APPROVED,
    partial
      ? 'Your refund has been approved for the eligible items. Final-sale items in the order are not refundable.'
      : 'Your refund has been approved.',
    refundCents,
    refundedSkus,
  );
}
