import React, { useMemo } from 'react';
import { useDesignerStore } from '../../stores/designerStore';
import { DesignerCard } from './DesignerCard';
import { Sidebar } from '../Layout/Sidebar';
import { Loader2, RefreshCcw, Wand2, Layers } from 'lucide-react';
import { ProcessingModal } from '../Shared/ProcessingModal';
import { WebPComparisonModal } from '../Shared/WebPComparisonModal';
import { Button } from '../ui/button';

export function DesignerGrid() {
    const [comparisonUrl, setComparisonUrl] = React.useState<string | null>(null);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const {
        designers,
        isLoading,
        selectedIds,
        toggleSelect,
        selectAll,
        clearSelection,
        filters,
        setFilter,
        fetchDesigners
    } = useDesignerStore();

    const filteredDesigners = useMemo(() => {
        return designers.filter(d => {
            if (filters.status === 'complete') {
                // Logic for complete
                if (!d.name || !d.coverUrl) return false;
            }
            if (filters.status === 'migrated' && !d.status?.migrated) return false;
            if (filters.city && d.city !== filters.city) return false;
            return true;
        });
    }, [designers, filters]);

    // Extract unique cities
    const cities = useMemo(() =>
        Array.from(new Set(designers.map(d => d.city).filter(Boolean))).sort(),
        [designers]);

    if (isLoading && designers.length === 0) {
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
                                disabled={selectedIds.size !== 1}
                                onClick={() => {
                                    const id = Array.from(selectedIds)[0];
                                    const designer = designers.find(d => d.id === id);
                                    if (designer?.coverUrl) setComparisonUrl(designer.coverUrl);
                                }}
                                className="w-full justify-start gap-2"
                            >
                                <Wand2 className="w-4 h-4" /> Convert Image
                            </Button>
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
                            onChange={(e) => setFilter('status', e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="migrated">Migrated</option>
                            <option value="complete">Complete</option>
                        </select>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium mb-2">City</h3>
                        <select
                            className="w-full text-sm border rounded px-2 py-1 bg-background"
                            value={filters.city || ''}
                            onChange={(e) => setFilter('city', e.target.value || null)}
                        >
                            <option value="">All Cities</option>
                            {cities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => fetchDesigners()}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted transition-colors"
                    >
                        <RefreshCcw className="w-3 h-3" /> Refresh Data
                    </button>
                </div>
            </Sidebar>

            <div className="flex-1 p-6 overflow-auto bg-muted/10">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredDesigners.map(designer => (
                        <DesignerCard
                            key={designer.id}
                            designer={designer}
                            selected={selectedIds.has(designer.id)}
                            onSelect={() => toggleSelect(designer.id)}
                        />
                    ))}
                </div>
                {filteredDesigners.length === 0 && (
                    <div className="flex h-64 items-center justify-center text-muted-foreground">
                        No designers found matching filters.
                    </div>
                )}
            </div>

            <WebPComparisonModal
                isOpen={!!comparisonUrl}
                imageUrl={comparisonUrl || ''}
                onClose={() => setComparisonUrl(null)}
                onAccept={(result: any) => {
                    console.log('Accepted conversion:', result);
                    setComparisonUrl(null);
                }}
            />

            <ProcessingModal
                isOpen={isProcessing}
                items={Array.from(selectedIds)}
                type="designers"
                onClose={() => setIsProcessing(false)}
                onComplete={() => {
                    setIsProcessing(false);
                    clearSelection();
                    fetchDesigners();
                }}
            />
        </div>
    );
}
