import { Router } from 'express';
import { NotionService } from '../services/NotionService';
import { TursoService } from '../services/TursoService';
import { generateContentHash } from '../lib/utils';

const router = Router();

router.get('/designers', async (req, res, next) => {
    try {
        const includeAll = req.query.all === 'true';
        const designers = await NotionService.getDesigners(includeAll);
        res.json({ designers });
    } catch (err) { next(err); }
});

router.get('/moodboard', async (req, res, next) => {
    try {
        const includeAll = req.query.all === 'true';
        const products = await NotionService.getMoodboard(includeAll);
        res.json({ products });
    } catch (err) { next(err); }
});

/**
 * Compare Notion items with Turso to determine migration status
 */
router.post('/compare-status', async (req, res, next) => {
    try {
        const { type } = req.body; // 'designers' or 'moodboard'

        if (!type || !['designers', 'moodboard'].includes(type)) {
            return res.status(400).json({
                error: 'Invalid type. Must be "designers" or "moodboard"'
            });
        }

        // Get ALL items from Notion (including unpublished)
        console.log(`Fetching ${type} from Notion...`);
        const notionItems = type === 'designers'
            ? await NotionService.getDesigners(true)
            : await NotionService.getMoodboard(true);
        console.log(`Fetched ${notionItems.length} items from Notion`);

        // Get migrated items from Turso
        const notionIds = notionItems.map(item => item.notionId);
        console.log(`Checking status for ${notionIds.length} items in Turso...`);
        const tursoStatus = await TursoService.checkStatus(
            notionIds,
            type === 'designers' ? 'designer' : 'moodboard'
        );
        console.log(`Got Turso status for ${Object.keys(tursoStatus.statuses).length} items`);

        // Combine data
        console.log('Calculating comparison...');
        const comparison = notionItems.map(item => {
            try {
                const currentHash = generateContentHash(item);
                const storedHash = tursoStatus.statuses[item.notionId]?.contentHash;
                const inTurso = tursoStatus.statuses[item.notionId]?.migrated || false;

                return {
                    ...item,
                    inTurso,
                    lastMigrated: tursoStatus.statuses[item.notionId]?.migratedAt || null,
                    needsUpdate: inTurso && currentHash !== storedHash,
                };
            } catch (err: any) {
                console.error(`Error processing item ${item.id}:`, err);
                throw err;
            }
        });
        console.log('Comparison calculated successfully');

        res.json({
            total: comparison.length,
            published: comparison.filter(i => i.published).length,
            migrated: comparison.filter(i => i.inTurso).length,
            pending: comparison.filter(i => !i.inTurso).length,
            items: comparison
        });
    } catch (err: any) {
        console.error('Error in /compare-status:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

export default router;
