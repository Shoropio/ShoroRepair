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

### ☁️ Sincronización Híbrida (Hybrid Cloud)

* **Modo Offline**: Funciona 100% sin internet usando base de datos local (IndexedDB/Dexie).
* **Google Drive Sync**: Respaldo y sincronización automática de bases de datos entre dispositivos.
* **Firebase Integration**: (Opcional) Para características avanzadas de tiempo real.

---

## 💻 Guía de Implementación

### Requisitos Previos

* Node.js v18+
* NPM o Yarn
* Rust (Solo si vas a compilar para Windows/Mac con Tauri)
* Android Studio (Solo si vas a compilar para Android con Capacitor)

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

### 4. Build para Producción (Web)

Genera los archivos estáticos optimizados en la carpeta `dist/`:

```bash
npm run build
```

---

## 🖥️ Implementación de Escritorio (Tauri 2.0)

ShoroRepair utiliza Tauri para ofrecer una experiencia nativa en Windows, macOS y Linux con un rendimiento superior y un tamaño de ejecutable mínimo (<10MB).

### Modo Desarrollo

```bash
npm run tauri dev
```

### Generar Instalador (.msi / .dmg / .deb)

Asegúrate de haber editado `src-tauri/tauri.conf.json` con tu identificador único.

```bash
npm run tauri build
```

Los instaladores se generarán en `src-tauri/target/release/bundle/`.

---

## 📱 Implementación Móvil (Capacitor)

La arquitectura responsive permite convertir la app web en una app nativa de Android/iOS.

### Preparación

1. Asegúrate de haber hecho el build web primero:

   ```bash
   npm run build
   ```

2. Sincroniza los cambios con el proyecto nativo:

   ```bash
   npx cap sync
   ```

### Ejecutar en Android

Requiere Android Studio instalado y configurado.

```bash
npx cap open android
```

Desde Android Studio, puedes ejecutar la app en un emulador o dispositivo físico, o generar el APK firmado ("Build > Generate Signed Bundle / APK").

---

## 🛡️ Seguridad y Datos

* **Cifrado Local**: Los datos sensibles viven en el dispositivo del usuario.
* **Sin Servidor Central**: Tú eres dueño de tus datos. No dependen de servidores de terceros (salvo tu propio Google Drive).
* **Roles y Permisos**: Sistema RBAC (Role-Based Access Control) para Administradores, Técnicos y Recepcionistas.

---
© 2026 Shoropio Corporation. Todos los derechos reservados.
