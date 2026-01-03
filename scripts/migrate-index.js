import { createClient } from '@libsql/client';
import { Client } from '@notionhq/client';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

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

// Initialize Cloudflare R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Helper: Generate slug
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

// Helper: Extract Notion properties
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
    case 'files': {
      const file = prop.files?.[0];
      if (!file) return null;
      return file.file?.url || file.external?.url || null;
    }
    default:
      return null;
  }
}

// Download image
async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image`);
  return Buffer.from(await res.arrayBuffer());
}

// Check if file exists in R2
async function fileExistsInR2(key) {
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key
    }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound') return false;
    throw err;
  }
}

// Upload to R2
async function uploadToR2(buffer, fileName, hash) {
  const finalName = `${fileName.replace(/\.webp$/, '')}-${hash}.webp`;
  const key = `studios/${finalName}`;

  if (await fileExistsInR2(key)) {
    return {
      url: `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
      skipped: true
    };
  }

  await r2Client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/webp'
  }));

  return {
    url: `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
    skipped: false
  };
}

// Process cover image
async function processCoverImage(notionUrl, slug, name) {
  if (!notionUrl) return null;

  const buffer = await downloadImage(notionUrl);
  const webp = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  const hash = crypto.createHash('md5').update(webp).digest('hex').slice(0, 8);

  return uploadToR2(webp, `${slug}.webp`, hash);
}

// Check if studio already exists in Turso
async function studioExists(notionId) {
  const res = await turso.execute({
    sql: `SELECT 1 FROM studios WHERE notion_id = ? LIMIT 1`,
    args: [notionId]
  });
  return res.rows.length > 0;
}

// Migrate studios
async function migrateStudios() {
  console.log('🏢 Migrating PUBLISHED studios only...\n');

  let studios = [];
  let cursor = null;

  do {
    const res = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      start_cursor: cursor || undefined,
      page_size: 100,
      filter: {
        property: 'Status',
        status: {
          equals: 'Published'
        }
      }
    });

    studios.push(...res.results);
    cursor = res.next_cursor;
    if (cursor) await new Promise(r => setTimeout(r, 300));
  } while (cursor);

  console.log(`📊 Found ${studios.length} published studios\n`);

  let inserted = 0;
  let skipped = 0;

  for (const page of studios) {
    const props = page.properties;
    const name = getProp(props, 'Name', 'title') || 'Untitled';
    const slug = generateSlug(name);

    if (await studioExists(page.id)) {
      console.log(`⏭️  Skipping already migrated: "${name}"`);
      skipped++;
      continue;
    }

    console.log(`➡️  Migrating "${name}"`);

    let coverUrl = null;
    const notionCover = getProp(props, 'Cover', 'files');
    if (notionCover) {
      const result = await processCoverImage(notionCover, slug, name);
      coverUrl = result?.url || null;
    }

    await turso.execute({
      sql: `
        INSERT INTO studios (
          id, notion_id, slug, status, name, number, city,
          cover, website, instagram, email, email2, phone,
          address, latitude, longitude, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        page.id,
        page.id,
        slug,
        'Published',
        name,
        getProp(props, 'Number', 'number'),
        getProp(props, 'City', 'select'),
        coverUrl,
        getProp(props, 'Website URL', 'url'),
        getProp(props, 'IG', 'url'),
        getProp(props, 'Email', 'email'),
        getProp(props, 'Email 2', 'email'),
        getProp(props, 'Phone', 'phone_number'),
        getProp(props, 'Address', 'rich_text'),
        getProp(props, 'Latitude', 'number'),
        getProp(props, 'Longitude', 'number'),
        page.created_time,
        page.last_edited_time
      ]
    });

    inserted++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n══════════════════════════════════');
  console.log('🎉 Migration complete');
  console.log(`✅ Inserted: ${inserted}`);
  console.log(`⏭️  Skipped existing: ${skipped}`);
  console.log('══════════════════════════════════');
}

// Run
(async () => {
  console.log('🚀 Starting Notion → Turso migration\n');
  await migrateStudios();
  process.exit(0);
})();
