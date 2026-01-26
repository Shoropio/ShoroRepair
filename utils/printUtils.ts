import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { toast } from 'sonner';

export const handlePrint = async (doc: any, fileName: string) => {
    const platform = Capacitor.getPlatform();

    if (platform === 'android' || platform === 'ios') {
        try {
            const pdfBase64 = doc.output('datauristring').split(',')[1];

            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: pdfBase64,
                directory: Directory.Documents,
                recursive: true
            });

            toast.success(`Archivo guardado: ${fileName}`);

            // Open the file automatically
            await FileOpener.open({
                filePath: savedFile.uri,
                contentType: 'application/pdf'
            });

        } catch (e) {
            console.error('Error handling PDF on mobile', e);
            toast.error('Error al guardar o abrir el PDF');
        }
    } else {
        // Desktop (Tauri) or Web
        const pdfBlob = doc.output('bloburl');

        // Create a persistent iframe for printing
        const iframe = document.createElement('iframe');

        // Style it to be invisible but NOT display:none as some browsers skip printing hidden elements
        iframe.style.position = 'fixed';
        iframe.style.bottom = '0';
        iframe.style.right = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';
        iframe.src = pdfBlob;

        document.body.appendChild(iframe);

        iframe.onload = () => {
            setTimeout(() => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();

                    // Cleanup after a long delay to ensure print dialog has time to appear
                    // 1 minute delay is safe as the iframe is invisible and takes 0 space
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    }, 60000);
                } catch (e) {
                    console.error('Print failed', e);
                    // Fallback: Open in new window
                    window.open(pdfBlob, '_blank');
                }
            }, 1000);
        };
    }
};
