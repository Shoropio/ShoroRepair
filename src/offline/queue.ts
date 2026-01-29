/**
 * Offline Sync Queue
 * Manages operations that need to be synced when back online
 */

export interface QueueItem {
    id: string;
    type: string;
    data: any;
    timestamp: number;
    status: 'pending' | 'processing' | 'failed' | 'completed';
}

export class SyncQueue {
    private queue: QueueItem[] = [];

    constructor() {
        this.loadQueue();
    }

    private loadQueue() {
        const saved = localStorage.getItem('sync_queue');
        if (saved) {
            try {
                this.queue = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load sync queue', e);
                this.queue = [];
            }
        }
    }

    private saveQueue() {
        localStorage.setItem('sync_queue', JSON.stringify(this.queue));
    }

    public add(type: string, data: any) {
        const item: QueueItem = {
            id: crypto.randomUUID(),
            type,
            data,
            timestamp: Date.now(),
            status: 'pending'
        };
        this.queue.push(item);
        this.saveQueue();
        return item.id;
    }

    public getPending() {
        return this.queue.filter(item => item.status === 'pending');
    }

    public markAs(id: string, status: QueueItem['status']) {
        const item = this.queue.find(q => q.id === id);
        if (item) {
            item.status = status;
            this.saveQueue();
            if (status === 'completed') {
                this.remove(id); // Optional: remove completed items
            }
        }
    }

    public remove(id: string) {
        this.queue = this.queue.filter(q => q.id !== id);
        this.saveQueue();
    }
}

export const syncQueue = new SyncQueue();
