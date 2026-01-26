import { db } from './db';
import { OrderStatus, Priority, DeviceType, PaymentMethod, PaymentStatus } from './types';

/**
 * Generates realistic demo data for testing the application
 */
export async function generateDemoData() {
    console.log('Generating demo data...');

    // Check if data already exists (optional: could ask user or just append)
    console.log('Adding demo data set to existing records...');

    try {
        // 1. Create Demo Clients
        const clientIds = await db.clients.bulkAdd([
            {
                name: 'María González Rodríguez',
                phone: '8888-1234',
                email: 'maria.gonzalez@email.com',
                address: 'San José, Barrio Escalante',
                createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000
            },
            {
                name: 'Carlos Méndez Vargas',
                phone: '8777-5678',
                email: 'carlos.mendez@email.com',
                address: 'Heredia, San Francisco',
                createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000
            },
            {
                name: 'Ana Patricia Solís',
                phone: '8666-9012',
                email: 'ana.solis@email.com',
                address: 'Alajuela, Centro',
                createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000
            },
            {
                name: 'Roberto Jiménez Castro',
                phone: '8555-3456',
                email: 'roberto.jimenez@email.com',
                address: 'Cartago, Oriental',
                createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
            },
            {
                name: 'Laura Fernández Mora',
                phone: '8444-7890',
                email: 'laura.fernandez@email.com',
                address: 'Escazú, Guachipelín',
                createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000
            },
            {
                name: 'José Luis Ramírez',
                phone: '8333-2345',
                address: 'Desamparados, San Miguel',
                createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000
            }
        ], { allKeys: true });

        console.log(`Created ${clientIds.length} demo clients`);

        // 2. Get technician IDs
        const technicians = await db.users.where('role').equals('Technician').toArray();
        const techId = technicians[0]?.id || 1;

        // 3. Create Demo Orders
        const settings = (await db.settings.toArray())[0];
        let orderCounter = settings?.nextInvoiceNumber || 1;

        const orders = [
            {
                orderNumber: `OS-${Date.now().toString().slice(-6)}-001`,
                clientId: clientIds[0],
                deviceType: DeviceType.PHONE,
                brand: 'Samsung',
                model: 'Galaxy S21',
                serialNumber: 'SM-G991B-123456',
                issueDescription: 'Pantalla rota, no responde al tacto',
                technicalDiagnosis: 'Reemplazo de digitalizador y LCD',
                status: OrderStatus.DELIVERED,
                priority: Priority.HIGH,
                technicianId: techId,
                notes: 'Cliente solicita garantía extendida',
                laborCost: 15000,
                parts: [
                    { partId: 1, name: 'Pantalla Samsung S21', quantity: 1, price: 45000 }
                ],
                taxRate: 13,
                total: 67800,
                paymentMethod: PaymentMethod.CARD,
                paymentStatus: PaymentStatus.PAID,
                customerApproved: true,
                invoiceNumber: `FAC-${String(orderCounter++).padStart(5, '0')}`,
                warrantyDays: 90,
                warrantyExpiration: Date.now() + 90 * 24 * 60 * 60 * 1000,
                createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
                logs: [
                    { timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000, status: OrderStatus.RECEIVED, note: 'Orden recibida' },
                    { timestamp: Date.now() - 19 * 24 * 60 * 60 * 1000, status: OrderStatus.DIAGNOSTIC, technicianId: techId },
                    { timestamp: Date.now() - 18 * 24 * 60 * 60 * 1000, status: OrderStatus.IN_REPAIR, technicianId: techId },
                    { timestamp: Date.now() - 17 * 24 * 60 * 60 * 1000, status: OrderStatus.READY },
                    { timestamp: Date.now() - 16 * 24 * 60 * 60 * 1000, status: OrderStatus.DELIVERED }
                ]
            },
            {
                orderNumber: `OS-${Date.now().toString().slice(-6)}-002`,
                clientId: clientIds[1],
                deviceType: DeviceType.APPLIANCE,
                brand: 'LG',
                model: 'Refrigerador InstaView',
                serialNumber: 'LG-REF-789012',
                issueDescription: 'No enfría correctamente, hace ruido extraño',
                technicalDiagnosis: 'Compresor defectuoso, requiere reemplazo',
                status: OrderStatus.AWAITING_PARTS,
                priority: Priority.URGENT,
                technicianId: techId,
                notes: 'Repuesto en pedido, llegada estimada 5 días',
                laborCost: 35000,
                parts: [],
                taxRate: 13,
                total: 39550,
                paymentMethod: PaymentMethod.TRANSFER,
                paymentStatus: PaymentStatus.PENDING,
                customerApproved: true,
                warrantyDays: 180,
                createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
                logs: [
                    { timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, status: OrderStatus.RECEIVED },
                    { timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, status: OrderStatus.DIAGNOSTIC, technicianId: techId },
                    { timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, status: OrderStatus.AWAITING_PARTS, note: 'Esperando compresor' }
                ]
            },
            {
                orderNumber: `OS-${Date.now().toString().slice(-6)}-003`,
                clientId: clientIds[2],
                deviceType: DeviceType.COMPUTER,
                brand: 'HP',
                model: 'Pavilion 15',
                serialNumber: 'HP-PAV-345678',
                issueDescription: 'No enciende, luz de carga parpadea',
                technicalDiagnosis: 'Batería agotada y adaptador defectuoso',
                status: OrderStatus.IN_REPAIR,
                priority: Priority.MEDIUM,
                technicianId: techId,
                notes: 'Cliente pregunta por actualización de RAM',
                laborCost: 8000,
                parts: [
                    { partId: 2, name: 'Batería HP Pavilion', quantity: 1, price: 25000 }
                ],
                taxRate: 13,
                total: 37290,
                paymentMethod: PaymentMethod.CASH,
                paymentStatus: PaymentStatus.PENDING,
                customerApproved: true,
                warrantyDays: 60,
                createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
                logs: [
                    { timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, status: OrderStatus.RECEIVED },
                    { timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, status: OrderStatus.DIAGNOSTIC, technicianId: techId },
                    { timestamp: Date.now() - 12 * 60 * 60 * 1000, status: OrderStatus.IN_REPAIR, technicianId: techId }
                ]
            },
            {
                orderNumber: `OS-${Date.now().toString().slice(-6)}-004`,
                clientId: clientIds[3],
                deviceType: DeviceType.PHONE,
                brand: 'iPhone',
                model: '13 Pro Max',
                serialNumber: 'IPHONE-901234',
                issueDescription: 'Batería se descarga muy rápido',
                status: OrderStatus.DIAGNOSTIC,
                priority: Priority.LOW,
                technicianId: techId,
                notes: '',
                laborCost: 0,
                parts: [],
                taxRate: 13,
                total: 0,
                paymentMethod: PaymentMethod.CASH,
                paymentStatus: PaymentStatus.PENDING,
                customerApproved: false,
                createdAt: Date.now() - 6 * 60 * 60 * 1000,
                logs: [
                    { timestamp: Date.now() - 6 * 60 * 60 * 1000, status: OrderStatus.RECEIVED },
                    { timestamp: Date.now() - 4 * 60 * 60 * 1000, status: OrderStatus.DIAGNOSTIC, technicianId: techId }
                ]
            },
            {
                orderNumber: `OS-${Date.now().toString().slice(-6)}-005`,
                clientId: clientIds[4],
                deviceType: DeviceType.ELECTRONICS,
                brand: 'Sony',
                model: 'PlayStation 5',
                serialNumber: 'PS5-567890',
                issueDescription: 'No lee discos, error CE-108255-1',
                status: OrderStatus.RECEIVED,
                priority: Priority.MEDIUM,
                notes: 'Cliente menciona que cayó líquido',
                laborCost: 0,
                parts: [],
                taxRate: 13,
                total: 0,
                paymentMethod: PaymentMethod.CASH,
                paymentStatus: PaymentStatus.PENDING,
                customerApproved: false,
                createdAt: Date.now() - 2 * 60 * 60 * 1000,
                logs: [
                    { timestamp: Date.now() - 2 * 60 * 60 * 1000, status: OrderStatus.RECEIVED }
                ]
            }
        ];

        await db.orders.bulkAdd(orders);
        console.log(`Created ${orders.length} demo orders`);

        // 4. Create Demo Inventory Items
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
        console.log('Created demo inventory items');

        // 5. Create Demo Expenses
        await db.expenses.bulkAdd([
            {
                description: 'Alquiler de local - Enero',
                category: 'Alquiler',
                amount: 250000,
                date: Date.now() - 25 * 24 * 60 * 60 * 1000,
                paymentMethod: 'Transferencia'
            },
            {
                description: 'Electricidad - Enero',
                category: 'Servicios',
                amount: 45000,
                date: Date.now() - 20 * 24 * 60 * 60 * 1000,
                paymentMethod: 'Efectivo'
            },
            {
                description: 'Compra de herramientas especializadas',
                category: 'Equipo',
                amount: 85000,
                date: Date.now() - 15 * 24 * 60 * 60 * 1000,
                paymentMethod: 'Tarjeta'
            },
            {
                description: 'Internet y telefonía',
                category: 'Servicios',
                amount: 28000,
                date: Date.now() - 10 * 24 * 60 * 60 * 1000,
                paymentMethod: 'Transferencia'
            },
            {
                description: 'Publicidad en redes sociales',
                category: 'Marketing',
                amount: 35000,
                date: Date.now() - 5 * 24 * 60 * 60 * 1000,
                paymentMethod: 'Tarjeta'
            }
        ]);
        console.log('Created demo expenses');

        // 6. Create Activity Logs
        const adminUser = await db.users.where('username').equals('admin').first();
        await db.activity_logs.bulkAdd([
            {
                userId: adminUser?.id,
                userName: 'Administrador Principal',
                action: 'Creó una nueva orden de servicio',
                entity: 'order',
                entityId: orders[0].orderNumber,
                details: `${orders[0].brand} ${orders[0].model} - ${orders[0].issueDescription}`,
                timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000
            },
            {
                userId: adminUser?.id,
                userName: 'Administrador Principal',
                action: 'Agregó un nuevo cliente',
                entity: 'client',
                details: clientIds[0] ? 'María González Rodríguez' : '',
                timestamp: Date.now() - 90 * 24 * 60 * 60 * 1000
            },
            {
                userId: techId,
                userName: 'Juan Pérez',
                action: 'Actualizó estado de orden a "En Reparación"',
                entity: 'order',
                entityId: orders[2].orderNumber,
                timestamp: Date.now() - 12 * 60 * 60 * 1000
            },
            {
                userId: adminUser?.id,
                userName: 'Administrador Principal',
                action: 'Agregó repuesto al inventario',
                entity: 'inventory',
                details: 'Pantalla iPhone 12 - 8 unidades',
                timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000
            },
            {
                userId: adminUser?.id,
                userName: 'Administrador Principal',
                action: 'Registró un nuevo gasto',
                entity: 'expense',
                details: 'Alquiler de local - ₡250,000',
                timestamp: Date.now() - 25 * 24 * 60 * 60 * 1000
            }
        ]);
        console.log('Created demo activity logs');

        // Update invoice counter
        if (settings) {
            await db.settings.update(settings.id!, { nextInvoiceNumber: orderCounter });
        }

        console.log('Demo data generation complete!');
        console.log('Summary:');
        console.log(`   - ${clientIds.length} Clients`);
        console.log(`   - ${orders.length} Orders`);
        console.log(`   - 8 Inventory Items`);
        console.log(`   - 5 Expenses`);
        console.log(`   - 5 Activity Logs`);

    } catch (error) {
        console.error('Error generating demo data:', error);
        throw error;
    }
}
