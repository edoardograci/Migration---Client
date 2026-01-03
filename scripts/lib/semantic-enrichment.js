/**
 * Semantic Enrichment Module
 * 
 * Local AI-powered semantic enrichment for moodboard embeddings.
 * Uses Ollama with qwen2.5:7b-instruct for structured metadata extraction.
 * 
 * This module:
 * - Scrapes source links for contextual information
 * - Uses local AI to extract structured semantic metadata
 * - Builds canonical embedding text for Vectorize
 * - Provides fallback logic when AI/scraping fails
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'qwen2.5:7b-instruct';

// Cache for scraped content (per source URL)
const scrapeCache = new Map();

// Cache for AI enrichment results (per product)
const enrichmentCache = new Map();

/**
 * Scrape minimal, relevant content from a source URL
 * 
 * Scrapes:
 * - <title>
 * - <meta name="description">
 * - first <h1>
 * - first 2 <p> tags
 * - image alt text (if available)
 * 
 * @param {string} url - The source URL to scrape
 * @returns {Promise<string|null>} - Scraped text or null on failure
 */
export async function scrapeSource(url) {
    if (!url) return null;

    // Check cache first
    if (scrapeCache.has(url)) {
        return scrapeCache.get(url);
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AccesoMigration/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.log(`  ⚠️  Scrape failed for ${url}: HTTP ${response.status}`);
            scrapeCache.set(url, null);
            return null;
        }

        const html = await response.text();
        const scrapedContent = extractRelevantContent(html);

        // Limit to ~1500 characters
        const trimmedContent = scrapedContent.substring(0, 1500);

        scrapeCache.set(url, trimmedContent);
        return trimmedContent;

    } catch (err) {
        console.log(`  ⚠️  Scrape failed for ${url}: ${err.message}`);
        scrapeCache.set(url, null);
        return null;
    }
}

/**
 * Extract relevant content from HTML
 * Strips scripts, navigation, and marketing fluff
 */
