/**
 * Build-time data-access helpers for games and their related summaries.
 */
import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** Optional category and publisher constraints for a game listing. */
export interface GameFilters {
    categoryIds?: readonly number[];
    publisherId?: number;
}

/**
 * Retrieves games ordered by title, matching any selected category and the publisher.
 *
 * @param db - The database connection to query.
 * @param filters - Optional constraints; empty categories mean all categories.
 * @returns Matching games with their category and publisher summaries.
 */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const rows = await baseGamesQuery(db)
        .where(and(
            filters.categoryIds?.length ? inArray(games.categoryId, filters.categoryIds) : undefined,
            filters.publisherId !== undefined ? eq(games.publisherId, filters.publisherId) : undefined,
        ))
        .orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Retrieves all game ids ordered by title.
 *
 * @param db - The database connection to query.
 * @returns Game ids for generating static detail routes.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Retrieves a single game with its related summaries.
 *
 * @param db - The database connection to query.
 * @param id - The game id to look up.
 * @returns The game, or null when it does not exist.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
