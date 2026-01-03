export interface Designer {
    id: string;
    notionId: string;
    name: string;
    city: string;
    coverUrl: string;
    website: string;
    instagram: string;
    email: string;
    published: boolean;
    status?: {
        migrated: boolean;
        migratedAt: string | null;
        error: string | null;
    };
}

export interface MoodboardProduct {
    id: string;
    notionId: string;
    name: string;
    designer: string;
    year: string;
    city: string;
    link: string;
    images: Array<{
        url: string;
        position: number;
    }>;
    enrichment?: any;
    status?: {
        migrated: boolean;
        migratedAt: string | null;
        error: string | null;
    };
}
