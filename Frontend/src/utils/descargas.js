/**
 * Dispara la descarga de un Blob en el navegador.
 * @param {Blob} blob
 * @param {string} nombre
 */
export function guardarBlob(blob, nombre = "archivo") {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/**
 * Crea una URL temporal para mostrar un blob (imagen/PDF).
 * El llamador debe revocarla con URL.revokeObjectURL.
 * @param {Blob} blob
 */
export function urlTemporal(blob) {
  return URL.createObjectURL(blob);
}
