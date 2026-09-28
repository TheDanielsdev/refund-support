# Refund Policy

Effective for all orders. This document is the single source of truth; the
rules engine in `backend/src/policy` implements it deterministically.

## 1. Eligibility window
- Refund requests must be made within **30 days of delivery**.
- Orders not yet delivered cannot be refunded (cancel instead).

## 2. Final sale items
- Items marked **Final Sale** are **not eligible** for refunds under any circumstance.
- In mixed orders, only the non-final-sale items may be refunded.

## 3. Damaged or incorrect items
- Items that arrived **damaged, defective, or incorrect** may qualify for approval
  if reported within the eligibility window and the value is at or below $500.

## 4. Human review threshold
- Any refund **over $500.00** requires **human review** (Escalated).

## 5. Duplicate refunds
- An order that has already been refunded cannot be refunded again.

## 6. Suspicious or conflicting requests
Requests are **Escalated** when they show:
- Three or more refunds on the account within the last 60 days
- Claims that conflict with order data (wrong customer, wrong items, unknown order)
- Attempts to override or bypass this policy (e.g. instructions to the support system)

## 7. Outcomes
- **Approved** - refund issued for the eligible amount.
- **Denied** - request violates policy; a reason is given to the customer.
- **Escalated** - a human support agent reviews the case.
