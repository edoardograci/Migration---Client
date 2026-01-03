import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { imageApi } from '../../api';
import { cn } from '../../lib/utils';
import { Loader2, Check, X, AlertTriangle } from 'lucide-react';

interface WebPComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    onAccept: (result: any) => void;
}

export function WebPComparisonModal({ isOpen, onClose, imageUrl, onAccept }: WebPComparisonModalProps) {
    const [step, setStep] = useState<'analyzing' | 'converting' | 'review'>('analyzing');
    const [analysis, setAnalysis] = useState<any>(null);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'compare' | 'diff'>('compare');

    useEffect(() => {
        if (isOpen && imageUrl) {
            analyze();
        }
    }, [isOpen, imageUrl]);

    const analyze = async () => {
        setStep('analyzing');
        setError(null);
        try {
            const data = await imageApi.analyze(imageUrl);
            setAnalysis(data);
            convert(data.recommendation);
        } catch (err: any) {
            setError(err.message || 'Analysis failed');
        }
    };

    const convert = async (strategy: string) => {
        setStep('converting');
        try {
            const res = await imageApi.convert(imageUrl, strategy);
            setResult(res);
            setStep('review');
        } catch (err: any) {
            setError(err.message || 'Conversion failed');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="font-semibold text-lg">Image Optimization</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {error && (
                        <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    {(step === 'analyzing' || step === 'converting') && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <Loader2 className="w-12 h-12 animate-spin text-primary" />
                            <p className="text-muted-foreground">
                                {step === 'analyzing' ? 'Analyzing image complexity...' : 'Optimizing with Smart WebP...'}
                            </p>
                        </div>
                    )}

                    {step === 'review' && result && (
                        <div className="space-y-6">
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 bg-muted/20 rounded-lg border">
                                    <div className="text-sm text-muted-foreground">Original</div>
                                    <div className="text-xl font-bold">{(result.originalSize / 1024).toFixed(1)} KB</div>
                                    <div className="text-xs text-muted-foreground">JPEG</div>
                                </div>
                                <div className="p-4 bg-muted/20 rounded-lg border">
                                    <div className="text-sm text-muted-foreground">Smart WebP</div>
                                    <div className="text-xl font-bold text-green-600">{(result.convertedSize / 1024).toFixed(1)} KB</div>
                                    <div className="text-xs text-green-600">-{result.reductionPercent}%</div>
                                </div>
                                <div className="p-4 bg-muted/20 rounded-lg border">
                                    <div className="text-sm text-muted-foreground">Quality Score</div>
                                    <div className={cn("text-xl font-bold", result.ssimScore >= 0.96 ? "text-green-600" : "text-yellow-600")}>
                                        {result.ssimScore.toFixed(3)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">SSIM (Target &gt; 0.96)</div>
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="border rounded-lg overflow-hidden bg-checkerboard min-h-[400px] relative">
                                <div className="absolute top-2 right-2 z-10 bg-black/75 text-white text-xs px-2 py-1 rounded">
                                    {viewMode === 'compare' ? 'Side-by-Side View' : 'Difference Map'}
                                </div>

                                {viewMode === 'compare' ? (
                                    <div className="grid grid-cols-2 h-full">
                                        <div className="border-r relative group">
                                            <img src={imageUrl} alt="Original" className="w-full h-full object-contain" />
                                            <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">Original</span>
                                        </div>
                                        <div className="relative group">
                                            <img src={`data:image/webp;base64,${result.convertedBlob}`} alt="WebP" className="w-full h-full object-contain" />
                                            <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">WebP Result</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center p-4">
                                        <img src={`data:image/png;base64,${result.diffBlob}`} alt="Diff" className="max-h-full object-contain" />
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="flex justify-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setViewMode('compare')}
                                    className={viewMode === 'compare' ? 'bg-primary text-primary-foreground' : ''}
                                >
                                    Compare
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setViewMode('diff')}
                                    className={viewMode === 'diff' ? 'bg-primary text-primary-foreground' : ''}
                                >
                                    Difference Map
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t flex justify-between bg-muted/5">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>

                    {step === 'review' && (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => convert('quality-82')}>Try Higher Quality</Button>
                            <Button onClick={() => onAccept(result)} className="gap-2">
                                <Check className="w-4 h-4" /> Accept & Use
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
