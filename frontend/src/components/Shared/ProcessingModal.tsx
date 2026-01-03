import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Loader2, Check, AlertTriangle, X } from 'lucide-react';
import { migrationApi } from '../../api';

interface ProcessingModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: string[];
    type: 'designers' | 'moodboard';
    onComplete: () => void;
}

export function ProcessingModal({ isOpen, onClose, items, type, onComplete }: ProcessingModalProps) {
    const [jobId, setJobId] = useState<string | null>(null);
    const [status, setStatus] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && items.length > 0 && !jobId) {
            startJob();
        }
    }, [isOpen, items]);

    useEffect(() => {
        if (!jobId) return;

        const interval = setInterval(async () => {
            try {
                const data = await migrationApi.getStatus(jobId);
                setStatus(data);
                if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
                    clearInterval(interval);
                    if (data.status === 'completed') {
                        setTimeout(onComplete, 1000); // Trigger refresh after short delay
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [jobId]);

    const startJob = async () => {
        setError(null);
        try {
            const res = await migrationApi.execute({ type, ids: items });
            setJobId(res.jobId);
        } catch (err: any) {
            setError(err.message || 'Failed to start job');
        }
    };

    const handleCancel = async () => {
        if (jobId) {
            await migrationApi.cancel(jobId);
        }
        onClose();
    };

    if (!isOpen) return null;

    const progressPercent = status?.progress
        ? Math.round((status.progress.completed / status.progress.total) * 100)
        : 0;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{status?.status === 'completed' ? 'Processing Complete' : 'Processing Items'}</DialogTitle>
                </DialogHeader>

                <div className="py-6 space-y-4">
                    {error && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded flex items-center gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    {!error && !status && (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {status && (
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{status.status.toUpperCase()}</span>
                                <span>{status.progress.completed} / {status.progress.total}</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>

                            {status.progress.current && (
                                <p className="text-xs text-muted-foreground truncate animate-pulse">
                                    {status.progress.current}...
                                </p>
                            )}

                            {status.status === 'completed' && (
                                <div className="text-green-600 bg-green-50 p-3 rounded text-sm flex items-center gap-2">
                                    <Check className="w-4 h-4" />
                                    Successfully migrated {status.progress.completed} items.
                                    {status.progress.failed > 0 && ` (${status.progress.failed} failed)`}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {status?.status === 'completed' ? (
                        <Button onClick={onClose}>Close</Button>
                    ) : (
                        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
