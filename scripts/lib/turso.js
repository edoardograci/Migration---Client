import { createClient } from '@libsql/client';

export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Helper: Get all studios for a city
export async function getStudiosByCity(city = 'Milan') {
  const result = await turso.execute({
    sql: 'SELECT * FROM studios WHERE city = ? AND status = ? ORDER BY name',
    args: [city, 'Published']
  });
  return result.rows;
}

// Helper: Get single studio by slug
export async function getStudioBySlug(slug) {
  const result = await turso.execute({
    sql: 'SELECT * FROM studios WHERE slug = ? AND status = ?',
    args: [slug, 'Published']
  });
  return result.rows[0] || null;
}

// Helper: Get all moodboard items
export async function getMoodboardItems() {
  const result = await turso.execute({
    sql: 'SELECT * FROM moodboard WHERE status = ? ORDER BY created_at DESC',
    args: ['Published']
  });
  return result.rows;
}

// Helper: Search moodboard by keywords
export async function searchMoodboard(query) {
  const result = await turso.execute({
    sql: `
      SELECT m.* FROM moodboard m
      JOIN moodboard_search s ON m.notion_id = s.notion_id
      WHERE moodboard_search MATCH ?
      ORDER BY rank
    `,
    args: [query]
  });
  return result.rows;
}

// Helper: Get all cities
export async function getCities() {
  const result = await turso.execute({
    sql: 'SELECT DISTINCT city FROM studios WHERE status = ? ORDER BY city',
    args: ['Published']
  });
  return result.rows.map(r => r.city);
}