import type { jsPDF } from 'jspdf';

export const handlePrint = async (doc: jsPDF, fileName: string, options: { autoPrint?: boolean } = {}) => {
    const autoPrint = options.autoPrint !== false; // default true

    const pdfBlob = doc.output('bloburl');

    if (!autoPrint) {
        try {
            window.open(pdfBlob, '_blank');
            return;
        } catch (_e) { /* noop */ }
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0';
    iframe.style.right = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    iframe.src = pdfBlob.toString();

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
};
