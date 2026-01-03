import { Client } from '@notionhq/client';
import { config } from '../config';
const notion = new Client({ auth: config.notion.apiKey });

export class NotionService {
    static async getDesigners() {
        let allResults: any[] = [];
        let cursor = undefined;

        try {
            do {
                const response = await (notion.databases as any).query({
                    database_id: config.notion.designersDbId as string,
                    start_cursor: cursor,
                    page_size: 100,
                    filter: {
                        property: 'Status',
                        status: { equals: 'Published' }
                    }
                });
                allResults = [...allResults, ...response.results];
                cursor = response.next_cursor as any;
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
                published: true
            }));
        } catch (error) {
            console.error("Error fetching available designers from Notion", error);
            throw error;
        }
    }

    static async getMoodboard() {
        let allResults: any[] = [];
        let cursor = undefined;

        try {
            do {
                const response = await (notion.databases as any).query({
                    database_id: config.notion.moodboardDbId as string,
                    start_cursor: cursor,
                    page_size: 100,
                    filter: {
                        property: 'Status',
                        select: { equals: 'Published' }
                    }
                });
                allResults = [...allResults, ...response.results];
                cursor = response.next_cursor as any;
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