function extractRelevantContent(html) {
    const parts = [];

    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
        parts.push(`Title: ${cleanText(titleMatch[1])}`);
    }

    // Extract <meta name="description">
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (descMatch) {
        parts.push(`Meta description: ${cleanText(descMatch[1])}`);
    }

    // Extract first <h1>
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
        parts.push(`Heading: ${cleanText(h1Match[1])}`);
    }

    // Extract first 2 <p> tags (simple extraction)
    const pMatches = html.match(/<p[^>]*>([^<]{20,})<\/p>/gi);
    if (pMatches) {
        const paragraphs = pMatches
            .slice(0, 2)
            .map(p => {
                const content = p.replace(/<[^>]+>/g, '');
                return cleanText(content);
            })
            .filter(p => p.length > 20 && !isNavigationText(p));

        if (paragraphs.length > 0) {
            parts.push(`Content: ${paragraphs.join(' ')}`);
        }
    }

    // Extract image alt text (first meaningful one)
    const altMatches = html.match(/alt=["']([^"']{10,})["']/gi);
    if (altMatches) {
        const alt = altMatches[0].replace(/alt=["']/i, '').replace(/["']$/, '');
        if (!isNavigationText(alt)) {
            parts.push(`Image alt: ${cleanText(alt)}`);
        }
    }

    return parts.join('\n');
}

/**
 * Clean text by removing extra whitespace and HTML entities
 */
function cleanText(text) {
    return text
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/&#\d+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Check if text is likely navigation/boilerplate
 */
function isNavigationText(text) {
    const navigationPatterns = [
        /^(home|about|contact|menu|nav|footer|header|cookie|privacy|terms)/i,
        /^(click here|read more|learn more|subscribe|sign up|login)/i,
        /^(©|\d{4})/,
    ];
    return navigationPatterns.some(p => p.test(text.toLowerCase().trim()));
}

/**
 * Call Ollama API to enrich scraped content with structured metadata
 * 
 * @param {string} scrapedText - The scraped content to enrich
 * @param {object} productData - Additional product context (name, designer, etc.)
 * @returns {Promise<object>} - Enriched metadata object
 */
export async function enrichSemantics(scrapedText, productData = {}) {
    // Create cache key from product data
    const cacheKey = `${productData.name || ''}-${productData.designer || ''}-${productData.link || ''}`;

    if (enrichmentCache.has(cacheKey)) {
        return enrichmentCache.get(cacheKey);
    }

    // Build input context
    const inputParts = [];
    if (productData.name) inputParts.push(`Product name: ${productData.name}`);
    if (productData.designer) inputParts.push(`Designer: ${productData.designer}`);
    if (productData.year) inputParts.push(`Year: ${productData.year}`);
    if (productData.city) inputParts.push(`City: ${productData.city}`);
    if (productData.client) inputParts.push(`Client: ${productData.client}`);
    if (productData.link) inputParts.push(`Source URL: ${productData.link}`);
    if (scrapedText) inputParts.push(`\nScraped content:\n${scrapedText}`);

    const inputText = inputParts.join('\n');

    // If no meaningful input, use fallback
    if (inputText.length < 10) {
        const fallback = generateFallbackEnrichment(productData);
        enrichmentCache.set(cacheKey, fallback);
        return fallback;
    }

    const prompt = `You are extracting factual metadata for a design archive.

Rules:
- Use ONLY the provided input
- Do NOT invent information
- Do NOT add opinions or marketing language
- Prefer concrete nouns over adjectives
- If a value is unknown, return null

Return a JSON object with EXACTLY these fields:
- object_type (singular noun, 1 word)
- category (singular noun, 1 word)
- materials (array of lowercase words, or null)
- keywords (array, max 6 items)
- description (max 25 words, factual)

INPUT:
${inputText}`;

    try {
        const result = await callOllama(prompt);
        const enriched = {
            ...result,
            enrichment_source: 'ai',
            enrichment_version: '1.0',
        };

        enrichmentCache.set(cacheKey, enriched);
        return enriched;

    } catch (err) {
        console.log(`  ⚠️  AI enrichment failed: ${err.message}`);
        const fallback = generateFallbackEnrichment(productData);
        enrichmentCache.set(cacheKey, fallback);
        return fallback;
    }
}

/**
 * Call Ollama HTTP API
 */
async function callOllama(prompt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for AI

    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false,
                format: 'json',
                options: {
                    temperature: 0.1, // Low temperature for deterministic output
                    num_predict: 500,
                },
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Ollama returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data.response?.trim();

        if (!text) {
            throw new Error('Empty response from Ollama');
        }

        // Parse JSON response
        const parsed = JSON.parse(text);

        // Validate required fields
        return {
            object_type: parseString(parsed.object_type),
            category: parseString(parsed.category),
            materials: parseArray(parsed.materials),
            keywords: parseArray(parsed.keywords)?.slice(0, 6),
            description: parseString(parsed.description)?.substring(0, 200),
        };

    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

/**
 * Parse string from AI response, return null if invalid
 */
function parseString(value) {
    if (typeof value === 'string' && value.trim() && value.toLowerCase() !== 'null') {
        return value.trim();
    }
    return null;
}

/**
 * Parse array from AI response, return null if invalid
 */
function parseArray(value) {
    if (Array.isArray(value) && value.length > 0) {
        return value
            .filter(v => typeof v === 'string' && v.trim())
            .map(v => v.toLowerCase().trim());
    }
    return null;
}

/**
 * Generate fallback enrichment when AI fails
 * Uses deterministic rules based on product name
 */
export function generateFallbackEnrichment(productData) {
    const name = productData.name || 'Unknown';
    const nameLower = name.toLowerCase();

    // Try to infer object type from common patterns
    let objectType = null;
    let category = null;
    const materials = null;
    const keywords = [];

    // Object type inference
    const objectPatterns = [
        { pattern: /chair|seat|stool/i, type: 'chair', category: 'furniture' },
        { pattern: /table|desk/i, type: 'table', category: 'furniture' },
        { pattern: /lamp|light|lighting/i, type: 'lamp', category: 'lighting' },
        { pattern: /sofa|couch/i, type: 'sofa', category: 'furniture' },
        { pattern: /shelf|shelving|bookcase/i, type: 'shelf', category: 'furniture' },
        { pattern: /cabinet|storage/i, type: 'cabinet', category: 'furniture' },
        { pattern: /mirror/i, type: 'mirror', category: 'accessory' },
        { pattern: /rug|carpet/i, type: 'rug', category: 'textile' },
        { pattern: /vase/i, type: 'vase', category: 'accessory' },
        { pattern: /clock/i, type: 'clock', category: 'accessory' },
        { pattern: /poster|print|artwork/i, type: 'artwork', category: 'art' },
        { pattern: /room|space|interior/i, type: 'interior', category: 'space' },
    ];

    for (const { pattern, type, category: cat } of objectPatterns) {
        if (pattern.test(nameLower)) {
            objectType = type;
            category = cat;
            break;
        }
    }

    // Default values
    if (!objectType) objectType = 'object';
    if (!category) category = 'design';

    // Generate keywords from name
    const nameWords = name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !['the', 'and', 'for'].includes(w))
        .slice(0, 4);

    keywords.push(...nameWords);

    if (productData.designer) {
        keywords.push(productData.designer.toLowerCase().split(' ')[0]);
    }

    // Simple description
    let description = `${name}`;
    if (productData.designer) description += ` by ${productData.designer}`;
    if (productData.year) description += `, ${productData.year}`;
    description = description.substring(0, 150);

    return {
        object_type: objectType,
        category: category,
        materials: materials,
        keywords: [...new Set(keywords)].slice(0, 6),
        description: description,
        enrichment_source: 'fallback',
        enrichment_version: '1.0',
    };
}

/**
 * Build canonical embedding text for a single image
 * 
 * Format:
 * [PRODUCT IMAGE]
 * Object type: {{object_type}}
 * Category: {{category}}
 * Materials: {{materials}}
 * Keywords: {{keywords}}
 * Description: {{description}}
 * Product name: {{product_name}}
 * Designer: {{designer}}
 * City: {{city}}
 * Year: {{year}}
 * Image index: {{index}}
 * Platform: Acceso moodboard
 * 
 * @param {object} enrichedData - The enriched semantic metadata
 * @param {object} product - The product data
 * @param {number} imageIndex - The image index (0-based)
 * @param {number} totalImages - Total number of images for the product
 * @returns {string} - Canonical embedding text
 */
export function buildEmbeddingText(enrichedData, product, imageIndex, totalImages = 1) {
    const lines = ['[PRODUCT IMAGE]'];

    // Add enriched fields
    lines.push(`Object type: ${enrichedData.object_type || 'object'}`);
    lines.push(`Category: ${enrichedData.category || 'design'}`);

    // Materials (comma-separated or "unknown")
    const materials = (Array.isArray(enrichedData.materials) && enrichedData.materials.length)
        ? enrichedData.materials.join(', ')
        : (typeof enrichedData.materials === 'string' ? enrichedData.materials : 'unknown');
    lines.push(`Materials: ${materials}`);

    // Keywords (comma-separated)
    const keywords = (Array.isArray(enrichedData.keywords) && enrichedData.keywords.length)
        ? enrichedData.keywords.join(', ')
        : (product.name?.toLowerCase() || 'design object');
    lines.push(`Keywords: ${keywords}`);

    // Description
    lines.push(`Description: ${enrichedData.description || product.name || 'Design object'}`);

    // Product metadata
    lines.push(`Product name: ${product.name || 'Unknown'}`);
    lines.push(`Designer: ${product.designer || 'Unknown'}`);
    lines.push(`City: ${product.city || 'Unknown'}`);
    lines.push(`Year: ${product.year || 'Unknown'}`);

    // Image-specific context (makes each embedding unique)
    lines.push(`Image index: ${imageIndex + 1} of ${totalImages}`);

    // Add positional context for multi-image products
    if (totalImages > 1) {
        let viewType = 'view';
        if (imageIndex === 0) viewType = 'primary view';
        else if (imageIndex === totalImages - 1) viewType = 'detail view';
        else viewType = `view ${imageIndex + 1}`;
        lines.push(`View: ${viewType}`);
    }

    // Platform identifier
    lines.push('Platform: Acceso moodboard');

    return lines.join('\n');
}

/**
 * Check if Ollama is available
 */
export async function checkOllamaAvailable() {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            return { available: false, reason: 'Ollama not responding' };
        }

        const data = await response.json();
        const models = data.models || [];
        const hasModel = models.some(m => m.name === OLLAMA_MODEL || m.name.startsWith('qwen2.5:7b'));

        if (!hasModel) {
            return {
                available: false,
                reason: `Model ${OLLAMA_MODEL} not found. Run: ollama pull ${OLLAMA_MODEL}`
            };
        }

        return { available: true, model: OLLAMA_MODEL };

    } catch (err) {
        return {
            available: false,
            reason: `Ollama not reachable: ${err.message}. Make sure Ollama is running.`
        };
    }
}

/**
 * Clear all caches (useful for re-running migration)
 */
export function clearCaches() {
    scrapeCache.clear();
    enrichmentCache.clear();
}
