import { Dexie, type Table } from 'dexie';
import { Client, ServiceOrder, Part, AppUser, CompanySettings, Expense, ActivityLog } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class RepairDB extends Dexie {
  clients!: Table<Client>;
  orders!: Table<ServiceOrder>;
  inventory!: Table<Part>;
  users!: Table<AppUser>;
  settings!: Table<CompanySettings>;
  expenses!: Table<Expense>;
  activity_logs!: Table<ActivityLog>;

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

    const tableNames = ['clients', 'orders', 'inventory', 'users', 'settings', 'expenses', 'activity_logs'];

    tableNames.forEach(tableName => {
      const table = this.table(tableName as any);

      table.hook('creating', (primKey, obj) => {
        obj.syncId = obj.syncId || uuidv4();
        obj.updatedAt = obj.updatedAt || Date.now();
        if (obj.synced === undefined) obj.synced = 0;
        obj.deleted = obj.deleted === undefined ? 0 : obj.deleted;
      });

      table.hook('updating', (mods: any, primKey, obj, transaction) => {
        if (Object.keys(mods).length === 1 && mods.hasOwnProperty('synced')) {
          return undefined;
        }

        const updates: any = {};
        if (!mods.hasOwnProperty('updatedAt')) {
          updates.updatedAt = Date.now();
        }
        if (!mods.hasOwnProperty('synced')) {
          updates.synced = 0;
        }

        return { ...mods, ...updates };
      });
    });
  }
}

export const db = new RepairDB();

export async function initializeData() {
  const adminExists = await db.users.where('role').equals('Admin').count();
  if (adminExists === 0) {
    console.log('System: Creating default Admin user.');
    await db.users.add({
      username: 'admin',
      fullName: 'Administrador Local',
      role: 'Admin',
      active: true,
      password: '123'
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
