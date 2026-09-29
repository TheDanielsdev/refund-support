export type Decision = 'APPROVED' | 'DENIED' | 'ESCALATED';

export interface RefundResult {
    id: string;
    decision: Decision;
    refundCents: number;
    reply: string;
    createdAt: string;
}

export interface RefundListItem {
    id: string;
    submittedEmail: string;
    submittedOrderRef: string;
    message: string;
    claimType: string | null;
    decision: Decision;
    refundCents: number;
    reply: string;
    injectionFlagged: boolean;
    aiUsed: boolean;
    createdAt: string;
}

export interface AuditLog {
    id: string;
    step: string;
    detail: any;
    createdAt: string;
}

export interface RefundDetail extends RefundListItem {
    auditLogs: AuditLog[];
}

export interface DemoOrder {
    orderNumber: string;
    email: string;
    customerName: string;
    status: string;
    totalCents: number;
    items: { sku: string; name: string; priceCents: number; isFinalSale: boolean }[];
}

export interface Stats {
    total: number;
    byDecision: Record<Decision, number>;
    injectionFlagged: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
            const body = await res.json();
            msg = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? msg;
        } catch {
            /* ignore */
        }
        throw new Error(msg);
    }
    return res.json();
}

export const api = {
    submitRefund: (body: { email: string; orderNumber: string; message: string }) =>
        request<RefundResult>('/refunds', { method: 'POST', body: JSON.stringify(body) }),
    listRefunds: (decision?: Decision) =>
        request<RefundListItem[]>(`/refunds${decision ? `?decision=${decision}` : ''}`),
    getRefund: (id: string) => request<RefundDetail>(`/refunds/${id}`),
    stats: () => request<Stats>('/refunds/stats'),
    demoOrders: () => request<DemoOrder[]>('/orders/demo'),
};

export const formatMoney = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);