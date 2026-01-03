import { enrichSemantics, buildEmbeddingText, scrapeSource } from '../lib/semantic-enrichment';

export class EnrichmentService {
    static async generate(productData: any, forceRegenerate = false) {
        // If forceRegenerate is true, we might need to bypass cache or similar?
        // enrichSemantics uses memory cache.
        // Ideally we pass force flag down, but lib doesn't support it yet. 
        // We can clear cache entry manually if needed, or update lib.
        // For now, simple wrapper.

        let scrapedText = null;
        if (productData.link) {
            scrapedText = await scrapeSource(productData.link);
        }

        const start = Date.now();
        const enrichment = await enrichSemantics(scrapedText, productData);
        const duration = Date.now() - start;

        return {
            enrichment,
            scrapedText,
            duration
        };
    }
}
