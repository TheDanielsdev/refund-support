import { Badge } from '@/components/ui/badge';
import type { Decision } from '@/lib/api';

const STYLES: Record<Decision, string> = {
    APPROVED: 'bg-green-100 text-green-800 border-green-300',
    DENIED: 'bg-red-100 text-red-800 border-red-300',
    ESCALATED: 'bg-amber-100 text-amber-800 border-amber-300',
};

export function DecisionBadge({ decision }: { decision: Decision }) {
    return (
        <Badge variant="outline" className={STYLES[decision]}>
            {decision}
        </Badge>
    );
}