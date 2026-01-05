import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

const R2 = new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.r2.accessKeyId || '',
        secretAccessKey: config.r2.secretAccessKey || '',
    },
});

export class StorageService {
    static async upload(key: string, body: Buffer | Uint8Array, contentType: string, isMoodboard = false) {
        try {
            const bucket = isMoodboard ? config.r2.bucketMoodboard : config.r2.bucketIndex;
            const publicUrl = isMoodboard ? config.r2.publicUrlMoodboard : config.r2.publicUrlIndex;

            // Check if file exists
            const exists = await this.exists(key, isMoodboard);

            await R2.send(new PutObjectCommand({
                Bucket: bucket as string,
                Key: key,
                Body: body,
                ContentType: contentType,
                // Force overwrite/update metadata if exists
                ...(exists && { ContentDisposition: 'inline' })
            }));
            return `${publicUrl}/${key}`;
        } catch (error) {
            console.error('Error uploading to R2:', error);
            throw error;
        }
    }

    static async exists(key: string, isMoodboard = false): Promise<boolean> {
        try {
            const bucket = isMoodboard ? config.r2.bucketMoodboard : config.r2.bucketIndex;
            await R2.send(new HeadObjectCommand({
                Bucket: bucket as string,
                Key: key
            }));
            return true;
        } catch (error: any) {
            if (error.name === 'NotFound') return false;
            throw error;
        }
    }
}
