// AFLOAT — toda la lógica del juego.
// Este archivo no importa ni toca el DOM. Se puede leer en voz alta
// y compararlo renglón a renglón con el pseudocódigo de la §7 del manual.
//
// Todas las funciones son puras salvo tirarDado(): reciben un estado
// y devuelven uno NUEVO, sin modificar nunca el que recibieron.

// ---------------------------------------------------------------------------
// Los números del manual. Ningún otro archivo del proyecto los repite.
// ---------------------------------------------------------------------------

// §3 — valores iniciales de las siete variables
export const TURNO_FINAL = 12
export const COMBUSTIBLE_INICIAL = 25
export const CAJAS_POR_LADO = 5
export const META_CAJAS = 8

// §3 — "El barco aguanta hasta 3 marcas hacia cada lado. Al llegar a 4, se vuelca."
export const MARCA_DE_VUELCO = 4

export const IZQUIERDA = 'IZQUIERDA'
export const DERECHA = 'DERECHA'

// §4 paso 4b — cada cuántos turnos abordan los piratas
export const PIRATAS_CADA = 3

// §5 — las tres acciones, con su costo y cuántas cajas pide su precondición
export const ACCIONES = {
  BAJAR_UNA: {
    id: 'BAJAR_UNA',
    nombre: 'Bajar una caja',
    costo: 2,
    cajasQuePide: 1,
    cajasQueBaja: 1,
  },
  DESCARGA_DOBLE: {
    id: 'DESCARGA_DOBLE',
    nombre: 'Descarga doble',
    costo: 5,
    cajasQuePide: 2,
    cajasQueBaja: 2,
  },
  CRUZAR: {
    id: 'CRUZAR',
    nombre: 'Cruzar la grúa',
    costo: 3,
    cajasQuePide: 0,
    cajasQueBaja: 0,
  },
}

// §6 — los nombres exactos de las cuatro condiciones de fin
export const CAUSAS = {
  CARGA_ENTREGADA: 'Carga entregada',
  VUELCO: 'El barco se vuelca',
  GRUA_PARADA: 'La grúa queda parada',
  ZARPA_CARGADO: 'El barco zarpa cargado',
}

// ---------------------------------------------------------------------------
// La aguja
// ---------------------------------------------------------------------------

// La aguja es "un solo número acompañado de un lado" (§3).
// En 0 el barco está derecho y no apunta a ningún lado: lado vale null.

// §3 — el lado contrario al que se le pasa
export function ladoContrario(lado) {
  return lado === IZQUIERDA ? DERECHA : IZQUIERDA
}

// §3 — "Qué significa mover la aguja una marca hacia un lado", los tres casos
export function moverAguja(aguja, hacia) {
  // Caso 1: si la aguja apunta al lado contrario, su número baja 1.
  if (aguja.lado !== null && aguja.lado !== hacia) {
    const numero = aguja.numero - 1
    // Caso 2: si la aguja queda en 0, el barco está derecho y ya no apunta a ningún lado.
    if (numero === 0) {
      return { numero: 0, lado: null }
    }
    return { numero: numero, lado: aguja.lado }
  }
  // Caso 3: si está en 0 o ya apunta a ese mismo lado, su número sube 1 y apunta a ese lado.
  return { numero: aguja.numero + 1, lado: hacia }
}

// §3 — cómo se escribe la aguja: "2 hacia la derecha", o "0" si el barco está derecho
export function textoAguja(aguja) {
  if (aguja.numero === 0) {
    return '0'
  }
  return aguja.numero + ' hacia la ' + aguja.lado.toLowerCase()
}

// §3 — "Al llegar a 4, se vuelca"
export function estaVolcado(estado) {
  return estado.aguja.numero >= MARCA_DE_VUELCO
}

// §3 — la escala dibujada del manual, de 4 izquierda a 4 derecha, para que la
// interfaz no tenga que saber cuánto mide ni dónde están las marcas de vuelco.
export function escalaDeLaAguja() {
  const marcas = []
  for (let n = MARCA_DE_VUELCO; n >= 1; n--) {
    marcas.push({ numero: n, lado: IZQUIERDA, vuelca: n === MARCA_DE_VUELCO })
  }
  marcas.push({ numero: 0, lado: null, vuelca: false })
  for (let n = 1; n <= MARCA_DE_VUELCO; n++) {
    marcas.push({ numero: n, lado: DERECHA, vuelca: n === MARCA_DE_VUELCO })
  }
  return marcas
}

// ---------------------------------------------------------------------------
// El estado
// ---------------------------------------------------------------------------

// §7 preparar la partida, pasos 1 a 3 — las siete variables de la §3 más el registro
export function estadoInicial(ladoGrua) {
  return {
    turno: 1,
    combustible: COMBUSTIBLE_INICIAL,
    cajasIzquierda: CAJAS_POR_LADO,
    cajasDerecha: CAJAS_POR_LADO,
    gruaEn: ladoGrua,
    aguja: { numero: 0, lado: null },
    cajasBajadas: 0,
    registro: [
      {
        turno: 1,
        texto: 'La grúa arranca en la ' + ladoGrua.toLowerCase() + '.',
        seccion: '§3',
      },
    ],
  }
}

