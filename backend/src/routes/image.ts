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
        const { imageUrl, strategy, forceConvert } = req.body;
        const result = await ImageService.convert(imageUrl, strategy, forceConvert);

        // In a real scenario we need original size to compare. 
        // Assuming original was downloaded and we don't have its size easily exposed from convert helper return 
        // unless we modified it. 
        // For now returning calculated convertedSize.

        res.json({
            originalSize: 0, // Placeholder
            convertedSize: result.size,
            reductionPercent: 0,
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
