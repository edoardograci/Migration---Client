import { turso } from '../src/services/TursoService';

async function migrateDatabase() {
    console.log('🔧 Running database migrations...');

    // Add content_hash columns if they don't exist
    try {
        await turso.execute(`
            ALTER TABLE studios ADD COLUMN content_hash TEXT
        `);
        console.log('✅ Added content_hash to studios');
    } catch (err) {
        // console.log(err);
        console.log('ℹ️  content_hash already exists in studios (or check failed)');
    }

    try {
        await turso.execute(`
            ALTER TABLE products ADD COLUMN content_hash TEXT
        `);
        console.log('✅ Added content_hash to products');
    } catch (err) {
        // console.log(err);
        console.log('ℹ️  content_hash already exists in products (or check failed)');
    }

    // Add indexes for better performance
    try {
        await turso.execute(`
            CREATE INDEX IF NOT EXISTS idx_studios_content_hash 
            ON studios(content_hash)
        `);
        console.log('✅ Added index to studios');
    } catch (err) {
        console.log('ℹ️  Index creation failed for studios', err);
    }

    try {
        await turso.execute(`
            CREATE INDEX IF NOT EXISTS idx_products_content_hash 
            ON products(content_hash)
        `);
        console.log('✅ Added index to products');
    } catch (err) {
        console.log('ℹ️  Index creation failed for products', err);
    }

    console.log('✅ Database migrations complete');
}

migrateDatabase()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    });
