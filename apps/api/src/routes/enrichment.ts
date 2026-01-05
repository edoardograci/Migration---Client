import { Router } from 'express';
import { EnrichmentService } from '../services/EnrichmentService';

const router = Router();

router.post('/generate', async (req, res, next) => {
    try {
        const { productData, forceRegenerate } = req.body;
        const result = await EnrichmentService.generate(productData, forceRegenerate);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/validate', async (req, res, next) => {
    // Basic validation stub
    const { enrichment } = req.body;
    const errors = [];
    if (!enrichment.object_type) errors.push('Missing object_type');
    if (!enrichment.category) errors.push('Missing category');

    res.json({ valid: errors.length === 0, errors });
});

router.post('/batch-generate', async (req, res, next) => {
    // Stub
    res.json({ results: [] });
});

export default router;
