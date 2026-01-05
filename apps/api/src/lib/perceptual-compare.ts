import sharp from 'sharp';
// @ts-ignore
import ssim from 'ssim.js';

export async function compareSSIM(
    original: Buffer,
    compressed: Buffer
): Promise<number> {
    // Resize both to same dimensions for comparison
    const size = 512; // Compare at 512x512

    const img1 = await sharp(original)
        .resize(size, size, { fit: 'contain' })
        .raw()
        .toBuffer({ resolveWithObject: true });

    const img2 = await sharp(compressed)
        .resize(size, size, { fit: 'contain' })
        .raw()
        .toBuffer({ resolveWithObject: true });

    const result = ssim(
        {
            data: new Uint8ClampedArray(img1.data),
            width: img1.info.width,
            height: img1.info.height
        },
        {
            data: new Uint8ClampedArray(img2.data),
            width: img2.info.width,
            height: img2.info.height
        }
    );

    return result.mssim;
}
