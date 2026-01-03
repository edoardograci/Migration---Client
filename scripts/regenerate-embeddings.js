/**
 * Regenerate Embeddings Script
 * 
 * Re-runs semantic enrichment on existing products in Turso.
 * Useful for:
 * - Updating embeddings after prompt improvements
 * - Re-scraping after source changes
 * - Batch updates without re-downloading images
 * - Fixing metadata issues (like folder patterns)
 * 
 * Usage:
 *   node scripts/regenerate-embeddings.js
 *   node scripts/regenerate-embeddings.js --force     # Regenerate all, ignore cache
 *   node scripts/regenerate-embeddings.js --no-ai    # Use fallback only
 *   node scripts/regenerate-embeddings.js --dry-run  # Preview without writing
 *   node scripts/regenerate-embeddings.js --fix-vectors  # Re-upsert all vectors to Vectorize
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import {
    scrapeSource,
    enrichSemantics,
    buildEmbeddingText,
    checkOllamaAvailable,
    clearCaches,
    generateFallbackEnrichment,
} from './lib/semantic-enrichment.js';

dotenv.config();

// Initialize Turso client
const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

// Vectorize configuration
const VECTORIZE_API_TOKEN = process.env.VECTORIZE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;

const VECTORIZE_API_URL = process.env.VECTORIZE_API_URL ||
    (CF_ACCOUNT_ID ? `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2` : null);

const AI_API_URL = CF_ACCOUNT_ID
    ? `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/qwen/qwen3-embedding-0.6b`
    : null;

// Parse command line args
const args = process.argv.slice(2);
const FORCE_REGENERATE = args.includes('--force');
const NO_AI = args.includes('--no-ai');
const DRY_RUN = args.includes('--dry-run');
const FIX_VECTORS = args.includes('--fix-vectors');
const ENRICHMENT_VERSION = '1.0'; // Increment this when prompt changes

async function regenerateEmbeddings() {
    console.log('🔄 Regenerating embeddings for moodboard...\n');

    if (DRY_RUN) {
        console.log('🏃 DRY RUN MODE - No changes will be written\n');
    }

    if (FIX_VECTORS) {
        console.log('🔧 FIX VECTORS MODE - Will re-upsert all vectors to Vectorize with correct metadata\n');
    }

    if (FORCE_REGENERATE) {
        console.log('⚡ FORCE MODE - Regenerating all embeddings\n');
        clearCaches();
    }

    // Check Ollama availability
    let ollamaAvailable = false;
    if (!NO_AI) {
        console.log('🤖 Checking Ollama availability...');
        const ollamaCheck = await checkOllamaAvailable();
        ollamaAvailable = ollamaCheck.available;

        if (ollamaAvailable) {
            console.log(`✅ Ollama ready with model: ${ollamaCheck.model}\n`);
        } else {
            console.log(`⚠️  ${ollamaCheck.reason}`);
            console.log('   Falling back to deterministic enrichment\n');
        }
    } else {
        console.log('⚠️  AI disabled via --no-ai flag\n');
    }

    // Fetch all products
    console.log('📦 Fetching products from Turso...');
    const productsResult = await turso.execute(`
    SELECT id, name, designer, year, client, link, city 
    FROM products 
    ORDER BY name
  `);

    const products = productsResult.rows;
    console.log(`📊 Found ${products.length} products\n`);

    let updated = 0;
    let skipped = 0;
    let aiEnrichments = 0;
    let fallbackEnrichments = 0;
    let vectorsFixed = 0;
    let errors = 0;

    for (const product of products) {
        const productId = product.id;
        const productData = {
            name: product.name,
            designer: product.designer,
            year: product.year,
            client: product.client,
            link: product.link,
            city: product.city,
        };

        console.log(`\n🔄 Processing: ${product.name}`);

        try {
            // Fetch images for this product
            const imagesResult = await turso.execute({
                sql: `
          SELECT id, position, image_url, r2_key, enrichment_version, embedding_text 
          FROM product_images 
          WHERE product_id = ?
          ORDER BY position
        `,
                args: [productId]
            });

            const images = imagesResult.rows;

            if (images.length === 0) {
                console.log(`  ⚠️  No images found`);
                continue;
            }

            // Check if regeneration needed (unless forcing or fixing vectors)
            if (!FORCE_REGENERATE && !FIX_VECTORS) {
                const allUpToDate = images.every(
                    img => img.enrichment_version === ENRICHMENT_VERSION
                );

                if (allUpToDate) {
                    console.log(`  ⏭️  Already at version ${ENRICHMENT_VERSION}, skipping`);
                    skipped += images.length;
                    continue;
                }
            }

            // Get semantic enrichment for this product (unless only fixing vectors)
            let enrichedData;

            if (!FIX_VECTORS) {
                if (ollamaAvailable && productData.link) {
                    console.log(`  🔍 Scraping: ${productData.link}`);
                    const scrapedText = await scrapeSource(productData.link);

                    enrichedData = await enrichSemantics(scrapedText, productData);

                    if (enrichedData.enrichment_source === 'ai') {
                        aiEnrichments++;
                        console.log(`  🤖 AI: type=${enrichedData.object_type}, category=${enrichedData.category}`);
                    } else {
                        fallbackEnrichments++;
                        console.log(`  📌 Fallback: type=${enrichedData.object_type}`);
                    }
                } else {
                    enrichedData = generateFallbackEnrichment(productData);
                    fallbackEnrichments++;
                    console.log(`  📌 Fallback: type=${enrichedData.object_type}`);
                }
            }

            // Update each image
            for (const image of images) {
                let embeddingText;

                if (FIX_VECTORS) {
                    // Use existing embedding text
                    embeddingText = image.embedding_text;
                    if (!embeddingText) {
                        console.log(`  ⚠️  Image ${image.position + 1}: No embedding text, skipping vector fix`);
                        continue;
                    }
                } else {
                    // Generate new embedding text
                    embeddingText = buildEmbeddingText(
                        enrichedData,
                        productData,
                        image.position,
                        images.length
                    );
                }

                // Generate and upsert vector to Vectorize
                if (VECTORIZE_API_URL && VECTORIZE_API_TOKEN && AI_API_URL && !DRY_RUN) {
                    try {
                        console.log(`  🧠 Generating embedding for image ${image.position + 1}...`);

                        // 1. Generate embedding
                        const embeddingResponse = await fetch(
                            AI_API_URL,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${VECTORIZE_API_TOKEN}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    text: embeddingText
                                })
                            }
                        );

                        if (!embeddingResponse.ok) {
                            throw new Error(`Embedding API error: ${embeddingResponse.statusText}`);
                        }

                        const embeddingData = await embeddingResponse.json();
                        const embedding = embeddingData.result?.data?.[0] || embeddingData.result?.embeddings?.[0];

                        if (!embedding) {
                            throw new Error('Invalid embedding response structure');
                        }

                        // 2. Upsert to Vectorize with FIXED metadata
                        console.log(`  💾 Upserting vector with corrected metadata...`);
                        const vectorId = image.id;

                        const upsertResponse = await fetch(
                            `${VECTORIZE_API_URL}/indexes/ai-search-optimus/upsert`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${VECTORIZE_API_TOKEN}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    vectors: [
                                        {
                                            id: vectorId,
                                            values: embedding,
                                            metadata: {
                                                product_id: productId,
                                                folder: "moodboard/*",  // FIXED: Consistent folder pattern
                                                key: image.r2_key,
                                                url: image.image_url
                                            }
                                        }
                                    ]
                                })
                            }
                        );

                        if (!upsertResponse.ok) {
                            const errorBody = await upsertResponse.text();
                            throw new Error(`Vectorize Upsert error: ${upsertResponse.statusText} - ${errorBody}`);
                        }

                        vectorsFixed++;
                        console.log(`     ✅ Vector upserted successfully`);

                    } catch (vecErr) {
                        console.error(`  ❌ Vectorize operation failed:`, vecErr.message);
                        errors++;
                    }
                }

                // Update database (unless only fixing vectors)
                if (!FIX_VECTORS && !DRY_RUN) {
                    await turso.execute({
                        sql: `
              UPDATE product_images 
              SET embedding_text = ?,
                  enrichment_json = ?,
                  enrichment_version = ?,
                  enrichment_source = ?
              WHERE id = ?
            `,
                        args: [
                            embeddingText,
                            JSON.stringify(enrichedData),
                            ENRICHMENT_VERSION,
                            enrichedData.enrichment_source,
                            image.id
                        ]
                    });

                    updated++;
                    console.log(`  ✅ Image ${image.position + 1}: Updated embedding (${embeddingText.length} chars)`);
                } else if (FIX_VECTORS) {
                    console.log(`  ✅ Image ${image.position + 1}: Vector fixed`);
                }
            }

        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            errors++;
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 Embedding regeneration complete!');

    if (!FIX_VECTORS) {
        console.log(`✅ Updated: ${updated}`);
        console.log(`⏭️  Skipped (up to date): ${skipped}`);
        console.log(`🤖 AI enrichments: ${aiEnrichments}`);
        console.log(`📌 Fallback enrichments: ${fallbackEnrichments}`);
    }

    if (FIX_VECTORS || FORCE_REGENERATE) {
        console.log(`🔧 Vectors fixed/re-upserted: ${vectorsFixed}`);
    }

    console.log(`❌ Errors: ${errors}`);

    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN - No changes were written');
    }

    console.log('═══════════════════════════════════════════════════════════════');
}

regenerateEmbeddings()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('💥 Failed:', err);
        process.exit(1);
    });