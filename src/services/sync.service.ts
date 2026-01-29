import { syncManager } from '../offline/sync';

export const SyncService = {
    start: () => syncManager.startSync(),
    stop: () => syncManager.stopSync(),
    forceSync: () => syncManager.sync(),
    getStatus: () => syncManager.getStatus(),
    subscribe: (cb: any) => syncManager.subscribe(cb)
};
