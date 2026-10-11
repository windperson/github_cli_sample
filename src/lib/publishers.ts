/**
 * Data-access helpers for retrieving publisher records.
 */
import { asc } from 'drizzle-orm';
import type { Database } from './db';
import { publishers } from '../../db/schema';
import type { Publisher } from '../types/game';

/**
 * Retrieves all publishers ordered by name.
 *
 * @param db - The database connection to query.
 * @returns Publishers containing their ids and names.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return await db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}
