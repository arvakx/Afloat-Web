// AFLOAT — solo DOM y eventos.
// Este archivo no contiene ninguna regla del juego: todos los numeros, costos,
// precondiciones y condiciones de fin vienen de engine.js.

import {
  ACCIONES,
  CAUSAS,
  COMBUSTIBLE_INICIAL,
  DERECHA,
  IZQUIERDA,
  MANUAL,
  META_CAJAS,
  PIRATAS_CADA,
  SECCION_PIRATAS,
  SECCION_VIENTO,
  TURNO_FINAL,
  TABLA_DEL_DADO,
  accionesLegales,
  cargaDisponible,
  efectoDelDado,
  estaEnPeligro,
  explicacionDelFinal,
  escalaDeLaAguja,
  estadoInicial,
  iniciarTurno,
  jugar,
  margenDeCarga,
  resumenDeLosPiratas,
  textoAguja,
  tirarDado,
  turnosParaElAbordaje,
} from './engine.js'

// ---------------------------------------------------------------------------
// Estado de la pantalla
// ---------------------------------------------------------------------------

// El turno tiene dos tiempos, como en el manual: primero se mira el estado (paso 1) y
// recien despues se tira el dado. Asi cada muerte queda atribuida a su causa.
const ESPERANDO_DADO = 'ESPERANDO_DADO'
const ELIGIENDO_ACCION = 'ELIGIENDO_ACCION'
const TERMINADA = 'TERMINADA'

let estado = null
let fase = ESPERANDO_DADO
let fin = null
let dado = null
let soploDelViento = false // si el viento movio la aguja en el turno que se esta mostrando
let huboAbordaje = false // si los piratas abordaron en el turno que se esta mostrando
let valoresDibujados = {} // para resaltar el renglon que cambio

const $ = (id) => document.getElementById(id)

// Los siete renglones de la hoja de estado, con las etiquetas y el formato del manual.
const RENGLONES = [
  ['TURNO', (e) => e.turno + ' de ' + TURNO_FINAL],
  ['COMBUSTIBLE', (e) => String(e.combustible)],
  ['CAJAS IZQUIERDA', (e) => String(e.cajasIzquierda)],
  ['CAJAS DERECHA', (e) => String(e.cajasDerecha)],
  ['GRÚA EN', (e) => e.gruaEn],
  ['AGUJA', (e) => textoAguja(e.aguja)],
  ['CAJAS BAJADAS', (e) => e.cajasBajadas + ' de ' + META_CAJAS],
]

const ANCHO_ETIQUETA = 18 // ancho del renglon "ETIQUETA ....." antes del valor

// El tanque se pinta en rojo cuando ya no alcanza ni para la accion mas barata.
// El umbral no esta escrito aca: sale de los costos que declara el motor.
const COSTO_MAS_BARATO = Math.min(...Object.values(ACCIONES).map((a) => a.costo))

// ---------------------------------------------------------------------------
// Ciclo de la partida
// ---------------------------------------------------------------------------

function comenzarPartida(ladoGrua) {
  estado = estadoInicial(ladoGrua)
  fin = null
  dado = null
  soploDelViento = false
  huboAbordaje = false
  fase = ESPERANDO_DADO
  valoresDibujados = {}
  $('pantalla-titulo').hidden = true
  $('juego').hidden = false
  dibujar()
}

// Segundo tiempo del turno: se tira el dado y actuan el viento y los piratas.
function comenzarTurno() {
  dado = tirarDado()
  const agujaAntes = estado.aguja
  const turno = iniciarTurno(estado, dado)
  estado = turno.estado
  fin = turno.fin
  soploDelViento = textoAguja(estado.aguja) !== textoAguja(agujaAntes)

  // El abordaje deja su renglón firmado en la bitácora de este turno.
  huboAbordaje = estado.registro.some(
    (r) => r.seccion === SECCION_PIRATAS && r.turno === estado.turno
  )
  fase = fin ? TERMINADA : ELIGIENDO_ACCION
  dibujar()
}

function elegirAccion(idAccion) {
  const jugada = jugar(estado, idAccion)

  // Jugada ilegal: no pasa nada y el jugador vuelve a elegir.
  // Los botones ilegales ya estan deshabilitados, asi que esto no deberia ocurrir.
  if (jugada.ilegal) {
    return
  }

  estado = jugada.estado
  fin = jugada.fin
  fase = fin ? TERMINADA : ESPERANDO_DADO

  // Primer tiempo del turno siguiente: se muestra como quedo el barco y se espera.
  // El dado del turno que termino se limpia para no confundirlo con el que viene.
  if (!fin) {
    dado = null
    soploDelViento = false
    huboAbordaje = false
  }
  dibujar()
}

