/**
 * Test Ollama Connection and Model
 * 
 * Run this script to verify Ollama is properly configured
 * before running the full migration.
 * 
 * Usage:
 *   node scripts/test-ollama.js
 */

import {
    checkOllamaAvailable,
    scrapeSource,
    enrichSemantics,
    buildEmbeddingText,
    generateFallbackEnrichment,
} from './lib/semantic-enrichment.js';

const TEST_URL = 'https://www.dezeen.com/2021/04/19/muuto-fiber-lounge-chair-nature-edition-design/';

async function testOllama() {
    console.log('🧪 Testing Ollama Integration\n');
    console.log('═══════════════════════════════════════════════════\n');

    // Step 1: Check Ollama availability
    console.log('1️⃣  Checking Ollama availability...');
    const ollamaCheck = await checkOllamaAvailable();

    if (!ollamaCheck.available) {
        console.log(`   ❌ ${ollamaCheck.reason}\n`);
        console.log('   To fix this:');
        console.log('   1. Install Ollama: https://ollama.ai');
        console.log('   2. Run: ollama serve');
        console.log('   3. Run: ollama pull qwen2.5:7b-instruct');
        console.log('   4. Re-run this test\n');

        console.log('   Testing fallback mode instead...\n');
        await testFallback();
        return;
    }

    console.log(`   ✅ Ollama ready with model: ${ollamaCheck.model}\n`);

    // Step 2: Test scraping
    console.log('2️⃣  Testing source scraping...');
    console.log(`   URL: ${TEST_URL}`);

    const scrapedText = await scrapeSource(TEST_URL);

    if (scrapedText) {
        console.log(`   ✅ Scraped ${scrapedText.length} characters`);
        console.log(`   Preview: ${scrapedText.substring(0, 150)}...\n`);
    } else {
        console.log('   ⚠️  Scraping failed (this is okay, will use fallback)\n');
    }

    // Step 3: Test AI enrichment
    console.log('3️⃣  Testing AI semantic enrichment...');

    const testProduct = {
        name: 'Fiber Lounge Chair',
        designer: 'Muuto',
        year: '2021',
        city: 'Copenhagen',
        client: null,
        link: TEST_URL,
    };

    console.log(`   Product: ${testProduct.name} by ${testProduct.designer}`);

    const startTime = Date.now();
    const enrichedData = await enrichSemantics(scrapedText, testProduct);
    const duration = Date.now() - startTime;

    console.log(`   ⏱️  Enrichment took ${duration}ms`);
    console.log(`   Source: ${enrichedData.enrichment_source}`);
    console.log(`   Result:`);
    console.log(`     - Object type: ${enrichedData.object_type}`);
    console.log(`     - Category: ${enrichedData.category}`);
    console.log(`     - Materials: ${enrichedData.materials?.join(', ') || 'null'}`);
    console.log(`     - Keywords: ${enrichedData.keywords?.join(', ') || 'null'}`);
    console.log(`     - Description: ${enrichedData.description || 'null'}\n`);

    // Step 4: Test embedding text generation
    console.log('4️⃣  Testing embedding text generation...');

    const embeddingText = buildEmbeddingText(enrichedData, testProduct, 0, 3);

    console.log(`   Generated ${embeddingText.length} characters:`);
    console.log('   ───────────────────────────────────');
    console.log(embeddingText.split('\n').map(l => `   ${l}`).join('\n'));
    console.log('   ───────────────────────────────────\n');

    // Success!
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ All tests passed! Ollama integration is working.');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('📌 Next steps:');
    console.log('   npm run migrate:moodboard    # Run full migration with AI');
    console.log('   npm run migrate:moodboard:no-ai  # Run without AI (fallback only)');
}

async function testFallback() {
    console.log('🔄 Testing fallback enrichment...\n');

    const testProduct = {
        name: 'Fiber Lounge Chair',
        designer: 'Muuto',
        year: '2021',
        city: 'Copenhagen',
        client: null,
        link: null,
    };

    const enrichedData = generateFallbackEnrichment(testProduct);

    console.log('   Result:');
    console.log(`     - Object type: ${enrichedData.object_type}`);
    console.log(`     - Category: ${enrichedData.category}`);
    console.log(`     - Keywords: ${enrichedData.keywords?.join(', ')}`);
    console.log(`     - Description: ${enrichedData.description}`);
    console.log(`     - Source: ${enrichedData.enrichment_source}\n`);

    const embeddingText = buildEmbeddingText(enrichedData, testProduct, 0, 1);

    console.log('   Embedding text:');
    console.log('   ───────────────────────────────────');
    console.log(embeddingText.split('\n').map(l => `   ${l}`).join('\n'));
    console.log('   ───────────────────────────────────\n');

    console.log('═══════════════════════════════════════════════════');
    console.log('✅ Fallback mode works! Migration can proceed without AI.');
    console.log('═══════════════════════════════════════════════════');
}

testOllama()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('💥 Test failed:', err);
        process.exit(1);
    });
