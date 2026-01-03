import React, { useMemo, useEffect } from 'react';
import { useMoodboardStore } from '../../stores/moodboardStore';
import { MoodboardCard } from './MoodboardCard';
import { Sidebar } from '../Layout/Sidebar';
import { Loader2, RefreshCcw, Layers, Search, Filter } from 'lucide-react';
import { ProcessingModal } from '../Shared/ProcessingModal';
import { Button } from '../ui/button';

export function MoodboardGrid() {
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');

    const {
        products,
        isLoading,
        selectedIds,
        toggleSelect,
        selectAll,
        clearSelection,
        filters,
        setFilter,
        fetchProducts
    } = useMoodboardStore();

    useEffect(() => {
        if (products.length === 0) fetchProducts();
    }, []);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Text search
            if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !p.designer?.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }

            // Status filters
            if (filters.status === 'complete') {
                if (!p.name || !p.images?.length) return false;
            }
            if (filters.status === 'migrated' && !p.status?.migrated) return false;

            // City filter
            if (filters.city && p.city !== filters.city) return false;

            return true;
        });
    }, [products, filters, searchTerm]);


    if (isLoading && products.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex h-full">
            <Sidebar>
                <div className="space-y-6">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full pl-8 pr-2 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div>
                        <h3 className="text-sm font-medium mb-2">Selection</h3>
                        <div className="flex flex-col gap-2">
                            <button onClick={selectAll} className="text-sm text-left px-2 py-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">Select All</button>
                            <button onClick={clearSelection} className="text-sm text-left px-2 py-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">Clear Selection</button>
                            <div className="text-xs text-muted-foreground px-2 mt-1">
                                {selectedIds.size} selected
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium mb-2">Actions</h3>
                        <div className="flex flex-col gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={selectedIds.size === 0}
                                onClick={() => setIsProcessing(true)}
                                className="w-full justify-start gap-2"
                            >
                                <Layers className="w-4 h-4" /> Batch Migrate
                            </Button>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium mb-2">Status</h3>
                        <select
                            className="w-full text-sm border rounded px-2 py-1 bg-background"
                            value={filters.status}
                            onChange={(e) => setFilter('status', e.target.value as any)}
                        >
                            <option value="all">All Status</option>
                            <option value="migrated">Migrated</option>
                            <option value="complete">Complete / Has Images</option>
                        </select>
                    </div>

                    <button
                        onClick={() => fetchProducts()}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted transition-colors mt-auto"
                    >
                        <RefreshCcw className="w-3 h-3" /> Refresh Items
                    </button>
                </div>
            </Sidebar>

            <div className="flex-1 p-6 overflow-auto bg-muted/10">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {filteredProducts.map(product => (
                        <MoodboardCard
                            key={product.id}
                            product={product}
                            selected={selectedIds.has(product.id)}
                            onSelect={() => toggleSelect(product.id)}
                        />
                    ))}
                </div>
                {filteredProducts.length === 0 && (
                    <div className="flex flex-col h-64 items-center justify-center text-muted-foreground gap-2">
                        <Filter className="w-8 h-8 opacity-20" />
                        <p>No products found matching filters.</p>
                    </div>
                )}
            </div>

            <ProcessingModal
                isOpen={isProcessing}
                items={Array.from(selectedIds)}
                type="moodboard"
                onClose={() => setIsProcessing(false)}
                onComplete={() => {
                    setIsProcessing(false);
                    clearSelection();
                    fetchProducts();
                }}
            />
        </div>
    );
}
