import { MoodboardProduct } from '../../types';
import { cn } from '../../lib/utils';
import { ExternalLink, Check, AlertCircle, RefreshCcw } from 'lucide-react';

interface MoodboardCardProps {
    product: MoodboardProduct;
    selected: boolean;
    onSelect: () => void;
}

export function MoodboardCard({ product, selected, onSelect }: MoodboardCardProps) {
    const isMigrated = product.status?.migrated;
    const isComplete = product.name && product.images?.length > 0;

    return (
        <div
            className={cn(
                "group relative flex flex-col bg-card rounded-lg border transition-all hover:shadow-md overflow-hidden cursor-pointer",
                selected ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"
            )}
            onClick={onSelect}
        >
            {/* Selector Checkbox (Overlay) */}
            <div className={cn(
                "absolute top-2 right-2 z-10 w-5 h-5 rounded border bg-background flex items-center justify-center transition-opacity",
                selected ? "bg-primary border-primary opacity-100" : "opacity-0 group-hover:opacity-100 border-muted-foreground"
            )}>
                {selected && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>

            {/* Image Preview */}
            <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {product.images?.[0]?.url ? (
                    <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="w-full h-full object-cover grayscale-[0.2] transition-transform group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Image
                    </div>
                )}

                {/* Badges */}
                <div className="absolute bottom-2 left-2 flex gap-1">
                    {isMigrated && (
                        <div className="bg-green-500/90 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Migrated
                        </div>
                    )}
                    {product.status?.needsUpdate && (
                        <div className="bg-blue-500/90 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <RefreshCcw className="w-2.5 h-2.5" /> Update
                        </div>
                    )}
                    {!isComplete && (
                        <div className="bg-yellow-500/90 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Incomplete
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-3">
                <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className="font-semibold text-sm leading-tight truncate">{product.name}</h3>
                    {product.link && (
                        <a
                            href={product.link}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:bg-muted rounded transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </a>
                    )}
                </div>

                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{product.designer || 'Unknown Designer'}</p>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {product.year || 'N/A'}
                        </span>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {product.images?.length || 0} Images
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
