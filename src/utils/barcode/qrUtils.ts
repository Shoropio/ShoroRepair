import * as QRCode from 'qrcode';

/**
 * Generates a QR code as a Base64 image string
 * @param text The text or URL to encode
 * @param options QRCode options (overrides defaults)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generateQRCode = async (text: string, options: any = {}): Promise<string> => {
    try {
        const defaults = {
            margin: 1,
            // produce a large raster image so jsPDF scales down cleanly for printing
            width: 1024,
            errorCorrectionLevel: 'H',
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        };

        const opts = { ...defaults, ...options };

        // Simple in-memory cache to avoid regenerating identical QRs repeatedly
        const key = JSON.stringify([text, opts.width, opts.margin, opts.errorCorrectionLevel]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(generateQRCode as any)._cache) (generateQRCode as any)._cache = new Map<string, string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cache: Map<string, string> = (generateQRCode as any)._cache;
        if (cache.has(key)) return cache.get(key)!;

        // return data URL (PNG) suitable for <img src=> and jsPDF.addImage
        const data = (await QRCode.toDataURL(text, opts)) as unknown as string;
        try { cache.set(key, data); } catch (_e) { /* ignore cache errors */ }
        return data;
    } catch (err) {
        console.error('Error generating QR code', err);
        throw err;
    }
};
