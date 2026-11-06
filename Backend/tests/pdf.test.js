/**
 * Pruebas de los generadores PDF y QR.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generarInformePdf,
  generarRotuloPdf,
} from '../src/utils/generadores/pdf.js';
import { generarQrBuffer } from '../src/utils/generadores/qr.js';

const muestra = {
  codigo_muestra: '0001-2026',
  matriz: 'Cacao',
  tipo_muestra: { nombre: 'Pasta' },
  fecha_recepcion: new Date('2026-11-06T09:00:00'),
  prioridad: 3,
};

const solicitud = { codigo_solicitud: 'SOL-2026-0001' };
const cliente = {
  razon_social: 'Cliente de prueba',
  usuario: { nombres: 'Ana', apellidos: 'Perez' },
};

test('generarInformePdf produce un PDF con datos de la muestra', async () => {
  const buffer = await generarInformePdf({
    informe: { fecha_generacion: new Date('2026-11-06T10:00:00') },
    muestra,
    solicitud,
    cliente,
    usuario: { nombres: 'Coordinador', apellidos: 'LABFICAT' },
    ordenes: [
      {
        estado: 'FINALIZADA',
        analisis: {
          nombre: 'Humedad',
          metodo: 'AOAC 925.45',
          tecnica: 'Gravimetria',
          unidades: '%',
        },
        resultados: [
          {
            parametro: { nombre: 'Humedad', unidad_medida: '%' },
            valor: 12.5,
          },
        ],
      },
    ],
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.ok(buffer.length > 1000);
});

test('generarRotuloPdf produce un PDF con QR', async () => {
  const buffer = await generarRotuloPdf({
    muestra,
    solicitud,
    cliente,
    analisis: [{ nombre: 'Humedad' }, { nombre: 'Cenizas' }],
    qrTexto: '0001-2026',
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.ok(buffer.length > 1000);
});

test('generarQrBuffer produce un PNG', async () => {
  const buffer = await generarQrBuffer('LABFICAT-0001-2026');

  assert.ok(Buffer.isBuffer(buffer));
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  );
});
