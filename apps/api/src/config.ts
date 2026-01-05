import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const requiredEnvVars = [
    'NOTION_TOKEN',
    'NOTION_DATABASE_ID',
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
] as const;

const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    if (process.env.NODE_ENV !== 'test') { // Allow tests to mock
        process.exit(1);
    }
}

export const config = {
    port: process.env.PORT || 3001,
    notion: {
        apiKey: process.env.NOTION_TOKEN,
        designersDbId: process.env.NOTION_DATABASE_ID,
        moodboardDbId: process.env.NOTION_MOODBOARD_ID,
        spotlightDbId: process.env.NOTION_SPOTLIGHT_ID,
    },
    turso: {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    },
    r2: {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucketIndex: process.env.R2_BUCKET_NAME,
        bucketMoodboard: process.env.R2_BUCKET_NAME2,
        publicUrlIndex: process.env.R2_PUBLIC_URL,
        publicUrlMoodboard: process.env.R2_PUBLIC_URL2,
    },
    vectorize: {
        accountId: process.env.CF_ACCOUNT_ID,
        token: process.env.VECTORIZE_API_TOKEN,
    }
};
