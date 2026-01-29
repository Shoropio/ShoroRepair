// Script para implementar traducciones automáticamente
// Este archivo documenta los cambios necesarios en cada módulo

/**
 * DASHBOARD.TSX - Cambios necesarios
 */
// Línea 48: "Cargando tablero..." → {t('common.loading')}
// Línea 54: "Bienvenido" → {t('dashboard.welcome')}
// Línea 62: "Órdenes Activas" → {t('dashboard.stats.active_orders')}
// Línea 70: "Pendientes" → {t('dashboard.stats.pending')}
// Línea 78: "Para Entrega" → {t('dashboard.stats.delivered_today')}
// Línea 86: "Recaudación" → {t('dashboard.stats.revenue_month')}
// Línea 95: "Estado del Taller" → {t('dashboard.workshop_status')}
// Línea 115: "Ingresos Recientes" → {t('dashboard.recent_entries')}
// Línea 116: "Ver todos" → {t('dashboard.view_all')}
// Línea 117: "Nueva Orden" → {t('dashboard.new_order')}
// Línea 143: "Mantén tu flujo productivo" → {t('dashboard.productivity_tip')}
// Línea 144: "Recuerda actualizar..." → {t('dashboard.inventory_reminder')}
// Línea 145: "Ir al inventario" → {t('dashboard.go_to_inventory')}

/**
 * ACTIVITY.TSX - Cambios necesarios
 */
// Ya tiene useTranslation importado
// Línea 60: "Registro de actividad" → {t('activity.title')}
// Línea 63: "Últimas 100 acciones del sistema" → {t('activity.subtitle')}
// Línea 79: "Todas", "Órdenes", etc. → {t('activity.filters.all')}, etc.
// Línea 89: "Sin actividad registrada" → {t('activity.empty')}
// Línea 90: "Las acciones del sistema aparecerán aquí" → {t('activity.empty_subtitle')}

/**
 * CLIENTS.TSX - Necesita implementación completa
 */
// Importar: import { useTranslation } from 'react-i18next';
// Agregar: const { t } = useTranslation();
// Títulos, botones, campos de formulario, mensajes

/**
 * INVENTORY.TSX - Necesita implementación completa
 */
// Importar: import { useTranslation } from 'react-i18next';
// Agregar: const { t } = useTranslation();
// Títulos, alertas de stock, campos

/**
 * USERS.TSX - Necesita implementación completa
 */
// Importar: import { useTranslation } from 'react-i18next';
// Agregar: const { t } = useTranslation();
// Roles, estados, campos de formulario

/**
 * SETTINGS.TSX - Necesita implementación completa
 */
// Importar: import { useTranslation } from 'react-i18next';
// Agregar: const { t } = useTranslation();
// Todas las secciones, campos, advertencias

/**
 * LOGIN.TSX - Necesita implementación completa
 */
// Importar: import { useTranslation } from 'react-i18next';
// Agregar: const { t } = useTranslation();
// Formulario, mensajes de error

/**
 * ORDERS.TSX - Parcialmente implementado
 */
// Ya tiene useTranslation
// Necesita reemplazar textos hardcodeados por claves

/**
 * EXPENSES.TSX - Necesita implementación completa
 */
// Importar: import { useTranslation } from 'react-i18next';
// Agregar: const { t } = useTranslation();
// Categorías, métodos de pago, campos

/**
 * ROLES.TSX - Necesita implementación completa
 */
// Importar: import { useTranslation } from 'react-i18next';
// Agregar: const { t } = useTranslation();
// Permisos, roles, botones

export const TRANSLATION_MAPPINGS = {
    dashboard: {
        'Cargando tablero...': 'common.loading',
        'Bienvenido': 'dashboard.welcome',
        'Órdenes Activas': 'dashboard.stats.active_orders',
        'Pendientes': 'dashboard.stats.pending',
        'Para Entrega': 'dashboard.stats.delivered_today',
        'Recaudación': 'dashboard.stats.revenue_month',
        'Estado del Taller': 'dashboard.workshop_status',
        'Ingresos Recientes': 'dashboard.recent_entries',
        'Ver todos': 'dashboard.view_all',
        'Nueva Orden': 'dashboard.new_order',
        'Mantén tu flujo productivo': 'dashboard.productivity_tip',
        'Ir al inventario': 'dashboard.go_to_inventory'
    },
    common: {
        'Guardar': 'common.save',
        'Cancelar': 'common.cancel',
        'Eliminar': 'common.delete',
        'Editar': 'common.edit',
        'Acciones': 'common.actions',
        'Buscar...': 'common.search',
        'Cargando...': 'common.loading',
        'Descargar': 'common.download',
        'Imprimir': 'common.print',
        'Actualizar': 'common.update',
        'Volver': 'common.back',
        'Siguiente': 'common.next',
        'Finalizar': 'common.finish'
    },
    orders: {
        'Centro de órdenes': 'orders.title',
        'Nueva Recepción': 'orders.new',
        'Formalizar Ingreso': 'orders.formalize',
        'Actualizar Expediente': 'orders.update_record',
        'Eliminar Orden': 'orders.delete_order',
        'Workbench': 'orders.workbench',
        'Cliente': 'orders.fields.client',
        'Seleccionar cliente': 'orders.fields.select_client',
        'Tipo de dispositivo': 'orders.fields.device_type',
        'Marca': 'orders.fields.brand',
        'Modelo': 'orders.fields.model',
        'Serial / IMEI': 'orders.fields.serial',
        'Descripción del problema': 'orders.fields.issue',
        'Accesorios incluidos': 'orders.fields.accessories',
        'Evidencia fotográfica': 'orders.fields.photos',
        'Agregar fotos': 'orders.fields.add_photos',
        'Sin fotos registradas': 'orders.fields.no_photos',
        'Técnico asignado': 'orders.fields.assigned_tech',
        'Seleccionar técnico': 'orders.fields.select_tech',
        'Diagnóstico técnico': 'orders.fields.diagnosis',
        'Repuestos utilizados': 'orders.fields.parts',
        'Agregar repuesto': 'orders.fields.add_part',
        'Seleccionar repuesto': 'orders.fields.select_part',
        'No se han agregado repuestos': 'orders.fields.no_parts',
        'Mano de obra': 'orders.fields.labor_cost',
        'Costo de repuestos': 'orders.fields.parts_cost',
        'Total final': 'orders.fields.final_total',
        'Notificar por WhatsApp': 'orders.notify_whatsapp',
        'Recibido': 'orders.status.received',
        'Diagnóstico': 'orders.status.diagnostic',
        'En reparación': 'orders.status.in_repair',
        'Listo': 'orders.status.ready',
        'Entregado': 'orders.status.delivered',
        'Cancelado': 'orders.status.cancelled'
    }
};
