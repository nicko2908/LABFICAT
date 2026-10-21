# Migraciones de datos

Scripts idempotentes para ajustar datos existentes. No forman parte del
arranque del servidor: se ejecutan manualmente y requieren `MONGO_URI`.

## Orden

| Script | Proposito | Comando |
|---|---|---|
| `001-tipologia-ninguna.js` | Crea/verifica la tipologia `NINGUNA` y migra clientes con `tipologia: null` | `npm run migrar:tipologia` |

## Recomendaciones

1. Hacer un backup de la base antes de ejecutar.
2. Ejecutar primero en un entorno de pruebas.
3. Revisar la salida: el script falla si quedan clientes sin tipologia.
4. No ejecutar `npm run seed` como sustituto de una migracion: el seed
   sincroniza catalogos, pero no corrige datos historicos.
