
const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'qwen2.5:7b-instruct';

const scrapeCache = new Map<string, string | null>();
const enrichmentCache = new Map<string, any>();

export async function scrapeSource(url: string | null): Promise<string | null> {
    if (!url) return null;
    if (scrapeCache.has(url)) return scrapeCache.get(url)!;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AccesoMigration/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: controller.signal as AbortSignal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            scrapeCache.set(url, null);
            return null;
        }

        const html = await response.text();
        const scrapedContent = extractRelevantContent(html);
        const trimmedContent = scrapedContent.substring(0, 1500);

        scrapeCache.set(url, trimmedContent);
        return trimmedContent;

    } catch (err: any) {
        scrapeCache.set(url, null);
        return null;
    }
}

function extractRelevantContent(html: string) {
    const parts = [];

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) parts.push(`Title: ${cleanText(titleMatch[1])}`);

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (descMatch) parts.push(`Meta description: ${cleanText(descMatch[1])}`);

    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) parts.push(`Heading: ${cleanText(h1Match[1])}`);

    const pMatches = html.match(/<p[^>]*>([^<]{20,})<\/p>/gi);
    if (pMatches) {
        const paragraphs = pMatches
            .slice(0, 2)
            .map(p => cleanText(p.replace(/<[^>]+>/g, '')))
            .filter(p => p.length > 20 && !isNavigationText(p));

        if (paragraphs.length > 0) parts.push(`Content: ${paragraphs.join(' ')}`);
    }

    const altMatches = html.match(/alt=["']([^"']{10,})["']/gi);
    if (altMatches) {
        const alt = altMatches[0].replace(/alt=["']/i, '').replace(/["']$/, '');
        if (!isNavigationText(alt)) parts.push(`Image alt: ${cleanText(alt)}`);
    }

    return parts.join('\n');
}

function cleanText(text: string) {
    return text
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/&#\d+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isNavigationText(text: string) {
    const navigationPatterns = [
        /^(home|about|contact|menu|nav|footer|header|cookie|privacy|terms)/i,
        /^(click here|read more|learn more|subscribe|sign up|login)/i,
        /^(©|\d{4})/,
    ];
    return navigationPatterns.some(p => p.test(text.toLowerCase().trim()));
}

export async function enrichSemantics(scrapedText: string | null, productData: any = {}) {
    const cacheKey = `${productData.name || ''}-${productData.designer || ''}-${productData.link || ''}`;
    if (enrichmentCache.has(cacheKey)) return enrichmentCache.get(cacheKey);

    const inputParts = [];
    if (productData.name) inputParts.push(`Product name: ${productData.name}`);
    if (productData.designer) inputParts.push(`Designer: ${productData.designer}`);
    if (productData.year) inputParts.push(`Year: ${productData.year}`);
    if (productData.city) inputParts.push(`City: ${productData.city}`);
    if (productData.client) inputParts.push(`Client: ${productData.client}`);
    if (productData.link) inputParts.push(`Source URL: ${productData.link}`);
    if (scrapedText) inputParts.push(`\nScraped content:\n${scrapedText}`);

    const inputText = inputParts.join('\n');

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
    } catch (err: any) {
        console.warn(`AI enrichment failed: ${err.message}`);
        const fallback = generateFallbackEnrichment(productData);
        enrichmentCache.set(cacheKey, fallback);
        return fallback;
    }
}

async function callOllama(prompt: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false,
                format: 'json',
                options: { temperature: 0.1, num_predict: 500 },
            }),
            signal: controller.signal as AbortSignal,
        });

        clearTimeout(timeout);
        if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);

        const data: any = await response.json();
        const text = data.response?.trim();
        if (!text) throw new Error('Empty response from Ollama');

        const parsed = JSON.parse(text);
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

function parseString(value: any) {
    if (typeof value === 'string' && value.trim() && value.toLowerCase() !== 'null') {
        return value.trim();
    }
    return null;
}

function parseArray(value: any) {
    if (Array.isArray(value) && value.length > 0) {
        return value
            .filter((v: any) => typeof v === 'string' && v.trim())
            .map((v: any) => v.toLowerCase().trim());
    }
    return null;
}

export function generateFallbackEnrichment(productData: any) {
    const name = productData.name || 'Unknown';
    const nameLower = name.toLowerCase();

    let objectType = null;
    let category = null;
    const keywords = [];

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

    if (!objectType) objectType = 'object';
    if (!category) category = 'design';

    const nameWords = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter((w: string) => w.length > 2 && !['the', 'and', 'for'].includes(w)).slice(0, 4);
    keywords.push(...nameWords);

    if (productData.designer) keywords.push(productData.designer.toLowerCase().split(' ')[0]);

    let description = `${name}`;
    if (productData.designer) description += ` by ${productData.designer}`;
    if (productData.year) description += `, ${productData.year}`;
    description = description.substring(0, 150);

    return {
        object_type: objectType,
        category: category,
        materials: null,
        keywords: [...new Set(keywords)].slice(0, 6),
        description: description,
        enrichment_source: 'fallback',
        enrichment_version: '1.0',
    };
}

export function buildEmbeddingText(enrichedData: any, product: any, imageIndex: number, totalImages = 1) {
    const lines = ['[PRODUCT IMAGE]'];

    lines.push(`Object type: ${enrichedData.object_type || 'object'}`);
    lines.push(`Category: ${enrichedData.category || 'design'}`);

    const materials = (Array.isArray(enrichedData.materials) && enrichedData.materials.length)
        ? enrichedData.materials.join(', ')
        : (typeof enrichedData.materials === 'string' ? enrichedData.materials : 'unknown');
    lines.push(`Materials: ${materials}`);

    const keywords = (Array.isArray(enrichedData.keywords) && enrichedData.keywords.length)
        ? enrichedData.keywords.join(', ')
        : (product.name?.toLowerCase() || 'design object');
    lines.push(`Keywords: ${keywords}`);

    lines.push(`Description: ${enrichedData.description || product.name || 'Design object'}`);

    lines.push(`Product name: ${product.name || 'Unknown'}`);
    lines.push(`Designer: ${product.designer || 'Unknown'}`);
    lines.push(`City: ${product.city || 'Unknown'}`);
    lines.push(`Year: ${product.year || 'Unknown'}`);

    lines.push(`Image index: ${imageIndex + 1} of ${totalImages}`);

    if (totalImages > 1) {
        let viewType = 'view';
        if (imageIndex === 0) viewType = 'primary view';
        else if (imageIndex === totalImages - 1) viewType = 'detail view';
        else viewType = `view ${imageIndex + 1}`;
        lines.push(`View: ${viewType}`);
    }

    lines.push('Platform: Acceso moodboard');

    return lines.join('\n');
}

export async function checkOllamaAvailable() {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) return { available: false, reason: 'Ollama not responding' };

        const data: any = await response.json();
        const models = data.models || [];
        const hasModel = models.some((m: any) => m.name === OLLAMA_MODEL || m.name.startsWith('qwen2.5:7b'));

        if (!hasModel) return { available: false, reason: `Model ${OLLAMA_MODEL} not found.` };

        return { available: true, model: OLLAMA_MODEL };
    } catch (err: any) {
        return { available: false, reason: `Ollama not reachable: ${err.message}` };
    }
}
