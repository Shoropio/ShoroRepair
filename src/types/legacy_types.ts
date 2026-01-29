export * from './src/types';

export enum OrderStatus {
  RECEIVED = 'Recibido',
  DIAGNOSTIC = 'Diagnóstico',
  IN_REPAIR = 'En Reparación',
  AWAITING_PARTS = 'Esperando Repuesto',
  READY = 'Listo',
  DELIVERED = 'Entregado'
}

export enum Priority {
  LOW = 'Baja',
  MEDIUM = 'Media',
  HIGH = 'Alta',
  URGENT = 'Urgente'
}

export enum DeviceType {
  PHONE = 'Teléfono',
  APPLIANCE = 'Electrodoméstico',
  COMPUTER = 'Computadora',
  ELECTRONICS = 'Electrónica',
  OTHER = 'Otro'
}

export enum PaymentMethod {
  CASH = 'Efectivo',
  TRANSFER = 'Transferencia',
  CARD = 'Tarjeta'
}

export enum PaymentStatus {
  PENDING = 'Pendiente',
  PAID = 'Pagado'
}


export interface SyncEntity {
  syncId?: string; // Globally unique ID for sync
  updatedAt?: number;
  synced?: number; // 0 = not synced, 1 = synced
  deleted?: number; // 0 = active, 1 = deleted
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
  sku?: string; // New: Barcode / SKU
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
  invoiceNumber?: string; // New: Permanent invoice ID for Hacienda
  photos?: string[]; // New: Array of base64 photo strings
  customerSignature?: string; // New: Base64 signature string
  logs?: OrderLog[]; // New: Bitácora de cambios
  warrantyDays?: number; // New: Días de garantía ofrecidos
  warrantyExpiration?: number; // New: Timestamp de fin de garantía
  invoiceUrl?: string; // New: Cloud URL for the PDF invoice/ticket
  messageLogs?: MessageLog[]; // New: Historial de mensajes enviados
  haciendaStatus?: 'pending' | 'accepted' | 'rejected' | 'error';
  haciendaClave?: string;
  haciendaResponse?: string;
  createdAt: number;
  // updatedAt is in SyncEntity
}

export type UserRole = 'Admin' | 'Technician' | 'Receptionist';

export interface RolePermissions {
  canViewReports: boolean;
  canManageInventory: boolean;
  canManageUsers: boolean;
  canEditOrders: boolean;
  canDeleteData: boolean;
  canManageExpenses: boolean;
  canManageClients: boolean;
}

export const ROLES_CONFIG: Record<UserRole, RolePermissions> = {
  Admin: {
    canViewReports: true,
    canManageInventory: true,
    canManageUsers: true,
    canEditOrders: true,
    canDeleteData: true,
    canManageExpenses: true,
    canManageClients: true
  },
  Technician: {
    canViewReports: false,
    canManageInventory: true,
    canManageUsers: false,
    canEditOrders: true,
    canDeleteData: false,
    canManageExpenses: false,
    canManageClients: true
  },
  Receptionist: {
    canViewReports: false,
    canManageInventory: false,
    canManageUsers: false,
    canEditOrders: true,
    canDeleteData: false,
    canManageExpenses: false,
    canManageClients: true
  }
};

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
  legalFooter?: string; // New: For Terms and Conditions or legal resolutions
  defaultTaxRate?: number; // New: Default Tax Rate percentage
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPassword?: string;
  logo?: string; // Base64 logo
  currency?: string; // e.g., 'CRC', 'USD', '₡'
  inactivityTimeout?: number; // In minutes
  accentColor?: string; // hex color
  language?: 'es' | 'en';
  // Firebase Config
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
  firebaseMeasurementId?: string;
  googleAnalyticsId?: string;
  // Hacienda CR Specifics
  haciendaUser?: string;
  haciendaPass?: string;
  p12Pin?: string;
  p12Cert?: string; // Base64
  isHaciendaProduction?: boolean;
  cloudSetupCompleted?: boolean;
  notificationsEnabled?: boolean;
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
  entity: string; // 'order', 'client', 'user', etc.
  entityId?: string;
  details?: string;
  timestamp: number;
}
