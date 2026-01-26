import { db } from '../db';
import { toast } from 'sonner';

export interface BackupData {
    version: string;
    timestamp: number;
    createdAt: string;
    appName: string;
    data: {
        clients: any[];
        orders: any[];
        inventory: any[];
        settings: any[];
        users: any[];
        expenses: any[];
    };
    stats: {
        totalClients: number;
        totalOrders: number;
        totalInventory: number;
        totalExpenses: number;
    };
}

const BACKUP_VERSION = '2.0';
const APP_NAME = 'ShoroRepair';

/**
 * Creates a complete backup of the database
 */
export async function createBackup(): Promise<BackupData> {
    const clients = await db.clients.toArray();
    const orders = await db.orders.toArray();
    const inventory = await db.inventory.toArray();
    const settings = await db.settings.toArray();
    const users = await db.users.toArray();
    const expenses = await db.expenses.toArray();

    const backup: BackupData = {
        version: BACKUP_VERSION,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        appName: APP_NAME,
        data: {
            clients,
            orders,
            inventory,
            settings,
            users,
            expenses
        },
        stats: {
            totalClients: clients.length,
            totalOrders: orders.length,
            totalInventory: inventory.length,
            totalExpenses: expenses.length
        }
    };

    return backup;
}

/**
 * Validates backup file structure
 */
export function validateBackup(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data) {
        errors.push('El archivo está vacío o corrupto');
        return { valid: false, errors };
    }

    // Check for version (v2) or legacy format
    const isLegacyFormat = !data.version && (data.clients || data.orders);

    if (!isLegacyFormat) {
        if (data.appName && data.appName !== APP_NAME) {
            errors.push(`Este respaldo es de otra aplicación: ${data.appName}`);
        }

        if (!data.data) {
            errors.push('El archivo no contiene datos válidos');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Restores database from backup with transaction safety
 */
export async function restoreBackup(
    backupData: any,
    options: {
        mergeMode?: boolean;
        skipUsers?: boolean;
    } = {}
): Promise<{ success: boolean; restored: Record<string, number> }> {
    const { mergeMode = false, skipUsers = false } = options;

    // Handle both v2 and legacy formats
    const data = backupData.data || backupData;

    const restored: Record<string, number> = {
        clients: 0,
        orders: 0,
        inventory: 0,
        settings: 0,
        users: 0,
        expenses: 0
    };

    try {
        await db.transaction('rw', [db.clients, db.orders, db.inventory, db.settings, db.users, db.expenses], async () => {
            // Clients
            if (data.clients?.length > 0) {
                if (!mergeMode) await db.clients.clear();
                await db.clients.bulkPut(data.clients);
                restored.clients = data.clients.length;
            }

            // Orders
            if (data.orders?.length > 0) {
                if (!mergeMode) await db.orders.clear();
                await db.orders.bulkPut(data.orders);
                restored.orders = data.orders.length;
            }

            // Inventory
            if (data.inventory?.length > 0) {
                if (!mergeMode) await db.inventory.clear();
                await db.inventory.bulkPut(data.inventory);
                restored.inventory = data.inventory.length;
            }

            // Settings
            if (data.settings?.length > 0) {
                await db.settings.clear();
                await db.settings.bulkPut(data.settings);
                restored.settings = data.settings.length;
            }

            // Users (optional)
            if (!skipUsers && data.users?.length > 0) {
                await db.users.clear();
                await db.users.bulkPut(data.users);
                restored.users = data.users.length;
            }

            // Expenses
            if (data.expenses?.length > 0) {
                if (!mergeMode) await db.expenses.clear();
                await db.expenses.bulkPut(data.expenses);
                restored.expenses = data.expenses.length;
            }
        });

        return { success: true, restored };
    } catch (error) {
        console.error('Error restoring backup:', error);
        throw error;
    }
}

/**
 * Downloads backup as JSON file
 */
export async function downloadBackup(): Promise<void> {
    try {
        const backup = await createBackup();
        const json = JSON.stringify(backup, null, 2);
        const date = new Date().toISOString().split('T')[0];
        const filename = `${APP_NAME}_Backup_${date}.json`;

        // Check for Tauri environment
        if ((window as any).__TAURI__) {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { writeTextFile } = await import('@tauri-apps/plugin-fs');

            const filePath = await save({
                defaultPath: filename,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });

            if (filePath) {
                await writeTextFile(filePath, json);
                toast.success('Respaldo guardado correctamente', {
                    description: `${backup.stats.totalClients} clientes, ${backup.stats.totalOrders} órdenes, ${backup.stats.totalInventory} productos`
                });
            }
            return;
        }

        // Browser fallback
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Respaldo descargado', {
            description: `${backup.stats.totalClients} clientes, ${backup.stats.totalOrders} órdenes, ${backup.stats.totalInventory} productos`
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        toast.error('Error al crear respaldo');
        throw error;
    }
}

/**
 * Reads and parses backup file
 */
export function readBackupFile(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                resolve(data);
            } catch (error) {
                reject(new Error('El archivo no es un JSON válido'));
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsText(file);
    });
}

