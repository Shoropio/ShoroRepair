/**
 * Stable per-installation identifier.
 *
 * Used to make locally-generated sequences (e.g. invoice numbers) unique across
 * devices without coordination. Deliberately stored in localStorage (per
 * browser/device) and NOT synced, so it does not converge between devices.
 */
const INSTALL_ID_KEY = 'shoro_install_id';

export function getInstallId(): string {
	try {
		const existing = localStorage.getItem(INSTALL_ID_KEY);
		if (existing) return existing;
	} catch {
		/* localStorage unavailable */
	}
	// Short, human-friendly, unambiguous (no vowels to avoid words).
	const alphabet = '0123456789BCDFGHJKLMNPQRSTVWXZ';
	let id = '';
	for (let i = 0; i < 4; i++) {
		id += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	try {
		localStorage.setItem(INSTALL_ID_KEY, id);
	} catch {
		/* ignore */
	}
	return id;
}
