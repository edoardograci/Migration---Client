import React, { useMemo } from 'react';
import { useDesignerStore } from '../../stores/designerStore';
import { DesignerCard } from './DesignerCard';
import { Sidebar } from '../Layout/Sidebar';
import { Loader2, Wand2, Layers, Database } from 'lucide-react';
import { ProcessingModal } from '../Shared/ProcessingModal';
import { WebPComparisonModal } from '../Shared/WebPComparisonModal';
import { Button } from '../ui/button';

export function DesignerGrid() {
    const [comparisonData, setComparisonData] = React.useState<{ url: string, id: string, name: string } | null>(null);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [operationInProgress, setOperationInProgress] = React.useState(false);

    const {
        designers,
        isLoading,
        selectedIds,
        toggleSelect,
        selectAll,
        setSelectedIds,
        clearSelection,
        filters,
        setFilter,
        fetchDesigners
    } = useDesignerStore();

    const filteredDesigners = useMemo(() => {
        return designers.filter(d => {
            // Notion status filter
            if (filters.notionStatus !== 'all' && d.notionStatus !== filters.notionStatus) {
                return false;
            }

            // Migration status filter
            if (filters.status === 'complete') {
                // Has all required fields
                if (!d.name || !d.coverUrl) return false;
            }
            if (filters.status === 'incomplete') {
                // Missing required fields
                if (d.name && d.coverUrl) return false;
            }
            if (filters.status === 'migrated' && !d.status?.migrated) return false;

            // City filter
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
                            <Button variant="outline" size="sm" onClick={selectAll} className="justify-start">Select All</Button>
                            <Button variant="outline" size="sm" onClick={clearSelection} className="justify-start">Clear Selection</Button>
                            <div className="text-xs text-muted-foreground px-2 mt-1">
                                {selectedIds.size} selected
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium mb-2">Actions</h3>
                        <div className="flex flex-col gap-2">
                            {/* Single Item Operations */}
                            <div className="text-xs text-muted-foreground px-2 mb-1">Single Item</div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={selectedIds.size !== 1}
                                onClick={() => {
                                    const id = Array.from(selectedIds)[0];
                                    const designer = designers.find(d => d.id === id);
                                    if (designer?.coverUrl) setComparisonData({
                                        url: designer.coverUrl,
                                        id: designer.id,
                                        name: designer.name
                                    });
                                }}
                                className="w-full justify-start gap-2"
                            >
                                <Wand2 className="w-4 h-4" /> Convert to WebP
                            </Button>

                            {/* Batch Operations */}
                            <div className="text-xs text-muted-foreground px-2 mt-3 mb-1">
                                Batch ({selectedIds.size} selected)
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                disabled={selectedIds.size === 0 || operationInProgress}
                                onClick={async () => {
                                    setOperationInProgress(true);
                                    try {
                                        await fetchDesigners();
                                    } finally {
                                        setOperationInProgress(false);
                                    }
                                }}
                                className="w-full justify-start gap-2"
                            >
                                <Database className={`w-4 h-4 ${operationInProgress ? 'animate-spin' : ''}`} /> Refresh from Notion
                            </Button>

                            <Button
                                variant="default"
                                size="sm"
                                disabled={selectedIds.size === 0 || operationInProgress}
                                onClick={() => setIsProcessing(true)}
                                className="w-full justify-start gap-2"
                            >
                                {operationInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                                Migrate Selected ({selectedIds.size})
                            </Button>

                            {operationInProgress && (
                                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Processing...</p>
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions */}
                            <div className="text-xs text-muted-foreground px-2 mt-3 mb-1">Quick Actions</div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    const unmigrated = designers.filter(d => !d.status?.migrated);
                                    setSelectedIds(new Set(unmigrated.map(d => d.id)));
                                }}
                                className="w-full justify-start text-xs border"
                            >
                                Select Unmigrated Only
                            </Button>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium mb-2">Notion Status</h3>
                        <select
                            className="w-full text-sm border rounded px-2 py-1 bg-background"
                            value={filters.notionStatus}
                            onChange={(e) => setFilter('notionStatus', e.target.value as any)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="Published">Published</option>
                            <option value="Draft">Draft</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium mb-2">Migration Status</h3>
                        <select
                            className="w-full text-sm border rounded px-2 py-1 bg-background"
                            value={filters.status}
                            onChange={(e) => setFilter('status', e.target.value as any)}
                        >
                            <option value="all">All Items</option>
                            <option value="migrated">Already Migrated</option>
                            <option value="complete">Ready to Migrate</option>
                            <option value="incomplete">Missing Data</option>
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
                isOpen={!!comparisonData}
                imageUrl={comparisonData?.url || ''}
                targetId={comparisonData?.id || ''}
                targetName={comparisonData?.name || ''}
                targetType="designers"
                onClose={() => setComparisonData(null)}
                onAccept={(result: any) => {
                    console.log('Accepted conversion:', result);
                    setComparisonData(null);
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
