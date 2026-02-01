import { db } from './db';
import { toast } from 'sonner';
import { firestore } from '../firebase/firestore';
import { auth } from '../firebase/auth';
import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    writeBatch,
    Timestamp,
    getDoc,
    serverTimestamp
} from 'firebase/firestore';

const TABLES_TO_SYNC = [
    { name: 'clients', firestore: 'clients' },
    { name: 'orders', firestore: 'orders' },
    { name: 'inventory', firestore: 'inventory' },
    { name: 'users', firestore: 'users' },
    { name: 'settings', firestore: 'settings' },
    { name: 'expenses', firestore: 'expenses' }
];

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export class SyncManager {
    private static instance: SyncManager;
    private status: SyncStatus = 'idle';
    private listeners: ((status: SyncStatus) => void)[] = [];
    private syncInterval: any = null;

    private constructor() {
        window.addEventListener('online', () => this.updateStatus(navigator.onLine ? 'idle' : 'offline'));
        window.addEventListener('offline', () => this.updateStatus('offline'));
        if (!navigator.onLine) this.status = 'offline';
    }

    private updateStatus(newStatus: SyncStatus) {
        this.status = newStatus;
        this.listeners.forEach(l => l(this.status));
    }

    public subscribe(listener: (status: SyncStatus) => void) {
        this.listeners.push(listener);
        listener(this.status);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    public getStatus() {
        return this.status;
    }

    public static getInstance(): SyncManager {
        if (!SyncManager.instance) {
            SyncManager.instance = new SyncManager();
        }
        return SyncManager.instance;
    }

    public async startSync() {
        if (this.syncInterval) return;

        // Initial sync
        this.sync();

        // Set up periodic sync every 5 minutes
        this.syncInterval = setInterval(() => {
            this.sync();
        }, 5 * 60 * 1000);

        // Also sync when coming back online
        window.addEventListener('online', () => this.sync());
    }

    public stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    public async sync() {
        if (this.status === 'syncing') return;
        if (!navigator.onLine) {
            this.updateStatus('offline');
            return;
        }
        if (!auth.currentUser) {
            toast.info("Modo Local: Vincula tu cuenta de Google en Ajustes para sincronizar con la nube.");
            return;
        }

        this.updateStatus('syncing');

        console.log('Starting sync...');

        const startTime = Date.now();

        try {
            const userId = auth.currentUser.uid;

            // Log sync start
            await db.activity_logs.add({
                userName: auth.currentUser.email || 'Sistema',
                action: 'Sincronización Iniciada',
                entity: 'sync',
                details: `Sincronizando con Firebase (Usuario: ${auth.currentUser.email})`,
                timestamp: startTime
            });

            for (const tableInfo of TABLES_TO_SYNC) {
                await this.syncTable(tableInfo.name, tableInfo.firestore, userId);
            }

            console.log('Sync completed successfully.');

            // Log sync completion
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            await db.activity_logs.add({
                userName: auth.currentUser.email || 'Sistema',
                action: 'Sincronización Completada',
                entity: 'sync',
                details: `Sincronización exitosa en ${duration}s`,
                timestamp: Date.now()
            });

            this.updateStatus('idle');
        } catch (error: any) {
            console.error('Sync failed:', error);

            // Log sync error
            await db.activity_logs.add({
                userName: auth.currentUser?.email || 'Sistema',
                action: 'Error de Sincronización',
                entity: 'sync',
                details: `Error: ${error.message || 'Error desconocido'}`,
                timestamp: Date.now()
            });

            this.updateStatus('error');
        }
    }

    private async syncTable(dexieTablename: string, firestoreCollection: string, userId: string) {
        const table = (db as any)[dexieTablename];
        const colRef = collection(firestore, 'users_data', userId, firestoreCollection);

        console.log(`Syncing table: ${dexieTablename}`);

        // 1. Push local changes to Firebase
        const unsyncedItems = await table.where('synced').equals(0).toArray();
        console.log(`Pushing ${unsyncedItems.length} unsynced items...`);

        for (const item of unsyncedItems) {
            // Ensure syncId exists (should be auto-generated by hooks)
            if (!item.syncId) {
                console.error(`Item missing syncId in ${dexieTablename}:`, item);
                continue;
            }

            const docRef = doc(colRef, item.syncId);

            // PUSH ALWAYS: Updload local version to Firebase as truth
            const { id, ...dataToPush } = item;

            await setDoc(docRef, { ...dataToPush, synced: 1 });
            // Update local record with synced flag
            await table.update(item.id, { synced: 1 });
        }

        // 2. Pull changes from Firebase (Incremental)
        const lastSyncKey = `lastSync_${dexieTablename}`;
        const lastSyncTimestamp = Number(localStorage.getItem(lastSyncKey) || 0);

        const q = query(colRef, where('updatedAt', '>', lastSyncTimestamp));
        const remoteDocs = await getDocs(q);
        console.log(`Pulling ${remoteDocs.docs.length} remote changes...`);

        let maxUpdatedAt = lastSyncTimestamp;

        for (const docSnap of remoteDocs.docs) {
            const remoteData = docSnap.data();

            // Ensure remote data has syncId
            if (!remoteData.syncId) {
                console.error(`Remote document missing syncId: ${docSnap.id}`);
                continue;
            }

            const localItem = await table.where('syncId').equals(remoteData.syncId).first();

            if (remoteData.updatedAt > maxUpdatedAt) {
                maxUpdatedAt = remoteData.updatedAt;
            }

            if (!localItem) {
                // New item from cloud - add it
                console.log(`Adding new item from cloud: ${remoteData.syncId}`);
                await table.add({ ...remoteData, synced: 1 });
            } else if (localItem.synced === 1 && remoteData.updatedAt > (localItem.updatedAt || 0)) {
                // DONT OVERWRITE LOCAL if sync status is 0 (pending local changes)
                const mergedData = {
                    ...localItem,
                    ...remoteData,
                    id: localItem.id,
                    synced: 1
                };

                if (dexieTablename === 'orders') {
                    mergedData.photos = remoteData.photos || localItem.photos;
                    mergedData.customerSignature = remoteData.customerSignature || localItem.customerSignature;
                    mergedData.invoiceUrl = remoteData.invoiceUrl || localItem.invoiceUrl;
                }

                await table.put(mergedData);
            }
        }

        localStorage.setItem(lastSyncKey, maxUpdatedAt.toString());
        console.log(`${dexieTablename} sync complete`);
    }
}

export const syncManager = SyncManager.getInstance();
