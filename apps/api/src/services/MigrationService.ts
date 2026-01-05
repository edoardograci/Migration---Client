import { turso } from './TursoService';
import { StorageService } from './StorageService';
import { ImageService } from './ImageService';
import { NotionService } from './NotionService';
import { EnrichmentService } from './EnrichmentService';
import { VectorizeService } from './VectorizeService';
import { buildEmbeddingText } from '../lib/semantic-enrichment';
import { generateId, generateContentHash } from '../lib/utils';
import { config } from '../config';
import { Designer, MoodboardProduct } from '@repo/shared-types';

interface Job {
    id: string;
    type: 'designers' | 'moodboard';
    items: string[];
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: { total: number; completed: number; failed: number; current: string | null };
    results: any[];
    errors: any[];
    startTime: string;
    endTime?: string;
}

const jobs = new Map<string, Job>();

export class MigrationService {
    static async execute(payload: { type: 'designers' | 'moodboard', ids: string[] }) {
        const jobId = generateId();
        const job: Job = {
            id: jobId,
            type: payload.type,
            items: payload.ids,
            status: 'queued',
            progress: { total: payload.ids.length, completed: 0, failed: 0, current: null },
            results: [],
            errors: [],
            startTime: new Date().toISOString()
        };

        jobs.set(jobId, job);

        // Start processing in background (don't await)
        this.processJob(jobId);

        return { jobId, status: 'queued' };
    }

    static async getStatus(jobId: string) {
        return jobs.get(jobId);
    }

    static async cancel(jobId: string) {
        const job = jobs.get(jobId);
        if (job && job.status === 'processing') {
            job.status = 'cancelled';
            job.endTime = new Date().toISOString();
        }
        return { cancelled: true };
    }

    static async dryRun(payload: any) {
        // Just return a summary of what would happen
        return {
            summary: { adding: payload.ids.length, updating: 0, removing: 0 },
            details: { adding: payload.ids, updating: [], removing: [] },
            warnings: [],
            costEstimate: {
                r2StorageMB: payload.ids.length * 0.5, // Approx 500KB per image
                vectorizeOps: 0,
                aiCalls: 0,
                tursoWrites: payload.ids.length,
                estimatedDuration: payload.ids.length * 2000 // 2s per item
            }
        };
    }

    private static async processJob(jobId: string) {
        const job = jobs.get(jobId);
        if (!job) return;

        job.status = 'processing';

        try {
            if (job.type === 'designers') {
                await this.migrateDesigners(job);
            } else {
                await this.migrateMoodboard(job);
            }

            if ((job.status as string) !== 'cancelled') {
                job.status = 'completed';
            }
        } catch (error: any) {
            console.error(`Job ${jobId} failed:`, error);
            job.status = 'failed';
            job.errors.push(error.message);
        } finally {
            job.endTime = new Date().toISOString();
        }
    }

    private static async migrateDesigners(job: Job) {
        const fullList = await NotionService.getDesigners();
        const designersToMigrate = fullList.filter((d: Designer) => job.items.includes(d.id));

        for (const designer of designersToMigrate) {
            if (job.status === 'cancelled') break;

            job.progress.current = `Processing ${designer.name}`;

            try {
                const contentHash = generateContentHash(designer);
                const slug = this.generateSlug(designer.name);

                // 1. Handle Image
                let coverKey = null;
                if (designer.coverUrl) {
                    // Use human-readable slug for naming
                    coverKey = `studios/${slug}.webp`;

                    // Always convert/optimize
                    const conversion = await ImageService.convert(designer.coverUrl);

                    // Upload
                    await StorageService.upload(coverKey, conversion.buffer, 'image/webp');
                }

                // 2. Insert into Turso
                await turso.execute({
                    sql: `
                        INSERT INTO studios (
                            id, notion_id, slug, status, name, 
                            city, cover, website, instagram, email, 
                            content_hash, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(notion_id) DO UPDATE SET
                            name=excluded.name,
                            slug=excluded.slug,
                            city=excluded.city,
                            cover=excluded.cover,
                            website=excluded.website,
                            instagram=excluded.instagram,
                            email=excluded.email,
                            content_hash=excluded.content_hash,
                            updated_at=excluded.updated_at
                    `,
                    args: [
                        designer.id, // using notion ID as ID? In script it was page.id
                        designer.notionId,
                        slug,
                        'Published',
                        designer.name,
                        designer.city,
                        coverKey,
                        designer.website,
                        designer.instagram,
                        designer.email,
                        contentHash,
                        new Date().toISOString(), // created_at
                        new Date().toISOString()  // updated_at
                    ]
                });

                job.progress.completed++;
                job.results.push({ id: designer.id, status: 'success' });

            } catch (err: any) {
                console.error(`Failed to migrate ${designer.name}:`, err);
                job.progress.failed++;
                job.errors.push({ id: designer.id, error: err.message });
            }
        }
    }

