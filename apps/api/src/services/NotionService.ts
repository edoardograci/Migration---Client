import { Client } from '@notionhq/client';
import { config } from '../config';
import { Designer, MoodboardProduct } from '@repo/shared-types';

const notion = new Client({ auth: config.notion.apiKey });

export class NotionService {
    /**
     * Fetch designers from Notion
     * @param includeUnpublished - If true, fetches all designers regardless of status
     */
    static async getDesigners(includeUnpublished = false): Promise<Designer[]> {
        let allResults: any[] = [];
        let cursor: string | undefined = undefined;

        try {
            do {
                const queryParams: any = {
                    database_id: config.notion.designersDbId as string,
                    start_cursor: cursor,
                    page_size: 100,
                };

                // Only add filter if we want published only
                if (!includeUnpublished) {
                    queryParams.filter = {
                        property: 'Status',
                        status: { equals: 'Published' }
                    };
                }

                const response = await notion.databases.query(queryParams);
                allResults = [...allResults, ...response.results];
                cursor = response.next_cursor ?? undefined;
            } while (cursor);

            return allResults.map((page: any) => ({
                id: page.id,
                notionId: page.id,
                name: page.properties['Name']?.title?.[0]?.plain_text || 'Untitled',
                city: page.properties['City']?.select?.name,
                coverUrl: page.properties['Cover']?.files?.[0]?.file?.url || page.properties['Cover']?.files?.[0]?.external?.url,
                website: page.properties['Website URL']?.url,
                instagram: page.properties['IG']?.url,
                email: page.properties['Email']?.email,
                notionStatus: page.properties['Status']?.status?.name || 'Draft',
                published: page.properties['Status']?.status?.name === 'Published'
            }));
        } catch (error) {
            console.error("Error fetching designers from Notion", error);
            throw error;
        }
    }

    /**
     * Fetch moodboard products from Notion
     * @param includeUnpublished - If true, fetches all products regardless of status
     */
    static async getMoodboard(includeUnpublished = false): Promise<MoodboardProduct[]> {
        let allResults: any[] = [];
        let cursor: string | undefined = undefined;

        try {
            do {
                const queryParams: any = {
                    database_id: config.notion.moodboardDbId as string,
                    start_cursor: cursor,
                    page_size: 100,
                };

                if (!includeUnpublished) {
                    queryParams.filter = {
                        property: 'Status',
                        select: { equals: 'Published' }
                    };
                }

                const response = await notion.databases.query(queryParams);
                allResults = [...allResults, ...response.results];
                cursor = response.next_cursor ?? undefined;
            } while (cursor);

            return allResults.map((page: any) => {
                const props = page.properties;
                const images = props['Image']?.files || props['Cover']?.files || [];

                return {
                    id: page.id,
                    notionId: page.id,
                    name: props['Name']?.title?.[0]?.plain_text || 'Untitled',
                    designer: props['Designer']?.select?.name,
                    year: props['Year']?.select?.name,
                    city: props['City']?.select?.name || props['City']?.rich_text?.[0]?.plain_text,
                    link: props['Link']?.url,
                    notionStatus: props['Status']?.select?.name || 'Draft',
                    published: props['Status']?.select?.name === 'Published',
                    images: images.map((img: any, index: number) => ({
                        url: img.file?.url || img.external?.url,
                        position: index
                    }))
                };
            });
        } catch (error) {
            console.error("Error fetching moodboard from Notion", error);
            throw error;
        }
    }
}
