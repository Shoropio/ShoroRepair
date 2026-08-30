import { db } from './db';
import { hashPassword } from '../lib/crypto';
import { Client, ServiceOrder, Part, AppUser, Expense, OrderPart, OrderLog } from '../types/models';
import { OrderStatus, Priority, DeviceType, PaymentMethod, PaymentStatus } from '../types/enums';

interface SeedOptions {
    force?: boolean;
    counts?: { clients?: number; parts?: number; orders?: number; expenses?: number };
}

export interface DemoSeedResult {
    loaded: boolean;
    summary: string;
}

const DEFAULT_COUNTS = { clients: 300, parts: 150, orders: 800, expenses: 250 };

const FIRST_NAMES = ['María', 'Carlos', 'Lucía', 'Jorge', 'Ana', 'Pedro', 'Sofía', 'Diego', 'Juan', 'Laura', 'Andrés', 'Paula', 'Miguel', 'Camila', 'Luis', 'Valentina', 'José', 'Daniela', 'Fernando', 'Gabriela', 'Ricardo', 'Mariana', 'Tomás', 'Isabella', 'Sebastián', 'Antonella', 'Mateo', 'Emma', 'Nicolás', 'Olivia'];
const LAST_NAMES = ['González', 'Ramírez', 'Fernández', 'Méndez', 'Torres', 'Sánchez', 'Castro', 'Morales', 'López', 'Hernández', 'Pérez', 'García', 'Rodríguez', 'Martínez', 'Vargas', 'Jiménez', 'Ruiz', 'Díaz', 'Álvarez', 'Romero', 'Silva', 'Navarro', 'Vega', 'Cruz'];

const DEVICE_POOLS: Record<DeviceType, { brands: string[]; models: string[]; issues: string[] }> = {
    [DeviceType.PHONE]: {
        brands: ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Motorola', 'OnePlus'],
        models: ['iPhone 11', 'iPhone 12', 'Galaxy S21', 'Redmi Note 10', 'P30 Pro', 'Moto G60', 'OnePlus 9'],
        issues: ['Pantalla rota', 'No enciende', 'Batería falla', 'Cámara borrosa', 'No carga', 'Altavoz malo', 'Botón roto']
    },
    [DeviceType.APPLIANCE]: {
        brands: ['LG', 'Samsung', 'Black+Decker', 'Mabe', 'Whirlpool', 'Panasonic'],
        models: ['Nevera 12ft', 'Lavadora 15kg', 'Arrocera 3L', 'Microondas 20L', 'Licuadora', 'Estufa 4 quemadores'],
        issues: ['No enfría', 'No calienta', 'No gira', 'No enciende', 'Fuga de agua', 'Ruido extraño']
    },
    [DeviceType.COMPUTER]: {
        brands: ['HP', 'Dell', 'Lenovo', 'Acer', 'Asus', 'MSI'],
        models: ['Pavilion 15', 'Inspiron 14', 'ThinkPad T14', 'Aspire 5', 'ZenBook', 'GF63'],
        issues: ['No prende', 'Pantalla azul', 'Lentitud / virus', 'Teclado no responde', 'No reconoce disco', 'Ventilador ruidoso']
    },
    [DeviceType.ELECTRONICS]: {
        brands: ['Sony', 'JBL', 'LG', 'Samsung', 'Bose', 'Philips'],
        models: ['TV 42"', 'Bocina Flip', 'Soundbar 2.1', 'Auriculares WH', 'Consola X', 'Cámara 4K'],
        issues: ['Sin imagen', 'No carga', 'Sin sonido', 'No enciende', 'Botones pegados', 'Lente sucio']
    },
    [DeviceType.OTHER]: {
        brands: ['Genérico', 'Variado', 'Marca Blanca'],
        models: ['Dispositivo variado', 'Accesorio', 'Kit reparación'],
        issues: ['Falla general', 'No funciona', 'Revisión técnica']
    }
};

