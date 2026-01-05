import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';

import notionRoutes from './routes/notion';
import tursoRoutes from './routes/turso';
import imageRoutes from './routes/image';
import enrichmentRoutes from './routes/enrichment';
import migrationRoutes from './routes/migration';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req: any, res: any) => res.json({ status: 'ok' }));

app.use('/api/notion', notionRoutes);
app.use('/api/turso', tursoRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/enrichment', enrichmentRoutes);
app.use('/api/migration', migrationRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
});
