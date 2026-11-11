/**
 * Funciones base de consumo de la API.
 *
 * Devuelven el body completo del backend: { ok, mensaje, datos }.
 * Para leer el payload real usar respuesta.datos.
 */
import api from "@/plugins/axios";

export const get = async (url, config = {}) => {
  const { data } = await api.get(url, config);
  return data;
};

export const post = async (url, datos = {}, config = {}) => {
  const { data } = await api.post(url, datos, config);
  return data;
};

export const put = async (url, datos = {}, config = {}) => {
  const { data } = await api.put(url, datos, config);
  return data;
};

export const patch = async (url, datos = {}, config = {}) => {
  const { data } = await api.patch(url, datos, config);
  return data;
};

// delete es palabra reservada; se exporta como del.
export const del = async (url, config = {}) => {
  const { data } = await api.delete(url, config);
  return data;
};

/**
 * Sube un FormData (multipart). No se fija Content-Type para que Axios
 * agregue el boundary automaticamente.
 */
export const subir = async (url, formData, config = {}) => {
  const { data } = await api.post(url, formData, {
    ...config,
    headers: { ...(config.headers || {}), "Content-Type": undefined },
  });
  return data;
};

/**
 * Descarga un archivo binario autenticado.
 * @param {string} url
 * @param {{ params?: object, nombrePorDefecto?: string }} [opciones]
 * @returns {Promise<{ blob: Blob, nombre: string }>}
 */
export const descargar = async (url, { params, nombrePorDefecto = "archivo" } = {}) => {
  const respuesta = await api.get(url, { params, responseType: "blob" });
  const blob = respuesta.data;
  const nombre = nombreDesdeContentDisposition(
    respuesta.headers?.["content-disposition"],
    nombrePorDefecto
  );

  return { blob, nombre };
};

/**
 * Extrae el nombre de archivo de Content-Disposition.
 * @param {string|undefined} header
 * @param {string} porDefecto
 */
function nombreDesdeContentDisposition(header, porDefecto) {
  if (!header) return porDefecto;

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].replace(/["']/g, ""));
    } catch {
      return utf8[1];
    }
  }

  const simple = /filename="?([^";]+)"?/i.exec(header);
  return simple?.[1] || porDefecto;
}