// §6 — carga disponible: la que sigue a bordo más la que ya se entregó. Es el techo
// de lo que todavía se puede llegar a entregar.
export function cargaDisponible(estado) {
  return estado.cajasIzquierda + estado.cajasDerecha + estado.cajasBajadas
}

// §6 — cuántas cajas más se pueden perder sin que la meta quede fuera de alcance
export function margenDeCarga(estado) {
  return cargaDisponible(estado) - META_CAJAS
}

// §3 — el barco está a una sola marca de volcarse
export function estaEnPeligro(estado) {
  return estado.aguja.numero === MARCA_DE_VUELCO - 1
}

// §3 — cuántas cajas quedan del lado donde está parada la grúa
export function cajasDelLadoDeLaGrua(estado) {
  return estado.gruaEn === IZQUIERDA ? estado.cajasIzquierda : estado.cajasDerecha
}

// Copia el estado con los cambios indicados. Nunca modifica el original.
function conCambios(estado, cambios) {
  return Object.assign({}, estado, cambios)
}

// Agrega un renglón a la bitácora sin tocar el registro anterior.
function conRenglon(estado, texto, seccion, datos) {
  const renglon = { turno: estado.turno, texto: texto, seccion: seccion }
  return conCambios(estado, {
    registro: estado.registro.concat([Object.assign(renglon, datos)]),
  })
}

// ---------------------------------------------------------------------------
// La secuencia del turno (§4)
// ---------------------------------------------------------------------------

// §4 paso 2 — tirar el dado. La única función no pura del módulo, aislada a propósito.
export function tirarDado() {
  return Math.floor(Math.random() * 6) + 1
}

// §4 paso 3 — la etiqueta con que el viento firma su renglón de la bitácora
export const SECCION_VIENTO = '§4 paso 3'

// §4 paso 3 — qué cara del dado hace qué.
// Estas dos constantes son la única fuente: la regla de abajo y la tabla que ve el
// jugador salen las dos de acá, así que no pueden discrepar.
export const CARAS_QUE_SOPLAN = [5, 6]
export const CARA_QUE_ENDEREZA = 1

const CARAS_DEL_DADO = [1, 2, 3, 4, 5, 6]
const CARAS_SIN_EFECTO = CARAS_DEL_DADO.filter(
  (cara) => cara !== CARA_QUE_ENDEREZA && !CARAS_QUE_SOPLAN.includes(cara)
)

// §4 paso 3 — la tabla del dado, para que la interfaz pueda mostrarla sin conocer la regla
export const TABLA_DEL_DADO = [
  {
    caras: [CARA_QUE_ENDEREZA],
    nombre: 'Mar en calma',
    efecto: 'La aguja baja 1 marca hacia el lado contrario. Puede cruzar el 0.',
    corto: 'endereza 1 marca',
  },
  {
    caras: CARAS_SIN_EFECTO,
    nombre: 'Sin novedad',
    efecto: 'El viento no toca el barco.',
    corto: 'no pasa nada',
  },
  {
    caras: CARAS_QUE_SOPLAN,
    nombre: 'Racha de viento',
    efecto: 'La aguja sube 1 marca hacia el lado al que ya está inclinado.',
    corto: 'inclina 1 marca más',
  },
]

// §4 paso 3 — qué le toca a esta tirada
export function efectoDelDado(dado) {
  return TABLA_DEL_DADO.find((fila) => fila.caras.includes(dado))
}

// §4 paso 3 — viento
export function aplicarViento(estado, dado) {
  const fila = efectoDelDado(dado)
  const encabezado = 'Dado ' + dado + ' — ' + fila.nombre + '. '

  // "Con el barco derecho el viento no tiene de dónde agarrarlo."
  if (estado.aguja.numero === 0) {
    return conRenglon(
      estado,
      encabezado + 'El barco está derecho, así que el viento no lo mueve.',
      SECCION_VIENTO
    )
  }

  // "Si salió 5 o 6, la aguja sube 1 hacia el lado al que ya está apuntando."
  if (CARAS_QUE_SOPLAN.includes(dado)) {
    const aguja = moverAguja(estado.aguja, estado.aguja.lado)
    const nuevo = conCambios(estado, { aguja: aguja })
    return conRenglon(nuevo, encabezado + 'La aguja sube a ' + textoAguja(aguja) + '.', SECCION_VIENTO)
  }

  // "Si salió 1, la aguja baja 1 hacia el lado contrario. Puede cruzar el 0."
  if (dado === CARA_QUE_ENDEREZA) {
    const aguja = moverAguja(estado.aguja, ladoContrario(estado.aguja.lado))
    const nuevo = conCambios(estado, { aguja: aguja })
    return conRenglon(nuevo, encabezado + 'La aguja baja a ' + textoAguja(aguja) + '.', SECCION_VIENTO)
  }

  // "En cualquier otro caso no pasa nada."
  return conRenglon(estado, encabezado + 'El viento no toca el barco.', SECCION_VIENTO)
}

// §4 paso 4b — la etiqueta con que el abordaje firma su renglón de la bitácora
export const SECCION_PIRATAS = '§4 paso 4b'

