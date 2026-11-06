# Migraciones de datos

Scripts idempotentes para ajustar datos existentes. No forman parte del
arranque del servidor: se ejecutan manualmente y requieren `MONGO_URI`.

## Orden recomendado

| Orden | Script | Proposito | Comando |
|---|---|---|---|
| 1 | `001-tipologia-ninguna.js` | **Legado.** Crea/verifica `NINGUNA` y migra clientes con `tipologia: null`. Se salta solo si ya existe el catalogo nuevo. | `npm run migrar:tipologia` |
| 2 | `002-catalogos.js` | Carga las 16 tipologias comerciales (4 internas), presentaciones de muestra, parametro `Resultado` y los 35 ensayos. Desactiva las 12 tipologias del RF-01 anterior y los 3 analisis de ejemplo. | `npm run migrar:catalogos` |
| 3 | `003-plan-plantillas.js` | Normaliza cotizaciones (version, items, codigo, snapshot), muestras (cotizacion/item, campos nuevos), clientes (mapeo de tipologias y `tipo_cliente`) e inicializa contadores. Ejecuta `syncIndexes()` para eliminar los indices legados. | `npm run migrar:plan` |
| 4 | `004-peticiones-archivos.js` | Elimina `ruta_archivo`/`formato` de `SoportePago` e inicializa `referencia_externa`. Revisa evidencias legadas de reclamaciones. | `npm run migrar:peticiones` |

Los scripts 002 y 003 aceptan `--dry-run` para revisar el alcance sin escribir:

```powershell
node scripts/migraciones/002-catalogos.js --dry-run
node scripts/migraciones/003-plan-plantillas.js --dry-run
```

## Recomendaciones

1. Hacer un backup de la base antes de ejecutar.
2. Ejecutar primero en un entorno de pruebas.
3. Ejecutar 002 antes que 003: 003 necesita el catalogo nuevo para mapear
   clientes y ensayos.
4. `003` ejecuta `syncIndexes()`. Esto elimina indices viejos como
   `cotizaciones.solicitud_1`, `muestras.solicitud_1` y
   `analisis.nombre_1`; sin ese paso, una V2 o una segunda muestra fallan
   con `E11000`.
5. No ejecutar `npm run seed` como sustituto de una migracion: el seed
   sincroniza catalogos, pero no corrige datos historicos.
6. Despues de migrar, ejecutar `npm test` y una prueba manual de creacion de
   cotizacion V2 y de una segunda muestra.
