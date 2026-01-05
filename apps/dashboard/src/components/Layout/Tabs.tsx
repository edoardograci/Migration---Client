import React from 'react';
import { cn } from '../../lib/utils';

interface TabsProps {
    value: string;
    onValueChange: (value: string) => void;
    items: { value: string; label: string }[];
}

export function Tabs({ value, onValueChange, items }: TabsProps) {
    return (
        <div className="flex items-center border-b px-4">
            {items.map((item) => (
                <button
                    key={item.value}
                    onClick={() => onValueChange(item.value)}
                    className={cn(
                        "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                        value === item.value
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}
