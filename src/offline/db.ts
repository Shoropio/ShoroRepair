import { Dexie, type Table } from 'dexie';
import { Client, ServiceOrder, Part, AppUser, CompanySettings, Expense, ActivityLog, DeviceType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, needsRehash } from '../lib/crypto';

export interface AppKeyRecord {
  id: string;
  key: Uint8Array;
}

export class RepairDB extends Dexie {
  clients!: Table<Client>;
  orders!: Table<ServiceOrder>;
  inventory!: Table<Part>;
  users!: Table<AppUser>;
  settings!: Table<CompanySettings>;
  expenses!: Table<Expense>;
  activity_logs!: Table<ActivityLog>;
  appkeys!: Table<AppKeyRecord>;

  constructor() {
    super('RepairMasterDB');

    this.version(8).stores({
      clients: '++id, syncId, name, phone, email, updatedAt, synced, deleted',
      orders: '++id, syncId, orderNumber, invoiceNumber, clientId, status, deviceType, createdAt, technicianId, paymentStatus, updatedAt, synced, deleted',
      inventory: '++id, syncId, name, sku, updatedAt, synced, deleted',
      users: '++id, syncId, username, role, updatedAt, synced, deleted',
      settings: '++id, syncId, updatedAt, synced, deleted',
      expenses: '++id, syncId, date, category, updatedAt, synced, deleted',
      activity_logs: '++id, syncId, userId, entity, timestamp, updatedAt, synced, deleted'
    }).upgrade(async tx => {
      const tables = ['clients', 'orders', 'inventory', 'users', 'settings', 'expenses', 'activity_logs'];
      for (const tableName of tables) {
        await tx.table(tableName).toCollection().modify(item => {
          if (!item.syncId) item.syncId = uuidv4();
          if (!item.updatedAt) item.updatedAt = Date.now();
          if (item.synced === undefined) item.synced = 0;
          if (item.deleted === undefined) item.deleted = 0;
        });
      }
    });

    this.version(9).stores({
      clients: '++id, syncId, name, phone, email, updatedAt, synced, deleted',
      orders: '++id, syncId, orderNumber, invoiceNumber, clientId, status, deviceType, createdAt, technicianId, paymentStatus, updatedAt, synced, deleted',
      inventory: '++id, syncId, name, sku, updatedAt, synced, deleted',
      users: '++id, syncId, username, role, updatedAt, synced, deleted',
      settings: '++id, syncId, updatedAt, synced, deleted',
      expenses: '++id, syncId, date, category, updatedAt, synced, deleted',
      activity_logs: '++id, syncId, userId, entity, timestamp, updatedAt, synced, deleted'
    }).upgrade(async tx => {
      await tx.table('orders').toCollection().modify(order => {
        const searchableDevice = `${order.brand || ''} ${order.model || ''} ${order.issueDescription || ''}`.toLowerCase();
        const looksLikeRiceCooker = searchableDevice.includes('arrocera') || searchableDevice.includes('rice cooker');
        const looksLikeBlackAndDecker = searchableDevice.includes('black+decker') || searchableDevice.includes('black & decker') || searchableDevice.includes('black decker');

        if (order.deviceType === DeviceType.PHONE && looksLikeRiceCooker && looksLikeBlackAndDecker) {
          order.deviceType = DeviceType.APPLIANCE;
          order.synced = 0;
          order.updatedAt = Date.now();
        }

        if (!Array.isArray(order.parts)) order.parts = [];
        order.laborCost = Number(order.laborCost) || 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const partsTotal = order.parts.reduce((acc: number, part: any) => {
          return acc + ((Number(part.price) || 0) * (Number(part.quantity) || 0));
        }, 0);
        const subtotal = order.laborCost + partsTotal;
        const taxRate = Number(order.taxRate) || 0;
        order.total = subtotal + (subtotal * (taxRate / 100));
      });
    });

    this.version(10).stores({
      clients: '++id, syncId, name, phone, email, updatedAt, synced, deleted',
      orders: '++id, syncId, orderNumber, invoiceNumber, clientId, status, deviceType, createdAt, technicianId, paymentStatus, updatedAt, synced, deleted',
      inventory: '++id, syncId, name, sku, updatedAt, synced, deleted',
      users: '++id, syncId, username, role, updatedAt, synced, deleted',
      settings: '++id, syncId, updatedAt, synced, deleted',
      expenses: '++id, syncId, date, category, updatedAt, synced, deleted',
      activity_logs: '++id, syncId, userId, entity, timestamp, updatedAt, synced, deleted',
      appkeys: 'id'
    });

    const tableNames = ['clients', 'orders', 'inventory', 'users', 'settings', 'expenses', 'activity_logs'];

    tableNames.forEach(tableName => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = this.table(tableName as any);

      table.hook('creating', (primKey, obj) => {
        obj.syncId = obj.syncId || uuidv4();
        obj.updatedAt = obj.updatedAt || Date.now();
        if (obj.synced === undefined) obj.synced = 0;
        obj.deleted = obj.deleted === undefined ? 0 : obj.deleted;
        if (obj.version === undefined) obj.version = 1;

        // Trigger sync after creation
        setTimeout(() => {
          import('./sync').then(({ syncManager }) => {
            syncManager.syncOnChange();
          });
        }, 1000);
      });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
      table.hook('updating', (mods: any, primKey, obj, _transaction) => {
        if (Object.keys(mods).length === 1 && Object.prototype.hasOwnProperty.call(mods, 'synced')) {
          return undefined;
        }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = {};
        if (!Object.prototype.hasOwnProperty.call(mods, 'updatedAt')) {
          updates.updatedAt = Date.now();
        }
        if (!Object.prototype.hasOwnProperty.call(mods, 'synced')) {
          updates.synced = 0;
        }
        // Increment the revision unless this update is itself carrying a version
        // (e.g. a pull that applies a remote record with its own version).
        if (!Object.prototype.hasOwnProperty.call(mods, 'version')) {
          updates.version = (obj?.version || 0) + 1;
        }

        // Trigger sync after update
        setTimeout(() => {
          import('./sync').then(({ syncManager }) => {
            syncManager.syncOnChange();
          });
        }, 1000);

        return { ...mods, ...updates };
      });

      table.hook('deleting', (_primKey, _obj) => {
        // Trigger sync after deletion
        setTimeout(() => {
          import('./sync').then(({ syncManager }) => {
            syncManager.syncOnChange();
          });
        }, 1000);
      });
    });
  }
}

