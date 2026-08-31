# 🛠️ ShoroRepair Lite

**Sistema de Gestión Profesional para Talleres de Reparación**

ShoroRepair es una solución integral todo-en-uno diseñada para laboratorios técnicos, servicios de reparación y talleres electrónicos. Combina un diseño premium geométrico con una arquitectura robusta capaz de funcionar **Offline-First**.

---

## 🚀 Características Principales

### 🔬 Gestión de Taller (Core)

* **Mesa de Trabajo Digital**: Control total del ciclo de vida de la reparación (Recibido → Diagnóstico → Reparación → Entrega).
* **Ingresos Rápidos**: Wizard optimizado para recepciones en menos de 30 segundos.
* **Bitácora Técnica**: Historial inmutable de cambios, notas técnicas y asignaciones.
* **Evidencia Multimedia**: Adjunta fotos de antes/después directamente a la orden.

### 💰 Facturación y Finanzas

* **Facturación PDF**: Generación automática de comprobantes profesionales con QR y términos legales.
* **Control de Gastos**: Registro de egresos operativos (Alquiler, Suministros, Salarios).
* **Reportes Financieros**: Análisis de rentabilidad, ticket promedio y productividad técnica.

### 📦 Inventario Inteligente

* **Stock en Tiempo Real**: Descuento automático de repuestos al finalizar órdenes.
* **Alertas de Stock**: Indicadores visuales y notificaciones para reabastecimiento.
* **Gestión de SKU**: Soporte para códigos de barras y categorización.

### ☁️ Sincronización en la Nube (Cloud Sync)

* **Modo Offline**: Funciona 100% sin internet usando base de datos local (IndexedDB/Dexie).
* **Google Login**: Inicio de sesión seguro con tu cuenta de Google para sincronizar entre dispositivos.
* **Firebase/Firestore**: Sincronización automática de tus datos (clientes, órdenes, inventario, gastos) entre dispositivos, con cada usuario aislado en su propio espacio (`users_data/{userId}`).
* **Instalable (PWA)**: Se instala como una app desde el navegador, sin tiendas ni instaladores.

---

## 💻 Guía de Implementación

### Requisitos Previos

* Node.js v18+
* NPM o Yarn

### 1. Instalación

Clona el repositorio e instala las dependencias:

```bash
git clone https://github.com/Shoropio/ShoroRepair.git
cd shororepair
npm install
```

### 2. Configuración de entorno

El archivo `.env` contiene credenciales locales y no debe subirse al repositorio. Usa `.env.example` como plantilla:

```bash
cp .env.example .env
```

Completa `.env` con la configuración de Firebase Web SDK de tu proyecto:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Después de cambiar `.env`, reinicia el servidor de desarrollo para que Vite cargue las variables.

### 3. Desarrollo Web (Local)

Para iniciar el servidor de desarrollo en el navegador:

```bash
npm run dev
```

Accede a `http://localhost:3000`. El sistema detectará que es una instalación nueva y lanzará el **Setup Wizard**.

Credenciales de administrador por defecto para entorno local (solo en instalación automática):

```text
Usuario: admin
Contraseña: 123
```

> ⚠️ Por seguridad, la contraseña del administrador por defecto está **hasheada (PBKDF2)** y el sistema **obliga a cambiarla** en el primer inicio de sesión. Las contraseñas y los secretos (API keys, tokens) se almacenan cifrados en el dispositivo; nunca en texto plano.

### 4. Build para Producción (Web)

Genera los archivos estáticos optimizados en la carpeta `dist/`:

```bash
npm run build
```

---

## 📲 Instalación como App (PWA)

ShoroRepair es una **Progressive Web App (PWA)**: se instala como una app nativa directamente desde el navegador, sin pasar por tiendas ni instalar paquetes.

1. Abre la app en Chrome o Edge.
2. Haz clic en el ícono de **instalar** de la barra de direcciones (o menú → "Instalar ShoroRepair").
3. La app se añade a tu escritorio/menú de inicio y funciona con su propio acceso directo, incluso **sin conexión**.

---

## 🛡️ Seguridad y Datos

* **Cifrado en reposo (dispositivo)**: Las contraseñas se almacenan hasheadas con PBKDF2-SHA256 (salt aleatorio). Las API keys y los tokens (p. ej. Gemini) se cifran con AES-GCM usando una clave por dispositivo. La base de datos local (IndexedDB/Dexie) en sí no está cifrada de extremo a extremo; los datos "viven" en el dispositivo del usuario y solo viajan a tu propio backend de Firebase.
* **Datos por Usuario (Firestore)**: Cada cuenta de Google tiene su propio espacio aislado (`users_data/{userId}`). Las reglas de seguridad de Firestore garantizan que cada usuario solo pueda leer y escribir sus propios datos (autenticado obligatoriamente).
* **RBAC y despliegues multiusuario**: En modo local/offline el RBAC se aplica en el cliente; en despliegues multiusuario en la nube, la autorización se refuerza en el servidor (Firestore Rules).
* **Protección de login**: bloqueo temporal por intentos fallidos (5 intentos → 5 min de bloqueo) para mitigar fuerza bruta local.
* **API keys en cliente**: Las llamadas directas a APIs externas (p. ej. Gemini) exponen la key en el dispositivo. Para ocultarlas por completo, usa un proxy/backend que retenga la credencial. Restringe además la key en la consola del proveedor (por app/dominio).

---
© 2026 Shoropio Corporation. Todos los derechos reservados.
