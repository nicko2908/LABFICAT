/**
 * Util: autorizacion por propietario.
 *
 * Reglas:
 *  - El coordinador puede acceder a cualquier recurso.
 *  - El cliente solo accede a los recursos de su propio perfil Cliente.
 *  - Cualquier otro rol recibe 403.
 */
import ApiError from './ApiError.js';
import { ROLES } from '../config/constants.js';
import Cliente from '../models/clientes/Cliente.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import CuponPago from '../models/servicios/CuponPago.js';

function esCoordinador(usuario) {
  return Boolean(usuario && usuario.rol === ROLES.COORDINADOR);
}

function idDe(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor;
  if (valor._id) return String(valor._id);
  return String(valor);
}

/**
 * Devuelve el perfil Cliente del usuario autenticado.
 * @param {string} usuarioId
 * @param {{ session?: import('mongoose').ClientSession }} [opciones]
 * @returns {Promise<import('mongoose').Document>}
 */
async function obtenerClienteDelUsuario(usuarioId, { session } = {}) {
  if (!usuarioId) throw ApiError.unauthorized();

  let query = Cliente.findOne({ usuario: usuarioId });
  if (session) query = query.session(session);

  let cliente;
  try {
    cliente = await query;
  } catch (err) {
    if (err && err.name === 'CastError') {
      throw ApiError.unauthorized('Sesion invalida');
    }
    throw err;
  }

  if (!cliente) {
    throw ApiError.forbidden('El usuario no tiene perfil de cliente');
  }

  return cliente;
}

/**
 * Verifica que el usuario pueda acceder a una solicitud.
 * @param {import('mongoose').Document|object} solicitud
 * @param {{ id?: string, sub?: string, rol?: string }} usuario
 * @param {{ session?: import('mongoose').ClientSession }} [opciones]
 * @returns {Promise<{ esCoordinador: boolean, cliente: import('mongoose').Document|null }>}
 */
async function verificarPropietarioSolicitud(solicitud, usuario, { session } = {}) {
  if (!usuario) throw ApiError.unauthorized();

  if (esCoordinador(usuario)) {
    return { esCoordinador: true, cliente: null };
  }

  if (usuario.rol !== ROLES.CLIENTE) {
    throw ApiError.forbidden('No tiene permisos para esta accion');
  }

  const cliente = await obtenerClienteDelUsuario(
    usuario.id || usuario.sub,
    { session }
  );

  if (idDe(solicitud.cliente) !== String(cliente._id)) {
    throw ApiError.forbidden('No tiene acceso a esta solicitud');
  }

  return { esCoordinador: false, cliente };
}

/**
 * Verifica que el usuario pueda acceder a una cotizacion a traves de su solicitud.
 * @param {import('mongoose').Document|object} cotizacion
 * @param {{ id?: string, sub?: string, rol?: string }} usuario
 * @param {{ session?: import('mongoose').ClientSession }} [opciones]
 * @returns {Promise<{ esCoordinador: boolean, cliente: import('mongoose').Document|null }>}
 */
async function verificarPropietarioCotizacion(cotizacion, usuario, { session } = {}) {
  if (!usuario) throw ApiError.unauthorized();
  if (esCoordinador(usuario)) {
    return { esCoordinador: true, cliente: null };
  }

  const solicitudId = idDe(cotizacion.solicitud);
  let query = Solicitud.findById(solicitudId);
  if (session) query = query.session(session);
  const solicitud = await query;

  if (!solicitud) throw ApiError.notFound('Solicitud no encontrada');

  return verificarPropietarioSolicitud(solicitud, usuario, { session });
}

/**
 * Verifica el acceso a un cupon a traves de su cotizacion.
 * @param {import('mongoose').Document|object} cupon
 * @param {{ id?: string, sub?: string, rol?: string }} usuario
 * @param {{ session?: import('mongoose').ClientSession }} [opciones]
 * @returns {Promise<{ esCoordinador: boolean, cliente: import('mongoose').Document|null }>}
 */
async function verificarPropietarioCupon(cupon, usuario, { session } = {}) {
  if (!usuario) throw ApiError.unauthorized();
  if (esCoordinador(usuario)) {
    return { esCoordinador: true, cliente: null };
  }

  const cotizacionId = idDe(cupon.cotizacion);
  let query = Cotizacion.findById(cotizacionId);
  if (session) query = query.session(session);
  const cotizacion = await query;

  if (!cotizacion) throw ApiError.notFound('Cotizacion no encontrada');

  return verificarPropietarioCotizacion(cotizacion, usuario, { session });
}

/**
 * Verifica el acceso a un soporte de pago a traves de su cupon.
 * @param {import('mongoose').Document|object} soporte
 * @param {{ id?: string, sub?: string, rol?: string }} usuario
 * @param {{ session?: import('mongoose').ClientSession }} [opciones]
 * @returns {Promise<{ esCoordinador: boolean, cliente: import('mongoose').Document|null }>}
 */
async function verificarPropietarioSoportePago(soporte, usuario, { session } = {}) {
  if (!usuario) throw ApiError.unauthorized();
  if (esCoordinador(usuario)) {
    return { esCoordinador: true, cliente: null };
  }

  const cuponId = idDe(soporte.cupon);
  let query = CuponPago.findById(cuponId);
  if (session) query = query.session(session);
  const cupon = await query;

  if (!cupon) throw ApiError.notFound('Cupon no encontrado');

  return verificarPropietarioCupon(cupon, usuario, { session });
}

export {
  esCoordinador,
  idDe,
  obtenerClienteDelUsuario,
  verificarPropietarioSolicitud,
  verificarPropietarioCotizacion,
  verificarPropietarioCupon,
  verificarPropietarioSoportePago,
};

export default {
  esCoordinador,
  idDe,
  obtenerClienteDelUsuario,
  verificarPropietarioSolicitud,
  verificarPropietarioCotizacion,
  verificarPropietarioCupon,
  verificarPropietarioSoportePago,
};
