export const ROLES = {
  CLIENTE: "cliente",
  ANALISTA: "analista",
  COORDINADOR: "coordinador",
};

export const ROLES_TODOS = [ROLES.CLIENTE, ROLES.COORDINADOR, ROLES.ANALISTA];

export const ETIQUETAS_ROL = {
  [ROLES.CLIENTE]: "Cliente",
  [ROLES.ANALISTA]: "Analista",
  [ROLES.COORDINADOR]: "Coordinador",
};

export const COLORES_ROL = {
  [ROLES.CLIENTE]: "info",
  [ROLES.ANALISTA]: "accent",
  [ROLES.COORDINADOR]: "primary",
};

export function etiquetaRol(rol) {
  return ETIQUETAS_ROL[rol] || "Usuario";
}

export function colorRol(rol) {
  return COLORES_ROL[rol] || "primary";
}
