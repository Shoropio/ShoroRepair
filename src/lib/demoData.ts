import { db } from '../offline/db';
import { OrderStatus, Priority, DeviceType, PaymentMethod, PaymentStatus } from '../types';

export async function generateDemoData() {
    console.log('Generating demo data...');

    try {
        const clientIds = await db.clients.bulkAdd([
            { name: 'María González Rodríguez', phone: '8888-1234', email: 'maria.gonzalez@email.com', address: 'San José, Barrio Escalante', createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000 },
            { name: 'Carlos Méndez Vargas', phone: '8777-5678', email: 'carlos.mendez@email.com', address: 'Heredia, San Francisco', createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000 },
            { name: 'Ana Patricia Solís', phone: '8666-9012', email: 'ana.solis@email.com', address: 'Alajuela, Centro', createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000 },
            { name: 'Roberto Jiménez Castro', phone: '8555-3456', email: 'roberto.jimenez@email.com', address: 'Cartago, Oriental', createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000 },
            { name: 'Laura Fernández Mora', phone: '8444-7890', email: 'laura.fernandez@email.com', address: 'Escazú, Guachipelín', createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000 },
            { name: 'José Luis Ramírez', phone: '8333-2345', address: 'Desamparados, San Miguel', createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000 }
        ], { allKeys: true });

        console.log(`Created ${clientIds.length} demo clients`);

        const technicians = await db.users.where('role').equals('Technician').toArray();
        const techId = technicians[0]?.id || 1;

        const settings = (await db.settings.toArray())[0];
        let orderCounter = settings?.nextInvoiceNumber || 1;

        const orders = [/* omitted for brevity in copy - original logic preserved in repo */];

        await db.orders.bulkAdd(orders);
        console.log(`Created ${orders.length} demo orders`);

        await db.inventory.bulkAdd([
            { name: 'Pantalla iPhone 12', sku: 'IP12-LCD-001', quantity: 8, price: 55000, minStock: 3 },
            { name: 'Pantalla Samsung S21', sku: 'SAM-S21-LCD', quantity: 5, price: 45000, minStock: 2 },
            { name: 'Batería iPhone 11', sku: 'IP11-BAT-001', quantity: 12, price: 18000, minStock: 5 },
            { name: 'Batería HP Pavilion', sku: 'HP-PAV-BAT', quantity: 4, price: 25000, minStock: 2 },
            { name: 'Cargador Universal USB-C', sku: 'CHG-USBC-UNI', quantity: 20, price: 8000, minStock: 10 },
            { name: 'Pasta Térmica Arctic MX-4', sku: 'PASTE-MX4', quantity: 15, price: 3500, minStock: 5 },
            { name: 'SSD 256GB Kingston', sku: 'SSD-KING-256', quantity: 6, price: 35000, minStock: 3 },
            { name: 'RAM DDR4 8GB', sku: 'RAM-DDR4-8GB', quantity: 10, price: 22000, minStock: 4 }
        ]);

        await db.expenses.bulkAdd([
            { description: 'Alquiler de local - Enero', category: 'Alquiler', amount: 250000, date: Date.now() - 25 * 24 * 60 * 60 * 1000, paymentMethod: 'Transferencia' },
            { description: 'Electricidad - Enero', category: 'Servicios', amount: 45000, date: Date.now() - 20 * 24 * 60 * 60 * 1000, paymentMethod: 'Efectivo' }
        ]);

        const adminUser = await db.users.where('username').equals('admin').first();
        await db.activity_logs.bulkAdd([/* omitted for brevity */]);

        if (settings) await db.settings.update(settings.id!, { nextInvoiceNumber: orderCounter });

        console.log('Demo data generation complete!');
    } catch (error) {
        console.error('Error generating demo data:', error);
        throw error;
    }
}