function volverAEmpezar() {
  estado = null
  fin = null
  dado = null
  fase = ESPERANDO_DADO
  $('juego').hidden = true
  $('cortina-fin').hidden = true
  $('pantalla-titulo').hidden = false
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------

function dibujar() {
  dibujarHud()
  dibujarEscena()
  dibujarAguja()
  dibujarDado()
  dibujarAcciones()
  dibujarPanel()
  dibujarBitacora()
  dibujarFin()
}

// Crea un elemento con clase y texto en una linea, que es lo que mas se repite.
function crear(tag, clase, texto) {
  const el = document.createElement(tag)
  if (clase) el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

// Llena un contenedor con n casillas iguales, marcando las primeras "llenas".
function dibujarCasillas(contenedor, total, llenas, clase) {
  contenedor.replaceChildren()
  for (let i = 0; i < total; i++) {
    contenedor.append(crear('span', i < llenas ? clase + ' llena' : clase))
  }
}

// -------------------------------------------------------------------- HUD

function dibujarHud() {
  // Turnos: un pip por turno del reloj, el actual parpadea.
  const pips = $('hud-turnos')
  pips.replaceChildren()
  for (let t = 1; t <= TURNO_FINAL; t++) {
    let clase = 'pip-turno'
    if (t < estado.turno) clase += ' gastado'
    if (t === estado.turno) clase += ' actual'
    pips.append(crear('span', clase))
  }
  $('hud-turno-cifra').textContent = estado.turno + ' / ' + TURNO_FINAL

  // Combustible: un segmento por unidad del tanque.
  const barra = $('hud-combustible')
  dibujarCasillas(barra, COMBUSTIBLE_INICIAL, estado.combustible, 'celda-combustible')
  barra.classList.toggle('critica', estado.combustible < COSTO_MAS_BARATO)
  $('hud-combustible-cifra').textContent = estado.combustible + ' / ' + COMBUSTIBLE_INICIAL

  // Carga: una ranura por caja que hace falta entregar.
  dibujarCasillas($('hud-carga'), META_CAJAS, estado.cajasBajadas, 'ranura')
  $('hud-carga-cifra').textContent = estado.cajasBajadas + ' / ' + META_CAJAS

  // Cuanta carga queda en juego y cuantas cajas mas se pueden perder. Es lo que hace
  // visible el robo: el margen arranca en las cajas de sobra y cada abordaje se come una.
  const margen = margenDeCarga(estado)
  const nota = $('hud-carga-margen')
  nota.textContent =
    margen === 0
      ? 'quedan ' + cargaDisponible(estado) + ': sin margen, no se puede perder ninguna más'
      : 'quedan ' + cargaDisponible(estado) + ' · margen ' + margen
  nota.classList.toggle('sin-margen', margen <= 0)

  // Piratas: cuenta regresiva hasta el próximo abordaje.
  const faltan = turnosParaElAbordaje(estado)
  dibujarCasillas($('hud-piratas'), PIRATAS_CADA, PIRATAS_CADA - faltan, 'pip-pirata')
  $('hud-piratas-cifra').textContent =
    faltan === 0 ? '¡ABORDAN AHORA!' : faltan === 1 ? 'en 1 turno' : 'en ' + faltan + ' turnos'
  $('hud-celda-piratas').classList.toggle('inminente', faltan === 0)
}

// ----------------------------------------------------------------- ESCENA

function dibujarEscena() {
  // El barco se inclina segun la aguja: marcas con signo, negativo a la izquierda.
  const marcas = estado.aguja.lado === DERECHA ? estado.aguja.numero : -estado.aguja.numero
  $('barco').style.setProperty('--marcas', String(marcas))

  // Las pilas de cajas que quedan a bordo, de cada lado.
  dibujarPila($('pila-izquierda'), estado.cajasIzquierda)
  dibujarPila($('pila-derecha'), estado.cajasDerecha)

  // La grua se para del lado que dice el estado.
  $('grua').classList.toggle('en-derecha', estado.gruaEn === DERECHA)

  // Los piratas se acercan por el costado donde trabaja la grua, que es por donde abordan.
  const pirata = $('pirata')
  pirata.style.setProperty('--lejania', String(turnosParaElAbordaje(estado)))
  pirata.classList.toggle('en-derecha', estado.gruaEn === DERECHA)
  pirata.classList.toggle('abordando', huboAbordaje)

  const grito = $('grito')
  grito.hidden = !huboAbordaje
  if (huboAbordaje) {
    const renglon = [...estado.registro].reverse().find((r) => r.seccion === SECCION_PIRATAS)
    grito.replaceChildren(
      crear('span', 'grito-titulo', '\u2620 ¡ABORDAJE!'),
      crear('span', 'grito-detalle', renglon ? renglon.texto : '')
    )
  }

  const escena = document.querySelector('.escena')
  escena.classList.toggle('volcada', fin !== null && fin.causa === CAUSAS.VUELCO)
  escena.classList.toggle('ganada', fin !== null && fin.causa === CAUSAS.CARGA_ENTREGADA)
}

function dibujarPila(contenedor, cuantas) {
  contenedor.replaceChildren()
  for (let i = 0; i < cuantas; i++) {
    contenedor.append(crear('div', 'caja'))
  }
}

// ------------------------------------------------------------ INCLINACION

function dibujarAguja() {
  const contenedor = $('aguja')
  contenedor.replaceChildren()

  for (const marca of escalaDeLaAguja()) {
    const esLaActual =
      marca.numero === estado.aguja.numero &&
      (marca.numero === 0 || marca.lado === estado.aguja.lado)

    let clase = 'marca'
    if (marca.vuelca) clase += ' vuelca'
    if (esLaActual) clase += ' actual'

    const casilla = crear('div', clase)
    casilla.append(crear('span', 'marca-numero', String(marca.numero)))
    casilla.append(crear('span', 'marca-pie', marca.vuelca ? 'VUELCA' : esLaActual ? '▲' : ''))
    contenedor.append(casilla)
  }

  $('aguja-lectura').textContent = 'Aguja en ' + textoAguja(estado.aguja)

  const peligro = estaEnPeligro(estado)
  const aviso = $('aviso-peligro')
  aviso.hidden = !peligro
  aviso.textContent = peligro ? '\u26A0 PELIGRO: una marca más y el barco vuelca' : ''
  contenedor.classList.toggle('en-peligro', peligro)
}

// ----------------------------------------------------------------- VIENTO

function dibujarDado() {
  const cubo = $('dado')
  cubo.dataset.cara = dado === null ? '' : String(dado)
  cubo.classList.toggle('sin-tirar', dado === null)
  cubo.classList.toggle('sopla', soploDelViento)

  // El boton solo existe en el primer tiempo del turno.
  const boton = $('boton-dado')
  boton.hidden = fase !== ESPERANDO_DADO
  $('boton-dado-sub').textContent = 'para empezar el turno ' + estado.turno

  // El ultimo renglon de la bitacora firmado por el viento dice si actuo y por que.
  if (dado === null) {
    $('dado-texto').textContent =
      'Turno ' + estado.turno + '. Mira cómo quedó el barco y después tira el dado.'
  } else {
    const renglon = [...estado.registro].reverse().find((r) => r.seccion === SECCION_VIENTO)
    $('dado-texto').textContent = renglon ? renglon.texto : ''
  }

  dibujarTablaDelDado()
}

// La tabla de efectos del dado, para que el jugador pueda planificar. Las caras y los
// textos salen del motor: aca no se sabe que hace cada numero.
function dibujarTablaDelDado() {
  const cuerpo = $('cuerpo-tabla-dado')
  cuerpo.replaceChildren()

  const filaQueSalio = dado === null ? null : efectoDelDado(dado)

  for (const fila of TABLA_DEL_DADO) {
    const tr = document.createElement('tr')
    if (fila === filaQueSalio) {
      tr.className = 'fila-activa'
    }

    const caras = crear('td', 'tabla-caras')
    for (const cara of fila.caras) {
      caras.append(crear('span', 'cara', String(cara)))
    }

    tr.append(caras, crear('td', 'tabla-nombre', fila.nombre), crear('td', 'tabla-efecto', fila.corto))
    cuerpo.append(tr)
  }
}

// --------------------------------------------------------------- ACCIONES

function dibujarAcciones() {
  const caja = $('acciones')
  caja.replaceChildren()

  const legales = accionesLegales(estado)
  const puedeElegir = fase === ELIGIENDO_ACCION

  for (const id of Object.keys(ACCIONES)) {
    const accion = ACCIONES[id]
    const permiso = legales[id]

    const boton = document.createElement('button')
    boton.type = 'button'
    boton.className = 'btn accion'
    boton.dataset.accion = id
    boton.disabled = !puedeElegir || !permiso.legal
    boton.addEventListener('click', () => elegirAccion(id))

    boton.append(crear('span', 'glifo'))
    boton.append(crear('span', 'nombre', accion.nombre))
    const detalle = !puedeElegir
      ? crear('span', 'detalle en-espera', 'Primero tira el dado')
      : permiso.legal
        ? crear('span', 'detalle', 'Cuesta ' + accion.costo + ' de combustible')
        : crear('span', 'detalle motivo', permiso.motivo)
    boton.append(detalle)

    caja.append(boton)
  }
}

// --------------------------------------------------------- HOJA DE ESTADO

function dibujarPanel() {
  const panel = $('panel-estado')
  panel.replaceChildren()

  for (const [etiqueta, leer] of RENGLONES) {
    const valor = leer(estado)
    const puntos = '.'.repeat(Math.max(1, ANCHO_ETIQUETA - etiqueta.length - 1))

    const linea = crear('div', 'renglon')
    linea.append(crear('span', null, etiqueta + ' ' + puntos + ' '))

    const der = crear('span', 'valor', valor)
    if (valoresDibujados[etiqueta] !== undefined && valoresDibujados[etiqueta] !== valor) {
      der.classList.add('cambio')
    }
    valoresDibujados[etiqueta] = valor

    linea.append(der)
    panel.append(linea)
  }
}

// --------------------------------------------------------------- BITACORA

function dibujarBitacora() {
  const lista = $('bitacora')
  lista.replaceChildren()

  for (const entrada of estado.registro) {
    const item = document.createElement('li')
    item.append(crear('span', 'bitacora-turno', 'T' + entrada.turno))
    item.append(crear('span', null, ' ' + entrada.texto + ' '))
    item.append(crear('span', 'bitacora-seccion', entrada.seccion))
    lista.append(item)
  }

  lista.scrollTop = lista.scrollHeight
}

// ---------------------------------------------------------- FIN DE PARTIDA

function dibujarFin() {
  $('cortina-fin').hidden = fin === null
  if (!fin) {
    return
  }

  const gano = fin.resultado === 'GANÓ'
  const cartel = $('cartel-fin')
  cartel.classList.toggle('gano', gano)
  cartel.classList.toggle('perdio', !gano)

  const porque = explicacionDelFinal(estado, fin)
  $('fin-resultado').textContent = fin.resultado
  $('fin-titulo').textContent = porque.titulo
  $('fin-detalle').textContent = porque.detalle
  $('fin-seccion').textContent = fin.causa + ' · ' + fin.seccionDelManual

  const resumen = $('fin-resumen')
  resumen.replaceChildren()
  const filas = [
    ['Turnos jugados', estado.turno + ' de ' + TURNO_FINAL],
    ['Cajas entregadas', estado.cajasBajadas + ' de ' + META_CAJAS],
    ['Combustible restante', estado.combustible + ' de ' + COMBUSTIBLE_INICIAL],
    ['Aguja final', textoAguja(estado.aguja)],
  ]

  // La autopsia: qué hicieron los piratas durante la partida. Es la conexión que
  // cuesta ver mientras se juega, porque ellos empujan y el viento remata.
  const piratas = resumenDeLosPiratas(estado)
  if (piratas.abordajes > 0) {
    filas.push([
      'Abordajes sufridos',
      piratas.abordajes + (piratas.abordajes === 1 ? ' abordaje' : ' abordajes'),
    ])
    filas.push([
      'Los piratas se llevaron',
      piratas.cajasRobadas + (piratas.cajasRobadas === 1 ? ' caja' : ' cajas'),
    ])
    filas.push([
      'y te empujaron la aguja',
      piratas.marcasEmpujadas + (piratas.marcasEmpujadas === 1 ? ' marca' : ' marcas'),
    ])
  }
  for (const [etiqueta, valor] of filas) {
    resumen.append(crear('dt', null, etiqueta))
    resumen.append(crear('dd', null, valor))
  }
}

// ----------------------------------------------------------------- MANUAL

// El manual se dibuja una sola vez: no cambia durante la partida. Aca no se sabe
// que dice ni que numeros trae; todo el contenido viene de MANUAL, en el motor.
function dibujarManual() {
  const indice = $('manual-indice')
  const cuerpo = $('manual-cuerpo')
  indice.replaceChildren()
  cuerpo.replaceChildren()

  for (const seccion of MANUAL) {
    const ancla = 'manual-' + seccion.seccion.replace(/[^0-9]/g, '')

    const enlace = crear('a', 'indice-enlace', seccion.seccion + ' ' + seccion.titulo)
    enlace.href = '#' + ancla
    indice.append(enlace)

    const bloque = crear('section', 'manual-seccion')
    bloque.id = ancla
    const titulo = crear('h3', 'manual-seccion-titulo')
    titulo.append(crear('span', 'manual-marca', seccion.seccion))
    titulo.append(crear('span', null, seccion.titulo))
    bloque.append(titulo)

    for (const parte of seccion.bloques) {
      bloque.append(dibujarBloqueDelManual(parte))
    }
    cuerpo.append(bloque)
  }
}

// Cada bloque del manual es de una de estas seis formas. El motor elige cual.
function dibujarBloqueDelManual(parte) {
  if (parte.subtitulo !== undefined) {
    return crear('h4', 'manual-subtitulo', parte.subtitulo)
  }

  if (parte.nota !== undefined) {
    return crear('p', 'manual-nota', parte.nota)
  }

  if (parte.pre !== undefined) {
    return crear('pre', 'manual-pre', parte.pre)
  }

  if (parte.lista !== undefined) {
    const ul = crear('ul', 'manual-lista')
    for (const punto of parte.lista) {
      ul.append(crear('li', null, punto))
    }
    return ul
  }

  if (parte.pasos !== undefined) {
    const ol = crear('ol', 'manual-pasos')
    for (const paso of parte.pasos) {
      const li = crear('li')
      li.append(crear('span', 'manual-paso-n', paso.n))
      li.append(crear('span', null, paso.texto))
      ol.append(li)
    }
    return ol
  }

  if (parte.tabla !== undefined) {
    const tabla = crear('table', 'manual-tabla')
    const thead = crear('thead')
    const filaCabecera = crear('tr')
    for (const encabezado of parte.tabla.encabezados) {
      filaCabecera.append(crear('th', null, encabezado))
    }
    thead.append(filaCabecera)

    const tbody = crear('tbody')
    for (const fila of parte.tabla.filas) {
      const tr = crear('tr')
      for (const celda of fila) {
        tr.append(crear('td', null, celda))
      }
      tbody.append(tr)
    }

    tabla.append(thead, tbody)
    const marco = crear('div', 'manual-tabla-marco')
    marco.append(tabla)
    return marco
  }

  return crear('p', 'manual-parrafo', parte.p)
}

// Quien tenia el foco antes de abrir el manual, para devolverselo al cerrar.
let focoAnterior = null

function abrirManual() {
  focoAnterior = document.activeElement
  $('cortina-manual').hidden = false
  $('manual-cuerpo').scrollTop = 0
  $('cerrar-reglas').focus()
}

function cerrarManual() {
  $('cortina-manual').hidden = true
  if (focoAnterior) {
    focoAnterior.focus()
  }
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

$('lado-izquierda').addEventListener('click', () => comenzarPartida(IZQUIERDA))
$('lado-derecha').addEventListener('click', () => comenzarPartida(DERECHA))
$('boton-dado').addEventListener('click', () => {
  if (fase === ESPERANDO_DADO) {
    comenzarTurno()
  }
})
$('reiniciar').addEventListener('click', volverAEmpezar)
$('reglas-titulo').addEventListener('click', abrirManual)
$('reglas-juego').addEventListener('click', abrirManual)
$('cerrar-reglas').addEventListener('click', cerrarManual)

// Cerrar tocando fuera de la hoja, que es lo que espera cualquiera.
$('cortina-manual').addEventListener('click', (evento) => {
  if (evento.target === $('cortina-manual')) {
    cerrarManual()
  }
})

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && !$('cortina-manual').hidden) {
    cerrarManual()
  }
})

dibujarManual()
