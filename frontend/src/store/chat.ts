import { api, type Decision } from '@/lib/api';
import { create } from 'zustand';

export interface ChatMessage {
    id: string;
    role: 'customer' | 'agent';
    text: string;
    decision?: Decision;
    refundCents?: number;
}

interface ChatState {
    email: string;
    orderNumber: string;
    messages: ChatMessage[];
    sending: boolean;
    error: string | null;
    setField: (field: 'email' | 'orderNumber', value: string) => void;
    send: (message: string) => Promise<void>;
    reset: () => void;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useChatStore = create<ChatState>((set, get) => ({
    email: '',
    orderNumber: '',
    messages: [],
    sending: false,
    error: null,
    setField: (field, value) => set({ [field]: value } as Pick<ChatState, 'email' | 'orderNumber'>),
    send: async (message) => {
        const { email, orderNumber } = get();
        set((s) => ({
            messages: [...s.messages, { id: uid(), role: 'customer', text: message }],
            sending: true,
            error: null,
        }));
        try {
            const r = await api.submitRefund({ email, orderNumber, message });
            set((s) => ({
                messages: [
                    ...s.messages,
                    { id: r.id, role: 'agent', text: r.reply, decision: r.decision, refundCents: r.refundCents },
                ],
                sending: false,
            }));
        } catch (e) {
            set({ sending: false, error: (e as Error).message });
        }
    },
    reset: () => set({ messages: [], error: null }),
}));