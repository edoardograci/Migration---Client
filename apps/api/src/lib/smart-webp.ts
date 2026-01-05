import sharp from 'sharp';
import { analyzeImage, ImageAnalysis } from './image-analysis';
import { compareSSIM } from './perceptual-compare';

interface ConversionStrategy {
    type: 'skip' | 'lossless' | 'adaptive' | 'careful' | 'fallback';
    qualities?: number[];
    options?: sharp.WebpOptions;
}

interface ConversionResult {
    buffer: Buffer;
    size: number;
    strategy: string;
    quality: number;
    ssim: number;
    accepted: boolean;
}

function determineStrategy(
    analysis: ImageAnalysis,
    currentFormat: string,
    currentSize: number
): ConversionStrategy {

    // Skip if already optimized WebP
    if (currentFormat === 'webp' && currentSize < 200_000) {
        return { type: 'skip' };
    }

    // Lossless for flat/graphic images
    if (analysis.isFlat) {
        return {
            type: 'lossless',
            options: {
                lossless: true,
                effort: 6
            } as any
        };
    }

    // Careful handling for dark images
    if (analysis.isDark) {
        return {
            type: 'careful',
            qualities: [82, 80, 78],
            options: {
                smartSubsample: true,
                nearLossless: 60
            } as any
        };
    }

    // Adaptive quality for high-detail images
    if (analysis.isHighDetail) {
        return {
            type: 'adaptive',
            qualities: [82, 78, 74, 70]
        };
    }

    // Default adaptive
    return {
        type: 'adaptive',
        qualities: [78, 74, 70, 66]
    };
}

async function convertWithStrategy(
    buffer: Buffer,
    strategy: ConversionStrategy,
    originalBuffer: Buffer
): Promise<ConversionResult> {

    if (strategy.type === 'skip') {
        return {
            buffer: buffer,
            size: buffer.length,
            strategy: 'skip',
            quality: 100,
            ssim: 1.0,
            accepted: true
        };
    }

    const image = sharp(buffer);

    if (strategy.type === 'lossless') {
        const webp = await image.webp(strategy.options).toBuffer();
        return {
            buffer: webp,
            size: webp.length,
            strategy: 'lossless',
            quality: 100,
            ssim: 1.0,
            accepted: true
        };
    }

    // Iterative quality search
    if (strategy.qualities) {
        for (const quality of strategy.qualities) {
            const options = {
                quality,
                ...strategy.options
            };

            const webp = await image.webp(options).toBuffer();
            const ssim = await compareSSIM(originalBuffer, webp);

            // Accept if perceptually identical
            if (ssim > 0.96) {
                return {
                    buffer: webp,
                    size: webp.length,
                    strategy: strategy.type,
                    quality,
                    ssim,
                    accepted: true
                };
            }
        }

        // Fallback: use highest quality
        const fallbackQuality = strategy.qualities[0];
        const webp = await image.webp({
            quality: fallbackQuality,
            ...strategy.options
        }).toBuffer();

        return {
            buffer: webp,
            size: webp.length,
            strategy: 'fallback',
            quality: fallbackQuality,
            ssim: await compareSSIM(originalBuffer, webp),
            accepted: false // Needs manual review
        };
    }

    throw new Error('Invalid strategy');
}

async function generateDiffMap(
    original: Buffer,
    compressed: Buffer
): Promise<Buffer> {
    // Create visual difference map
    const originalSharp = sharp(original).resize(800, 600, { fit: 'contain' });
    const compressedSharp = sharp(compressed).resize(800, 600, { fit: 'contain' });

    // Composite with difference blend mode
    const diff = await originalSharp
        .composite([{
            input: await compressedSharp.toBuffer(),
            blend: 'difference'
        }])
        .normalize() // Amplify differences
        .toBuffer();

    return diff;
}

export async function smartWebP(
    imageUrl: string,
    forceConvert = false
): Promise<ConversionResult & { diffMap: Buffer }> {

    // Download original
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    // Analyze
    const analysis = await analyzeImage(originalBuffer);
    const metadata = await sharp(originalBuffer).metadata();

    // Determine strategy
    const strategy = determineStrategy(
        analysis,
        metadata.format || 'unknown',
        originalBuffer.length
    );

    if (strategy.type === 'skip' && !forceConvert) {
        return {
            buffer: originalBuffer,
            size: originalBuffer.length,
            strategy: 'skip',
            quality: 100,
            ssim: 1.0,
            accepted: true,
            diffMap: Buffer.alloc(0)
        };
    }

    // Convert
    const result = await convertWithStrategy(
        originalBuffer,
        strategy,
        originalBuffer
    );

    // Generate diff map for preview
    const diffMap = await generateDiffMap(originalBuffer, result.buffer);

    return {
        ...result,
        diffMap
    };
}
