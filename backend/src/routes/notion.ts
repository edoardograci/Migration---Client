import { Router } from 'express';
import { NotionService } from '../services/NotionService';

const router = Router();

router.get('/designers', async (req, res, next) => {
    try {
        const designers = await NotionService.getDesigners();
        res.json({ designers });
    } catch (err) { next(err); }
});

router.get('/moodboard', async (req, res, next) => {
    try {
        const products = await NotionService.getMoodboard();
        res.json({ products });
    } catch (err) { next(err); }
});

export default router;
