import axios from 'axios';

export const api = axios.create({
    baseURL: '/api'
});

export const notionApi = {
    getDesigners: () => api.get('/notion/designers').then(res => res.data),
    getMoodboard: () => api.get('/notion/moodboard').then(res => res.data),
};

export const tursoApi = {
    checkStatus: (notionIds: string[], type: 'designer' | 'moodboard') =>
        api.post('/turso/check-status', { notionIds, type }).then(res => res.data),
};

export const imageApi = {
    analyze: (imageUrl: string) => api.post('/image/analyze', { imageUrl }).then(res => res.data),
    convert: (imageUrl: string, strategy?: string, forceConvert?: boolean) =>
        api.post('/image/convert', { imageUrl, strategy, forceConvert }).then(res => res.data),
    batchConvert: (images: any[]) => api.post('/image/batch-convert', { images }).then(res => res.data),
};

export const enrichmentApi = {
    generate: (productData: any, forceRegenerate = false) =>
        api.post('/enrichment/generate', { productData, forceRegenerate }).then(res => res.data),
    validate: (enrichment: any) =>
        api.post('/enrichment/validate', { enrichment }).then(res => res.data),
};

export const migrationApi = {
    dryRun: (payload: any) => api.post('/migration/dry-run', payload).then(res => res.data),
    execute: (payload: any) => api.post('/migration/execute', payload).then(res => res.data),
    getStatus: (jobId: string) => api.get(`/migration/status/${jobId}`).then(res => res.data),
    cancel: (jobId: string) => api.post(`/migration/cancel/${jobId}`).then(res => res.data),
};
