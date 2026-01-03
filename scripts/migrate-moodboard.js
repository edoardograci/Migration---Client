import { createClient } from '@libsql/client';
import { Client } from '@notionhq/client';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';
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

// Initialize Notion client
const notionToken = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;
if (!notionToken) {
  console.error('❌ Missing NOTION_API_KEY or NOTION_TOKEN in .env');
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// Initialize Turso client
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Initialize R2 client (S3-compatible)
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Vectorize configuration
const VECTORIZE_API_TOKEN = process.env.VECTORIZE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;

const VECTORIZE_API_URL = process.env.VECTORIZE_API_URL ||
  (CF_ACCOUNT_ID ? `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2` : null);

const AI_API_URL = CF_ACCOUNT_ID
  ? `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/qwen/qwen3-embedding-0.6b`
  : null;

// Verify environment variables
console.log('🔍 Checking environment variables...');
console.log('✅ Notion token:', notionToken ? 'Set' : '❌ Missing');
console.log('✅ Moodboard DB ID:', process.env.NOTION_MOODBOARD_ID ? 'Set' : '❌ Missing');
console.log('✅ Turso URL:', process.env.TURSO_DATABASE_URL ? 'Set' : '❌ Missing');
console.log('✅ Turso Token:', process.env.TURSO_AUTH_TOKEN ? 'Set' : '❌ Missing');
console.log('✅ R2 Account ID:', process.env.R2_ACCOUNT_ID ? 'Set' : '❌ Missing');
console.log('✅ R2 Access Key:', process.env.R2_ACCESS_KEY_ID ? 'Set' : '❌ Missing');
console.log('✅ R2 Secret:', process.env.R2_SECRET_ACCESS_KEY ? 'Set' : '❌ Missing');
console.log('✅ R2 Bucket:', process.env.R2_BUCKET_NAME2 ? 'Set' : '❌ Missing');
console.log('✅ R2 Public URL:', process.env.R2_PUBLIC_URL2 ? 'Set' : '❌ Missing');
console.log('✅ CF Account ID:', process.env.CF_ACCOUNT_ID ? 'Set' : '⚠️  Optional (might use R2 ID)');
console.log('✅ Vectorize API:', VECTORIZE_API_URL ? 'Set' : '⚠️  Optional (not set)');
console.log('✅ AI API:', AI_API_URL ? 'Set' : '⚠️  Optional (not set)');
console.log('');

// Helper: Generate URL-friendly slug
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

// Helper: Extract property values from Notion
function getProp(properties, key, type) {
  const prop = properties[key];
  if (!prop) return null;

  switch (type) {
    case 'title':
      return prop.title?.[0]?.plain_text || null;
    case 'rich_text':
      return prop.rich_text?.[0]?.plain_text || null;
    case 'select':
      return prop.select?.name || null;
    case 'status':
      return prop.status?.name || null;
    case 'url':
      return prop.url || null;
    case 'email':
      return prop.email || null;
    case 'phone_number':
      return prop.phone_number || null;
    case 'number':
      return prop.number || null;
    case 'files':
      return prop.files || [];
    default:
      return null;
  }
}

// Helper: Download image from URL
async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    return await response.arrayBuffer();
  } catch (err) {
    console.error(`❌ Failed to download image from ${url}:`, err.message);
    throw err;
  }
}

// Helper: Check if file already exists in R2
async function fileExistsInR2(r2Key) {
  try {
    await r2.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME2,
      Key: r2Key,
    }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound') {
      return false;
    }
    throw err;
  }
}

// Helper: Convert to WebP and upload to R2
async function uploadImageToR2(imageBuffer, productId, position) {
  try {
    // Convert to WebP
    const webpBuffer = await sharp(Buffer.from(imageBuffer))
      .webp({ quality: 85 })
      .toBuffer();

    // Generate unique filename with hash
    const hash = crypto.createHash('md5').update(webpBuffer).digest('hex').substring(0, 8);
    const r2Key = `moodboard/${productId}/${position}-${hash}.webp`;

    // Check if file already exists in R2
    const exists = await fileExistsInR2(r2Key);
    if (exists) {
      console.log(`  ⏭️  File already exists in R2: ${r2Key}`);
      const imageUrl = `${process.env.R2_PUBLIC_URL2}/${r2Key}`;
      return { r2Key, imageUrl, skipped: true };
    }

    // Upload to R2
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME2,
      Key: r2Key,
      Body: webpBuffer,
      ContentType: 'image/webp',
    }));

    // Generate public URL
    const imageUrl = `${process.env.R2_PUBLIC_URL2}/${r2Key}`;

    return { r2Key, imageUrl, skipped: false };
  } catch (err) {
    console.error('❌ Failed to process/upload image:', err.message);
    throw err;
  }
}

