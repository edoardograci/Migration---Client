import { useState, useEffect } from 'react';
import { imageApi } from '../../api';
import { Loader2, Info } from 'lucide-react';

interface ImageAnalysisPanelProps {
    imageUrl: string;
    onConvert?: (result: any) => void;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ImageAnalysisPanel({ imageUrl }: ImageAnalysisPanelProps) {
    const [analysis, setAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function analyze() {
            if (!imageUrl) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const result = await imageApi.analyze(imageUrl);
                setAnalysis(result);
            } catch (err: any) {
                console.error('Analysis failed:', err);
                setError(err.message || 'Failed to analyze image');
            } finally {
                setLoading(false);
            }
        }
        analyze();
    }, [imageUrl]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Analyzing image...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="p-4 text-sm text-muted-foreground">
                No image to analyze
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Current Image Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg border">
                    <div className="text-xs text-muted-foreground mb-1">Current Size</div>
                    <div className="text-lg font-bold">{formatSize(analysis.metadata.size)}</div>
                    <div className="text-xs text-muted-foreground uppercase">
                        {analysis.metadata.format || 'Unknown'}
                    </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border">
                    <div className="text-xs text-muted-foreground mb-1">Dimensions</div>
                    <div className="text-lg font-bold">
                        {analysis.metadata.width} × {analysis.metadata.height}
                    </div>
                    <div className="text-xs text-muted-foreground">pixels</div>
                </div>
            </div>

            {/* Image Classification */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Classification:{' '}
                            <span className="capitalize">{analysis.classification}</span>
                        </div>
                        <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            {analysis.reason}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            Recommended strategy:{' '}
                            <span className="font-medium">{analysis.recommendation}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Technical Details */}
            <div className="p-3 border rounded-lg">
                <div className="text-xs font-medium mb-2">Technical Analysis</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                        <span className="text-muted-foreground">Entropy:</span>{' '}
                        <span className="font-mono">
                            {analysis.metadata.entropy?.toFixed(2) || 'N/A'}
                        </span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Mean Brightness:</span>{' '}
                        <span className="font-mono">
                            {analysis.metadata.mean?.toFixed(0) || 'N/A'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
