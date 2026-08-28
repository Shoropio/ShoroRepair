import JsBarcode from 'jsbarcode';

/**
 * Generates a barcode as a Base64 image string
 * @param value The value to encode (e.g., Order Number)
 * @param options JsBarcode options
 */
export const generateBarcode = (value: string, options: JsBarcode.Options = {}): string => {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value, {
        format: "CODE128",
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 20,
        background: "#ffffff",
        lineColor: "#000000",
        margin: 10,
        ...options
    });
    return canvas.toDataURL('image/png');
};