    private static async migrateMoodboard(job: Job) {
        const fullList = await NotionService.getMoodboard();
        const productsToMigrate = fullList.filter((p: MoodboardProduct) => job.items.includes(p.id));

        for (const product of productsToMigrate) {
            if (job.status === 'cancelled') break;

            job.progress.current = `Processing ${product.name}`;

            try {
                // 1. Semantic Enrichment
                const enrichmentRes = await EnrichmentService.generate(product);
                const enrichedData = enrichmentRes.enrichment;

                const contentHash = generateContentHash(product);
                const productSlug = this.generateSlug(product.name);

                // 2. Insert/Update Product in Turso
                await turso.execute({
                    sql: `
                        INSERT INTO products (
                            id, notion_id, slug, status, name, 
                            designer, year, link, city, content_hash, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(notion_id) DO UPDATE SET
                            name=excluded.name, slug=excluded.slug, designer=excluded.designer,
                            year=excluded.year, link=excluded.link, city=excluded.city, 
                            content_hash=excluded.content_hash,
                            updated_at=excluded.updated_at
                    `,
                    args: [
                        product.id, product.notionId, productSlug, 'Published', product.name,
                        product.designer, product.year, product.link, product.city,
                        contentHash,
                        new Date().toISOString(), new Date().toISOString()
                    ]
                });

                // 3. Process Images
                for (let i = 0; i < product.images.length; i++) {
                    const img = product.images[i];
                    const imageId = `${product.id}_${i}`;
                    const r2Key = `moodboard/${productSlug}/${i}.webp`;

                    // Convert & Optimise
                    const conversion = await ImageService.convert(img.url);

                    // Upload to Moodboard bucket (R2_BUCKET_NAME2)
                    // We need to pass bucket to StorageService or handle it there.
                    // For now, let's assume StorageService.uploadMoodboard helper
                    await StorageService.upload(r2Key, conversion.buffer, 'image/webp', true);

                    // Embedding Text
                    const embeddingText = buildEmbeddingText(enrichedData, product, i, product.images.length);

                    // Vectorize
                    try {
                        const embedding = await VectorizeService.generateEmbedding(embeddingText);
                        await VectorizeService.upsert(imageId, embedding, {
                            product_id: product.id,
                            folder: "moodboard/*",
                            key: r2Key,
                            url: `${config.r2.publicUrlMoodboard}/${r2Key}`
                        });
                    } catch (vecErr) {
                        console.error(`Vectorize failed for ${product.name} image ${i}:`, vecErr);
                    }

                    // Save Image Entry in Turso
                    await turso.execute({
                        sql: `
                            INSERT INTO product_images (
                                id, product_id, image_url, r2_key, position, 
                                original_notion_url, embedding_text, enrichment_json,
                                enrichment_version, enrichment_source, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                image_url=excluded.image_url, r2_key=excluded.r2_key,
                                position=excluded.position, embedding_text=excluded.embedding_text,
                                enrichment_json=excluded.enrichment_json, updated_at=datetime('now')
                        `,
                        args: [
                            imageId, product.id, `${config.r2.publicUrlMoodboard}/${r2Key}`, r2Key, i,
                            img.url, embeddingText, JSON.stringify(enrichedData),
                            enrichedData.enrichment_version || '1.0',
                            enrichedData.enrichment_source || 'unknown',
                            new Date().toISOString()
                        ]
                    });
                }

                job.progress.completed++;
                job.results.push({ id: product.id, status: 'success' });

            } catch (err: any) {
                console.error(`Failed to migrate moodboard product ${product.name}:`, err);
                job.progress.failed++;
                job.errors.push({ id: product.id, error: err.message });
            }
        }
    }

    private static generateSlug(name: string): string {
        return name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
    }
}
