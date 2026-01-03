import { createClient } from '@libsql/client';
import { config } from '../config';

export const turso = createClient({
    url: config.turso.url || '',
    authToken: config.turso.authToken,
});

export class TursoService {
    static async checkStatus(notionIds: string[], type: 'designer' | 'moodboard') {
        if (notionIds.length === 0) return { statuses: {} };

        const table = type === 'designer' ? 'studios' : 'products';
        const placeholders = notionIds.map(() => '?').join(',');

        try {
            const result = await turso.execute({
                sql: `SELECT notion_id, updated_at FROM ${table} WHERE notion_id IN (${placeholders})`,
                args: notionIds
            });

            const statusMap: Record<string, any> = {};
            // Initialize all as not migrated
            notionIds.forEach(id => statusMap[id] = { migrated: false, migratedAt: null });

            // Update found ones
            result.rows.forEach(row => {
                const nid = row['notion_id'] as string;
                statusMap[nid] = {
                    migrated: true,
                    migratedAt: row['updated_at']
                };
            });

            return { statuses: statusMap };
        } catch (error) {
            console.error('Error checking Turso status:', error);
            // Return empty statuses (non-blocking) or throw?
            // For UI, better to return map with error?
            return { statuses: {} };
        }
    }
}
