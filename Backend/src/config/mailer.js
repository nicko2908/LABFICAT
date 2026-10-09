/**
 * Transporte SMTP (Nodemailer) para el envio de correos.
 * Expone enviarCorreo() reutilizable. Las reglas de "que se envia
 * y cuando" viven en services/notificacion/.
 */
import nodemailer from 'nodemailer';
import env from './env.js';

const transporter = nodemailer.createTransport({
  host: env.mail.host,
  port: env.mail.port,
  secure: env.mail.secure,
  auth: env.mail.user
    ? { user: env.mail.user, pass: env.mail.pass }
    : undefined,
});

/**
 * @param {Object} opciones
 * @param {string|string[]} opciones.para  Destinatario(s)
 * @param {string} opciones.asunto
 * @param {string} [opciones.html]         Cuerpo HTML
 * @param {string} [opciones.texto]        Cuerpo alternativo en texto
 * @param {Array}  [opciones.adjuntos]     [{ filename, path|content }]
 */
async function enviarCorreo({ para, asunto, html, texto, adjuntos = [] }) {
  return transporter.sendMail({
    from: env.mail.from,
    to: para,
    subject: asunto,
    html,
    text: texto,
    attachments: adjuntos,
  });
}

export { transporter, enviarCorreo };
