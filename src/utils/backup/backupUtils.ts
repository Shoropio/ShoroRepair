import { db } from '../../offline/db';
import { toast } from 'sonner';
import { Client, ServiceOrder, Part, CompanySettings, AppUser, Expense } from '../../types';

export interface BackupData {
    version: string;
    timestamp: number;
    createdAt: string;
    appName: string;
    data: {
        clients: Client[];
        orders: ServiceOrder[];
        inventory: Part[];
        settings: CompanySettings[];
        users: AppUser[];
        expenses: Expense[];
    };
    stats: {
        totalClients: number;
        totalOrders: number;
        totalInventory: number;
        totalExpenses: number;
    };
}

type BackupRestoreInput = {
    data?: BackupData['data'];
    clients?: Client[];
    orders?: ServiceOrder[];
    inventory?: Part[];
    settings?: CompanySettings[];
    users?: AppUser[];
    expenses?: Expense[];
};

const BACKUP_VERSION = '2.0';
const APP_NAME = 'ShoroRepair';

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

export function validateBackup(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data) {
        errors.push('El archivo está vacío o corrupto');
        return { valid: false, errors };
    }

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

export async function restoreBackup(
    backupData: BackupRestoreInput,
    options: {
        mergeMode?: boolean;
        skipUsers?: boolean;
    } = {}
): Promise<{ success: boolean; restored: Record<string, number> }> {
    const { mergeMode = false, skipUsers = false } = options;

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
            if (data.clients?.length > 0) {
                if (!mergeMode) await db.clients.clear();
                await db.clients.bulkPut(data.clients);
                restored.clients = data.clients.length;
            }

            if (data.orders?.length > 0) {
                if (!mergeMode) await db.orders.clear();
                await db.orders.bulkPut(data.orders);
                restored.orders = data.orders.length;
            }

            if (data.inventory?.length > 0) {
                if (!mergeMode) await db.inventory.clear();
                await db.inventory.bulkPut(data.inventory);
                restored.inventory = data.inventory.length;
            }

            if (data.settings?.length > 0) {
                await db.settings.clear();
                await db.settings.bulkPut(data.settings);
                restored.settings = data.settings.length;
            }

            if (!skipUsers && data.users?.length > 0) {
                await db.users.clear();
                await db.users.bulkPut(data.users);
                restored.users = data.users.length;
            }

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

export async function downloadBackup(): Promise<void> {
    try {
        const backup = await createBackup();
        const json = JSON.stringify(backup, null, 2);
        const date = new Date().toISOString().split('T')[0];
        const filename = `${APP_NAME}_Backup_${date}.json`;

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

export function readBackupFile(file: File): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                resolve(data);
            } catch (_error) {
                reject(new Error('El archivo no es un JSON válido'));
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsText(file);
    });
}

export function formatBackupDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('es', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export async function getEstimatedBackupSize(): Promise<string> {
    const backup = await createBackup();
    const bytes = new Blob([JSON.stringify(backup)]).size;

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function uploadBackupToCloud(): Promise<string> {
    try {
        const { uploadFile } = await import('../../services/upload.service');
        const backup = await createBackup();
        const json = JSON.stringify(backup);
        const blob = new Blob([json], { type: 'application/json' });

        const timestamp = Date.now();
        const path = `backups/backup_${timestamp}.json`;

        const url = await uploadFile(blob, path);

        toast.success('Respaldo en la nube completado');
        return url;
    } catch (error) {
        console.error('Error uploading backup to cloud:', error);
        toast.error('Error al subir respaldo a la nube');
        throw error;
    }
}

export async function listCloudBackups() {
    try {
        const { listFiles, getDownloadURL } = await import('../../services/upload.service');
        const items = await listFiles('backups');

        const backups = await Promise.all(items.map(async (item) => {
            const url = await getDownloadURL(item);
            const name = item.name;
            const timestamp = parseInt(name.replace('backup_', '').replace('.json', ''));
            return { name, url, timestamp };
        }));

        return backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.error('Error listing cloud backups:', error);
        return [];
    }
}

export async function getBackupFromCloudUrl(url: string): Promise<BackupData> {
    const { getFileByUrl } = await import('../../services/upload.service');
    return await getFileByUrl(url);
}

export async function deleteCloudBackup(url: string) {
    const { deleteImage } = await import('../../services/upload.service');
    await deleteImage(url);
    toast.success('Respaldo eliminado de la nube');
}

export async function uploadBackupToGoogleDrive(accessToken: string): Promise<boolean> {
    try {
        const backup = await createBackup();
        const jsonContent = JSON.stringify(backup, null, 2);

        const timestamp = Date.now();
        const filename = `${APP_NAME}_Backup_${new Date().toISOString().split('T')[0]}_${timestamp}.json`;

        const metadata = {
            name: filename,
            mimeType: 'application/json',
        };

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const body = delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            jsonContent +
            close_delim;

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: body
        });

        if (!response.ok) {
            if (response.status === 401) {
                toast.error("Tu sesión de Google expiró. Por favor, desvincula y vuelve a conectar.");
                return false;
            }
            const error = await response.json();
            throw new Error(error.error?.message || 'Error en Google Drive');
        }

        const resData = await response.json();
        console.log("Drive Upload Success:", resData);
        toast.success('Respaldo guardado en Google Drive');
        return true;
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('Error uploading to Google Drive:', error);
        toast.error(`Error Google Drive: ${err.message}`);
        return false;
    }
}
