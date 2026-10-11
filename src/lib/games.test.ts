/**
 * Tests game queries against a migrated in-memory SQLite database.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    type GameFilters,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('game filtering', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
        await db.insert(categories).values([
            { id: 1, name: 'Strategy' },
            { id: 2, name: 'Puzzle' },
            { id: 3, name: 'Adventure' },
        ]);
        await db.insert(publishers).values([
            { id: 1, name: 'Alpha Games' },
            { id: 2, name: 'Beta Games' },
        ]);
        await db.insert(games).values([
            { id: 3, title: 'Zulu', description: 'Z', categoryId: 2, publisherId: 1 },
            { id: 2, title: 'Bravo', description: 'B', categoryId: 1, publisherId: 2 },
            { id: 1, title: 'Alpha', description: 'A', categoryId: 1, publisherId: 1 },
        ]);
    });

    const cases: { name: string; filters: GameFilters; ids: number[] }[] = [
        { name: 'no constraints', filters: {}, ids: [1, 2, 3] },
        { name: 'empty categories', filters: { categoryIds: [] }, ids: [1, 2, 3] },
        { name: 'one category', filters: { categoryIds: [1] }, ids: [1, 2] },
        { name: 'multiple categories with OR', filters: { categoryIds: [1, 2] }, ids: [1, 2, 3] },
        { name: 'publisher only', filters: { publisherId: 1 }, ids: [1, 3] },
        { name: 'combined constraints with AND', filters: { categoryIds: [1, 2], publisherId: 2 }, ids: [2] },
        { name: 'empty categories with publisher', filters: { categoryIds: [], publisherId: 2 }, ids: [2] },
        { name: 'unknown category', filters: { categoryIds: [999] }, ids: [] },
        { name: 'unknown publisher', filters: { publisherId: 999 }, ids: [] },
        { name: 'zero publisher is not absent', filters: { publisherId: 0 }, ids: [] },
        { name: 'known and unknown categories', filters: { categoryIds: [999, 2] }, ids: [3] },
        { name: 'duplicate categories', filters: { categoryIds: [1, 1] }, ids: [1, 2] },
        { name: 'unmatched combination', filters: { categoryIds: [2], publisherId: 2 }, ids: [] },
        { name: 'category without games', filters: { categoryIds: [3] }, ids: [] },
    ];

    it.each(cases)('returns ordered matches for $name', async ({ filters, ids }) => {
        const result = await getAllGames(db, filters);
        expect(result).toHaveLength(ids.length);
        expect(result.map((game) => game.id)).toEqual(ids);
        expect(result.map((game) => game.title)).toEqual(ids.map((id) => ['Alpha', 'Bravo', 'Zulu'][id - 1]));
    });

    it('preserves related summaries when filtering', async () => {
        const result = await getAllGames(db, { categoryIds: [1], publisherId: 1 });
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: 1, title: 'Alpha', description: 'A', starRating: null,
            category: { id: 1, name: 'Strategy' },
            publisher: { id: 1, name: 'Alpha Games' },
        });
    });

    it('returns an empty list from an empty database with or without filters', async () => {
        const emptyDb = await createTestDatabase();
        expect(await getAllGames(emptyDb)).toEqual([]);
        expect(await getAllGames(emptyDb, { categoryIds: [1], publisherId: 1 })).toEqual([]);
    });
});

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
