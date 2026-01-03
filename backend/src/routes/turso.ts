import { Router } from 'express';
import { TursoService } from '../services/TursoService';

const router = Router();

router.post('/check-status', async (req, res, next) => {
    try {
        const { notionIds, type } = req.body;
        const statuses = await TursoService.checkStatus(notionIds, type);
        res.json({ statuses });
    } catch (err) { next(err); }
});

export default router;