/**
 * Format backup date for display
 */
export function formatBackupDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('es', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get estimated backup size
 */
export async function getEstimatedBackupSize(): Promise<string> {
    const backup = await createBackup();
    const bytes = new Blob([JSON.stringify(backup)]).size;

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
/**
 * Creates and uploads a backup to Firebase Storage
 */
export async function uploadBackupToCloud(): Promise<string> {
    try {
        const { uploadFile } = await import('../src/utils/storageUtils');
        const backup = await createBackup();
        const json = JSON.stringify(backup);
        const blob = new Blob([json], { type: 'application/json' });

        const timestamp = Date.now();
        const path = `backups/backup_${timestamp}.json`;

        const url = await uploadFile(blob, path);

        // Also update a "latest" pointer if desired, or just return URL
        toast.success('Respaldo en la nube completado');
        return url;
    } catch (error) {
        console.error('Error uploading backup to cloud:', error);
        toast.error('Error al subir respaldo a la nube');
        throw error;
    }
}
/**
 * Lists all backups available in the cloud
 */
export async function listCloudBackups() {
    try {
        const { listFiles, getDownloadURL } = await import('../src/utils/storageUtils');
        const items = await listFiles('backups');

        const backups = await Promise.all(items.map(async (item) => {
            const url = await getDownloadURL(item);
            const name = item.name;
            // Parse timestamp from name backup_TIMESTAMP.json
            const timestamp = parseInt(name.replace('backup_', '').replace('.json', ''));
            return { name, url, timestamp };
        }));

        return backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.error('Error listing cloud backups:', error);
        return [];
    }
}

/**
 * Downloads a backup from cloud URL
 */
export async function getBackupFromCloudUrl(url: string): Promise<BackupData> {
    const { getFileByUrl } = await import('../src/utils/storageUtils');
    return await getFileByUrl(url);
}

/**
 * Deletes a backup from the cloud
 */
export async function deleteCloudBackup(url: string) {
    const { deleteImage } = await import('../src/utils/storageUtils');
    await deleteImage(url);
    toast.success('Respaldo eliminado de la nube');
}

/**
 * Uploads a backup to Google Drive
 */
export async function uploadBackupToGoogleDrive(accessToken: string): Promise<boolean> {
    try {
        const backup = await createBackup();
        const json = JSON.stringify(backup);
        const blob = new Blob([json], { type: 'application/json' });

        const timestamp = Date.now();
        const filename = `${APP_NAME}_Backup_${new Date().toISOString().split('T')[0]}_${timestamp}.json`;

        // 1. Metadata for the file
        const metadata = {
            name: filename,
            mimeType: 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            body: form
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Error en Google Drive');
        }

        toast.success('Respaldo guardado en Google Drive');
        return true;
    } catch (error: any) {
        console.error('Error uploading to Google Drive:', error);
        toast.error(`Google Drive error: ${error.message}`);
        return false;
    }
}
