/**
 * Data-access helpers for retrieving category records.
 */
import { asc } from 'drizzle-orm';
import type { Database } from './db';
import { categories } from '../../db/schema';
import type { Category } from '../types/game';

/**
 * Retrieves all categories ordered by name, including those without games.
 *
 * @param db - The database connection to query.
 * @returns Categories containing their ids and names.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));
}
