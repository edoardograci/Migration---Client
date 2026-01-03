import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function createSchema() {
  console.log('🔧 Creating Turso schema...');

  // Studios table
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS studios (
      id TEXT PRIMARY KEY,
      notion_id TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'Published',
      name TEXT NOT NULL,
      number INTEGER,
      city TEXT NOT NULL,
      cover TEXT,
      website TEXT,
      instagram TEXT,
      email TEXT,
      email2 TEXT,
      phone TEXT,
      address TEXT,
      latitude REAL,
      longitude REAL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Moodboard table
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS moodboard (
      id TEXT PRIMARY KEY,
      notion_id TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'Published',
      name TEXT NOT NULL,
      designer TEXT,
      year TEXT,
      client TEXT,
      link TEXT,
      city TEXT,
      keywords TEXT,
      image_url TEXT,
      original_notion_image TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create indexes for performance
  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_studios_city ON studios(city)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_studios_status ON studios(status)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_studios_slug ON studios(slug)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_moodboard_status ON moodboard(status)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_moodboard_slug ON moodboard(slug)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_moodboard_city ON moodboard(city)
  `);

  // Full-text search on keywords
  await turso.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS moodboard_search 
    USING fts5(notion_id, name, keywords, content='moodboard', content_rowid='rowid')
  `);

  // Products table (moodboard items with images)
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

  // Product embeddings table (tracks Vectorize entries)
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

  // Indexes for product_images
  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_product_images_product_id 
    ON product_images(product_id)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)
  `);

  // Indexes for product_embeddings
  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_product_embeddings_image_id 
    ON product_embeddings(image_id)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_product_embeddings_product_id 
    ON product_embeddings(product_id)
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_product_embeddings_vector_id 
    ON product_embeddings(vector_id)
  `);

  console.log('✅ Schema created successfully!');
}

createSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });