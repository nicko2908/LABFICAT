/**
 * Pruebas unitarias de la maquina de estados (sin base de datos).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ESTADO_SOLICITUD,
  ESTADO_COTIZACION,
  ESTADO_CUPON,
  ESTADO_SOPORTE_PAGO,
  ESTADO_ORDEN,
} from '../src/config/constants.js';
import {
  puedeTransicionarSolicitud,
  estadosSiguientesSolicitud,
  esEstadoTerminalSolicitud,
  puedeTransicionarCotizacion,
  puedeTransicionarCupon,
  puedeTransicionarSoportePago,
  puedeTransicionarOrden,
} from '../src/config/estados.js';

test('permite el flujo feliz de un cliente externo', () => {
  const camino = [
    ESTADO_SOLICITUD.REGISTRADA,
    ESTADO_SOLICITUD.COTIZADA,
    ESTADO_SOLICITUD.ACEPTADA,
    ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION,
    ESTADO_SOLICITUD.PAGO_APROBADO,
    ESTADO_SOLICITUD.EN_ANALISIS,
    ESTADO_SOLICITUD.INFORME_LISTO,
    ESTADO_SOLICITUD.FINALIZADA,
    ESTADO_SOLICITUD.CERRADA,
  ];

  for (let i = 0; i < camino.length - 1; i += 1) {
    assert.equal(
      puedeTransicionarSolicitud(camino[i], camino[i + 1]),
      true,
      `${camino[i]} -> ${camino[i + 1]}`
    );
  }
});

test('permite el flujo interno sin pasar por pago', () => {
  assert.equal(
    puedeTransicionarSolicitud(
      ESTADO_SOLICITUD.ACEPTADA,
      ESTADO_SOLICITUD.EN_ANALISIS
    ),
    true
  );
});

test('permite reenviar un pago rechazado', () => {
  assert.equal(
    puedeTransicionarSolicitud(
      ESTADO_SOLICITUD.PAGO_RECHAZADO,
      ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION
    ),
    true
  );
  assert.equal(
    puedeTransicionarSolicitud(
      ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION,
      ESTADO_SOLICITUD.PAGO_RECHAZADO
    ),
    true
  );
});

test('rechaza saltos de estado', () => {
  assert.equal(
    puedeTransicionarSolicitud(
      ESTADO_SOLICITUD.REGISTRADA,
      ESTADO_SOLICITUD.EN_ANALISIS
    ),
    false
  );
  assert.equal(
    puedeTransicionarSolicitud(
      ESTADO_SOLICITUD.PAGO_RECHAZADO,
      ESTADO_SOLICITUD.EN_ANALISIS
    ),
    false
  );
  assert.equal(
    puedeTransicionarSolicitud(
      ESTADO_SOLICITUD.INFORME_LISTO,
      ESTADO_SOLICITUD.CERRADA
    ),
    false
  );
  assert.equal(
    puedeTransicionarSolicitud(
      ESTADO_SOLICITUD.CERRADA,
      ESTADO_SOLICITUD.REGISTRADA
    ),
    false
  );
});

test('no considera valida una transicion al mismo estado', () => {
  assert.equal(
    puedeTransicionarSolicitud(
      ESTADO_SOLICITUD.REGISTRADA,
      ESTADO_SOLICITUD.REGISTRADA
    ),
    false
  );
});

test('identifica los estados terminales de la solicitud', () => {
  assert.equal(esEstadoTerminalSolicitud(ESTADO_SOLICITUD.DESISTIDA), true);
  assert.equal(esEstadoTerminalSolicitud(ESTADO_SOLICITUD.CERRADA), true);
  assert.equal(esEstadoTerminalSolicitud(ESTADO_SOLICITUD.FINALIZADA), false);
  assert.equal(esEstadoTerminalSolicitud(ESTADO_SOLICITUD.EN_ANALISIS), false);
});

test('lista los estados siguientes de Aceptada', () => {
  const siguientes = estadosSiguientesSolicitud(ESTADO_SOLICITUD.ACEPTADA);

  assert.deepEqual(siguientes, [
    ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION,
    ESTADO_SOLICITUD.EN_ANALISIS,
    ESTADO_SOLICITUD.DESISTIDA,
  ]);
});

test('valida las transiciones de cotizacion', () => {
  assert.equal(
    puedeTransicionarCotizacion(
      ESTADO_COTIZACION.PENDIENTE,
      ESTADO_COTIZACION.ACEPTADA
    ),
    true
  );
  assert.equal(
    puedeTransicionarCotizacion(
      ESTADO_COTIZACION.ACEPTADA,
      ESTADO_COTIZACION.RECHAZADA
    ),
    false
  );
});

test('valida las transiciones de cupon', () => {
  assert.equal(
    puedeTransicionarCupon(ESTADO_CUPON.PENDIENTE, ESTADO_CUPON.GENERADO),
    true
  );
  assert.equal(
    puedeTransicionarCupon(ESTADO_CUPON.GENERADO, ESTADO_CUPON.UTILIZADO),
    true
  );
  assert.equal(
    puedeTransicionarCupon(ESTADO_CUPON.UTILIZADO, ESTADO_CUPON.VENCIDO),
    false
  );
});

test('valida las transiciones de soporte de pago', () => {
  assert.equal(
    puedeTransicionarSoportePago(
      ESTADO_SOPORTE_PAGO.PENDIENTE_VERIFICACION,
      ESTADO_SOPORTE_PAGO.APROBADO
    ),
    true
  );
  assert.equal(
    puedeTransicionarSoportePago(
      ESTADO_SOPORTE_PAGO.RECHAZADO,
      ESTADO_SOPORTE_PAGO.PENDIENTE_VERIFICACION
    ),
    true
  );
});

test('valida las transiciones de orden', () => {
  assert.equal(
    puedeTransicionarOrden(ESTADO_ORDEN.PENDIENTE, ESTADO_ORDEN.EN_PROCESO),
    true
  );
  assert.equal(
    puedeTransicionarOrden(ESTADO_ORDEN.EN_PROCESO, ESTADO_ORDEN.FINALIZADA),
    true
  );
  assert.equal(
    puedeTransicionarOrden(ESTADO_ORDEN.FINALIZADA, ESTADO_ORDEN.INVALIDADA),
    true
  );
  assert.equal(
    puedeTransicionarOrden(ESTADO_ORDEN.INVALIDADA, ESTADO_ORDEN.PENDIENTE),
    false
  );
});
