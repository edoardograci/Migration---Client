import { NotionService } from '../src/services/NotionService';
import { StorageService } from '../src/services/StorageService';
import fetch from 'node-fetch';
import sharp from 'sharp';

const targetSlugs = new Set([
    'studioutte',
    'stefano-giovannoni',
    'roberto-paoli',
    'raffaella-mangiarotti',
    'patricia-urquiola-design',
    'paolo-dellelce',
    'matteo-ragni-design-studio',
    'matteo-bordignon',
    'lorenzkaz',
    'lorenz-kaz',
    'guglielmo-poletti',
    'giulio-iacchetti-studio',
    'gabriele-panciera',
    'formaantasma',
    'forma-antasma',
    'formafantasma',
    'elena-salmistraro',
    'paolo-dell-elce',
    'paolo-dellelce',
    'domenico-orefice-design-studio',
    'cono-studio',
    'claudio-larcher-design-studio',
    'cara-davide',
    'bgr-design-studio',
    'bebop',
    'andrea-mancuso-studio'
]);

const MAX_SIZE = 100 * 1024; // 100kb

function generateSlug(name: string): string {
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

async function run() {
    console.log('Fetching designers from Notion for STRICT compression...');
    const designers = await NotionService.getDesigners(true);

    const results: any[] = [];

    for (const designer of designers) {
        const slug = generateSlug(designer.name);
        if (targetSlugs.has(slug)) {
            console.log(`\n--- Processing: ${designer.name} (slug: ${slug}) ---`);

            if (!designer.coverUrl) {
                console.log(`- Skipping: No cover URL.`);
                continue;
            }

            try {
                const response = await fetch(designer.coverUrl);
                const originalBuffer = Buffer.from(await response.arrayBuffer());

                let finalBuffer = originalBuffer;
                let finalQuality = 80;
                let finalSize = originalBuffer.length;
                let strategy = 'original';

                // Initial WebP conversion with high quality
                const firstPass = await sharp(originalBuffer).webp({ quality: 80, effort: 6 }).toBuffer();

                if (firstPass.length > MAX_SIZE) {
                    console.log(`- Still over 100kb (${(firstPass.length / 1024).toFixed(1)} KB). Retrying with lower qualities...`);

                    // Progressive reduction
                    const qualities = [75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25];
                    let success = false;

                    for (const q of qualities) {
                        const webp = await sharp(originalBuffer).webp({ quality: q, effort: 6 }).toBuffer();
                        if (webp.length <= MAX_SIZE) {
                            finalBuffer = webp;
                            finalSize = webp.length;
                            finalQuality = q;
                            strategy = `webp-q${q}`;
                            success = true;
                            break;
                        }
                    }

                    if (!success) {
                        console.log(`- Even at Q25, still over 100kb. Trying resizing...`);
                        // Force resize to max width 1600 if still too big
                        const resized = await sharp(originalBuffer)
                            .resize(1600, null, { withoutEnlargement: true })
                            .webp({ quality: 50, effort: 6 })
                            .toBuffer();

                        finalBuffer = resized;
                        finalSize = resized.length;
                        finalQuality = 50;
                        strategy = 'webp-resized-q50';

                        // If still too big, keep dropping quality
                        if (finalSize > MAX_SIZE) {
                            for (const q of [40, 30, 20]) {
                                const evenSmaller = await sharp(originalBuffer)
                                    .resize(1200, null, { withoutEnlargement: true })
                                    .webp({ quality: q, effort: 6 })
                                    .toBuffer();
                                if (evenSmaller.length <= MAX_SIZE) {
                                    finalBuffer = evenSmaller;
                                    finalSize = evenSmaller.length;
                                    finalQuality = q;
                                    strategy = `webp-resized-q${q}`;
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    finalBuffer = firstPass;
                    finalSize = firstPass.length;
                    strategy = 'webp-q80';
                }

                // Upload to R2
                const storageKey = `studios/${slug}.webp`;
                await StorageService.upload(storageKey, finalBuffer, 'image/webp', false);

                results.push({
                    name: designer.name,
                    slug: slug,
                    originalSize: (originalBuffer.length / 1024).toFixed(1) + ' KB',
                    finalSize: (finalSize / 1024).toFixed(1) + ' KB',
                    reduction: ((originalBuffer.length - finalSize) / originalBuffer.length * 100).toFixed(1) + '%',
                    quality: finalQuality,
                    strategy: strategy
                });

                console.log(`- Final size: ${(finalSize / 1024).toFixed(1)} KB (Strategy: ${strategy})`);
            } catch (err: any) {
                console.error(`- Error: ${err.message}`);
            }
        }
    }

    console.log('\n--- STRICT COMPRESSION SUMMARY ---');
    console.table(results);

    const fs = require('fs');
    fs.writeFileSync('strict-compression-results.json', JSON.stringify(results, null, 2));
}

run().catch(console.error);