// §4 paso 4b — cuántos turnos faltan para el próximo abordaje. 0 quiere decir que
// los piratas abordan en este mismo turno. Se deduce del turno: no es una variable nueva.
export function turnosParaElAbordaje(estado) {
  return (PIRATAS_CADA - (estado.turno % PIRATAS_CADA)) % PIRATAS_CADA
}

// §4 paso 4b — abordaje pirata
export function aplicarPiratas(estado) {
  // "Los piratas rondan el puerto y abordan cada 3 turnos."
  if (turnosParaElAbordaje(estado) !== 0) {
    return estado
  }

  // "Abordan por el costado donde está trabajando la grúa."
  const costado = estado.gruaEn
  const cajasAhi = cajasDelLadoDeLaGrua(estado)

  // "Si no encuentran carga de ese lado, se retiran con las manos vacías."
  if (cajasAhi === 0) {
    return conRenglon(
      estado,
      'Los piratas abordan por la ' + costado.toLowerCase() + ' y no encuentran carga. Se retiran.',
      SECCION_PIRATAS,
      { robo: 0, marcas: 0 }
    )
  }

  // "Se llevan 1 caja de ese costado. Esa caja NO cuenta como entregada."
  const cambios =
    costado === IZQUIERDA
      ? { cajasIzquierda: estado.cajasIzquierda - 1 }
      : { cajasDerecha: estado.cajasDerecha - 1 }

  // Le sacaron peso a ese costado, así que la aguja se mueve hacia el contrario,
  // igual que cuando la grúa baja una caja (§5).
  cambios.aguja = moverAguja(estado.aguja, ladoContrario(costado))

  // "Los piratas no se llevan la caja si eso volcaría el barco: quieren la carga,
  // no un naufragio." Ven al barco escorado y se retiran con las manos vacías.
  if (cambios.aguja.numero >= MARCA_DE_VUELCO) {
    return conRenglon(
      estado,
      'Los piratas abordan por la ' +
        costado.toLowerCase() +
        ' pero el barco está demasiado escorado: se retiran sin la caja.',
      SECCION_PIRATAS,
      { robo: 0, marcas: 0 }
    )
  }

  const nuevo = conCambios(estado, cambios)

  // El aviso importa: el abordaje suele dejar el barco a una marca del vuelco, y esa
  // es la conexión que cuesta ver mientras se juega.
  const aviso = estaEnPeligro(nuevo) ? ' Una marca más y el barco vuelca.' : ''

  return conRenglon(
    nuevo,
    'Los piratas abordan por la ' +
      costado.toLowerCase() +
      ' y roban 1 caja. No cuenta como entregada. La aguja sube a ' +
      textoAguja(nuevo.aguja) +
      '.' +
      aviso,
    SECCION_PIRATAS,
    { robo: 1, marcas: 1 }
  )
}

// §4 paso 4b — qué hicieron los piratas en toda la partida. Sale del registro, así que
// no hace falta guardar nada extra en el estado.
export function resumenDeLosPiratas(estado) {
  const abordajes = estado.registro.filter((r) => r.seccion === SECCION_PIRATAS)
  return {
    abordajes: abordajes.length,
    cajasRobadas: abordajes.reduce((total, r) => total + r.robo, 0),
    marcasEmpujadas: abordajes.reduce((total, r) => total + r.marcas, 0),
  }
}

// §5 — precondiciones de las tres acciones. Una sola fuente para el paso 5 y el paso 7.
export function accionesLegales(estado) {
  const cajas = cajasDelLadoDeLaGrua(estado)
  const legales = {}

  for (const id of Object.keys(ACCIONES)) {
    const accion = ACCIONES[id]

    // Precondición de cajas: "hay al menos N cajas del lado donde está la grúa".
    // Cruzar la grúa pide 0 cajas: "nunca es ilegal por falta de cajas" (§5).
    if (cajas < accion.cajasQuePide) {
      legales[id] = {
        legal: false,
        motivo:
          'Hacen falta ' +
          accion.cajasQuePide +
          (accion.cajasQuePide === 1 ? ' caja' : ' cajas') +
          ' del lado de la grúa y quedan ' +
          cajas +
          '.',
      }
      continue
    }

    // Precondición de combustible: "y el combustible es N o más".
    if (estado.combustible < accion.costo) {
      legales[id] = {
        legal: false,
        motivo: 'Cuesta ' + accion.costo + ' de combustible y quedan ' + estado.combustible + '.',
      }
      continue
    }

    legales[id] = { legal: true, motivo: '' }
  }

  return legales
}

// §4 paso 5 — "Si ninguna cumple su precondición, la grúa queda parada"
export function hayAlgunaAccionLegal(estado) {
  const legales = accionesLegales(estado)
  return Object.keys(legales).some((id) => legales[id].legal)
}

