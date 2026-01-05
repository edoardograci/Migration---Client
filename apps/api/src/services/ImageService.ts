import { smartWebP } from '../lib/smart-webp';
import { analyzeImage } from '../lib/image-analysis';
import fetch from 'node-fetch'; // Standard fetch might be available but import for safety if using older node types, though I used ES2020 target. Node 18 globals are fine.
import sharp from 'sharp'; // Needed for metadata

export class ImageService {
    static async analyze(imageUrl: string) {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const analysis = await analyzeImage(buffer);
        const metadata = await sharp(buffer).metadata();

        let recommendation = 'adaptive';
        let reason = 'Standard high-quality conversion';

        if (metadata.format === 'webp' && buffer.length < 200000) {
            recommendation = 'skip';
            reason = 'Already optimized WebP';
        } else if (analysis.isFlat) {
            recommendation = 'lossless';
            reason = 'Flat/graphic image detected';
        } else if (analysis.isDark) {
            recommendation = 'careful';
            reason = 'Dark image detected, preserving shadow detail';
        }

        return {
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: buffer.length,
                entropy: analysis.entropy,
                mean: analysis.mean
            },
            classification: analysis.isFlat ? 'flat' : analysis.isDark ? 'dark' : 'high-detail',
            recommendation,
            reason
        };
    }

    static async convert(imageUrl: string, strategy?: string, forceConvert?: boolean, storageKey?: string, isMoodboard?: boolean) {
        // strategy is not effectively used by smartWebP yet unless we pass it, 
        // but smartWebP is smart enough. logic is inside smartWebP.
        // If client wants to override, we'd need to modify smartWebP. 
        // For now, ignoring strategy override from client to keep it simple as per smartWebP design.
        const result = await smartWebP(imageUrl, forceConvert);

        // If a storage key is provided, we save the result
        if (storageKey && result.buffer) {
            const { StorageService } = await import('./StorageService');
            await StorageService.upload(storageKey, result.buffer, 'image/webp', isMoodboard);
        }

        return result;
    }

    static async batchConvert(images: Array<{ id: string, url: string }>) {
        const results = [];
        for (const img of images) {
            try {
                const res = await this.convert(img.url);
                // Convert buffer to base64 for transport?
                // The API says "convertedBlob: string; // base64".
                const base64 = res.buffer.toString('base64');
                const diffBase64 = res.diffMap.toString('base64');

                results.push({
                    id: img.id,
                    success: true,
                    result: {
                        ...res,
                        buffer: undefined, // Don't send buffer
                        diffMap: undefined,
                        convertedBlob: base64,
                        diffBlob: diffBase64
                    }
                });
            } catch (e: any) {
                results.push({ id: img.id, success: false, error: e.message });
            }
        }
        return results;
    }
}
