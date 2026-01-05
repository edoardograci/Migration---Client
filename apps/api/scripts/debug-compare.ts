import { NotionService } from '../src/services/NotionService';
import { TursoService } from '../src/services/TursoService';
import { generateContentHash } from '../src/lib/utils';
import { config } from '../src/config';

// Mock config if needed or ensure .env is loaded
import * as dotenv from 'dotenv';
dotenv.config();

async function testCompareStatus() {
    try {
        console.log('Fetching designers from Notion...');
        const designers = await NotionService.getDesigners(true);
        console.log(`Fetched ${designers.length} designers.`);

        if (designers.length > 0) {
            console.log('Generating hash for first designer...');
            const hash = generateContentHash(designers[0]);
            console.log('Hash:', hash);

            console.log('Checking status in Turso...');
            const notionIds = designers.map((d: any) => d.notionId);
            const tursoStatus = await TursoService.checkStatus(notionIds, 'designer');
            console.log('Turso status keys:', Object.keys(tursoStatus.statuses).length);

            console.log('Comparing...');
            const comparison = designers.map((item: any) => {
                const currentHash = generateContentHash(item);
                const storedHash = tursoStatus.statuses[item.notionId]?.contentHash;
                const inTurso = tursoStatus.statuses[item.notionId]?.migrated || false;

                return {
                    ...item,
                    inTurso,
                    lastMigrated: tursoStatus.statuses[item.notionId]?.migratedAt || null,
                    needsUpdate: inTurso && currentHash !== storedHash,
                };
            });
            console.log('Comparison successful. First item:', comparison[0]);
        }

    } catch (error) {
        console.error('ERROR:', error);
    }
}

testCompareStatus();
