import { createClient } from '@libsql/client';
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

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

// Verify environment variables
console.log('🔍 Checking environment variables...');
console.log('✅ Notion token:', notionToken ? 'Set' : '❌ Missing');
console.log('✅ Spotlight DB ID:', process.env.NOTION_SPOTLIGHT_ID ? 'Set' : '❌ Missing');
console.log('✅ Turso URL:', process.env.TURSO_DATABASE_URL ? 'Set' : '❌ Missing');
console.log('✅ Turso Token:', process.env.TURSO_AUTH_TOKEN ? 'Set' : '❌ Missing');
console.log('');

// Helper: Extract property values from Notion
function getProp(properties, key, type) {
  const prop = properties[key];
  if (!prop) return null;

  switch (type) {
    case 'relation':
      // Returns array of related page IDs
      return prop.relation || [];
    case 'date':
      return prop.date || null;
    default:
      return null;
  }
}

// Create spotlight table
async function createSpotlightTable() {
  console.log('📋 Creating spotlight table...');

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS spotlight (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for performance
  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_spotlight_product_id 
    ON spotlight(product_id)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_spotlight_dates 
    ON spotlight(start_date, end_date)
  `);

  console.log('✅ Spotlight table created successfully\n');
}

// Migrate Spotlight
async function migrateSpotlight() {
  console.log('🌟 Migrating Spotlight from Notion...');

  let allItems = [];
  let cursor = null;
  let pageNum = 0;

  // Fetch all pages from Notion
  do {
    pageNum++;
    console.log(`📄 Fetching spotlight page ${pageNum}...`);

    const response = await notion.databases.query({
      database_id: process.env.NOTION_SPOTLIGHT_ID,
      start_cursor: cursor || undefined,
      page_size: 100
    });

    allItems = allItems.concat(response.results);
    cursor = response.next_cursor;

    if (cursor) await new Promise(r => setTimeout(r, 300));
  } while (cursor);

  console.log(`📊 Found ${allItems.length} spotlight items total\n`);

  let spotlightsInserted = 0;
  let spotlightsUpdated = 0;
  let spotlightsSkipped = 0;
  let errors = 0;

  for (const page of allItems) {
    const props = page.properties;
    const spotlightId = page.id;

    // Get the relation to Moodboard (property name includes emoji)
    const moodboardRelation = getProp(props, '🍋 Moodboard', 'relation');
    
    if (!moodboardRelation || moodboardRelation.length === 0) {
      console.log(`⚠️  Skipping ${spotlightId}: No moodboard relation found`);
      spotlightsSkipped++;
      continue;
    }

    // Get the product_id (notion_id from moodboard)
    const productId = moodboardRelation[0].id;

    // Get the date range
    const dateRange = getProp(props, 'Date', 'date');
    
    if (!dateRange || !dateRange.start) {
      console.log(`⚠️  Skipping ${spotlightId}: No date found`);
      spotlightsSkipped++;
      continue;
    }

    const startDate = dateRange.start;
    const endDate = dateRange.end || null;

    console.log(`\n🔄 Processing spotlight: ${spotlightId}`);
    console.log(`  📌 Product ID: ${productId}`);
    console.log(`  📅 Date: ${startDate}${endDate ? ` → ${endDate}` : ''}`);

    try {
      // Check if spotlight entry already exists
      const existing = await turso.execute({
        sql: 'SELECT id FROM spotlight WHERE id = ?',
        args: [spotlightId]
      });

      const isUpdate = existing.rows.length > 0;

      // Insert or update spotlight entry
      await turso.execute({
        sql: `
          INSERT INTO spotlight (
            id, product_id, start_date, end_date, updated_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            product_id = excluded.product_id,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            updated_at = excluded.updated_at
        `,
        args: [
          spotlightId,
          productId,
          startDate,
          endDate
        ]
      });

      if (isUpdate) {
        spotlightsUpdated++;
        console.log(`  ✅ Spotlight updated`);
      } else {
        spotlightsInserted++;
        console.log(`  ✅ Spotlight inserted`);
      }

    } catch (err) {
      errors++;
      console.error(`❌ Failed to process spotlight "${spotlightId}":`, err.message);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('🎉 Spotlight migration complete!');
  console.log(`✅ Spotlights inserted: ${spotlightsInserted}`);
  console.log(`🔄 Spotlights updated: ${spotlightsUpdated}`);
  console.log(`⏭️  Spotlights skipped: ${spotlightsSkipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('╚════════════════════════════════════════════════════╝');
}

// Run migration
async function runMigration() {
  try {
    console.log('🚀 Starting Spotlight Notion → Turso migration...\n');

    await createSpotlightTable();
    await migrateSpotlight();

    console.log('\n✨ Migration complete! Your spotlight data is now in Turso.');
    console.log('\n📊 Verify your data:');
    console.log('turso db shell acceso');
    console.log('SELECT COUNT(*) FROM spotlight;');
    console.log('SELECT s.id, p.name, s.start_date, s.end_date');
    console.log('FROM spotlight s');
    console.log('LEFT JOIN products p ON s.product_id = p.id;');

    process.exit(0);
  } catch (err) {
    console.error('💥 Migration failed:', err);
    process.exit(1);
  }
}

runMigration();