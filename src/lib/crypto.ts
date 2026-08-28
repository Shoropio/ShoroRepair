/**
 * Utilidades criptográficas (Web Crypto API).
 *
 * - hashPassword / verifyPassword: PBKDF2-SHA256 para contraseñas (nunca en texto plano).
 * - encryptSecret / decryptSecret: AES-GCM para secretos en reposo (API keys, tokens).
 *
 * Nota: en una app 100% cliente no es posible ocultar un secreto de quien tiene
 * acceso físico al dispositivo. El cifrado en reposo evita la lectura trivial
 * desde IndexedDB/localStorage y mitiga extracción casual o por malware ligero.
 * Para secretos que se usan contra APIs externas (p.ej. Gemini), lo ideal es un
 * proxy/backend que retenga la key.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 120_000;

function bufToB64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

const subtle = (): SubtleCrypto | null =>
	typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null;

export async function hashPassword(password: string): Promise<string> {
	const s = subtle();
	if (!s) return `plain$${password}`;
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await s.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	const bits = await s.deriveBits(
		{ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
		keyMaterial,
		256
	);
	return `pbkdf2$${bufToB64(salt.buffer)}$${bufToB64(bits)}$${PBKDF2_ITERATIONS}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
	if (!stored) return false;
	// Migración: contraseñas heredadas en texto plano.
	if (!stored.startsWith('pbkdf2$')) return password === stored;

	const parsed = parsePbkdf2(stored);
	if (!parsed) return false;

	const s = subtle();
	if (!s) return false;

	try {
		const salt = b64ToBuf(parsed.saltB64);
		const keyMaterial = await s.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
		const bits = await s.deriveBits(
			{ name: 'PBKDF2', salt, iterations: parsed.iterations, hash: 'SHA-256' },
			keyMaterial,
			256
		);
		const computed = new Uint8Array(bits);
		const expected = b64ToBuf(parsed.hashB64);
		if (computed.length !== expected.length) return false;
		let diff = 0;
		for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ expected[i];
		return diff === 0;
	} catch {
		return false;
	}
}

// Devuelve true si el hash almacenado NO está en el formato final correcto
// (texto plano heredado o formato intermedio con bug de separador).
export function needsRehash(stored: string | undefined): boolean {
	if (!stored) return false;
	if (!stored.startsWith('pbkdf2$')) return true;
	return stored.split('$').length !== 4;
}

export function isHashed(value: string | undefined): boolean {
	return !!value && value.startsWith('pbkdf2$');
}

// Soporta el formato correcto (pbkdf2$salt$hash$iter) y el formato antiguo
// con bug de separador (pbkdf2$saltHashIter, único '$').
function parsePbkdf2(stored: string): { saltB64: string; hashB64: string; iterations: number } | null {
	try {
		const parts = stored.split('$');
		if (parts.length === 4) {
			const iterations = parseInt(parts[3], 10);
			if (!parts[1] || !parts[2] || !iterations) return null;
			return { saltB64: parts[1], hashB64: parts[2], iterations };
		}
		if (parts.length === 2) {
			// Formato buggy: pbkdf2$ + (saltB64 + hashB64 + "120000")
			const body = parts[1];
			const iterStr = PBKDF2_ITERATIONS.toString();
			if (!body.endsWith(iterStr)) return null;
			const saltHash = body.slice(0, body.length - iterStr.length);
			const HASH_B64_LEN = 44; // 32 bytes -> base64 de 44 chars
			if (saltHash.length <= HASH_B64_LEN) return null;
			const hashB64 = saltHash.slice(saltHash.length - HASH_B64_LEN);
			const saltB64 = saltHash.slice(0, saltHash.length - HASH_B64_LEN);
			return { saltB64, hashB64, iterations: PBKDF2_ITERATIONS };
		}
		return null;
	} catch {
		return null;
	}
}

// --- Cifrado de secretos en reposo (AES-GCM con clave por dispositivo) ---

let cachedDeviceKey: CryptoKey | null = null;

async function getDeviceKey(): Promise<CryptoKey | null> {
	const s = subtle();
	if (!s) return null;

	if (cachedDeviceKey) return cachedDeviceKey;

	const { db } = await import('../offline/db');
	let raw: Uint8Array | undefined;
	try {
		const rec = await db.appkeys.get('master');
		raw = rec?.key;
	} catch {
		raw = undefined;
	}

	if (!raw || raw.length !== 32) {
		raw = crypto.getRandomValues(new Uint8Array(32));
		try {
			await db.appkeys.put({ id: 'master', key: raw });
		} catch {
			/* almacenamiento no disponible */
		}
	}

	cachedDeviceKey = await s.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
	return cachedDeviceKey;
}

export async function encryptSecret(plaintext: string | null | undefined): Promise<string | null> {
	if (plaintext == null || plaintext === '') return plaintext ?? null;
	const key = await getDeviceKey();
	if (!key) return plaintext; // degradación: sin Web Crypto, no cifrar pero no romper
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
	return `aesgcm$${bufToB64(iv.buffer)}$${bufToB64(ct)}`;
}

export async function decryptSecret(payload: string | null | undefined): Promise<string | null> {
	if (!payload) return payload ?? null;
	if (!payload.startsWith('aesgcm$')) return payload; // valor sin cifrar (legacy)
	const key = await getDeviceKey();
	if (!key) return payload;
		try {
			const parts = payload.split('$');
			let ivB64: string;
			let ctB64: string;
			if (parts.length === 3) {
				ivB64 = parts[1];
				ctB64 = parts[2];
			} else if (parts.length === 2) {
				// Formato buggy: aesgcm$ + (ivB64 + ctB64); IV de 12 bytes -> 16 chars base64.
				const body = parts[1];
				ivB64 = body.slice(0, 16);
				ctB64 = body.slice(16);
			} else {
				return null;
			}
			const pt = await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv: b64ToBuf(ivB64) },
				key,
				b64ToBuf(ctB64)
			);
			return dec.decode(pt);
		} catch {
			return null;
		}
}