// §4 pasos 8 a 12 — cobrar el costo y aplicar el efecto de la acción elegida
export function ejecutarAccion(estado, idAccion) {
  const accion = ACCIONES[idAccion]

  // §4 paso 8 — cobrar el costo
  let nuevo = conCambios(estado, { combustible: estado.combustible - accion.costo })
  nuevo = conRenglon(
    nuevo,
    accion.nombre + '. Cuesta ' + accion.costo + ', quedan ' + nuevo.combustible + '.',
    '§4 paso 8'
  )

  // §4 paso 9 — aplicar el efecto (§5)
  if (accion.id === ACCIONES.CRUZAR.id) {
    // "La grúa pasa al otro lado. No se baja ninguna caja y la aguja no se mueve."
    const otroLado = ladoContrario(nuevo.gruaEn)
    nuevo = conCambios(nuevo, { gruaEn: otroLado })
    return conRenglon(
      nuevo,
      'La grúa pasa a la ' + otroLado.toLowerCase() + '. La aguja sigue en ' + textoAguja(nuevo.aguja) + '.',
      '§5'
    )
  }

  // §5 y §7 paso 13 — bajar cajas de a una, revisando el vuelco después de cada marca.
  for (let i = 0; i < accion.cajasQueBaja; i++) {
    nuevo = bajarUnaCaja(nuevo)

    // §7 paso 14 — "Si en cualquier momento del paso 13 la aguja llegó a 4, el barco
    // se vuelca: terminar la partida sin bajar la segunda caja."
    if (estaVolcado(nuevo)) {
      const faltaban = accion.cajasQueBaja - (i + 1)
      const aviso = faltaban > 0 ? ' La caja que faltaba no se baja.' : ''
      return conRenglon(
        nuevo,
        'La aguja llegó a ' + MARCA_DE_VUELCO + ': el barco se vuelca.' + aviso,
        '§5'
      )
    }
  }

  return nuevo
}

// §5 fila "Bajar una caja" — el efecto de una sola caja, que la descarga doble repite
function bajarUnaCaja(estado) {
  // "Se quita 1 caja de ese lado."
  const cambios =
    estado.gruaEn === IZQUIERDA
      ? { cajasIzquierda: estado.cajasIzquierda - 1 }
      : { cajasDerecha: estado.cajasDerecha - 1 }

  // "Las cajas bajadas suben 1."
  cambios.cajasBajadas = estado.cajasBajadas + 1

  // "La aguja se mueve 1 marca hacia el lado contrario al de la grúa."
  cambios.aguja = moverAguja(estado.aguja, ladoContrario(estado.gruaEn))

  const nuevo = conCambios(estado, cambios)
  return conRenglon(
    nuevo,
    'Baja 1 caja de la ' +
      estado.gruaEn.toLowerCase() +
      '. Bajadas: ' +
      nuevo.cajasBajadas +
      ' de ' +
      META_CAJAS +
      '. Aguja: ' +
      textoAguja(nuevo.aguja) +
      '.',
    '§5'
  )
}

// ---------------------------------------------------------------------------
// Fin de partida (§6), con la prioridad de la §9 caso 1
// ---------------------------------------------------------------------------

// Los tres momentos en que el manual manda revisar el fin de la partida.
export const MOMENTOS = {
  TRAS_LAS_AMENAZAS: 'TRAS_LAS_AMENAZAS', // §4 paso 4: después del viento y del abordaje
  ANTES_DE_ELEGIR: 'ANTES_DE_ELEGIR', // §4 paso 5
  DESPUES_DE_LA_ACCION: 'DESPUES_DE_LA_ACCION', // §4 pasos 10, 11 y 12
}

// §6 y §9 caso 1 — primero el vuelco, después la victoria, y al final el tiempo
export function revisarFin(estado, momento) {
  // §4 paso 4 — revisar si el barco se volcó, antes de que el jugador elija acción
  if (momento === MOMENTOS.TRAS_LAS_AMENAZAS) {
    if (estaVolcado(estado)) {
      return { resultado: 'PERDIÓ', causa: CAUSAS.VUELCO, seccionDelManual: '§4 paso 4' }
    }
    return null
  }

  // §4 paso 5 — revisar si la grúa quedó parada
  if (momento === MOMENTOS.ANTES_DE_ELEGIR) {
    if (!hayAlgunaAccionLegal(estado)) {
      return { resultado: 'PERDIÓ', causa: CAUSAS.GRUA_PARADA, seccionDelManual: '§4 paso 5' }
    }
    return null
  }

  // §4 paso 10 — revisar si el barco se volcó
  if (estaVolcado(estado)) {
    return { resultado: 'PERDIÓ', causa: CAUSAS.VUELCO, seccionDelManual: '§4 paso 10' }
  }

  // §4 paso 11 — revisar si ganó
  if (estado.cajasBajadas >= META_CAJAS) {
    return { resultado: 'GANÓ', causa: CAUSAS.CARGA_ENTREGADA, seccionDelManual: '§4 paso 11' }
  }

  // §4 paso 12 — revisar si se acabó el tiempo
  if (estado.turno === TURNO_FINAL) {
    return { resultado: 'PERDIÓ', causa: CAUSAS.ZARPA_CARGADO, seccionDelManual: '§4 paso 12' }
  }

  return null
}

