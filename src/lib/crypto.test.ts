import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isHashed } from './crypto';

describe('crypto: password hashing (PBKDF2)', () => {
	it('produces a pbkdf2$ hashed output with separators', async () => {
		const h = await hashPassword('123');
		expect(h.startsWith('pbkdf2$')).toBe(true);
		expect((h.match(/\$/g) || []).length).toBe(3);
	});

	it('verifies the correct password and rejects a wrong one', async () => {
		const h = await hashPassword('s3cr3t');
		expect(await verifyPassword('s3cr3t', h)).toBe(true);
		expect(await verifyPassword('wrong', h)).toBe(false);
	});

	it('uses a random salt (hashes differ but both verify)', async () => {
		const a = await hashPassword('same');
		const b = await hashPassword('same');
		expect(a).not.toEqual(b);
		expect(await verifyPassword('same', a)).toBe(true);
		expect(await verifyPassword('same', b)).toBe(true);
	});

	it('supports legacy plaintext migration', async () => {
		expect(await verifyPassword('123', '123')).toBe(true);
		expect(await verifyPassword('x', '123')).toBe(false);
		expect(isHashed('123')).toBe(false);
		expect(isHashed('pbkdf2$abc$def$1')).toBe(true);
	});
});
