import React from 'react';
import { cn } from '../../lib/utils';

export function Header() {
    return (
        <header className="border-b h-14 flex items-center px-4 bg-background z-50 sticky top-0">
            <h1 className="font-semibold text-lg">Migration Dashboard</h1>
            <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-muted-foreground">v1.0.0</span>
            </div>
        </header>
    );
}