// §6 y §9 — por qué terminó así, dicho en castellano y con los números a la vista.
// Vive acá y no en la interfaz porque distinguir los dos motivos de "grúa parada"
// (§9 caso 3) y saber quién empujó la aguja son cosas de las reglas.
export function explicacionDelFinal(estado, fin) {
  if (fin.causa === CAUSAS.CARGA_ENTREGADA) {
    return {
      titulo: 'Entregaste la carga',
      detalle:
        'Bajaste ' +
        estado.cajasBajadas +
        ' cajas de las ' +
        META_CAJAS +
        ' que hacían falta, en ' +
        estado.turno +
        ' turnos, y te sobraron ' +
        estado.combustible +
        ' de combustible.',
    }
  }

  if (fin.causa === CAUSAS.VUELCO) {
    // El último renglón del registro dice qué fue lo que empujó la aguja hasta el final.
    const ultimo = estado.registro[estado.registro.length - 1]
    // Solo hay dos culpables posibles: el viento del paso 3 o la descarga del jugador.
    // Los piratas nunca aparecen acá porque se retiran antes de volcar el barco (§4 paso 4b).
    const culpable =
      ultimo.seccion === SECCION_VIENTO
        ? 'Te volcó el viento'
        : 'Te volcaste solo, con tu propia descarga'
    return {
      titulo: culpable,
      detalle:
        'La aguja llegó a ' +
        textoAguja(estado.aguja) +
        '. El barco aguanta hasta ' +
        (MARCA_DE_VUELCO - 1) +
        ' marcas hacia cada lado; en ' +
        MARCA_DE_VUELCO +
        ' se da vuelta.',
    }
  }

  if (fin.causa === CAUSAS.GRUA_PARADA) {
    const masBarato = Math.min(...Object.keys(ACCIONES).map((id) => ACCIONES[id].costo))

    // §9 caso 3, primer motivo: no alcanza para nada.
    if (estado.combustible < masBarato) {
      return {
        titulo: 'Te quedaste sin combustible',
        detalle:
          'Te quedan ' +
          estado.combustible +
          ' y la acción más barata cuesta ' +
          masBarato +
          '. Ya no se puede hacer ninguna jugada.',
      }
    }

    // §9 caso 3, segundo motivo: la grúa quedó del lado vacío y no alcanza para cruzar.
    return {
      titulo: 'La grúa quedó del lado vacío',
      detalle:
        'No queda ninguna caja en la ' +
        estado.gruaEn.toLowerCase() +
        ', que es donde está la grúa, y cruzar cuesta ' +
        ACCIONES.CRUZAR.costo +
        ': te quedan ' +
        estado.combustible +
        '. El barco puede estar derecho y sobrarte turnos: igual no hay jugada legal.',
    }
  }

  // §6 — el barco zarpa cargado
  return {
    titulo: 'Se acabó el tiempo',
    detalle:
      'Era el turno ' +
      TURNO_FINAL +
      ' y bajaste ' +
      estado.cajasBajadas +
      ' cajas de las ' +
      META_CAJAS +
      ' que hacían falta. El barco zarpa con la carga a bordo.',
  }
}

// ---------------------------------------------------------------------------
// El turno completo, para que la interfaz no tenga que conocer ninguna regla
// ---------------------------------------------------------------------------

// §4 pasos 2 a 5 — dado, viento, vuelco, abordaje y grúa parada
export function iniciarTurno(estado, dado) {
  // §4 pasos 2 y 3
  const conViento = aplicarViento(estado, dado)

  // §4 paso 4 — el vuelco por viento termina la partida antes de que nadie mas juegue,
  // asi la aguja nunca pasa de la marca de vuelco.
  const finPorViento = revisarFin(conViento, MOMENTOS.TRAS_LAS_AMENAZAS)
  if (finPorViento) {
    return { estado: conViento, fin: finPorViento }
  }

  // §4 paso 4b — el abordaje nunca vuelca el barco: los piratas se retiran antes.
  const conPiratas = aplicarPiratas(conViento)

  // §4 paso 5
  const finPorGruaParada = revisarFin(conPiratas, MOMENTOS.ANTES_DE_ELEGIR)
  if (finPorGruaParada) {
    return { estado: conPiratas, fin: finPorGruaParada }
  }

  return { estado: conPiratas, fin: null }
}

// §4 pasos 7 a 13 — verificar la precondición, ejecutar, revisar los finales y avanzar
export function jugar(estado, idAccion) {
  // §4 paso 7 — "Si la acción elegida no cumple su precondición, la jugada es ilegal:
  // no pasa absolutamente nada, no se gasta combustible, y el jugador vuelve a elegir."
  const legales = accionesLegales(estado)
  if (!legales[idAccion].legal) {
    return { estado: estado, fin: null, ilegal: true, motivo: legales[idAccion].motivo }
  }

  // §4 pasos 8 y 9
  const jugado = ejecutarAccion(estado, idAccion)

  // §4 pasos 10, 11 y 12, en ese orden
  const fin = revisarFin(jugado, MOMENTOS.DESPUES_DE_LA_ACCION)
  if (fin) {
    return { estado: jugado, fin: fin, ilegal: false, motivo: '' }
  }

  // §4 paso 13 — pasar al turno siguiente
  const siguiente = conCambios(jugado, { turno: jugado.turno + 1 })
  return { estado: siguiente, fin: null, ilegal: false, motivo: '' }
}

// ---------------------------------------------------------------------------
// El manual, para leerlo dentro del juego
// ---------------------------------------------------------------------------
//
// Vive acá y no en el HTML por la misma razón que todo lo demás: los números que
// lee el jugador salen de las constantes de arriba. Si mañana cambia un costo,
// el manual cambia solo. No hay forma de que el texto y las reglas discrepen.

