import { create } from 'zustand';
import { notionApi, tursoApi } from '../api';
import { Designer } from '../types';

interface DesignerState {
    designers: Designer[];
    isLoading: boolean;
    selectedIds: Set<string>;
    filters: {
        status: 'all' | 'complete' | 'incomplete' | 'migrated';
        city: string | null;
    };

    fetchDesigners: () => Promise<void>;
    toggleSelect: (id: string) => void;
    selectAll: () => void;
    clearSelection: () => void;
    setFilter: (key: string, value: any) => void;
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
    designers: [],
    isLoading: false,
    selectedIds: new Set(),
    filters: { status: 'all', city: null },

    fetchDesigners: async () => {
        set({ isLoading: true });
        try {
            const data = await notionApi.getDesigners();
            const statusMap = await tursoApi.checkStatus(data.designers.map((d: any) => d.notionId), 'designer');

            const designers = data.designers.map((d: any) => ({
                ...d,
                status: statusMap.statuses[d.notionId]
            }));

            set({ designers, isLoading: false });
        } catch (err) {
            console.error(err);
            set({ isLoading: false });
        }
    },

    toggleSelect: (id) => set((state) => {
        const newSelected = new Set(state.selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        return { selectedIds: newSelected };
    }),

    selectAll: () => set((state) => ({
        selectedIds: new Set(state.designers.map(d => d.id))
    })),

    clearSelection: () => set({ selectedIds: new Set() }),

    setFilter: (key, value) => set((state) => ({
        filters: { ...state.filters, [key]: value }
    }))
}));
