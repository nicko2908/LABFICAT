/**
 * Responde 404 para rutas no registradas.
 */
function notFound(req, res) {
  res.status(404).json({
    ok: false,
    mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

export default notFound;
