# 🏗️ Arquitectura de ShoroRepair

ShoroRepair Lite sigue una arquitectura modular y escalable diseñada para aplicaciones **Offline-First** y multiplataforma (con una sola base de código web/PWA).

## 📁 Estructura del Proyecto

### `src/` - Núcleo de la Aplicación
- `app/`: Contiene el componente principal `App.tsx` y la configuración global de navegación.
- `components/`: UI kits organizados por categoría:
  - `ui/`: Componentes básicos reutilizables (Badge, Button, Card, Input).
  - `shared/`: Componentes compartidos con lógica de negocio.
  - `layout/`: Componentes de estructura de página.
- `contexts/`: Proveedores de contexto de React (Auth, Theme, etc.).
- `features/`: Módulos de la aplicación organizados por dominio funcional (Orders, Clients, Inventory). Cada archivo es una página independiente.
- `firebase/`: Capa de infraestructura para los servicios de Google Firebase, modularizada para facilitar el tree-shaking.
- `hooks/`: Ganchos de React personalizados para lógica reutilizable.
- `lib/`: Librerías de terceros configuradas y utilidades genéricas.
- `offline/`: Lógica para el funcionamiento sin conexión:
  - `db.ts`: Esquema y configuración de Dexie/IndexedDB.
  - `sync.ts`: Manager de sincronización con la nube.
  - `conflict.ts`: Resolución de conflictos y limpieza de duplicados.
- `services/`: Fachadas que encapsulan la lógica de comunicación con APIs y servicios externos.
- `styles/`: Estilos globales y temas de Tailwind CSS.
- `types/`: Definiciones de TypeScript organizadas en enums, modelos y tipos de autenticación.

## 🛠️ Tecnologías Principales
- **React 19**: Framework de interfaz de usuario.
- **Vite**: Herramienta de construcción y servidor de desarrollo.
- **Tailwind CSS v4**: Motor de estilos y diseño adaptable.
- **Dexie.js**: Wrapper de IndexedDB para almacenamiento local persistente.
- **vite-plugin-pwa**: Genera la Progressive Web App instalable (manifest + service worker).
- **Firebase**: Autenticación con Google, Firestore para sincronización en la nube y Storage para respaldos.

## 🔄 Flujo de Sincronización
La aplicación sigue un enfoque **Offline-First**. Todos los datos se guardan primero en la base de datos local y el `SyncManager` se encarga de enviarlos a la nube cuando hay conexión disponible, manejando automáticamente fallos de red y conflictos de datos.
