import { create } from 'zustand';
import { notionApi } from '../api';
import { Designer } from '../types';

interface DesignerFilters {
    status: 'all' | 'complete' | 'incomplete' | 'migrated';
    notionStatus: 'all' | 'Published' | 'Draft' | 'Archived';
    city: string | null;
}

interface DesignerState {
    designers: Designer[];
    isLoading: boolean;
    selectedIds: Set<string>;
    filters: DesignerFilters;

    fetchDesigners: () => Promise<void>;
    toggleSelect: (id: string) => void;
    selectAll: () => void;
    clearSelection: () => void;
    setFilter: (key: keyof DesignerFilters, value: any) => void;
}

export const useDesignerStore = create<DesignerState>((set) => ({
    designers: [],
    isLoading: false,
    selectedIds: new Set(),
    filters: {
        status: 'all',
        notionStatus: 'all',
        city: null
    },

    fetchDesigners: async () => {
        set({ isLoading: true });
        try {
            // Fetch ALL designers via status comparison endpoint
            const data = await notionApi.compareStatus('designers');

            const designers = data.items.map((d: any) => ({
                ...d,
                status: {
                    migrated: d.inTurso,
                    migratedAt: d.lastMigrated,
                    needsUpdate: d.needsUpdate,
                    error: null
                }
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
