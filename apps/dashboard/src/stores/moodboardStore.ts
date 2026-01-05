import { create } from 'zustand';
import { notionApi } from '../api';
import { MoodboardProduct } from '@repo/shared-types';

interface MoodboardFilters {
    status: 'all' | 'migrated' | 'complete' | 'incomplete';
    notionStatus: 'all' | 'Published' | 'Draft' | 'Archived';
    city: string | null;
}

interface MoodboardState {
    products: MoodboardProduct[];
    isLoading: boolean;
    selectedIds: Set<string>;
    filters: MoodboardFilters;

    fetchProducts: (force?: boolean) => Promise<void>;
    toggleSelect: (id: string) => void;
    selectAll: () => void;
    clearSelection: () => void;
    setFilter: (key: keyof MoodboardFilters, value: any) => void;
}

// Helper to get initial state from localStorage
const STORAGE_KEY = 'migrator_moodboard_v1';
const getInitialProducts = (): MoodboardProduct[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

export const useMoodboardStore = create<MoodboardState>((set, get) => ({
    products: getInitialProducts(),
    isLoading: false,
    selectedIds: new Set(),
    filters: {
        status: 'all',
        notionStatus: 'all',
        city: null
    },

    fetchProducts: async (force = false) => {
        // Only fetch if forced OR if we have no cached data
        if (!force && get().products.length > 0) return;

        set({ isLoading: true });
        try {
            const data = await notionApi.compareStatus('moodboard');
            const products = data.items.map((d: any) => ({
                ...d,
                status: {
                    migrated: d.inTurso,
                    migratedAt: d.lastMigrated,
                    needsUpdate: d.needsUpdate,
                    error: null
                }
            }));

            set({ products, isLoading: false });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
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
