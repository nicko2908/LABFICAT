/**
 * Notificacion por correo para recuperacion de contrasena (RF-27).
 *
 * El token se envia al correo del usuario; nunca se devuelve en la respuesta
 * HTTP. El enlace/uso del token queda a cargo del frontend.
 */
import { enviarCorreo } from '../../config/mailer.js';

function construirHtml({ nombres, token, minutos }) {
  const nombre = String(nombres || 'usuario').trim();

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
      <h2 style="color:#123b5d">LABFICAT</h2>
      <p>Hola ${nombre},</p>
      <p>Recibimos una solicitud para restablecer tu contrasena.</p>
      <p>Tu codigo de recuperacion es:</p>
      <p style="font-size:22px;font-weight:bold;letter-spacing:2px;background:#f2f4f7;padding:12px;text-align:center">
        ${token}
      </p>
      <p>El codigo vence en <strong>${minutos} minutos</strong> y solo puede usarse una vez.</p>
      <p>Si no solicitaste este cambio, ignora este mensaje.</p>
      <hr />
      <p style="font-size:12px;color:#6b7280">LABFICAT - Laboratorio de alimentos</p>
    </div>
  `;
}

/**
 * Envia el correo con el token de recuperacion.
 * @param {{ usuario: object, token: string, minutos: number }} params
 */
export async function enviarCorreoRecuperacion({ usuario, token, minutos }) {
  if (!usuario?.correo) {
    throw new Error('El usuario no tiene correo registrado');
  }

  const nombre = [usuario.nombres, usuario.apellidos]
    .filter(Boolean)
    .join(' ')
    .trim();

  return enviarCorreo({
    para: usuario.correo,
    asunto: 'LABFICAT - Recuperacion de contrasena',
    html: construirHtml({ nombres: nombre, token, minutos }),
    texto: `Hola ${nombre || 'usuario'}. Tu codigo de recuperacion LABFICAT es: ${token}. Vence en ${minutos} minutos y solo puede usarse una vez.`,
  });
}

export { construirHtml };
export default { enviarCorreoRecuperacion };
