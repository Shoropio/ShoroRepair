import { describe, it, expect } from 'vitest';
import { resolveRemoteChange } from './syncResolution';

describe('resolveRemoteChange (sync conflict/tombstone logic)', () => {
	it('adds when there is no local record', () => {
		const remote = { syncId: 's1', updatedAt: 100, name: 'X' } as Record<string, unknown>;
		const r = resolveRemoteChange(null, remote, 'clients');
		expect(r.kind).toBe('add');
		if (r.kind === 'add') {
			expect(r.data.synced).toBe(1);
			expect(r.data.name).toBe('X');
		}
	});

	it('applies a newer remote when local has no pending changes', () => {
		const local = { id: 7, syncId: 's1', updatedAt: 100, synced: 1, name: 'old' } as Record<string, unknown>;
		const remote = { syncId: 's1', updatedAt: 200, name: 'new' } as Record<string, unknown>;
		const r = resolveRemoteChange(local, remote, 'clients');
		expect(r.kind).toBe('apply');
		if (r.kind === 'apply') {
			expect(r.data.name).toBe('new');
			expect(r.data.id).toBe(7);
			expect(r.data.synced).toBe(1);
			expect(r.data.conflict).toBe(0);
		}
	});

	it('flags a conflict (does not silently drop remote) when local has pending changes and remote is newer', () => {
		const local = { id: 7, syncId: 's1', updatedAt: 100, synced: 0, name: 'local' } as Record<string, unknown>;
		const remote = { syncId: 's1', updatedAt: 200, name: 'remote' } as Record<string, unknown>;
		const r = resolveRemoteChange(local, remote, 'clients');
		expect(r.kind).toBe('conflict');
		if (r.kind === 'conflict') {
			expect(r.syncId).toBe('s1');
			expect(r.remote.name).toBe('remote');
		}
	});

	it('keeps local when local is newer or equal', () => {
		const local = { id: 7, syncId: 's1', updatedAt: 300, synced: 1 } as Record<string, unknown>;
		const remote = { syncId: 's1', updatedAt: 200 } as Record<string, unknown>;
		expect(resolveRemoteChange(local, remote, 'clients').kind).toBe('keep');

		const equal = { id: 7, syncId: 's1', updatedAt: 200, synced: 1 } as Record<string, unknown>;
		expect(resolveRemoteChange(equal, remote, 'clients').kind).toBe('keep');
	});

	it('never trusts the cloud for role/active/password on the users table', () => {
		const local = {
			id: 7,
			syncId: 's1',
			updatedAt: 100,
			synced: 1,
			role: 'Technician',
			active: true,
			password: 'localhash'
		} as Record<string, unknown>;
		const remote = {
			syncId: 's1',
			updatedAt: 200,
			role: 'Admin',
			active: false,
			password: 'evilhash'
		} as Record<string, unknown>;
		const r = resolveRemoteChange(local, remote, 'users');
		expect(r.kind).toBe('apply');
		if (r.kind === 'apply') {
			expect(r.data.role).toBe('Technician');
			expect(r.data.active).toBe(true);
			expect(r.data.password).toBe('localhash');
		}
	});
});
