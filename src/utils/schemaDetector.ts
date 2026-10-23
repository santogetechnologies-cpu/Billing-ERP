import { supabase } from '../lib/supabase';
import { getAppStorage } from './storageUtils';

let cachedProfileColumns: Set<string> | null = null;
let profileColumnsPromise: Promise<Set<string>> | null = null;

// Baseline columns guaranteed by initial schema (003_users_roles.sql)
const BASELINE_PROFILE_COLUMNS = new Set([
  'id',
  'company_id',
  'branch_id',
  'role_id',
  'role',
  'full_name',
  'email',
  'phone',
  'avatar_url',
  'status',
  'last_login',
  'created_at',
  'updated_at'
]);

/**
 * Inspects public.profiles schema once and returns the exact set of supported columns.
 * Prevents PostgREST 400 (PGRST204) Bad Request errors caused by sending columns
 * that do not exist yet in the database.
 */
export async function getAvailableProfileColumns(): Promise<Set<string>> {
  if (cachedProfileColumns) {
    return cachedProfileColumns;
  }

  if (profileColumnsPromise) {
    return profileColumnsPromise;
  }

  profileColumnsPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

      if (!error && data && data.length > 0 && typeof data[0] === 'object') {
        cachedProfileColumns = new Set(Object.keys(data[0]));
        return cachedProfileColumns;
      }
    } catch (err) {
      console.warn('Unable to probe profiles schema, falling back to baseline:', err);
    }

    cachedProfileColumns = new Set(BASELINE_PROFILE_COLUMNS);
    return cachedProfileColumns;
  })();

  try {
    return await profileColumnsPromise;
  } finally {
    profileColumnsPromise = null;
  }
}

/**
 * Filter an update payload to only include columns supported by the current database schema.
 */
export async function filterSupportedProfilePayload(
  rawPayload: Record<string, any>
): Promise<Record<string, any>> {
  const supportedCols = await getAvailableProfileColumns();
  const safePayload: Record<string, any> = {};

  for (const [key, value] of Object.entries(rawPayload)) {
    if (supportedCols.has(key) && value !== undefined) {
      safePayload[key] = value;
    }
  }

  return safePayload;
}

/**
 * Check if a specific column is supported by the profiles table.
 */
export async function hasProfileColumn(columnName: string): Promise<boolean> {
  const supportedCols = await getAvailableProfileColumns();
  return supportedCols.has(columnName);
}

/**
 * Clear column cache to force re-detection (e.g. after database migration is applied).
 */
export function clearProfileSchemaCache(): void {
  cachedProfileColumns = null;
  profileColumnsPromise = null;
}

// ---------------------------------------------------------------------------
// TABLE SCHEMA CACHE & 404 SUPPRESSION
// ---------------------------------------------------------------------------
const STORAGE_KEY_MISSING_TABLES = 'universal_billing_missing_tables';

// Tables identified as not yet migrated into the remote Supabase PostgREST schema cache:
const KNOWN_UNMIGRATED_TABLES = [
  'warehouse_managers',
  'purchase_requests',
  'purchase_request_items',
  'purchase_request_history',
  'purchase_orders',
  'user_sessions',
  'barcode_audit_logs'
];

function getPersistedMissingTables(): Set<string> {
  const set = new Set<string>(KNOWN_UNMIGRATED_TABLES);
  try {
    const storage = getAppStorage();
    const raw = storage.getItem(STORAGE_KEY_MISSING_TABLES);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((t: string) => set.add(t));
      }
    } else {
      // Seed initial unmigrated tables so zero 404 network errors are logged
      try {
        storage.setItem(STORAGE_KEY_MISSING_TABLES, JSON.stringify(Array.from(set)));
      } catch {}
    }
  } catch {
    KNOWN_UNMIGRATED_TABLES.forEach(t => set.add(t));
  }
  return set;
}

function persistMissingTables(set: Set<string>): void {
  try {
    const storage = getAppStorage();
    storage.setItem(STORAGE_KEY_MISSING_TABLES, JSON.stringify(Array.from(set)));
  } catch {}
}

const missingTablesCache = getPersistedMissingTables();
const availableTablesCache = new Set<string>();

/**
 * Checks whether an error is a PostgREST 404 / PGRST205 schema cache missing table error.
 */
export function isTableNotFoundError(error: any): boolean {
  if (!error) return false;
  const status = error.status || (error as any)?.statusCode;
  const code = error.code || '';
  const message = error.message || '';
  return (
    status === 404 ||
    code === 'PGRST205' ||
    code === '404' ||
    message.includes('in the schema cache') ||
    message.includes('Not Found') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

/**
 * Marks a table as confirmed missing in the remote Supabase database.
 * Once marked, frontend services will skip firing failing network calls to PostgREST
 * and cleanly use local cache fallbacks, eliminating browser console 404 logs.
 */
export function markTableMissing(tableName: string): void {
  missingTablesCache.add(tableName);
  availableTablesCache.delete(tableName);
  persistMissingTables(missingTablesCache);
}

/**
 * Marks a table as available in the remote Supabase database.
 */
export function markTableAvailable(tableName: string): void {
  availableTablesCache.add(tableName);
  missingTablesCache.delete(tableName);
  persistMissingTables(missingTablesCache);
}

/**
 * Returns whether a table is known to be missing from the remote database schema cache.
 */
export function isTableMarkedMissing(tableName: string): boolean {
  if (availableTablesCache.has(tableName)) return false;
  if (missingTablesCache.has(tableName)) return true;
  const persisted = getPersistedMissingTables();
  if (persisted.has(tableName)) {
    missingTablesCache.add(tableName);
    return true;
  }
  return false;
}

/**
 * Clear missing table cache to retry probing (e.g. after SQL migrations run).
 */
export function clearTableSchemaCache(): void {
  missingTablesCache.clear();
  availableTablesCache.clear();
  try {
    const storage = getAppStorage();
    storage.removeItem(STORAGE_KEY_MISSING_TABLES);
  } catch {}
}

/**
 * Verifies if remote tables are available in Supabase and updates cache accordingly.
 */
export async function verifyAndSyncTableSchema(tableName?: string): Promise<boolean> {
  const tablesToTest = tableName ? [tableName] : KNOWN_UNMIGRATED_TABLES;
  let allAvailable = true;
  for (const t of tablesToTest) {
    try {
      const { error } = await supabase.from(t).select('*').limit(1);
      if (error && isTableNotFoundError(error)) {
        markTableMissing(t);
        allAvailable = false;
      } else {
        markTableAvailable(t);
      }
    } catch {
      markTableMissing(t);
      allAvailable = false;
    }
  }
  return allAvailable;
}

// Expose verification helpers on window for browser console access
if (typeof window !== 'undefined') {
  (window as any).verifyUniversalBillingSchema = verifyAndSyncTableSchema;
  (window as any).clearTableSchemaCache = clearTableSchemaCache;
}