// §3 — la escala de la aguja dibujada con las marcas que devuelve escalaDeLaAguja()
function escalaEnTexto() {
  const casillas = escalaDeLaAguja()
  const numeros = casillas.map((m) => String(m.numero).padStart(2, ' ')).join(' ')
  const cruces = casillas.map((m) => (m.vuelca ? ' X' : '  ')).join(' ')
  return 'IZQUIERDA  ' + numeros + '  DERECHA\n           ' + cruces
}

// Enumera una lista en castellano: "1", "1 y 2", "2, 3 o 4".
function enumerar(cosas, union) {
  if (cosas.length === 1) {
    return String(cosas[0])
  }
  return cosas.slice(0, -1).join(', ') + ' ' + union + ' ' + cosas[cosas.length - 1]
}

// §5 — una fila de la tabla de acciones, con su precondición escrita en palabras
function filaDeAccion(accion) {
  const combustible = 'el combustible sea ' + accion.costo + ' o más'
  const precondicion =
    accion.cajasQuePide === 0
      ? 'Solo pide que ' +
        combustible +
        '. Nunca es ilegal por falta de cajas: se puede cruzar aunque el barco esté vacío.'
      : 'Que haya al menos ' +
        accion.cajasQuePide +
        (accion.cajasQuePide === 1 ? ' caja' : ' cajas') +
        ' del lado donde está la grúa, y que ' +
        combustible +
        '.'
  return [accion.nombre, precondicion, String(accion.costo)]
}

