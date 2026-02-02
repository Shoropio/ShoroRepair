# Instrucciones para Configurar las Reglas de Firestore

## Error Actual
`FirebaseError: Missing or insufficient permissions`

Este error ocurre porque Firestore no tiene las reglas de seguridad configuradas correctamente.

## Solución

### Opción 1: Configurar desde Firebase Console (Recomendado)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. En el menú lateral, ve a **Firestore Database**
4. Haz clic en la pestaña **Reglas** (Rules)
5. Reemplaza el contenido con las reglas del archivo `firestore.rules`
6. Haz clic en **Publicar** (Publish)

### Opción 2: Usar Firebase CLI

Si tienes Firebase CLI instalado:

```bash
# Instalar Firebase CLI (si no lo tienes)
npm install -g firebase-tools

# Iniciar sesión
firebase login

# Inicializar el proyecto (solo la primera vez)
firebase init firestore

# Desplegar las reglas
firebase deploy --only firestore:rules
```

## Explicación de las Reglas

Las reglas configuradas permiten que:
- Cada usuario autenticado solo pueda leer y escribir **sus propios datos**
- Los datos están organizados en: `/users_data/{userId}/{collection}/{document}`
- Usuarios no autenticados no tienen acceso a ningún dato

## Verificación

Después de aplicar las reglas:
1. Recarga la aplicación
2. Inicia sesión con tu cuenta de Google
3. El error de permisos debería desaparecer
4. La sincronización debería funcionar correctamente

## Notas de Seguridad

- **NUNCA** uses reglas que permitan acceso público en producción
- Las reglas actuales son seguras para producción
- Cada usuario solo puede acceder a sus propios datos
- Los datos están aislados por `userId` (UID de Firebase Auth)