// Create database tables
async function createTables() {
  console.log('📋 Creating database tables...');

  // Products table
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      notion_id TEXT UNIQUE NOT NULL,
      slug TEXT NOT NULL,
      status TEXT DEFAULT 'Published',
      name TEXT NOT NULL,
      designer TEXT,
      year TEXT,
      client TEXT,
      link TEXT,
      city TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Product images table with semantic enrichment fields
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      original_notion_url TEXT,
      embedding_text TEXT,
      enrichment_json TEXT,
      enrichment_version TEXT,
      enrichment_source TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Product embeddings table
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS product_embeddings (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      vector_id TEXT NOT NULL,
      embedding_text TEXT NOT NULL,
      enrichment_version TEXT,
      enrichment_source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (image_id) REFERENCES product_images(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_product_images_product_id 
    ON product_images(product_id)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_products_slug 
    ON products(slug)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_product_embeddings_image_id 
    ON product_embeddings(image_id)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_product_embeddings_vector_id 
    ON product_embeddings(vector_id)
  `);

  console.log('✅ Tables created successfully\n');
}

// Add new columns to existing tables if they don't exist
async function migrateSchema() {
  console.log('🔧 Checking for schema migrations...');

  try {
    // Check if embedding_text column exists
    const result = await turso.execute(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='product_images'
    `);

    const schema = result.rows[0]?.sql || '';

    if (!schema.includes('embedding_text')) {
      console.log('  📦 Adding embedding_text column...');
      await turso.execute('ALTER TABLE product_images ADD COLUMN embedding_text TEXT');
    }

    if (!schema.includes('enrichment_json')) {
      console.log('  📦 Adding enrichment_json column...');
      await turso.execute('ALTER TABLE product_images ADD COLUMN enrichment_json TEXT');
    }

    if (!schema.includes('enrichment_version')) {
      console.log('  📦 Adding enrichment_version column...');
      await turso.execute('ALTER TABLE product_images ADD COLUMN enrichment_version TEXT');
    }

    if (!schema.includes('enrichment_source')) {
      console.log('  📦 Adding enrichment_source column...');
      await turso.execute('ALTER TABLE product_images ADD COLUMN enrichment_source TEXT');
    }

    console.log('✅ Schema migration complete\n');
  } catch (err) {
    console.log('  ℹ️  Schema already up to date\n');
  }
}