export const MANUAL = [
  {
    seccion: '§1',
    titulo: 'Qué es AFLOAT',
    bloques: [
      {
        p:
          'Manejas una grúa de puerto y tienes que bajar la carga de un barco antes de ' +
          'quedarte sin tiempo o sin combustible. La dificultad no es bajar cajas: es ' +
          'bajarlas sin sacar demasiado peso de un mismo lado, porque el barco se inclina ' +
          'y se vuelca.',
      },
      {
        p:
          'Juegas contra un sistema de reglas fijas. El sistema no juega: solo aplica ' +
          'lo que dice este manual. No hay nada oculto.',
      },
    ],
  },
  {
    seccion: '§2',
    titulo: 'Objetivo',
    bloques: [
      {
        p:
          'Bajar ' +
          META_CAJAS +
          ' cajas antes de que termine el turno ' +
          TURNO_FINAL +
          '. El barco trae ' +
          CAJAS_POR_LADO * 2 +
          ' cajas en total, así que no hace falta vaciarlo: alcanza con ' +
          META_CAJAS +
          '.',
      },
      { p: 'Hay una sola forma de ganar y tres formas distintas de perder. Están todas en la §6.' },
    ],
  },
  {
    seccion: '§3',
    titulo: 'Las siete variables',
    bloques: [
      { p: 'Todo el estado del juego cabe en siete números. Están siempre a la vista en la hoja de estado.' },
      {
        tabla: {
          encabezados: ['Variable', 'Empieza en', 'Qué representa'],
          filas: [
            ['Turno', '1 de ' + TURNO_FINAL, 'En qué turno va la partida. Sube de a 1.'],
            ['Combustible', String(COMBUSTIBLE_INICIAL), 'Lo que le queda a la grúa. Solo baja, nunca se recupera.'],
            ['Cajas izquierda', String(CAJAS_POR_LADO), 'Cuántas cajas quedan del lado izquierdo.'],
            ['Cajas derecha', String(CAJAS_POR_LADO), 'Cuántas cajas quedan del lado derecho.'],
            ['Grúa en', 'La eliges tú', 'De qué lado está parada la grúa: IZQUIERDA o DERECHA.'],
            ['Aguja', '0', 'Cuánto está inclinado el barco: un número y un lado.'],
            ['Cajas bajadas', '0 de ' + META_CAJAS, 'Cuántas cajas se bajaron ya. Al llegar a ' + META_CAJAS + ' se gana.'],
          ],
        },
      },
      { subtitulo: 'Cómo se lee la aguja' },
      {
        p:
          'La aguja es un solo número acompañado de un lado. Se escribe "2 hacia la derecha", ' +
          'que quiere decir que el lado derecho está más pesado. En 0 el barco está derecho y ' +
          'no apunta a ningún lado.',
      },
      { pre: escalaEnTexto() },
      {
        p:
          'El barco aguanta hasta ' +
          (MARCA_DE_VUELCO - 1) +
          ' marcas hacia cada lado. Al llegar a ' +
          MARCA_DE_VUELCO +
          ' (las dos X) se vuelca.',
      },
      { subtitulo: 'Qué significa mover la aguja una marca hacia un lado' },
      {
        p: 'Es la única regla que hay que leer despacio, así que va con sus tres casos separados:',
      },
      {
        pasos: [
          {
            n: '1',
            texto:
              'Si la aguja apunta al lado contrario, su número baja 1. ' +
              'Ejemplo: está en 2 hacia la derecha, se mueve hacia la izquierda, queda en 1 hacia la derecha.',
          },
          {
            n: '2',
            texto:
              'Si la aguja queda en 0, el barco está derecho y ya no apunta a ningún lado. ' +
              'Ejemplo: está en 1 hacia la derecha, se mueve hacia la izquierda, queda en 0.',
          },
          {
            n: '3',
            texto:
              'Si está en 0 o ya apunta a ese mismo lado, su número sube 1 y apunta a ese lado. ' +
              'Ejemplo: está en 0, se mueve hacia la izquierda, queda en 1 hacia la izquierda.',
          },
        ],
      },
    ],
  },
  {
    seccion: '§4',
    titulo: 'La secuencia de un turno',
    bloques: [
      { p: 'Un turno tiene siempre estos pasos, siempre en este orden, sin saltarse ninguno.' },
      {
        pasos: [
          { n: '1', texto: 'Escribir el estado. Los siete renglones tal como están al empezar el turno.' },
          { n: '2', texto: 'Tirar el dado. Se tira en todos los turnos, incluido el primero.' },
          {
            n: '3',
            texto:
              'Aplicar el viento. Con el barco derecho el viento no tiene de dónde agarrarlo y ' +
              'no pasa nada. Si no, manda la tabla del dado: ' +
              TABLA_DEL_DADO.map((f) => enumerar(f.caras, 'o') + ' → ' + f.corto).join('; ') +
              '.',
          },
          {
            n: '4',
            texto:
              'Revisar si el barco se volcó. Si la aguja quedó en ' +
              MARCA_DE_VUELCO +
              ', se vuelca: la partida termina y pierdes. No se juega la acción de este turno.',
          },
          {
            n: '4b',
            texto:
              'Abordaje pirata. Los piratas abordan cada ' +
              PIRATAS_CADA +
              ' turnos por el costado donde está trabajando la grúa. Se llevan 1 caja de ese ' +
              'costado y esa caja NO cuenta como entregada. Como le sacaron peso a ese lado, ' +
              'la aguja se mueve 1 marca hacia el contrario, igual que si la hubieras bajado tú. ' +
              'Si no encuentran carga de ese lado se retiran con las manos vacías, y tampoco se ' +
              'llevan la caja si eso volcaría el barco: quieren la carga, no un naufragio.',
          },
          {
            n: '5',
            texto:
              'Revisar si la grúa quedó parada. Mirar las tres acciones de la §5. Si ninguna ' +
              'cumple su precondición, la partida termina y pierdes.',
          },
          { n: '6', texto: 'Elegir una acción. Una sola de las tres. No se puede pasar el turno sin hacer nada.' },
          {
            n: '7',
            texto:
              'Verificar la precondición. Si la acción elegida no la cumple, la jugada es ilegal: ' +
              'no pasa absolutamente nada, no se gasta combustible, y vuelves al paso 6.',
          },
          { n: '8', texto: 'Cobrar el costo. Restarle al combustible el costo de la acción elegida.' },
          { n: '9', texto: 'Aplicar el efecto. Cambiar el estado exactamente como dice la §5.' },
          { n: '10', texto: 'Revisar si el barco se volcó. Si la aguja quedó en ' + MARCA_DE_VUELCO + ', pierdes.' },
          { n: '11', texto: 'Revisar si ganaste. Si las cajas bajadas llegaron a ' + META_CAJAS + ', ganas.' },
          { n: '12', texto: 'Revisar si se acabó el tiempo. Si este era el turno ' + TURNO_FINAL + ', pierdes.' },
          { n: '13', texto: 'Pasar al turno siguiente. Sumarle 1 al turno y volver al paso 1.' },
        ],
      },
      {
        nota:
          'El orden de los pasos 10, 11 y 12 importa y no se puede cambiar: es lo que decide ' +
          'qué pasa cuando dos finales caen en el mismo turno. Está explicado en la §9.',
      },
    ],
  },
  {
    seccion: '§5',
    titulo: 'Las tres acciones',
    bloques: [
      { p: 'En cada turno se hace una sola acción. Estas son todas las que existen.' },
      {
        tabla: {
          encabezados: ['Acción', 'Cuándo se puede', 'Cuesta'],
          filas: Object.keys(ACCIONES).map((id) => filaDeAccion(ACCIONES[id])),
        },
      },
      {
        tabla: {
          encabezados: ['Acción', 'Qué le hace al estado'],
          filas: [
            [
              ACCIONES.BAJAR_UNA.nombre,
              'Se quita 1 caja de ese lado. Las cajas bajadas suben 1. La aguja se mueve 1 marca hacia el lado contrario al de la grúa.',
            ],
            [
              ACCIONES.DESCARGA_DOBLE.nombre,
              'Lo mismo que arriba, dos veces seguidas, de a una marca por vez. Si con la primera la aguja llega a ' +
                MARCA_DE_VUELCO +
                ', el barco se vuelca ahí mismo y la segunda caja no se baja.',
            ],
            [
              ACCIONES.CRUZAR.nombre,
              'La grúa pasa al otro lado. No se baja ninguna caja y la aguja no se mueve.',
            ],
          ],
        },
      },
      {
        lista: [
          'Bajar cajas de un lado aliviana ese lado, así que la aguja siempre se mueve hacia el lado contrario al de la grúa.',
          'En la descarga doble las dos marcas se mueven de a una, aplicando la regla de la §3 cada vez. Por eso la aguja puede cruzar el 0: de "1 hacia la derecha" pasa a "0" y después a "1 hacia la izquierda".',
          'Cruzar la grúa nunca es ilegal por falta de cajas: se puede cruzar aunque no quede ninguna, siempre que alcance el combustible.',
        ],
      },
    ],
  },
  {
    seccion: '§6',
    titulo: 'Cómo termina la partida',
    bloques: [
      {
        tabla: {
          encabezados: ['Condición', 'Cómo se verifica', 'Resultado'],
          filas: [
            [
              CAUSAS.CARGA_ENTREGADA,
              'En el paso 11, las cajas bajadas son ' + META_CAJAS + ' o más.',
              'GANÓ',
            ],
            [
              CAUSAS.VUELCO,
              'En el paso 4 o en el paso 10, la aguja está en ' + MARCA_DE_VUELCO + ' hacia cualquier lado.',
              'PERDIÓ',
            ],
            [
              CAUSAS.GRUA_PARADA,
              'En el paso 5, ninguna de las tres acciones cumple su precondición.',
              'PERDIÓ',
            ],
            [
              CAUSAS.ZARPA_CARGADO,
              'En el paso 12, el turno era el ' + TURNO_FINAL + ' y bajaste menos de ' + META_CAJAS + '.',
              'PERDIÓ',
            ],
          ],
        },
      },
      {
        p:
          'Hay una condición de victoria y tres de derrota, y cada una se revisa mirando un ' +
          'renglón distinto del estado: las cajas bajadas, la aguja, las acciones disponibles ' +
          'y el número de turno.',
      },
    ],
  },
  {
    seccion: '§9',
    titulo: 'Casos borde',
    bloques: [
      { subtitulo: 'Dos finales en el mismo turno' },
      {
        p:
          'Se revisa primero el vuelco, después la victoria, y al final el tiempo. Ese orden ' +
          'decide el resultado:',
      },
      {
        tabla: {
          encabezados: ['Si en la misma jugada...', 'Resultado'],
          filas: [
            [
              'bajas la caja número ' + META_CAJAS + ' y la aguja llega a ' + MARCA_DE_VUELCO,
              'PERDIÓ por vuelco. El vuelco se revisa primero.',
            ],
            [
              'bajas la caja número ' + META_CAJAS + ' y era el turno ' + TURNO_FINAL,
              'GANÓ. La victoria se revisa antes que el fin de tiempo.',
            ],
            [
              'la aguja llega a ' + MARCA_DE_VUELCO + ' y era el turno ' + TURNO_FINAL,
              'PERDIÓ por vuelco, no por tiempo. Se anota la causa correcta.',
            ],
          ],
        },
      },
      { subtitulo: 'El combustible queda exactamente en cero' },
      {
        p:
          'Llegar a 0 no termina la partida en ese instante. Lo que la termina es no tener ' +
          'ninguna acción legal, y eso se revisa recién al empezar el turno siguiente (paso 5). ' +
          'Por eso, si gastas tu último combustible bajando la caja número ' +
          META_CAJAS +
          ', ganas: la revisión de la grúa parada ya no llega a ocurrir.',
      },
      { subtitulo: 'No queda ninguna acción legal' },
      {
        p: 'Se revisa en el paso 5 de cada turno y puede pasar por dos motivos distintos:',
      },
      {
        lista: [
          'Por combustible: queda menos de ' +
            Math.min(...Object.keys(ACCIONES).map((id) => ACCIONES[id].costo)) +
            ', que es el costo de la acción más barata. Ninguna acción se puede pagar.',
          'Por carga y posición: no hay ninguna caja del lado donde está la grúa y no alcanza ' +
            'para cruzar, que cuesta ' +
            ACCIONES.CRUZAR.costo +
            '. Pierdes aunque el barco esté perfectamente derecho y todavía queden turnos.',
        ],
      },
      { subtitulo: 'El viento vuelca el barco sin que llegues a jugar' },
      {
        p:
          'Si la aguja está en ' +
          (MARCA_DE_VUELCO - 1) +
          ' y sale una cara que sopla, el viento la sube a ' +
          MARCA_DE_VUELCO +
          ' en el paso 3, y el paso 4 termina la partida antes de que elijas acción. Es legal ' +
          'y es intencional: dejar la aguja en ' +
          (MARCA_DE_VUELCO - 1) +
          ' es apostar a que no sople.',
      },
    ],
  },
  {
    seccion: '§10',
    titulo: 'Supuestos',
    bloques: [
      {
        p:
          'Estos tres puntos no estaban decididos y se resolvieron con la regla más simple. ' +
          'Se anotan acá para que quede claro que son decisiones y no descuidos.',
      },
      {
        pasos: [
          {
            n: '1',
            texto:
              'El dado se tira también en el turno 1, aunque la aguja esté en 0 y el viento no ' +
              'pueda hacer nada, para que la secuencia del turno sea siempre idéntica.',
          },
          {
            n: '2',
            texto:
              'El vuelco se revisa antes que la victoria. Si las dos cosas pasan en la misma ' +
              'jugada, pierdes: un barco volcado se lleva la carga al agua.',
          },
          {
            n: '3',
            texto:
              'Quedarse sin acciones legales es derrota inmediata, no un turno perdido. La ' +
              'partida ya está decidida, así que se termina ahí y se anota la causa.',
          },
        ],
      },
    ],
  },
]
