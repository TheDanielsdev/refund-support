import { DecisionBadge } from '@/components/DecisionBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type Decision, formatMoney, type RefundDetail, type RefundListItem, type Stats } from '@/lib/api';
import { useAdminStore } from '@/store/admin';
import { useCallback, useEffect, useState } from 'react';

const FILTERS: (Decision | 'ALL')[] = ['ALL', 'APPROVED', 'DENIED', 'ESCALATED'];

function usePolling(fn: () => Promise<void>, deps: unknown[], ms = 5000) {
    useEffect(() => {
        fn().catch(() => undefined);
        const t = setInterval(() => fn().catch(() => undefined), ms);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}

const RULE_DOT: Record<string, string> = { pass: 'bg-green-500', fail: 'bg-red-500', flag: 'bg-amber-500' };

function AuditStep({ step, detail }: { step: string; detail: any }) {
    if (step === 'policy_evaluation' && Array.isArray(detail?.rules)) {
        return (
            <div className="space-y-1">
                <p className="text-sm">
                    Decision: <strong>{detail.decision}</strong>
                    {detail.refundCents > 0 && ` · ${formatMoney(detail.refundCents)}`}
                </p>
                <ul className="space-y-1">
                    {detail.rules.map((r: any, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${RULE_DOT[r.outcome] ?? 'bg-gray-400'}`} />
                            <span>
                                <span className="font-medium">{r.rule}</span>: {r.detail}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
    return <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(detail, null, 2)}</pre>;
}

export default function AdminPage() {
    const { filter, selectedId, setFilter, select } = useAdminStore();
    const [rows, setRows] = useState<RefundListItem[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [detail, setDetail] = useState<RefundDetail | null>(null);

    const load = useCallback(async () => {
        const [list, s] = await Promise.all([api.listRefunds(filter === 'ALL' ? undefined : filter), api.stats()]);
        setRows(list);
        setStats(s);
    }, [filter]);

    usePolling(load, [load]);

    useEffect(() => {
        if (!selectedId) return setDetail(null);
        api.getRefund(selectedId).then(setDetail).catch(() => setDetail(null));
    }, [selectedId]);

    const tiles: [string, number | undefined][] = [
        ['Total', stats?.total],
        ['Approved', stats?.byDecision.APPROVED],
        ['Denied', stats?.byDecision.DENIED],
        ['Escalated', stats?.byDecision.ESCALATED],
        ['Injection flagged', stats?.injectionFlagged],
    ];

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {tiles.map(([label, value]) => (
                    <Card key={label}>
                        <CardHeader className="pb-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">{value ?? '–'}</CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle>Refund requests</CardTitle>
                    <div className="flex gap-1">
                        {FILTERS.map((f) => (
                            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
                                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Order</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Claim</TableHead>
                                <TableHead>Decision</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Flags</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                                        No requests yet. Submit one from the customer page.
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((r) => (
                                <TableRow key={r.id} className="cursor-pointer" onClick={() => select(r.id)}>
                                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>{r.submittedOrderRef}</TableCell>
                                    <TableCell className="text-xs">{r.submittedEmail}</TableCell>
                                    <TableCell className="text-xs">{r.claimType ?? '–'}</TableCell>
                                    <TableCell>
                                        <DecisionBadge decision={r.decision} />
                                    </TableCell>
                                    <TableCell className="text-right">{r.refundCents ? formatMoney(r.refundCents) : '–'}</TableCell>
                                    <TableCell className="space-x-1">
                                        {r.injectionFlagged && <Badge variant="destructive">Injection</Badge>}
                                        {r.aiUsed && <Badge variant="secondary">LLM</Badge>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Sheet open={!!selectedId} onOpenChange={(o) => !o && select(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                    <SheetHeader>
                        <SheetTitle>Request detail</SheetTitle>
                        <SheetDescription>{detail ? `${detail.submittedOrderRef} · ${detail.submittedEmail}` : 'Loading…'}</SheetDescription>
                    </SheetHeader>
                    {detail && (
                        <div className="space-y-5 p-4">
                            <div className="flex items-center gap-2">
                                <DecisionBadge decision={detail.decision} />
                                {detail.refundCents > 0 && <span className="font-medium">{formatMoney(detail.refundCents)}</span>}
                            </div>
                            <section>
                                <h4 className="mb-1 text-sm font-semibold">Customer message</h4>
                                <p className="whitespace-pre-wrap rounded bg-muted p-2 text-sm">{detail.message}</p>
                            </section>
                            <section>
                                <h4 className="mb-1 text-sm font-semibold">Reply sent</h4>
                                <p className="whitespace-pre-wrap rounded border p-2 text-sm">{detail.reply}</p>
                            </section>
                            <section>
                                <h4 className="mb-2 text-sm font-semibold">Audit trail</h4>
                                <ol className="space-y-3">
                                    {detail.auditLogs.map((a) => (
                                        <li key={a.id} className="space-y-1 border-l-2 pl-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.step.replace(/_/g, ' ')}</p>
                                            <AuditStep step={a.step} detail={a.detail} />
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}