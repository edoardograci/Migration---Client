import { Router } from 'express';
import { ImageService } from '../services/ImageService';

const router = Router();

router.post('/analyze', async (req, res, next) => {
    try {
        const { imageUrl } = req.body;
        const result = await ImageService.analyze(imageUrl);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/convert', async (req, res, next) => {
    try {
        const { imageUrl, strategy, forceConvert, storageKey, isMoodboard } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: 'Missing required parameter: imageUrl' });
        }

        // Download original to get size
        const originalResponse = await fetch(imageUrl);
        if (!originalResponse.ok) {
            return res.status(400).json({ error: 'Failed to fetch image from URL' });
        }
        const originalBuffer = Buffer.from(await originalResponse.arrayBuffer());
        const originalSize = originalBuffer.length;

        const result = await ImageService.convert(imageUrl, strategy, forceConvert, storageKey, isMoodboard);

        const reductionPercent = Math.round(((originalSize - result.size) / originalSize) * 100);

        res.json({
            originalSize: originalSize,
            convertedSize: result.size,
            reductionPercent: reductionPercent,
            ssimScore: result.ssim,
            strategy: result.strategy,
            convertedBlob: result.buffer.toString('base64'),
            diffBlob: result.diffMap.toString('base64'),
            accepted: result.accepted,
            reason: result.accepted ? 'Good quality' : 'Quality too low'
        });
    } catch (err) { next(err); }
});

router.post('/batch-convert', async (req, res, next) => {
    try {
        const { images } = req.body;
        const results = await ImageService.batchConvert(images);
        res.json({ results });
    } catch (err) { next(err); }
});

export default router;
