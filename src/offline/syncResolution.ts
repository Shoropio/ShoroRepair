/**
 * Pure decision logic for applying a remote change during sync.
 *
 * Keeping this side-effect-free makes it unit-testable without Firebase/IndexedDB.
 * The strategy is deterministic per entity:
 *  - remote only / local older (no pending local edit)  -> apply remote
 *  - local has pending (unsynced) edits AND remote is newer -> conflict (keep local,
 *    surface remote); we never silently discard the remote change
 *  - otherwise (local newer/equal)                        -> keep local
 *
 * For the `users` table we never trust the cloud for `role`, `active` or `password`:
 * those are local-authority fields, so a malicious cloud write cannot escalate
 * privileges on pull.
 */

export type PullResolution =
	| { kind: 'add'; data: Record<string, unknown> }
	| { kind: 'apply'; data: Record<string, unknown> }
	| { kind: 'conflict'; syncId: string; remote: Record<string, unknown> }
	| { kind: 'keep' };

export function resolveRemoteChange(
	localItem: Record<string, unknown> | null,
	remoteData: Record<string, unknown>,
	dexieTablename: string
): PullResolution {
	const localUpdatedAt = (localItem?.updatedAt as number) || 0;

	if (!localItem) {
		const data: Record<string, unknown> = { ...remoteData, synced: 1 };
		if (dexieTablename === 'users') {
			// Local authority: never trust a remote password or forced-change flag
			// (a stale/wrong project could otherwise inject `123` locally).
			delete data.password;
			delete data.mustChangePassword;
		}
		return { kind: 'add', data };
	}

	if (localItem.synced === 1 && (remoteData.updatedAt as number) > localUpdatedAt) {
		const merged: Record<string, unknown> = {
			...localItem,
			...remoteData,
			id: localItem.id,
			synced: 1,
			conflict: 0
		};

		if (dexieTablename === 'orders') {
			merged.photos = remoteData.photos || localItem.photos;
			merged.customerSignature = remoteData.customerSignature || localItem.customerSignature;
			merged.invoiceUrl = remoteData.invoiceUrl || localItem.invoiceUrl;
		}

		if (dexieTablename === 'users') {
			// Local authority for security-sensitive fields.
			merged.role = localItem.role;
			merged.active = localItem.active;
			merged.password = localItem.password;
			merged.mustChangePassword = localItem.mustChangePassword;
		}

		return { kind: 'apply', data: merged };
	}

	if (localItem.synced === 0 && (remoteData.updatedAt as number) > localUpdatedAt) {
		return { kind: 'conflict', syncId: remoteData.syncId as string, remote: remoteData };
	}

	return { kind: 'keep' };
}
