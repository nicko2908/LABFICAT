import { useQuasar } from "quasar";

import { textoDetalles } from "@/utils/errores";

export function useNotificar() {
  const $q = useQuasar();

  const notificarOk = (mensaje) => {
    $q.notify({ type: "positive", message: mensaje, icon: "check_circle" });
  };

  /**
   * @param {{ mensaje?: string, detalles?: any }|string} error
   */
  const notificarError = (error) => {
    if (typeof error === "string") {
      $q.notify({ type: "negative", message: error, icon: "error" });
      return;
    }

    const detalle = textoDetalles(error?.detalles);

    $q.notify({
      type: "negative",
      icon: "error",
      message: error?.mensaje || "Ocurrio un error inesperado",
      caption: detalle,
      timeout: detalle ? 6000 : 3500,
    });
  };

  const notificarInfo = (mensaje) => {
    $q.notify({ type: "info", message: mensaje, icon: "info" });
  };

  const notificarAdvertencia = (mensaje) => {
    $q.notify({ type: "warning", message: mensaje, icon: "warning" });
  };

  return { notificarOk, notificarError, notificarInfo, notificarAdvertencia };
}
