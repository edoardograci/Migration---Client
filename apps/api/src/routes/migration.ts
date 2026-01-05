import { Router } from 'express';
import { MigrationService } from '../services/MigrationService';

const router = Router();

router.post('/dry-run', async (req, res, next) => {
    try {
        const result = await MigrationService.dryRun(req.body);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/execute', async (req, res, next) => {
    try {
        const result = await MigrationService.execute(req.body);
        res.json(result);
    } catch (err) { next(err); }
});

router.get('/status/:jobId', async (req, res, next) => {
    try {
        const result = await MigrationService.getStatus(req.params.jobId);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/cancel/:jobId', async (req, res, next) => {
    try {
        const result = await MigrationService.cancel(req.params.jobId);
        res.json(result);
    } catch (err) { next(err); }
});

export default router;
