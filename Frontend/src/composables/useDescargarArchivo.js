import { guardarBlob } from "@/utils/descargas";
import { useNotificar } from "./useNotificar";

/**
 * Envuelve una descarga autenticada y avisa al usuario.
 *
 * Uso:
 *   const { descargarArchivo } = useDescargarArchivo();
 *   await descargarArchivo(() => cotizaciones.descargarExcel(id));
 */
export function useDescargarArchivo() {
  const { notificarOk, notificarError } = useNotificar();

  /**
   * @param {() => Promise<{ blob: Blob, nombre: string }>} obtenerArchivo
   * @param {string} [mensaje]
   */
  async function descargarArchivo(obtenerArchivo, mensaje = "Archivo descargado") {
    try {
      const { blob, nombre } = await obtenerArchivo();
      guardarBlob(blob, nombre);
      notificarOk(mensaje);
    } catch (error) {
      notificarError(error);
    }
  }

  return { descargarArchivo };
}
