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
    notionStatus?: 'Published' | 'Draft' | 'Archived' | string;
    status?: {
        migrated: boolean;
        migratedAt: string | null;
        error: string | null;
        needsUpdate?: boolean;
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
    published?: boolean;
    notionStatus?: 'Published' | 'Draft' | 'Archived' | string;
    images: Array<{
        url: string;
        position: number;
    }>;
    enrichment?: any;
    status?: {
        migrated: boolean;
        migratedAt: string | null;
        error: string | null;
        needsUpdate?: boolean;
    };
}

export interface MigrationStats {
    total: number;
    published: number;
    migrated: number;
    pending: number;
    items: (Designer | MoodboardProduct)[];
}
