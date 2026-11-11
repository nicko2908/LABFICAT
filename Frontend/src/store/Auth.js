import { computed, ref } from "vue";
import { defineStore } from "pinia";

/**
 * Store de la sesion. Guarda token, usuario y perfil de cliente.
 * Se persiste con pinia-plugin-persistedstate (ver main.js).
 */
export const useAuthStore = defineStore(
  "auth",
  () => {
    const token = ref(null);
    const usuario = ref(null);
    const cliente = ref(null);

    const estaAutenticado = computed(() => !!token.value);

    const rol = computed(() => {
      const valor = usuario.value?.rol;
      return valor?.nombre || valor || null;
    });

    const nombreUsuario = computed(() => {
      const nombres = usuario.value?.nombres || "";
      const apellidos = usuario.value?.apellidos || "";
      return (
        `${nombres} ${apellidos}`.trim() ||
        usuario.value?.correo ||
        "Invitado"
      );
    });

    const esCliente = computed(() => rol.value === "cliente");
    const esCoordinador = computed(() => rol.value === "coordinador");
    const esAnalista = computed(() => rol.value === "analista");

    /**
     * @param {{ token: string, usuario?: object, cliente?: object }} respuesta
     */
    function guardarSesion(respuesta) {
      token.value = respuesta?.token || null;
      usuario.value = respuesta?.usuario || null;
      cliente.value = respuesta?.cliente || null;
    }

    function actualizarPerfil({ usuario: usuarioNuevo, cliente: clienteNuevo }) {
      if (usuarioNuevo) usuario.value = usuarioNuevo;
      if (clienteNuevo !== undefined) cliente.value = clienteNuevo;
    }

    function cerrarSesion() {
      token.value = null;
      usuario.value = null;
      cliente.value = null;
    }

    return {
      token,
      usuario,
      cliente,
      estaAutenticado,
      rol,
      nombreUsuario,
      esCliente,
      esCoordinador,
      esAnalista,
      guardarSesion,
      actualizarPerfil,
      cerrarSesion,
    };
  },
  {
    persist: {
      key: "labficat-auth",
      pick: ["token", "usuario", "cliente"],
    },
  }
);
