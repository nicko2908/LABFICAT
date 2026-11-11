import { reactive, ref } from "vue";

/**
 * Paginacion de servidor para tablas.
 *
 * @param {(params: object) => Promise<any>} cargarFn
 * @param {{ limit?: number, filtros?: object }} [opciones]
 */
export function usePaginacion(cargarFn, opciones = {}) {
  const filas = ref([]);
  const cargando = ref(false);
  const total = ref(0);
  const paginas = ref(1);
  const error = ref(null);

  const paginacion = reactive({
    page: 1,
    rowsPerPage: opciones.limit || 20,
    rowsNumber: 0,
  });

  const filtros = reactive({ ...(opciones.filtros || {}) });

  async function cargar(extra = {}) {
    cargando.value = true;
    error.value = null;

    try {
      const respuesta = await cargarFn({
        page: paginacion.page,
        limit: paginacion.rowsPerPage,
        ...filtros,
        ...extra,
      });

      const datos = respuesta?.datos ?? respuesta;
      filas.value = Array.isArray(datos) ? datos : datos?.items || [];
      total.value = datos?.total ?? filas.value.length;
      paginas.value = datos?.pages ?? 1;
      paginacion.rowsNumber = total.value;
    } catch (err) {
      error.value = err;
      filas.value = [];
      total.value = 0;
      paginacion.rowsNumber = 0;
    } finally {
      cargando.value = false;
    }
  }

  function onRequest(request) {
    paginacion.page = request.pagination.page;
    paginacion.rowsPerPage = request.pagination.rowsPerPage;
    cargar();
  }

  function buscar() {
    paginacion.page = 1;
    return cargar();
  }

  return {
    filas,
    cargando,
    total,
    paginas,
    error,
    paginacion,
    filtros,
    cargar,
    onRequest,
    buscar,
  };
}
