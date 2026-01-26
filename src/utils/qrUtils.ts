import * as QRCode from 'qrcode';

/**
 * Generates a QR code as a Base64 image string
 * @param text The text or URL to encode
 * @param options QRCode options
 */
export const generateQRCode = async (text: string, options: any = {}): Promise<string> => {
    try {
        return (await QRCode.toDataURL(text, {
            margin: 2,
            width: 300,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            ...options
        })) as unknown as string;
    } catch (err) {
        console.error('Error generating QR code', err);
        throw err;
    }
};