// Migrate Moodboard with semantic enrichment
async function migrateMoodboard(useAI = true) {
  console.log('🎨 Migrating Moodboard from Notion...');

  // Check Ollama availability if using AI
  let ollamaAvailable = false;
  if (useAI) {
    console.log('🤖 Checking Ollama availability...');
    const ollamaCheck = await checkOllamaAvailable();
    ollamaAvailable = ollamaCheck.available;

    if (ollamaAvailable) {
      console.log(`✅ Ollama ready with model: ${ollamaCheck.model}`);
    } else {
      console.log(`⚠️  Ollama not available: ${ollamaCheck.reason}`);
      console.log('   Falling back to deterministic enrichment');
    }
    console.log('');
  }

  let allItems = [];
  let cursor = null;
  let pageNum = 0;

  // Fetch all pages from Notion
  do {
    pageNum++;
    console.log(`📄 Fetching moodboard page ${pageNum}...`);

    const response = await notion.databases.query({
      database_id: process.env.NOTION_MOODBOARD_ID,
      start_cursor: cursor || undefined,
      page_size: 100,
      filter: {
        property: 'Status',
        select: {
          equals: 'Published'
        }
      }
    });

    allItems = allItems.concat(response.results);
    cursor = response.next_cursor;

    if (cursor) await new Promise(r => setTimeout(r, 300));
  } while (cursor);

  console.log(`📊 Found ${allItems.length} moodboard items total\n`);

  let productsInserted = 0;
  let imagesInserted = 0;
  let imagesSkipped = 0;
  let enrichmentsAI = 0;
  let enrichmentsFallback = 0;
  let errors = 0;

  for (const page of allItems) {
    const props = page.properties;
    const name = getProp(props, 'Name', 'title') || 'Untitled';
    const productId = page.id; // Use notion_id as product_id

    console.log(`\n🔄 Processing: ${name} (${productId})`);

    try {
      // Extract product data
      const productData = {
        name: name,
        designer: getProp(props, 'Designer', 'select'),
        year: getProp(props, 'Year', 'select'),
        client: getProp(props, 'Client', 'rich_text') || getProp(props, 'Client', 'select'),
        link: getProp(props, 'Link', 'url'),
        city: getProp(props, 'City', 'select') || getProp(props, 'City', 'rich_text'),
      };

      // Insert product
      await turso.execute({
        sql: `
          INSERT INTO products (
            id, notion_id, slug, status, name, designer, year, 
            client, link, city, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(notion_id) DO UPDATE SET
            slug = excluded.slug,
            status = excluded.status,
            name = excluded.name,
            designer = excluded.designer,
            year = excluded.year,
            client = excluded.client,
            link = excluded.link,
            city = excluded.city,
            updated_at = excluded.updated_at
        `,
        args: [
          productId,
          page.id,
          generateSlug(name),
          getProp(props, 'Status', 'status') || 'Published',
          name,
          productData.designer,
          productData.year,
          productData.client,
          productData.link,
          productData.city,
          page.created_time,
          page.last_edited_time
        ]
      });

      productsInserted++;
      console.log(`  ✅ Product inserted`);

      // Get all images from Notion
      const imageFiles = getProp(props, 'Image', 'files') || getProp(props, 'Cover', 'files') || [];

      if (imageFiles.length === 0) {
        console.log(`  ⚠️  No images found for this product`);
        continue;
      }

      console.log(`  📸 Processing ${imageFiles.length} image(s)...`);

      // ═══════════════════════════════════════════════════════════════
      // SEMANTIC ENRICHMENT (once per product)
      // ═══════════════════════════════════════════════════════════════

      let enrichedData;

      // Check if we can reuse existing enrichment from Turso
      const existingEnrichmentResult = await turso.execute({
        sql: "SELECT enrichment_json FROM product_images WHERE product_id = ? AND enrichment_json IS NOT NULL LIMIT 1",
        args: [productId]
      });

      if (existingEnrichmentResult.rows.length > 0) {
        try {
          const jsonStr = existingEnrichmentResult.rows[0].enrichment_json;
          if (jsonStr) {
            enrichedData = JSON.parse(jsonStr);
            console.log(`  ♻️  Reusing existing enrichment: type=${enrichedData.object_type}`);
          }
        } catch (e) {
          console.log('  ⚠️  Failed to parse existing enrichment JSON, regenerating...');
        }
      }

      if (!enrichedData) {
        if (ollamaAvailable && productData.link) {
          // Scrape source URL (cached per URL)
          console.log(`  🔍 Scraping source: ${productData.link}`);
          const scrapedText = await scrapeSource(productData.link);

          if (scrapedText) {
            console.log(`  📝 Scraped ${scrapedText.length} chars, running AI enrichment...`);
          }

          // Get AI enrichment (uses cache if already processed)
          enrichedData = await enrichSemantics(scrapedText, productData);

          if (enrichedData.enrichment_source === 'ai') {
            enrichmentsAI++;
            console.log(`  🤖 AI enrichment: type=${enrichedData.object_type}, category=${enrichedData.category}`);
          } else {
            enrichmentsFallback++;
            console.log(`  📌 Fallback enrichment: type=${enrichedData.object_type}`);
          }
        } else {
          // Use fallback enrichment
          enrichedData = generateFallbackEnrichment(productData);
          enrichmentsFallback++;
          console.log(`  📌 Using fallback enrichment: type=${enrichedData.object_type}`);
        }
      }

      // Process each image
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const originalUrl = file.file?.url || file.external?.url;

        if (!originalUrl) {
          console.log(`  ⚠️  Skipping image ${i + 1}: No URL found`);
          continue;
        }

        try {
          console.log(`  📥 Downloading image ${i + 1}/${imageFiles.length}...`);
          const imageBuffer = await downloadImage(originalUrl);

          console.log(`  🔄 Converting to WebP and uploading to R2...`);
          const { r2Key, imageUrl, skipped } = await uploadImageToR2(imageBuffer, productId, i);

          // Generate unique image ID
          const imageId = `${productId}-img-${i}`;

          // ═══════════════════════════════════════════════════════════════
          // BUILD EMBEDDING TEXT (unique per image)
          // ═══════════════════════════════════════════════════════════════

          const embeddingText = buildEmbeddingText(
            enrichedData,
            productData,
            i,                      // imageIndex
            imageFiles.length       // totalImages
          );

          // ═══════════════════════════════════════════════════════════════
          // GENERATE EMBEDDING & UPSERT TO VECTORIZE
          // ═══════════════════════════════════════════════════════════════

          if (VECTORIZE_API_URL && VECTORIZE_API_TOKEN && AI_API_URL) {
            console.log(`  🧠 Generating embedding via Cloudflare AI...`);

            try {
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

              // Cloudflare AI response structure
              const embedding = embeddingData.result?.data?.[0] || embeddingData.result?.embeddings?.[0];

              if (!embedding) {
                console.error('  ❌ Failed to extract embedding from response:', JSON.stringify(embeddingData));
                throw new Error('Invalid embedding response structure');
              }

              // 2. Upsert to Vectorize
              console.log(`  💾 Upserting vector to Vectorize...`);
              const vectorId = imageId; // stable, deterministic

              // FIXED: Use "moodboard/*" as folder to match search filter
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
                          key: r2Key,
                          url: imageUrl
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

              console.log(`     ✅ Vector upserted successfully`);

            } catch (vecErr) {
              console.error(`  ❌ Vectorize operation failed:`, vecErr.message);
            }
          } else {
            console.log('  ⚠️  Skipping Vectorize: API URL or Token missing');
          }

          // Insert into product_images table with enrichment data
          await turso.execute({
            sql: `
              INSERT INTO product_images (
                id, product_id, image_url, r2_key, position, 
                original_notion_url, embedding_text, enrichment_json,
                enrichment_version, enrichment_source, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                image_url = excluded.image_url,
                r2_key = excluded.r2_key,
                position = excluded.position,
                original_notion_url = excluded.original_notion_url,
                embedding_text = excluded.embedding_text,
                enrichment_json = excluded.enrichment_json,
                enrichment_version = excluded.enrichment_version,
                enrichment_source = excluded.enrichment_source
            `,
            args: [
              imageId,
              productId,
              imageUrl,
              r2Key,
              i,
              originalUrl,
              embeddingText,
              JSON.stringify(enrichedData),
              enrichedData.enrichment_version || '1.0',
              enrichedData.enrichment_source || 'unknown',
              new Date().toISOString()
            ]
          });

          imagesInserted++;
          if (skipped) {
            imagesSkipped++;
            console.log(`  ℹ️  Image ${i + 1} already in R2: ${r2Key}`);
          } else {
            console.log(`  ✅ Image ${i + 1} uploaded: ${r2Key}`);
          }

          // Log embedding preview
          console.log(`  📄 Embedding text preview (${embeddingText.length} chars):`);
          console.log(`     ${embeddingText.split('\n').slice(0, 3).join(' | ')}...`);

        } catch (imgErr) {
          console.error(`  ❌ Failed to process image ${i + 1}:`, imgErr.message);
          errors++;
        }
      }

    } catch (err) {
      errors++;
      console.error(`❌ Failed to process product "${name}":`, err.message);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 Moodboard migration complete!');
  console.log(`✅ Products inserted: ${productsInserted}`);
  console.log(`✅ Images uploaded: ${imagesInserted}`);
  console.log(`⏭️  Images skipped (already exist): ${imagesSkipped}`);
  console.log(`🤖 AI enrichments: ${enrichmentsAI}`);
  console.log(`📌 Fallback enrichments: ${enrichmentsFallback}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

// Run migration
async function runMigration() {
  try {
    console.log('🚀 Starting Notion → Turso + R2 migration with semantic enrichment...\n');

    // Check for --no-ai flag
    const useAI = !process.argv.includes('--no-ai');

    if (!useAI) {
      console.log('⚠️  Running without AI enrichment (--no-ai flag detected)\n');
    }

    await createTables();
    await migrateSchema();
    await migrateMoodboard(useAI);

    // Clear caches after migration
    clearCaches();

    console.log('\n✨ Migration complete! Your data is now in Turso and R2.');
    console.log('\n📊 Verify your data:');
    console.log('turso db shell acceso');
    console.log('SELECT COUNT(*) FROM products;');
    console.log('SELECT COUNT(*) FROM product_images;');
    console.log('SELECT p.name, COUNT(pi.id) as image_count FROM products p');
    console.log('LEFT JOIN product_images pi ON p.id = pi.product_id GROUP BY p.id;');
    console.log('\n📄 View embedding text samples:');
    console.log("SELECT id, embedding_text, enrichment_source FROM product_images LIMIT 3;");

    process.exit(0);
  } catch (err) {
    console.error('💥 Migration failed:', err);
    process.exit(1);
  }
}

runMigration();