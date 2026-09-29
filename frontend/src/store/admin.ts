import { type Decision } from '@/lib/api';
import { create } from 'zustand';

interface AdminState {
    filter: Decision | 'ALL';
    selectedId: string | null;
    setFilter: (f: Decision | 'ALL') => void;
    select: (id: string | null) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
    filter: 'ALL',
    selectedId: null,
    setFilter: (filter) => set({ filter }),
    select: (selectedId) => set({ selectedId }),
}));