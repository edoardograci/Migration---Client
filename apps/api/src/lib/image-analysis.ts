import sharp from 'sharp';

export interface ImageAnalysis {
    entropy: number;
    mean: number;
    isFlat: boolean;
    isDark: boolean;
    isHighDetail: boolean;
}

export async function analyzeImage(buffer: Buffer): Promise<ImageAnalysis> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    const entropy = stats.entropy;
    // stats.channels is an array of ChannelStats. mean is a property of ChannelStats.
    // Using the first channel (usually luminance/red or gray)
    const mean = stats.channels[0].mean;

    return {
        entropy,
        mean,
        isFlat: entropy < 4.5,
        isDark: mean < 60,
        isHighDetail: entropy > 6
    };
}
