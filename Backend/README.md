# LABFICAT - Backend

API REST del sistema de gestion del laboratorio **LABFICAT** (Produccion de Centro - SENA).

- **Stack:** Node.js + Express + Mongoose (MongoDB Atlas)
- **Arquitectura:** MVC + capa de servicios y validators
- **Modulo:** Trabajo Final

## Requisitos

- Node.js 18+
- Cuenta/cluster en MongoDB Atlas

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de variables de entorno
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/Mac

# 3. Completar MONGO_URI, JWT_SECRET y credenciales SMTP en .env

# 4. Levantar en desarrollo
npm run dev

# 5. Levantar en produccion
npm start
```

## Estructura

```
src/
├─ server.js        Arranque (conecta Mongo y levanta HTTP)
├─ app.js           Configuracion de Express (middlewares, rutas, errores)
├─ config/          Infraestructura: BD, entorno, constantes, mailer
├─ models/          M (Modelo): schemas de Mongoose agrupados por dominio
├─ controllers/     C (Controlador): reciben req, llaman services, responden
├─ routes/          Mapeo URL -> controlador (un archivo por modulo)
├─ services/        Logica de negocio (no conoce req/res)
├─ middlewares/     Auth, roles, validacion, upload, auditoria, errores
├─ validators/      Reglas de entrada (formatos, longitudes, tamanos)
├─ jobs/            Tareas programadas (node-cron)
├─ templates/       Plantillas de PDF, Excel y correo
├─ utils/           Helpers puros y generadores (PDF, Excel, QR, codigo)
└─ docs/            Documentacion de la API (Swagger/OpenAPI)
storage/            Archivos subidos y generados (no versionado)
tests/              Pruebas automatizadas
logs/               Salida de auditoria/errores
```

## Convenciones

- Un archivo por **coleccion** en `models/`, agrupados por dominio.
- Un archivo por **modulo** en `controllers/`, `services/` y `routes/`.
- Las rutas solo orquestan; la logica vive en `services/`.
- Los archivos binarios se guardan en `storage/`; en BD solo la ruta.
