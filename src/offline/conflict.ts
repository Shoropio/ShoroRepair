import { db } from './db';
import { toast } from 'sonner';

/**
 * Utility to detect and remove duplicate records based on syncId
 * This ensures data integrity across local and cloud sync
 */

export interface DuplicateReport {
    tableName: string;
    totalRecords: number;
    duplicates: number;
    cleaned: number;
}

/**
 * Scans a table for duplicate syncIds and keeps only the most recent version
 */
async function cleanTableDuplicates(tableName: string): Promise<DuplicateReport> {
    const table = (db as any)[tableName];
    const allRecords = await table.toArray();

    const syncIdMap = new Map<string, any[]>();
    let duplicatesFound = 0;
    let recordsCleaned = 0;

    // Group records by syncId
    for (const record of allRecords) {
        if (!record.syncId) {
            console.warn(`Record without syncId in ${tableName}:`, record.id);
            continue;
        }

        if (!syncIdMap.has(record.syncId)) {
            syncIdMap.set(record.syncId, []);
        }
        syncIdMap.get(record.syncId)!.push(record);
    }

    // Find and resolve duplicates
    for (const [syncId, records] of syncIdMap.entries()) {
        if (records.length > 1) {
            duplicatesFound += records.length - 1;
            console.log(`Found ${records.length} duplicates for syncId: ${syncId}`);

            // Sort by updatedAt (most recent first)
            records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

            // Keep the first (most recent), delete the rest
            const toKeep = records[0];
            const toDelete = records.slice(1);

            for (const duplicate of toDelete) {
                await table.delete(duplicate.id);
                recordsCleaned++;
                console.log(`Deleted duplicate id: ${duplicate.id}`);
            }
        }
    }

    return {
        tableName,
        totalRecords: allRecords.length,
        duplicates: duplicatesFound,
        cleaned: recordsCleaned
    };
}

/**
 * Scans all tables and removes duplicates
 */
export async function cleanAllDuplicates(): Promise<DuplicateReport[]> {
    const tables = ['clients', 'orders', 'inventory', 'users', 'settings', 'expenses'];
    const reports: DuplicateReport[] = [];

    console.log('Starting duplicate cleanup...');

    for (const tableName of tables) {
        try {
            const report = await cleanTableDuplicates(tableName);
            reports.push(report);

            if (report.cleaned > 0) {
                console.log(`${tableName}: Cleaned ${report.cleaned} duplicates`);
            }
        } catch (error) {
            console.error(`Error cleaning ${tableName}:`, error);
        }
    }

    const totalCleaned = reports.reduce((sum, r) => sum + r.cleaned, 0);

    if (totalCleaned > 0) {
        toast.success(`Limpieza completada: ${totalCleaned} duplicados eliminados`);
    } else {
        toast.info('No se encontraron duplicados');
    }

    return reports;
}

/**
 * Validates that all records have unique syncIds
 */
export async function validateDataIntegrity(): Promise<boolean> {
    const tables = ['clients', 'orders', 'inventory', 'users', 'settings', 'expenses'];
    let allValid = true;

    for (const tableName of tables) {
        const table = (db as any)[tableName];
        const records = await table.toArray();

        // Check for missing syncIds
        const missingSync = records.filter((r: any) => !r.syncId);
        if (missingSync.length > 0) {
            console.error(`${tableName}: ${missingSync.length} records missing syncId`);
            allValid = false;
        }

        // Check for duplicate syncIds
        const syncIds = records.map((r: any) => r.syncId).filter(Boolean);
        const uniqueSyncIds = new Set(syncIds);
        if (syncIds.length !== uniqueSyncIds.size) {
            console.error(`${tableName}: Duplicate syncIds detected`);
            allValid = false;
        }
    }

    if (allValid) {
        console.log('Data integrity check passed');
    }

    return allValid;
}

/**
 * Generates a summary report of the database
 */
export async function generateIntegrityReport() {
    const tables = ['clients', 'orders', 'inventory', 'users', 'settings', 'expenses'];
    const report: any = {
        timestamp: new Date().toISOString(),
        tables: {}
    };

    for (const tableName of tables) {
        const table = (db as any)[tableName];
        const records = await table.toArray();

        const syncIds = records.map((r: any) => r.syncId).filter(Boolean);
        const uniqueSyncIds = new Set(syncIds);

        report.tables[tableName] = {
            totalRecords: records.length,
            withSyncId: syncIds.length,
            withoutSyncId: records.length - syncIds.length,
            uniqueSyncIds: uniqueSyncIds.size,
            hasDuplicates: syncIds.length !== uniqueSyncIds.size
        };
    }

    console.table(report.tables);
    return report;
}
