import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
export { getDownloadURL };
import { storage, auth } from '../firebase';

/**
 * Uploads an image to Firebase Storage and returns the download URL
 * @param file The file or data URL to upload
 * @param path The path in storage (e.g., 'orders/OS-123456/photo1.jpg')
 */
export const uploadImage = async (file: File | Blob | string, path: string): Promise<string> => {
    if (!auth.currentUser) throw new Error("Debes estar autenticado para subir imágenes.");

    let blob: Blob;

    if (typeof file === 'string' && file.startsWith('data:')) {
        // Convert Base64 to Blob
        const response = await fetch(file);
        blob = await response.blob();
    } else if (file instanceof File || file instanceof Blob) {
        blob = file;
    } else {
        throw new Error("Formato de archivo no válido.");
    }

    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
};

/**
 * Uploads a generic file to Firebase Storage
 */
export const uploadFile = async (data: Blob | File, path: string): Promise<string> => {
    if (!auth.currentUser) throw new Error("Debes estar autenticado para subir archivos.");
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, data);
    return await getDownloadURL(snapshot.ref);
};

/**
 * Deletes an image from Firebase Storage using its URL
 * @param url The full download URL of the image
 */
export const deleteImage = async (url: string) => {
    try {
        const storageRef = ref(storage, url);
        await deleteObject(storageRef);
    } catch (error) {
        console.error("Error deleting image from storage:", error);
    }
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
 * Lists all files in a specific storage directory
 */
export const listFiles = async (path: string) => {
    if (!auth.currentUser) return [];
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    return result.items;
};

/**
 * Fetches file content from a URL
 */
export const getFileByUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error al descargar archivo");
    return await response.json();
};
