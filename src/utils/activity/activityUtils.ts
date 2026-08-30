import { db } from '../../offline/db';

const DAY = 86400000;

export async function getActivityRetentionDays(): Promise<number> {
    const settings = await db.settings.limit(1).first();
    const days = Number(settings?.activityRetentionDays ?? 0);
    return Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0;
}

export async function purgeActivityLogs(olderThanDays: number): Promise<number> {
    const table = db.activity_logs;
    if (!olderThanDays || olderThanDays <= 0) {
        const count = await table.count();
        await table.clear();
        return count;
    }
    const cut = Date.now() - olderThanDays * DAY;
    const oldLogs = await table.where('timestamp').below(cut).toArray();
    const ids = oldLogs
        .map(log => log.id)
        .filter((id): id is number => typeof id === 'number');
    if (ids.length > 0) await table.bulkDelete(ids);
    return ids.length;
}

export async function runScheduledActivityCleanup(): Promise<number> {
    const days = await getActivityRetentionDays();
    if (days <= 0) return 0;
    return purgeActivityLogs(days);
}