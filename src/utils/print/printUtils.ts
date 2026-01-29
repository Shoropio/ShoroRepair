import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { toast } from 'sonner';

export const handlePrint = async (doc: any, fileName: string, options: { autoPrint?: boolean } = {}) => {
    const platform = Capacitor.getPlatform();
    const autoPrint = options.autoPrint !== false; // default true

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

            await FileOpener.open({
                filePath: savedFile.uri,
                contentType: 'application/pdf'
            });

        } catch (e) {
            console.error('Error handling PDF on mobile', e);
            toast.error('Error al guardar o abrir el PDF');
        }
    } else {
        const pdfBlob = doc.output('bloburl');

        if (!autoPrint) {
            try {
                window.open(pdfBlob, '_blank');
                return;
            } catch (e) {}
        }

        const iframe = document.createElement('iframe');
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

                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    }, 60000);
                } catch (e) {
                    console.error('Print failed', e);
                    window.open(pdfBlob, '_blank');
                }
            }, 1000);
        };
    }
};
