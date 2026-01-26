
import { db } from '../../db';
import { CompanySettings, ServiceOrder } from '../../types';

const HACIENDA_IDP_SANDBOX = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token';
const HACIENDA_IDP_PROD = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token';

const HACIENDA_API_RECEPCION_SANDBOX = 'https://api.comprobanteselectronicos.go.cr/recepcion-sandbox/v1/recepcion';
const HACIENDA_API_RECEPCION_PROD = 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion';

/**
 * Gets the OAuth2 access token from Hacienda IDP
 */
export async function getHaciendaToken(settings: CompanySettings): Promise<string> {
    const url = settings.isHaciendaProduction ? HACIENDA_IDP_PROD : HACIENDA_IDP_SANDBOX;
    const client_id = settings.isHaciendaProduction ? 'api-prod' : 'api-stag';

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', client_id);
    params.append('username', settings.haciendaUser || '');
    params.append('password', settings.haciendaPass || '');
    params.append('scope', '');

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    if (!response.ok) {
        throw new Error('Error al autenticar con Hacienda: ' + response.statusText);
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Generates the 50-digit 'Clave' and 20-digit 'Consecutivo' for an invoice
 */
export function generateHaciendaIdentifiers(settings: CompanySettings, seq: number) {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);

    // Consecutivo: 3 (Sucursal) + 5 (Terminal) + 2 (Tipo) + 10 (Secuencial)
    const sucursal = '001';
    const terminal = '00001';
    const tipo = '01'; // Factura Electronica
    const secuencial = seq.toString().padStart(10, '0');
    const consecutivo = `${sucursal}${terminal}${tipo}${secuencial}`;

    // Clave: 50 digits
    // 506 (Costa Rica) + Day + Month + Year + TaxId (12) + Consecutivo (20) + Situacion (1) + SecurityCode (8)
    const country = '506';
    const taxId = settings.taxId.replace(/[^0-9]/g, '').padStart(12, '0');
    const situacion = '1'; // Normal
    const securityCode = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 digits

    const clave = `${country}${day}${month}${year}${taxId}${consecutivo}${situacion}${securityCode}`;

    return { clave, consecutivo };
}

/**
 * Placeholder for XML signing (Requires node-forge or similar)
 * In a real-world browser app, this usually calls a microservice or 
 * uses a library like xmldsigjs (not included in this project yet).
 */
async function signXml(xml: string, p12Base64: string, p12Pin: string): Promise<string> {
    // This is a complex cryptographic process.
    // For now, we will throw a clear error or return a stub.
    // Recommended: Use an external signing API or a specialized JS library.
    console.warn("Módulo de firma automática en firma... se requiere librería especializada.");
    return btoa(xml); // Stub: Just Base64 for now
}

/**
 * Sends a ServiceOrder to Hacienda
 */
export async function sendOrderToHacienda(order: ServiceOrder): Promise<any> {
    const settings = (await db.settings.toArray())[0];
    if (!settings || !settings.haciendaUser || !settings.haciendaPass) {
        throw new Error("Configuración de Hacienda incompleta.");
    }

    const { clave, consecutivo } = generateHaciendaIdentifiers(settings, settings.nextInvoiceNumber);
    const token = await getHaciendaToken(settings);

    // Build the "Recepcion" Payload
    const payload = {
        clave,
        fecha: new Date().toISOString(),
        emisor: {
            tipoIdentificacion: settings.taxId.length > 10 ? '02' : '01',
            numeroIdentificacion: settings.taxId.replace(/[^0-9]/g, '')
        },
        receptor: {
            // Usually client data here
            tipoIdentificacion: '01', // Cedula Fisica placeholder
            numeroIdentificacion: '000000000'
        },
        callbackUrl: '', // Not needed for simple sync call
        comprobanteXml: '' // REQUIRED: The SIGNED XML in Base64
    };

    // Note: To send this for REAL, we need the Comprobante XML version 4.3 signed.
    // Since building a full Schema 4.3 XML builder is out of scope for a single task,
    // we provide the connectivity wrapper.

    throw new Error("El módulo de Firma Criptográfica requiere ser configurado con un proveedor de firma (Firma-Gratis o similar) para completar el proceso.");
}
