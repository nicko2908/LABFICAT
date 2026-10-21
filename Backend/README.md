# LABFICAT - Backend

API REST del sistema de gestion del laboratorio **LABFICAT** (Produccion de Centro - SENA).

- **Stack:** Node.js + Express + Mongoose (MongoDB Atlas), modulos **ESM** (`"type": "module"`)
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

## Variables de entorno

- **Obligatorias:** `MONGO_URI` y `JWT_SECRET`. Si faltan, el backend no arranca.
- **Supabase (opcional en local):** `SUPABASE_URL` y `API_KEY_SUPABASE`.
  Si no estan configuradas, la API funciona igual y solo los endpoints de
  firma digital responden `503 Storage no configurado`.
- **Negocio:** `CUPON_VIGENCIA_DIAS` (por defecto 5), `CUPON_UMBRAL_RECORDATORIO_DIAS`
  y `TOKEN_RECUPERACION_MINUTOS`.

## Verificacion rapida

```bash
# 1. La app responde (no requiere Mongo)
curl http://localhost:3000/health

# 2. Login con el usuario sembrado (requiere npm run seed)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"correo\":\"coordinador@sena.edu.co\",\"contrasena\":\"Labficat123*\"}"

# 3. Prueba de humo automatizada
npm test
```

## Semilla de datos iniciales

```bash
# Crea los roles (cliente, analista, coordinador) y la configuracion del sistema
npm run seed
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
├─ seeds/           Datos iniciales (roles, configuracion) -> npm run seed
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
