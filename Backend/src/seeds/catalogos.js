/**
 * Datos maestros de los catalogos LABFICAT.
 *
 * Fuente de verdad:
 *  - 16 tipologias de "Clasificacion/Tipologia" de la Oferta de servicios
 *    CAT-ST-OC-F-002 v6. Las 4 marcadas con es_interno=true son las unicas
 *    que liquidan al 0 %; el resto son clientes externos.
 *  - 35 ensayos del catalogo de la misma plantilla (codigo 1..35, valor
 *    15.000). El simbolo ° se imprime cuando acreditado=true.
 *  - Presentaciones de muestra usadas en la Recepcion de muestras
 *    CAT-ST-MI-F-002 v2 (Pasta, Polvo, Liquido, Grano, etc.).
 *
 * Este modulo lo usan tanto el seed como las migraciones para que ambos
 * caminos carguen exactamente los mismos datos.
 */

const TIPOLOGIAS_SEMILLA = [
  { nombre: 'Campesinos', codigo: 'CAMPESINOS', es_interno: false, activo: true },
  { nombre: 'Economía Popular', codigo: 'ECONOMIA_POPULAR', es_interno: false, activo: true },
  { nombre: 'Aprendices SENA', codigo: 'APRENDICES_SENA', es_interno: true, activo: true },
  { nombre: 'Gremios Productivos', codigo: 'GREMIOS_PRODUCTIVOS', es_interno: false, activo: true },
  { nombre: 'Empresas', codigo: 'EMPRESAS', es_interno: false, activo: true },
  { nombre: 'SER', codigo: 'SER', es_interno: false, activo: true },
  { nombre: 'Fondo Emprender', codigo: 'FONDO_EMPRENDER', es_interno: false, activo: true },
  { nombre: 'CampeSENA', codigo: 'CAMPESENA', es_interno: true, activo: true },
  { nombre: 'Desplazados', codigo: 'DESPLAZADOS', es_interno: false, activo: true },
  { nombre: 'Comunidad SENA', codigo: 'COMUNIDAD_SENA', es_interno: true, activo: true },
  { nombre: 'Emprendedor', codigo: 'EMPRENDEDOR', es_interno: false, activo: true },
  { nombre: 'Victimas del Conflicto', codigo: 'VICTIMAS_CONFLICTO', es_interno: false, activo: true },
  { nombre: 'Asociaciones', codigo: 'ASOCIACIONES', es_interno: false, activo: true },
  { nombre: 'Cooperativas de Aprendices', codigo: 'COOPERATIVAS_APRENDICES', es_interno: true, activo: true },
  { nombre: 'Cooperativas', codigo: 'COOPERATIVAS', es_interno: false, activo: true },
  { nombre: 'Persona natural', codigo: 'PERSONA_NATURAL', es_interno: false, activo: true },
];

// Tipologias del RF-01 anterior. No se borran: se desactivan para conservar
// la integridad de los clientes historicos que las referencian.
const TIPOLOGIAS_LEGADO = [
  'Indígena',
  'Afrocolombiano, negro, raizal o palenquero',
  'Rrom o gitano',
  'Campesino',
  'Víctima del conflicto armado',
  'Persona con discapacidad',
  'Mujer cabeza de hogar',
  'Población LGBTIQ+',
  'Persona reincorporada o reintegrada',
  'Empresario o emprendedor',
  'Aprendiz, estudiante o egresado',
  'Ninguna de las anteriores',
];

const TIPOS_MUESTRA_SEMILLA = [
  { nombre: 'Pasta', estado_fisico: 'SOLIDO', activo: true },
  { nombre: 'Polvo', estado_fisico: 'SOLIDO', activo: true },
  { nombre: 'Líquido', estado_fisico: 'LIQUIDO', activo: true },
  { nombre: 'Grano', estado_fisico: 'SOLIDO', activo: true },
  { nombre: 'Solución', estado_fisico: 'LIQUIDO', activo: true },
  { nombre: 'Emulsión', estado_fisico: 'LIQUIDO', activo: true },
  { nombre: 'Suspensión', estado_fisico: 'LIQUIDO', activo: true },
  { nombre: 'Gel', estado_fisico: 'SOLIDO', activo: true },
  { nombre: 'Sólido', estado_fisico: 'SOLIDO', activo: true },
  { nombre: 'Semisólido', estado_fisico: 'SOLIDO', activo: true },
];

