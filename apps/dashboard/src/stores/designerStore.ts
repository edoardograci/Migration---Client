import { create } from 'zustand';
import { notionApi } from '../api';
import { Designer } from '@repo/shared-types';

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

    fetchDesigners: (force?: boolean) => Promise<void>;
    refreshDesigner: (id: string) => Promise<void>;
    toggleSelect: (id: string) => void;
    selectAll: () => void;
    setSelectedIds: (ids: Set<string>) => void;
    clearSelection: () => void;
    setFilter: (key: keyof DesignerFilters, value: any) => void;
    updateLocalDesigner: (id: string, updates: Partial<Designer>) => void;
}

// Helper to get initial state from localStorage
const STORAGE_KEY = 'migrator_designers_v1';
const getInitialDesigners = (): Designer[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

export const useDesignerStore = create<DesignerState>((set, get) => ({
    designers: getInitialDesigners(),
    isLoading: false,
    selectedIds: new Set(),
    filters: {
        status: 'all',
        notionStatus: 'all',
        city: null
    },

    fetchDesigners: async (force = false) => {
        // Only fetch if forced OR if we have no cached data
        if (!force && get().designers.length > 0) return;

        set({ isLoading: true });
        try {
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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(designers));
        } catch (err) {
            console.error(err);
            set({ isLoading: false });
        }
    },

    refreshDesigner: async (id) => {
        try {
            const data = await notionApi.compareStatus('designers');
            const updated = data.items.find((d: any) => d.id === id);

            if (updated) {
                const newDesigners = get().designers.map(d =>
                    d.id === id ? {
                        ...updated,
                        status: {
                            migrated: updated.inTurso,
                            migratedAt: updated.lastMigrated,
                            needsUpdate: updated.needsUpdate,
                            error: null
                        }
                    } : d
                );
                set({ designers: newDesigners });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newDesigners));
            }
        } catch (err) {
            console.error(err);
        }
    },

    toggleSelect: (id) => set((state) => {
        const newSelected = new Set(state.selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        return { selectedIds: newSelected };
    }),

    setSelectedIds: (ids) => set({ selectedIds: ids }),

    selectAll: () => set((state) => {
        const filtered = state.designers.filter(d => {
            if (state.filters.notionStatus !== 'all' && d.notionStatus !== state.filters.notionStatus) return false;
            if (state.filters.city && d.city !== state.filters.city) return false;
            return true;
        });
        return { selectedIds: new Set(filtered.map(d => d.id)) };
    }),

    clearSelection: () => set({ selectedIds: new Set() }),

    setFilter: (key, value) => set((state) => ({
        filters: { ...state.filters, [key]: value }
    })),

    updateLocalDesigner: (id, updates) => set((state) => {
        const newDesigners = state.designers.map(d =>
            d.id === id ? { ...d, ...updates } : d
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newDesigners));
        return { designers: newDesigners };
    })
}));
