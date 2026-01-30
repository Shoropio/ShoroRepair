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

export type UserRole = 'Admin' | 'Technician' | 'Receptionist';