export const db = new RepairDB();

// Multi-tab / PWA safety. When another tab opens a newer DB version, IndexedDB
// fires `versionchange` on the existing connections; if we don't close, the
// upgrade is blocked and every other tab stalls. We release the handle and let
// the UI show a "reload to continue" prompt via the dispatched events.
db.on('versionchange', () => {
    console.warn('db: schema upgrade in another tab detected; closing this connection.');
    db.close();
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('db-versionchange'));
    }
});

db.on('blocked', () => {
    console.warn('db: upgrade blocked by another open tab; close other tabs or reload to continue.');
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('db-blocked'));
    }
});

export async function initializeData() {
  // Garantizar que el usuario 'admin' exista y tenga un hash válido.
  // Corrige hashes heredados (texto plano o formato bugeado) recreándolos.
  const defaultAdmin = await db.users.where('username').equals('admin').first();
  if (!defaultAdmin) {
    console.log('System: Creating default Admin user.');
    await db.users.add({
      username: 'admin',
      fullName: 'Administrador Local',
      role: 'Admin',
      active: true,
      password: await hashPassword('123'),
      mustChangePassword: true
    });
  } else if (needsRehash(defaultAdmin.password)) {
    await db.users.update(defaultAdmin.id!, {
      password: await hashPassword('123'),
      mustChangePassword: true,
      updatedAt: Date.now(),
      synced: 0
    });
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({
      businessName: 'ShoroRepair',
      legalName: 'ShoroRepair S.A.',
      taxId: '000-000000-000',
      address: 'Calle Principal #123',
      phone: '555-0123',
      email: 'contacto@shororepair.com',
      invoicePrefix: 'FAC',
      defaultTaxRate: 13,
      nextInvoiceNumber: 1,
      inactivityTimeout: 5,
      notificationsEnabled: true,
      cloudSetupCompleted: false
    });
  }

  const inventoryCount = await db.inventory.count();
  if (inventoryCount === 0) {
    await db.inventory.bulkAdd([
      { name: 'Pantalla iPhone 11', quantity: 5, price: 80, minStock: 2 },
      { name: 'Batería Genérica 3000mAh', quantity: 15, price: 20, minStock: 5 }
    ]);
  }
}