const ALL_DEVICE_TYPES = Object.values(DeviceType);
const PART_NAMES = ['Pantalla', 'Batería', 'Cristal templado', 'Conector de carga', 'Flex de botón', 'Cámara trasera', 'Altavoz', 'Micrófono', 'Táctil', 'Placa base', 'Cable flex', 'Ventilador', 'Fuente de poder', 'Memoria RAM', 'Disco SSD', 'Bisel', 'Marco', 'Puerto USB', 'Cargador', 'Sensor'];
const PART_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Genérica', 'LG', 'HP', 'Universal'];
const EXPENSE_CATEGORIES = ['Compra de Repuestos', 'Alquiler', 'Servicios Públicos', 'Salarios', 'Marketing', 'Transporte', 'Otros', 'Herramientas', 'Licencias'];
const STATUSES = Object.values(OrderStatus);
const PRIORITIES = Object.values(Priority);
const PAYMENTS = Object.values(PaymentMethod);

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Injects a large, interrelated demo dataset so pagination, reports and the
 * whole UI can be exercised for bugs. Idempotent via a localStorage flag;
 * pass { force: true } to wipe the demo tables and regenerate.
 */
export async function seedDemoData(opts: SeedOptions = {}): Promise<DemoSeedResult> {
    const FLAG = 'shororepair_demo_loaded';
    const counts = { ...DEFAULT_COUNTS, ...(opts.counts ?? {}) };

    if (!opts.force && localStorage.getItem(FLAG)) {
        return {
            loaded: false,
            summary: 'Los datos de demostración ya existen en la base local. Para regenerarlos usa seedDemoData({ force: true }) desde la consola.'
        };
    }

    if (opts.force) {
        await Promise.all([
            db.clients.clear(),
            db.orders.clear(),
            db.inventory.clear(),
            db.expenses.clear()
        ]);
    }

    const now = Date.now();
    const day = 86400000;

    // Users (technicians + receptionist)
    const techSpecs: Omit<AppUser, 'id'>[] = [
        { username: 'tecnico1', fullName: 'Roberto Aguilar', email: 'roberto@shororepair.com', role: 'Technician', active: true, mustChangePassword: true },
        { username: 'tecnico2', fullName: 'Elena Vásquez', email: 'elena@shororepair.com', role: 'Technician', active: true, mustChangePassword: true },
        { username: 'tecnico3', fullName: 'Marcos Pineda', email: 'marcos@shororepair.com', role: 'Technician', active: true, mustChangePassword: true },
        { username: 'recepcion1', fullName: 'Carmen Jiménez', email: 'carmen@shororepair.com', role: 'Receptionist', active: true, mustChangePassword: true }
    ];
    const techIds: number[] = [];
    for (const u of techSpecs) techIds.push(await db.users.add({ ...u, password: await hashPassword('123') }));

    // Clients
    const clients: Client[] = [];
    for (let i = 0; i < counts.clients; i++) {
        const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        clients.push({
            name,
            phone: `8888-${String(randInt(1000, 9999))}`,
            email: `cliente${i + 1}@demo.com`,
            address: `Calle ${randInt(1, 200)} #${randInt(1, 99)}`,
            taxId: i % 4 === 0 ? `CPF-${1000 + i}` : undefined,
            createdAt: now - randInt(1, 200) * day
        });
    }
    const clientIds: number[] = [];
    for (const c of clients) clientIds.push(await db.clients.add(c));

    // Inventory
    const parts: Part[] = [];
    for (let i = 0; i < counts.parts; i++) {
        const brand = pick(PART_BRANDS);
        const qty = randInt(0, 40);
        const minStock = randInt(2, 12);
        parts.push({
            name: `${brand} ${pick(PART_NAMES)}`,
            sku: `P-${String(i + 1).padStart(4, '0')}`,
            quantity: qty,
            price: randInt(5, 200),
            minStock
        });
    }
    const partIds: number[] = [];
    for (const p of parts) partIds.push(await db.inventory.add(p));

    // Orders
    let invoiceSeq = 1;
    for (let i = 0; i < counts.orders; i++) {
        const deviceType = pick(ALL_DEVICE_TYPES);
        const pool = DEVICE_POOLS[deviceType];
        const brand = pick(pool.brands);
        const model = pick(pool.models);
        const status = pick(STATUSES);
        const priority = pick(PRIORITIES);
        const techId = Math.random() < 0.85 ? pick(techIds) : undefined;

        const partCount = randInt(0, 3);
        const orderParts: OrderPart[] = [];
        for (let p = 0; p < partCount; p++) {
            const idx = randInt(0, parts.length - 1);
            orderParts.push({
                partId: partIds[idx],
                name: parts[idx].name,
                quantity: randInt(1, 3),
                price: parts[idx].price
            });
        }
        const partsTotal = orderParts.reduce((acc, p) => acc + p.price * p.quantity, 0);
        const laborCost = randInt(15, 120);
        const taxRate = 13;
        const subtotal = laborCost + partsTotal;
        const total = +(subtotal + subtotal * (taxRate / 100)).toFixed(2);

        const daysAgo = randInt(0, 150);
        const createdAt = now - daysAgo * day;

        const isPaid = status === OrderStatus.DELIVERED || status === OrderStatus.READY || Math.random() < 0.4;
        const paymentStatus = isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING;
        const invoiceNumber = paymentStatus === PaymentStatus.PAID ? `FAC-${String(invoiceSeq++).padStart(4, '0')}` : undefined;

        const logs: OrderLog[] = [
            { timestamp: createdAt, status: OrderStatus.RECEIVED, technicianId: techId, note: 'Orden ingresada' }
        ];
        if (status === OrderStatus.READY) logs.push({ timestamp: createdAt + day, status: OrderStatus.READY, technicianId: techId, note: 'Reparación finalizada' });
        if (status === OrderStatus.DELIVERED) logs.push({ timestamp: createdAt + 2 * day, status: OrderStatus.DELIVERED, technicianId: techId, note: 'Entregado al cliente' });
        if (status === OrderStatus.CANCELLED) logs.push({ timestamp: createdAt + day, status: OrderStatus.CANCELLED, technicianId: techId, note: 'Cancelado por cliente' });

        const order: ServiceOrder = {
            orderNumber: `ORD-${String(i + 1).padStart(5, '0')}`,
            clientId: pick(clientIds),
            deviceType,
            brand,
            model,
            issueDescription: pick(pool.issues),
            status,
            priority,
            technicianId: techId,
            laborCost,
            parts: orderParts,
            taxRate,
            total,
            paymentMethod: pick(PAYMENTS),
            paymentStatus,
            invoiceNumber,
            createdAt,
            updatedAt: createdAt,
            warrantyDays: 90,
            warrantyExpiration: createdAt + 90 * day
        };
        await db.orders.add(order);
    }

    // Expenses
    for (let i = 0; i < counts.expenses; i++) {
        const e: Expense = {
            description: `${pick(EXPENSE_CATEGORIES)} #${i + 1}`,
            category: pick(EXPENSE_CATEGORIES),
            amount: Number((randInt(20, 800) + Math.random()).toFixed(2)),
            date: now - randInt(0, 180) * day,
            paymentMethod: pick(PAYMENTS)
        };
        await db.expenses.add(e);
    }

    localStorage.setItem(FLAG, '1');
    return {
        loaded: true,
        summary: `Clientes: ${counts.clients} · Órdenes: ${counts.orders} · Repuestos: ${counts.parts} · Gastos: ${counts.expenses}`
    };
}

if (import.meta.env.DEV) {
    (window as unknown as { seedDemoData?: typeof seedDemoData }).seedDemoData = seedDemoData;
}