// Parametro generico que permite registrar un resultado por ensayo. El
// modelo OrdenAnalisis exige al menos un parametro para poder finalizar.
const PARAMETRO_RESULTADO = {
  nombre: 'Resultado',
  unidad_medida: 'unidades',
  activo: true,
};

const ANALISIS_SEMILLA = [
  { codigo: 1, nombre: 'Humedad', unidades: '%', metodo: 'AOAC 925.45 B:2023 Modificado', tecnica: 'Gravimetría', acreditado: true },
  { codigo: 2, nombre: 'Cenizas', unidades: '%', metodo: 'AOAC 900.02 C:2023 Modificado', tecnica: 'Gravimetría', acreditado: true },
  { codigo: 3, nombre: 'Grasas', unidades: '%', metodo: 'AOAC 920.39 C:2023 Modificado', tecnica: 'Gravimetría (Soxhlet)', acreditado: true },
  { codigo: 4, nombre: 'Proteína', unidades: '%', metodo: 'AOAC 981.10:2023 Modificado', tecnica: 'Volumetría (Kjeldhal)', acreditado: true },
  { codigo: 5, nombre: 'Fenoles totales', unidades: '%', metodo: 'Folin, O., Ciocalteu, V. (1927)', tecnica: 'Espectrofotometría UV-Vis', acreditado: true },
  { codigo: 6, nombre: 'Grados Brix', unidades: '%', metodo: 'ISO 2173:2003 Modificado', tecnica: 'Refractometría', acreditado: true },
  { codigo: 7, nombre: 'Sacarosa', unidades: '%', metodo: 'ISO 10504:2013 Modificado', tecnica: 'Cromatografía HPLC', acreditado: true },
  { codigo: 8, nombre: 'Glucosa', unidades: '%', metodo: 'ISO 10504:2013 Modificado', tecnica: 'Cromatografía HPLC', acreditado: true },
  { codigo: 9, nombre: 'Fructosa', unidades: '%', metodo: 'ISO 10504:2013 Modificado', tecnica: 'Cromatografía HPLC', acreditado: true },
  { codigo: 10, nombre: 'Azúcares reductores', unidades: '%', metodo: 'ISO 10504:2013 Modificado', tecnica: 'Cromatografía HPLC', acreditado: true },
  { codigo: 11, nombre: 'Azúcares totales', unidades: '%', metodo: 'ISO 10504:2013 Modificado', tecnica: 'Cromatografía HPLC', acreditado: true },
  { codigo: 12, nombre: 'Hierro', unidades: 'mg/kg', metodo: 'AOAC 985.35:2023 Modificado', tecnica: 'AA Llama óxido nitroso - Acetileno', acreditado: false },
  { codigo: 13, nombre: 'Calcio', unidades: 'mg/kg', metodo: 'AOAC 985.35:2023 Modificado', tecnica: 'AA Llama Aire - Acetileno', acreditado: false },
  { codigo: 14, nombre: 'Arsénico', unidades: 'mg/kg', metodo: 'AOAC 986.15:2023 Modificado', tecnica: 'AA Generación de Hidruros', acreditado: false },
  { codigo: 15, nombre: 'Plomo', unidades: 'mg/kg', metodo: 'AOAC 999.11:2023 Modificado', tecnica: 'AA Horno de grafito', acreditado: false },
  { codigo: 16, nombre: 'Azúcares totales', unidades: '%', metodo: 'Dubois, et al., (1951)', tecnica: 'Espectrofotometría UV-Vis', acreditado: false },
  { codigo: 17, nombre: 'Capacidad Antioxidante', unidades: '%', metodo: 'Pyrzynska, K., & Pękal, A. (2013)', tecnica: 'Espectrofotometría UV-Vis', acreditado: false },
  { codigo: 18, nombre: 'Colorantes', unidades: 'Positivo - Negativo', metodo: 'NTC 1311:2021 Metodo B (de arata)', tecnica: 'Cualitativo', acreditado: false },
  { codigo: 19, nombre: 'Sulfitos', unidades: 'Positivo - Negativo', metodo: 'AOAC 990.28:2023', tecnica: 'Cualitativo', acreditado: false },
  { codigo: 20, nombre: 'Aminoácidos', unidades: '%', metodo: 'Xu, et al., (2015)', tecnica: 'Cromatografía HPLC', acreditado: false },
  { codigo: 21, nombre: 'Fenoles totales', unidades: '%', metodo: 'Alarcón, et al., (2021)', tecnica: 'Cromatografía HPLC', acreditado: false },
  { codigo: 22, nombre: 'Acrilamida', unidades: '%', metodo: 'Mesias et. Al., (2020)', tecnica: 'Cromatografía HPLC', acreditado: false },
  { codigo: 23, nombre: 'Vitamina A', unidades: '%', metodo: 'Lopez, V (2013)', tecnica: 'Cromatografía HPLC', acreditado: false },
  { codigo: 24, nombre: 'Vitamina B', unidades: '%', metodo: 'Ekinci, R., Kadakal, İ (2005)', tecnica: 'Cromatografía HPLC', acreditado: false },
  { codigo: 25, nombre: 'Vitamina D', unidades: '%', metodo: 'Lopez, V (2013)', tecnica: 'Cromatografía HPLC', acreditado: false },
  { codigo: 26, nombre: 'Vitamina E', unidades: '%', metodo: 'Lopez, V (2013)', tecnica: 'Cromatografía HPLC', acreditado: false },
  { codigo: 27, nombre: 'Vitamina K', unidades: '%', metodo: 'Ekinci, R., Kadakal, İ (2005)', tecnica: 'Cromatografía HPLC', acreditado: false },
  { codigo: 28, nombre: 'Vitamina C', unidades: '%', metodo: 'AOAC 2012.22:2023', tecnica: 'Cromatografía HPLC', acreditado: false },
  { codigo: 29, nombre: 'Sodio', unidades: 'mg/kg', metodo: 'AOAC 985.35:2023 Modificado', tecnica: 'AA Llama Aire - Acetileno', acreditado: false },
  { codigo: 30, nombre: 'Potasio', unidades: 'mg/kg', metodo: 'AOAC 985.35:2023 Modificado', tecnica: 'AA Llama Aire - Acetileno', acreditado: false },
  { codigo: 31, nombre: 'Fósforo', unidades: '%', metodo: 'AOAC 995.11:2023 Modificado', tecnica: 'Espectrofotometría UV-Vis', acreditado: false },
  { codigo: 32, nombre: 'pH', unidades: 'unidades de pH', metodo: 'AOAC 981.12:2023 Modificado', tecnica: 'Potenciometría', acreditado: false },
  { codigo: 33, nombre: 'Grados Brix miel', unidades: '%', metodo: 'AOAC 920.180:2023', tecnica: 'Refractometría', acreditado: false },
  { codigo: 34, nombre: 'Humedad miel', unidades: '%', metodo: 'AOAC 969.38 B:2023', tecnica: 'Refractometría', acreditado: false },
  { codigo: 35, nombre: 'Densidad', unidades: 'g/mL', metodo: null, tecnica: null, acreditado: false },
];

const PRECIO_ANALISIS = 15000;

export {
  TIPOLOGIAS_SEMILLA,
  TIPOLOGIAS_LEGADO,
  TIPOS_MUESTRA_SEMILLA,
  PARAMETRO_RESULTADO,
  ANALISIS_SEMILLA,
  PRECIO_ANALISIS,
};
