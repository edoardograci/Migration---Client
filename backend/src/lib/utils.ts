import crypto from 'crypto';

export function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Generate a deterministic hash of content for change detection
 * Used to detect if Notion content changed since last migration
 */
export function generateContentHash(item: any): string {
    // Create deterministic string from content
    const content = JSON.stringify({
        name: item.name,
        city: item.city,
        coverUrl: item.coverUrl,
        website: item.website,
        instagram: item.instagram,
        email: item.email,
        designer: item.designer,
        year: item.year,
        link: item.link,
        images: item.images?.map((img: any) => img.url),
    });

    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
