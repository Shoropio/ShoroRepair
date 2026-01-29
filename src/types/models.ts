import { OrderStatus, Priority, DeviceType, PaymentMethod, PaymentStatus } from './enums';
import { UserRole } from './auth';

export interface SyncEntity {
    syncId?: string;
    updatedAt?: number;
    synced?: number;
    deleted?: number;
}

export interface Client extends SyncEntity {
    id?: number;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    createdAt: number;
}

export interface Part extends SyncEntity {
    id?: number;
    name: string;
    sku?: string;
    quantity: number;
    price: number;
    minStock: number;
}

export interface OrderPart {
    partId: number;
    name: string;
    quantity: number;
    price: number;
}

export interface OrderLog {
    timestamp: number;
    status: OrderStatus;
    note?: string;
    technicianId?: number;
}

export interface MessageLog {
    id?: string;
    timestamp: number;
    type: 'WhatsApp' | 'Email';
    content: string;
    status: 'Sent' | 'Failed';
    recipient: string;
}

export interface ServiceOrder extends SyncEntity {
    id?: number;
    orderNumber: string;
    clientId: number;
    deviceType: DeviceType;
    brand: string;
    model: string;
    serialNumber?: string;
    issueDescription: string;
    technicalDiagnosis?: string;
    status: OrderStatus;
    priority: Priority;
    technicianId?: number;
    notes?: string;
    laborCost: number;
    parts: OrderPart[];
    taxRate: number;
    total: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    customerApproved?: boolean;
    invoiceNumber?: string;
    photos?: string[];
    customerSignature?: string;
    logs?: OrderLog[];
    warrantyDays?: number;
    warrantyExpiration?: number;
    invoiceUrl?: string;
    messageLogs?: MessageLog[];
    haciendaStatus?: 'pending' | 'accepted' | 'rejected' | 'error';
    haciendaClave?: string;
    haciendaResponse?: string;
    createdAt: number;
}

export interface AppUser extends SyncEntity {
    id?: number;
    username: string;
    fullName: string;
    email?: string;
    password?: string;
    role: UserRole;
    active: boolean;
}

export interface CompanySettings extends SyncEntity {
    id?: number;
    businessName: string;
    legalName: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    invoicePrefix: string;
    nextInvoiceNumber: number;
    legalFooter?: string;
    defaultTaxRate?: number;
    smtpHost?: string;
    smtpPort?: string;
    smtpUser?: string;
    smtpPassword?: string;
    logo?: string;
    currency?: string;
    inactivityTimeout?: number;
    accentColor?: string;
    language?: 'es' | 'en';
    firebaseApiKey?: string;
    firebaseAuthDomain?: string;
    firebaseProjectId?: string;
    firebaseStorageBucket?: string;
    firebaseMessagingSenderId?: string;
    firebaseAppId?: string;
    firebaseMeasurementId?: string;
    googleAnalyticsId?: string;
    haciendaUser?: string;
    haciendaPass?: string;
    p12Pin?: string;
    p12Cert?: string;
    isHaciendaProduction?: boolean;
    cloudSetupCompleted?: boolean;
    notificationsEnabled?: boolean;
    geminiApiKey?: string;
}

export interface Expense extends SyncEntity {
    id?: number;
    description: string;
    category: string;
    amount: number;
    date: number;
    paymentMethod: string;
}

export interface ActivityLog extends SyncEntity {
    id?: number;
    userId?: number;
    userName: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
    timestamp: number;
}
