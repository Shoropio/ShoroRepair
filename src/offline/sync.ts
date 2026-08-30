import { db, getTable } from './db';
import { firestore } from '../firebase/firestore';
import { auth } from '../firebase/auth';
import { resolveRemoteChange } from './syncResolution';
import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,




} from 'firebase/firestore';

const DEBUG = import.meta.env.DEV;
const dlog = (...args: unknown[]) => { if (DEBUG) console.log(...args); };

/** Bounded exponential backoff for transient Firebase/network errors. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 1000): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (i < attempts - 1) {
                await new Promise(r => setTimeout(r, baseDelayMs * 2 ** i));
            }
        }
    }
    throw lastErr;
}


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
    private syncInterval: ReturnType<typeof setInterval> | null = null;
    private syncCooldownUntil = 0;

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

        // Initial sync on login
        this.sync();

        // Sync when coming back online
        window.addEventListener('online', () => this.sync());
    }

    public stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // New method to trigger sync on data changes
    public async syncOnChange() {
        // Ignore changes produced by our own sync writes (see sync() cooldown)
        // to avoid an endless re-sync loop.
        if (Date.now() < this.syncCooldownUntil) return;
        if (this.status !== 'syncing') {
            await this.sync();
        }
    }

    public async sync() {
        if (this.status === 'syncing') return;
        try {
            await this.performSync();
        } finally {
            // The Dexie change-hooks in db.ts defer their syncOnChange() call by
            // ~1s. Extend a cooldown past the cycle so those trailing calls
            // (raised by our own writes) are swallowed instead of looping forever.
            this.syncCooldownUntil = Date.now() + 2000;
        }
    }

    private async performSync(depth = 0): Promise<void> {
        if (!navigator.onLine) {
            this.updateStatus('offline');
            return;
        }
        if (!auth || !auth.currentUser) {
            dlog('Modo Local: Vincula tu cuenta de Google en Ajustes para sincronizar con la nube.');
            return;
        }
        if (!firestore) {
            dlog('Firebase/Firestore no está configurado; omitiendo sincronización con la nube.');
            this.updateStatus('idle');
            return;
        }

        this.updateStatus('syncing');

        dlog('Starting sync...');

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

            dlog('Sync completed successfully.');

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
        } catch (error: unknown) {
            const err = error as { message?: string };
            console.error('Sync failed:', error);

            // Log sync error
            await db.activity_logs.add({
                userName: auth.currentUser?.email || 'Sistema',
                action: 'Error de Sincronización',
                entity: 'sync',
                details: `Error: ${err.message || 'Error desconocido'}`,
                timestamp: Date.now()
            });

            this.updateStatus('error');
            return;
        }

        // A change may have been written (or flagged as conflict) while this cycle
        // was running. Without this re-check those changes would be silently
        // skipped until the next edit/online event. Cap depth to avoid loops.
        if (depth < 3 && (await this.hasPendingChanges())) {
            dlog('Pending changes detected after sync, running another cycle.');
            await this.performSync(depth + 1);
        }
    }

    private async hasPendingChanges(): Promise<boolean> {
        for (const tableInfo of TABLES_TO_SYNC) {
            const table = getTable(tableInfo.name);
            // Records flagged as a conflict are intentionally held back from the
            // push until a human reconciles them, so they must not count as pending
            // (otherwise sync would loop forever re-flagging the same conflict).
            const count = await table.where('synced').equals(0).and((r) => r.conflict !== 1).count();
            if (count > 0) return true;
        }
        return false;
    }

    private async syncTable(dexieTablename: string, firestoreCollection: string, userId: string) {
        const table = getTable(dexieTablename);
        const colRef = collection(firestore, 'users_data', userId, firestoreCollection);

        dlog(`Syncing table: ${dexieTablename}`);

        const lastSyncKey = `lastSync_${dexieTablename}`;
        const lastSyncTimestamp = Number(localStorage.getItem(lastSyncKey) || 0);

        // 1. Pull remote changes FIRST so that a local pending (unsynced) edit can
        //    be detected as a conflict against a newer remote write. If we pushed
        //    before pulling we would flip `synced` to 1 and the conflict branch in
        //    resolveRemoteChange would become unreachable, silently overwriting the
        //    user's local change (data loss).
        const q = query(colRef, where('updatedAt', '>', lastSyncTimestamp));
        const remoteDocs = await withRetry(() => getDocs(q));
        dlog(`Pulling ${remoteDocs.docs.length} remote changes...`);

        let maxUpdatedAt = lastSyncTimestamp;

        for (const docSnap of remoteDocs.docs) {
            const remoteData = docSnap.data() as Record<string, unknown>;

            // Ensure remote data has syncId
            if (!remoteData.syncId) {
                console.error(`Remote document missing syncId: ${docSnap.id}`);
                continue;
            }

            const localItem = (await table.where('syncId').equals(remoteData.syncId as string).first()) as Record<string, unknown> | null;

            if ((remoteData.updatedAt as number) > maxUpdatedAt) {
                maxUpdatedAt = remoteData.updatedAt as number;
            }

            const resolution = resolveRemoteChange(localItem, remoteData, dexieTablename);

            switch (resolution.kind) {
                case 'add':
                    // Avoid creating a duplicate local record when a user with the same
                    // username already exists (e.g. syncing against a stale/wrong project
                    // that also seeded an `admin`). Keep the local record as source of truth.
                    if (dexieTablename === 'users' && remoteData.username) {
                        const existing = (await table
                            .where('username')
                            .equals(remoteData.username as string)
                            .first()) as Record<string, unknown> | null;
                        if (existing) {
                            dlog(`Skipping remote user ${remoteData.username}: local user already exists`);
                            break;
                        }
                    }
                    dlog(`Adding new item from cloud: ${remoteData.syncId}`);
                    await table.add(resolution.data);
                    break;
                case 'apply':
                    await table.put(resolution.data);
                    break;
                case 'conflict':
                    // Keep local as source of truth, but flag the conflict and persist
                    // the remote payload in the activity log so a human can reconcile.
                    // We never silently discard the remote change, and the flagged
                    // record is skipped by the push phase below (so the local edit is
                    // preserved until reconciled) instead of being overwritten.
                    console.warn(`Sync conflict on ${dexieTablename}/${resolution.syncId}: keeping local, remote retained for review.`);
                    if (localItem) {
                        await table.update(localItem.id as number, { conflict: 1, synced: 0 });
                    }
                    await db.activity_logs.add({
                        userName: auth.currentUser?.email || 'Sistema',
                        action: 'Conflicto de sincronización',
                        entity: dexieTablename,
                        entityId: resolution.syncId,
                        details: `Cambio local sin sincronizar vs remoto más reciente. Copia remota conservada: ${JSON.stringify(resolution.remote).slice(0, 2000)}`,
                        timestamp: Date.now()
                    });
                    break;
                case 'keep':
                    // Local is newer or equal -> no-op.
                    break;
            }
        }

        localStorage.setItem(lastSyncKey, maxUpdatedAt.toString());

        // 2. Push local changes to Firebase (skip records already flagged as a
        //    conflict so the local edit survives for human reconciliation).
        const unsyncedItems = await table.where('synced').equals(0).toArray();
        dlog(`Pushing ${unsyncedItems.length} unsynced items...`);

        for (const item of unsyncedItems) {
            // Ensure syncId exists (should be auto-generated by hooks)
            if (!item.syncId) {
                console.error(`Item missing syncId in ${dexieTablename}:`, item);
                continue;
            }

            // A conflict was flagged during the pull above: keep the local edit and
            // let a human resolve it rather than blindly pushing over the remote.
            if (item.conflict === 1) continue;

            const docRef = doc(colRef, item.syncId as string);

            // Never upload local-only secrets (e.g. the PBKDF2 password hash) or
            // transient UI flags (conflict) to the cloud.
            const { id: _id, password: _password, conflict: _conflict, ...dataToPush } = item;

            await withRetry(() => setDoc(docRef, { ...dataToPush, synced: 1 }));
            // Update local record with synced flag and clear unknown conflict marker.
            // Keep the version aligned with what was just pushed.
            await table.update(item.id as number, { synced: 1, conflict: 0, version: item.version });
        }

        dlog(`${dexieTablename} sync complete`);
    }
}

export const syncManager = SyncManager.getInstance();
