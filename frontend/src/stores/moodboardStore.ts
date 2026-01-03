import { create } from 'zustand';
import { notionApi, tursoApi } from '../api';
import { MoodboardProduct } from '../types';

interface MoodboardFilters {
    status: 'all' | 'migrated' | 'complete';
    city: string | null;
}

interface MoodboardState {
    products: MoodboardProduct[];
    isLoading: boolean;
    selectedIds: Set<string>;
    filters: MoodboardFilters;

    fetchProducts: () => Promise<void>;
    toggleSelect: (id: string) => void;
    selectAll: () => void;
    clearSelection: () => void;
    setFilter: (key: keyof MoodboardFilters, value: any) => void;
}

export const useMoodboardStore = create<MoodboardState>((set, get) => ({
    products: [],
    isLoading: false,
    selectedIds: new Set(),
    filters: {
        status: 'all',
        city: null
    },

    fetchProducts: async () => {
        set({ isLoading: true });
        try {
            const data = await notionApi.getMoodboard();
            const statusMap = await tursoApi.checkStatus(data.products.map((d: any) => d.id), 'moodboard');

            const products = data.products.map((d: any) => ({
                ...d,
                status: statusMap.statuses[d.id]
            }));

            set({ products, isLoading: false });
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
        selectedIds: new Set(state.products.map(d => d.id))
    })),

    clearSelection: () => set({ selectedIds: new Set() }),

    setFilter: (key, value) => set((state) => ({
        filters: { ...state.filters, [key]: value }
    })),
}));
