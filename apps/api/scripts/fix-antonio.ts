import { NotionService } from '../src/services/NotionService';
import { StorageService } from '../src/services/StorageService';
import fetch from 'node-fetch';
import sharp from 'sharp';

const MAX_SIZE = 100 * 1024; // 100kb
const TARGET_NAME = 'Antonio de Marco Studio';
const TARGET_SLUG = 'antonio-de-marco-studio';

async function run() {
    console.log(`Processing: ${TARGET_NAME}`);
    const designers = await NotionService.getDesigners(true);
    const designer = designers.find(d => d.name === TARGET_NAME || d.name.toLowerCase().includes('antonio de marco'));

    if (!designer || !designer.coverUrl) {
        console.error('Designer or cover URL not found');
        return;
    }

    console.log(`Found cover URL: ${designer.coverUrl}`);

    const response = await fetch(designer.coverUrl);
    const originalBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`Original size: ${(originalBuffer.length / 1024).toFixed(1)} KB`);

    let finalBuffer = originalBuffer;
    let finalQuality = 80;

    // Try progressive WebP compression
    const qualities = [80, 70, 60, 50, 40, 30, 20, 10];
    let success = false;

    for (const q of qualities) {
        const webp = await sharp(originalBuffer).webp({ quality: q, effort: 6 }).toBuffer();
        if (webp.length <= MAX_SIZE) {
            finalBuffer = webp;
            finalQuality = q;
            success = true;
            break;
        }
    }

    if (!success) {
        console.log('Iterative quality reduction failed to reach 100kb. Resizing...');
        // Try resizing if quality alone isn't enough
        const resized = await sharp(originalBuffer)
            .resize(1600, null, { withoutEnlargement: true })
            .webp({ quality: 50, effort: 6 })
            .toBuffer();

        finalBuffer = resized;
        finalQuality = 50;

        if (finalBuffer.length > MAX_SIZE) {
            for (const q of [40, 30, 20, 10]) {
                const smaller = await sharp(originalBuffer)
                    .resize(1200, null, { withoutEnlargement: true })
                    .webp({ quality: q, effort: 6 })
                    .toBuffer();
                if (smaller.length <= MAX_SIZE) {
                    finalBuffer = smaller;
                    finalQuality = q;
                    break;
                }
            }
        }
    }

    console.log(`Final size: ${(finalBuffer.length / 1024).toFixed(1)} KB (Quality: ${finalQuality})`);

    const storageKey = `studios/${TARGET_SLUG}.webp`;
    await StorageService.upload(storageKey, finalBuffer, 'image/webp', false);
    console.log(`Uploaded to: ${storageKey}`);
}

run().catch(console.error);
