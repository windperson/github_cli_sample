/**
 * Tests the category filter options against an in-memory SQLite database.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories } from '../../db/schema';
import type { Database } from './db';
import { getAllCategories } from './categories';

describe('categories data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns only ids and names in alphabetical order, including categories without games', async () => {
        const inserted = await db.insert(categories).values([
            { name: 'Strategy', description: 'Category description' },
            { name: 'Adventure' },
        ]).returning({ id: categories.id, name: categories.name });

        const all = await getAllCategories(db);
        expect(all).toHaveLength(2);
        expect(all).toEqual([inserted[1], inserted[0]]);
    });

    it('returns an empty list when there are no categories', async () => {
        expect(await getAllCategories(db)).toEqual([]);
    });
});
