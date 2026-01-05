import { NotionService } from '../src/services/NotionService';
import { ImageService } from '../src/services/ImageService';
import fetch from 'node-fetch';

const targetSlugs = new Set([
    'andrea-mancuso-studio',
    'bebop',
    'cara-davide-61afac79',
    'cara-davide',
    'claudio-larcher-design-studio',
    'cono-studio',
    'domenico-orefice-design-studio',
    'elena-salmistraro',
    'fabio-verdelli-design-studio',
    'federica-biasi-studio',
    'formaantasma', // checking as provided
    'formafantasma', // adding for safety
    'francisco-gomez-paz',
    'giulio-iacchetti-studio',
    'guglielmo-poletti',
    'jiyoun-kim-studio',
    'joongho-choi-studio',
    'luca-casini',
    'maddalena-casadei-studio',
    'mario-scairato-design-studio',
    'matteo-bordignon',
    'matteo-ragni-design-studio-cda50acb',
    'matteo-ragni-design-studio',
    'odo-fioravanti-design-studio',
    'paolo-dellelce',
    'philippe-tabet',
    'raffaella-mangiarotti',
    'roberto-paoli',
    'sovrappensiero',
    'stefano-giovannoni',
    'studio-finemateria',
    'studio-klass',
    'swna',
    'valerio-sommella-design-studio'
]);

function generateSlug(name: string): string {
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

async function run() {
    console.log('Fetching designers from Notion...');
    const designers = await NotionService.getDesigners(true);
    console.log(`Found ${designers.length} designers total.`);

    const results: any[] = [];

    for (const designer of designers) {
        const slug = generateSlug(designer.name);
        if (targetSlugs.has(slug)) {
            console.log(`\nProcessing: ${designer.name} (slug: ${slug})`);

            if (!designer.coverUrl) {
                console.log(`- Skipping: No cover URL found.`);
                continue;
            }

            try {
                // Get original size for reporting
                const originalResp = await fetch(designer.coverUrl);
                const originalBuffer = Buffer.from(await originalResp.arrayBuffer());
                const originalSize = originalBuffer.length;

                // Force convert and save to R2
                const storageKey = `studios/${slug}.webp`;
                const conversion = await ImageService.convert(
                    designer.coverUrl,
                    'adaptive',
                    true, // forceConvert
                    storageKey,
                    false // isMoodboard
                );

                const reduction = originalSize - conversion.size;
                const reductionPercent = ((reduction / originalSize) * 100).toFixed(1);

                results.push({
                    name: designer.name,
                    slug: slug,
                    originalSize: (originalSize / 1024).toFixed(1) + ' KB',
                    newSize: (conversion.size / 1024).toFixed(1) + ' KB',
                    reduction: reductionPercent + '%'
                });

                console.log(`- Success! Reduced by ${reductionPercent}% (${(conversion.size / 1024).toFixed(1)} KB)`);
            } catch (err: any) {
                console.error(`- Error processing ${designer.name}:`, err.message);
            }
        }
    }

    console.log('\n--- FINAL SUMMARY ---\n');
    console.table(results);

    // Save to disk for easy reading
    const fs = require('fs');
    fs.writeFileSync('compression-results.json', JSON.stringify(results, null, 2));
    console.log('\nResults saved to compression-results.json');
}

run().catch(console.error);
