import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Loader2, AlertTriangle, Check } from 'lucide-react';
import { migrationApi } from '../../api';
import { useDesignerStore } from '../../stores/designerStore';

interface ProcessingModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: string[];
    type: 'designers' | 'moodboard';
    onComplete?: () => void;
}

interface JobStatus {
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: {
        total: number;
        completed: number;
        failed: number;
        current?: string;
    };
    error?: string;
}

export function ProcessingModal({ isOpen, onClose, items, type, onComplete }: ProcessingModalProps) {
    const [jobId, setJobId] = useState<string | null>(null);
    const [status, setStatus] = useState<JobStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { refreshDesigner } = useDesignerStore();

    const startJob = useCallback(async () => {
        setError(null);
        try {
            const res = await migrationApi.execute({ type, ids: items });
            setJobId(res.jobId);
        } catch (err: any) {
            setError(err.message || 'Failed to start job');
        }
    }, [type, items]);

    const handleCancel = useCallback(async () => {
        if (jobId) {
            try {
                await migrationApi.cancel(jobId);
            } catch (err) {
                console.error('Failed to cancel job:', err);
            }
        }
        onClose();
    }, [jobId, onClose]);

    useEffect(() => {
        if (isOpen && items.length > 0) {
            startJob();
        } else {
            setJobId(null);
            setStatus(null);
            setError(null);
        }
    }, [isOpen, items, startJob]);

    useEffect(() => {
        if (!jobId) return;

        const interval = setInterval(async () => {
            try {
                const data = await migrationApi.getStatus(jobId);
                setStatus(data);

                if (['completed', 'failed', 'cancelled'].includes(data.status)) {
                    clearInterval(interval);
                    if (data.status === 'completed') {
                        // Refresh specific items
                        if (type === 'designers') {
                            await Promise.all(items.map(id => refreshDesigner(id)));
                        }
                        if (onComplete) {
                            setTimeout(onComplete, 1000);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to poll status:', err);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [jobId, type, items, refreshDesigner, onComplete]);

    if (!isOpen) return null;

    const progressPercent = status?.progress
        ? Math.round((status.progress.completed / status.progress.total) * 100)
        : 0;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent className="sm:max-w-md bg-white">
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
