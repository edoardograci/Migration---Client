import { config } from '../config';

export class VectorizeService {
    private static API_URL = config.vectorize.accountId
        ? `https://api.cloudflare.com/client/v4/accounts/${config.vectorize.accountId}/vectorize/v2`
        : null;

    private static AI_URL = config.vectorize.accountId
        ? `https://api.cloudflare.com/client/v4/accounts/${config.vectorize.accountId}/ai/run/@cf/qwen/qwen3-embedding-0.6b`
        : null;

    static async generateEmbedding(text: string): Promise<number[]> {
        if (!this.AI_URL || !config.vectorize.token) {
            throw new Error('Cloudflare AI configuration missing');
        }

        const response = await fetch(this.AI_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.vectorize.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Embedding API error: ${response.statusText} - ${err}`);
        }

        const data: any = await response.json();
        const embedding = data.result?.data?.[0] || data.result?.embeddings?.[0];

        if (!embedding) {
            throw new Error('Failed to extract embedding from response');
        }

        return embedding;
    }

    static async upsert(vectorId: string, values: number[], metadata: any) {
        if (!this.API_URL || !config.vectorize.token) {
            throw new Error('Cloudflare Vectorize configuration missing');
        }

        const response = await fetch(`${this.API_URL}/indexes/ai-search-optimus/upsert`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.vectorize.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                vectors: [
                    {
                        id: vectorId,
                        values,
                        metadata
                    }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Vectorize Upsert error: ${response.statusText} - ${err}`);
        }

        return await response.json();
    }
}
