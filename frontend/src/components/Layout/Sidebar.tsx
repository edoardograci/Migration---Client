import React from 'react';
import { cn } from '../../lib/utils';

export function Sidebar({ className, children }: { className?: string, children: React.ReactNode }) {
    return (
        <aside className={cn("w-64 border-r bg-background flex flex-col", className)}>
            <div className="p-4 border-b font-medium">Filters & Actions</div>
            <div className="flex-1 overflow-auto p-4">
                {children}
            </div>
        </aside>
    );
}
