import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { publishers } from '../../db/schema';
import type { Database } from './db';
import { getAllPublishers } from './publishers';

describe('publishers data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns every publisher with only id and name ordered by name', async () => {
        const inserted = await db
            .insert(publishers)
            .values([
                { name: 'Zebra Games', description: 'Publisher description' },
                { name: 'Alpha Games' },
            ])
            .returning({ id: publishers.id, name: publishers.name });

        const all = await getAllPublishers(db);

        expect(all).toHaveLength(2);
        expect(all).toEqual([inserted[1], inserted[0]]);
    });

    it('returns an empty list when there are no publishers', async () => {
        expect(await getAllPublishers(db)).toEqual([]);
    });
});
