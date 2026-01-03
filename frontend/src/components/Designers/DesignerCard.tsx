import React from 'react';
import { Designer } from '../../types';
import { cn } from '../../lib/utils';
import { Check, AlertTriangle, ExternalLink, Instagram, Globe } from 'lucide-react';

interface DesignerCardProps {
    designer: Designer;
    selected: boolean;
    onSelect: () => void;
    onMigrate?: () => void;
}

export function DesignerCard({ designer, selected, onSelect, onMigrate }: DesignerCardProps) {
    const isMigrated = !!designer.status?.migrated;
    const hasError = !!designer.status?.error;

    // Validation
    const missingFields = [];
    if (!designer.name) missingFields.push('Name');
    if (!designer.coverUrl) missingFields.push('Cover Image');
    if (!designer.website && !designer.instagram) missingFields.push('Website/IG');
    const isValid = missingFields.length === 0;

    return (
        <div
            className={cn(
                "group relative border rounded-lg overflow-hidden transition-all hover:shadow-md",
                selected ? "ring-2 ring-primary border-primary" : "border-border",
                !isValid && "border-yellow-500/50 bg-yellow-50/10"
            )}
            onClick={onSelect}
        >
            {/* Selection Checkbox */}
            <div className="absolute top-2 left-2 z-10">
                <div className={cn(
                    "w-5 h-5 rounded border bg-background flex items-center justify-center transition-colors cursor-pointer",
                    selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/50 hover:border-primary"
                )}>
                    {selected && <Check className="w-3.5 h-3.5" />}
                </div>
            </div>

            {/* Status Indicators */}
            <div className="absolute top-2 right-2 z-10 flex gap-1">
                {isMigrated && (
                    <div className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        <Check className="w-3 h-3" /> Migrated
                    </div>
                )}
                {!isValid && (
                    <div className="bg-yellow-500 text-yellow-50 text-xs px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1" title={`Missing: ${missingFields.join(', ')}`}>
                        <AlertTriangle className="w-3 h-3" /> Incomplete
                    </div>
                )}
            </div>

            {/* Image */}
            <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {designer.coverUrl ? (
                    <img
                        src={designer.coverUrl}
                        alt={designer.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Image
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-3">
                <h3 className="font-semibold truncate" title={designer.name}>{designer.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{designer.city || 'Unknown City'}</p>

                <div className="mt-3 flex items-center gap-2">
                    {designer.website && (
                        <a href={designer.website} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 p-1 hover:bg-muted rounded"
                            onClick={e => e.stopPropagation()}>
                            <Globe className="w-3 h-3" /> Web
                        </a>
                    )}
                    {designer.instagram && (
                        <a href={designer.instagram} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-pink-600 flex items-center gap-1 p-1 hover:bg-muted rounded"
                            onClick={e => e.stopPropagation()}>
                            <Instagram className="w-3 h-3" /> IG
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
