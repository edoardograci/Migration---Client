import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { imageApi } from '../../api';
import { Loader2, Check, X, Image as ImageIcon } from 'lucide-react';

interface BatchImage {
    id: string;
    url: string;
    name: string;
}

interface BatchResult {
    id: string;
    name: string;
    success: boolean;
    originalSize?: number;
    newSize?: number;
    savings?: number;
    ssim?: number;
    error?: string;
}

interface BatchOptimizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: BatchImage[];
    onComplete: (results: BatchResult[]) => void;
}

function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function BatchOptimizationModal({
    isOpen,
    onClose,
    images,
    onComplete
}: BatchOptimizationModalProps) {
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState<BatchResult[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const startOptimization = async () => {
        setProcessing(true);
        setResults([]);
        setCurrentIndex(0);

        const optimizationResults: BatchResult[] = [];

        for (let i = 0; i < images.length; i++) {
            setCurrentIndex(i);
            const img = images[i];

            try {
                const result = await imageApi.convert(img.url);
                optimizationResults.push({
                    id: img.id,
                    name: img.name,
                    success: true,
                    originalSize: result.originalSize,
                    newSize: result.convertedSize,
                    savings: result.reductionPercent,
                    ssim: result.ssimScore,
                });
            } catch (err: any) {
                optimizationResults.push({
                    id: img.id,
                    name: img.name,
                    success: false,
                    error: err.message || 'Conversion failed',
                });
            }

            setResults([...optimizationResults]);
        }

        setProcessing(false);
        onComplete(optimizationResults);
    };

    const handleClose = () => {
        if (!processing) {
            setResults([]);
            setCurrentIndex(0);
            onClose();
        }
    };

    const totalSavings = results
        .filter(r => r.success && r.originalSize && r.newSize)
        .reduce((acc, r) => acc + ((r.originalSize || 0) - (r.newSize || 0)), 0);

    const successCount = results.filter(r => r.success).length;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Batch Image Optimization</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto">
                    {!processing && results.length === 0 && (
                        <div className="py-8 text-center">
                            <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground mb-4">
                                Ready to optimize {images.length} image{images.length !== 1 ? 's' : ''}
                            </p>
                            <Button onClick={startOptimization}>
                                Start Optimization
                            </Button>
                        </div>
                    )}

                    {processing && (
                        <div className="py-8">
                            <div className="flex items-center justify-center gap-3 mb-4">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                <span className="text-sm">
                                    Processing {currentIndex + 1} of {images.length}...
                                </span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${((currentIndex + 1) / images.length) * 100}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground text-center mt-2">
                                {images[currentIndex]?.name}
                            </p>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-2">
                            {results.map((result) => (
                                <div
                                    key={result.id}
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {result.success ? (
                                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                        ) : (
                                            <X className="w-4 h-4 text-red-600 flex-shrink-0" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium truncate">
                                                {result.name}
                                            </div>
                                            {result.success ? (
                                                <div className="text-xs text-muted-foreground">
                                                    {formatSize(result.originalSize || 0)} → {formatSize(result.newSize || 0)}
                                                    <span className="text-green-600 ml-2">
                                                        ({result.savings}% smaller)
                                                    </span>
                                                    {result.ssim && (
                                                        <span className="text-muted-foreground ml-2">
                                                            SSIM: {(result.ssim * 100).toFixed(1)}%
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-red-600">
                                                    {result.error}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {!processing && (
                                <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div className="text-sm font-medium text-green-900 dark:text-green-100">
                                        Total Savings: {formatSize(totalSavings)}
                                    </div>
                                    <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                                        {successCount} of {results.length} images optimized successfully
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="border-t pt-4 flex justify-end">
                    <Button
                        variant={processing || results.length === 0 ? "outline" : "default"}
                        onClick={handleClose}
                        disabled={processing}
                    >
                        {processing ? 'Processing...' : results.length > 0 ? 'Done' : 'Cancel'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
