// Storage utils: Base64 Mode (Local Storage)
// Images are converted to Base64 strings and stored directly in the database.

/**
 * "Uploads" an image by converting it to a Base64 string.
 * This effectively stores the image data within the database record itself.
 * @param file The file, blob, or existing base64 string
 * @param path Unused in Base64 mode, kept for compatibility
 */
export const uploadImage = async (	file: File | Blob | string, _path: string = ''): Promise<string> => {
    // If it's already a Base64 string, just return it
    if (typeof file === 'string' && file.startsWith('data:')) {
        return file;
    }

    // Helper to Convert Blob/File to Base64
    const toBase64 = (b: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(b);
        });
    };

    if (file instanceof Blob) {
        return await toBase64(file);
    }

    throw new Error("Formato de archivo no válido para conversión Base64.");
};

/**
 * Uploads a generic file (converted to Base64)
 */
export const uploadFile = async (data: Blob | File | string, path: string): Promise<string> => {
    return uploadImage(data, path);
};

/**
 * Deletes an image (No-op in Base64 mode as data is inside the record)
 */
export const deleteImage = async (_path: string) => {
    // No action needed for Base64 strings stored in DB fields
    // They are deleted when the parent record array is updated
    return;
};

/**
 * Helper to compress images before upload
 */
export const compressImage = (file: File, maxDim = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

/**
 * Lists files (Stub for compatibility)
 */
export const listFiles = async (_path: string) => {
    return [];
};

/**
 * Fetches file content from a URL
 */
export const getFileByUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error al descargar archivo");
    return await response.json();
};

/**
 * Compatibility stub for getDownloadURL
 */
export const getDownloadURL = async (item: { url?: string; path?: string } | string): Promise<string> => {
    if (typeof item === 'string') return item;
    return item.url || item.path || '';
};
