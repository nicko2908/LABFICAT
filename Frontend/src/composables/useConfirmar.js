import { useQuasar } from "quasar";

export function useConfirmar() {
  const $q = useQuasar();

  /**
   * @param {{ titulo: string, mensaje: string, textoOk?: string, color?: string }} opciones
   * @returns {Promise<boolean>}
   */
  const confirmar = ({
    titulo,
    mensaje,
    textoOk = "Confirmar",
    color = "primary",
  }) =>
    new Promise((resolve) => {
      $q.dialog({
        title: titulo,
        message: mensaje,
        ok: { label: textoOk, color, unelevated: true },
        cancel: { label: "Cancelar", flat: true, color: "grey-8" },
        persistent: true,
      })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false));
    });

  return { confirmar };
}
