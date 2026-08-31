// Los ocho casos pedidos, tomados uno a uno del manual.
import test from 'node:test'
import assert from 'node:assert'

import {
  ACCIONES,
  CAUSAS,
  DERECHA,
  IZQUIERDA,
  MANUAL,
  MOMENTOS,
  MARCA_DE_VUELCO,
  META_CAJAS,
  PIRATAS_CADA,
  TURNO_FINAL,
  TABLA_DEL_DADO,
  accionesLegales,
  aplicarPiratas,
  cargaDisponible,
  estaEnPeligro,
  explicacionDelFinal,
  margenDeCarga,
  resumenDeLosPiratas,
  aplicarViento,
  ejecutarAccion,
  estadoInicial,
  iniciarTurno,
  jugar,
  revisarFin,
  textoAguja,
} from '../src/engine.js'

// Arma un estado cualquiera partiendo del inicial, para escribir los casos borde.
function estadoCon(cambios) {
  return Object.assign(estadoInicial(IZQUIERDA), cambios)
}

test('1. La aguja cruza el 0 en una descarga doble (§10, segunda pregunta)', () => {
  const antes = estadoCon({
    gruaEn: DERECHA,
    aguja: { numero: 1, lado: DERECHA },
    cajasDerecha: 5,
  })

  const despues = ejecutarAccion(antes, ACCIONES.DESCARGA_DOBLE.id)

  assert.strictEqual(textoAguja(despues.aguja), '1 hacia la izquierda')
  assert.strictEqual(despues.cajasBajadas, 2)
  assert.strictEqual(despues.cajasDerecha, 3)
})

test('2. Vuelco a mitad de descarga doble: la segunda caja no se baja (§5)', () => {
  // Grúa en la izquierda: la aguja se mueve hacia la derecha. Ya está en 3 hacia
  // la derecha, así que la primera marca la lleva a 4 y el barco se vuelca ahí mismo.
  const antes = estadoCon({
    gruaEn: IZQUIERDA,
    aguja: { numero: 3, lado: DERECHA },
    cajasIzquierda: 5,
  })

  const despues = ejecutarAccion(antes, ACCIONES.DESCARGA_DOBLE.id)

  assert.strictEqual(textoAguja(despues.aguja), '4 hacia la derecha')
  assert.strictEqual(despues.cajasBajadas, 1, 'la segunda caja no se baja')
  assert.strictEqual(despues.cajasIzquierda, 4, 'solo salió una caja del barco')
  // El costo de la descarga doble se cobra igual: se cobra en el paso 8, antes del efecto.
  assert.strictEqual(despues.combustible, antes.combustible - ACCIONES.DESCARGA_DOBLE.costo)

  const fin = revisarFin(despues, MOMENTOS.DESPUES_DE_LA_ACCION)
  assert.strictEqual(fin.resultado, 'PERDIÓ')
  assert.strictEqual(fin.causa, CAUSAS.VUELCO)
})

test('3. Empate vuelco + caja 8 en la misma jugada → PERDIÓ (§9 caso 1)', () => {
  // Con 7 bajadas y la aguja en 3 hacia la derecha, bajar una caja desde la
  // izquierda lleva las bajadas a 8 y la aguja a 4 en la misma jugada.
  const antes = estadoCon({
    gruaEn: IZQUIERDA,
    aguja: { numero: 3, lado: DERECHA },
    cajasBajadas: 7,
    cajasIzquierda: 2,
  })

  const resultado = jugar(antes, ACCIONES.BAJAR_UNA.id)

  assert.strictEqual(resultado.estado.cajasBajadas, 8)
  assert.strictEqual(resultado.fin.resultado, 'PERDIÓ')
  assert.strictEqual(resultado.fin.causa, CAUSAS.VUELCO)
})

test('4. Empate caja 8 + turno 12 → GANÓ (§9 caso 1)', () => {
  const antes = estadoCon({
    turno: 12,
    gruaEn: IZQUIERDA,
    aguja: { numero: 0, lado: null },
    cajasBajadas: 7,
    cajasIzquierda: 2,
  })

  const resultado = jugar(antes, ACCIONES.BAJAR_UNA.id)

  assert.strictEqual(resultado.fin.resultado, 'GANÓ')
  assert.strictEqual(resultado.fin.causa, CAUSAS.CARGA_ENTREGADA)
})

test('5. Combustible en 0 con 8 cajas bajadas → GANÓ, no derrota por grúa parada (§9 caso 2)', () => {
  // Gasta su último combustible bajando la caja número 8.
  const antes = estadoCon({
    combustible: 2,
    gruaEn: IZQUIERDA,
    aguja: { numero: 0, lado: null },
    cajasBajadas: 7,
    cajasIzquierda: 2,
  })

  const resultado = jugar(antes, ACCIONES.BAJAR_UNA.id)

  assert.strictEqual(resultado.estado.combustible, 0)
  assert.strictEqual(resultado.fin.resultado, 'GANÓ')
  assert.strictEqual(resultado.fin.causa, CAUSAS.CARGA_ENTREGADA)
})

test('6. Grúa parada por posición: combustible 2, grúa izquierda, 0 a la izquierda (§9 caso 3)', () => {
  const antes = estadoCon({
    combustible: 2,
    gruaEn: IZQUIERDA,
    cajasIzquierda: 0,
    cajasDerecha: 3,
  })

  const legales = accionesLegales(antes)
  assert.strictEqual(legales.BAJAR_UNA.legal, false, 'no hay cajas de ese lado')
  assert.strictEqual(legales.DESCARGA_DOBLE.legal, false, 'tampoco hay cajas de ese lado')
  assert.strictEqual(legales.CRUZAR.legal, false, 'cruzar cuesta 3 y solo hay 2')

  const fin = revisarFin(antes, MOMENTOS.ANTES_DE_ELEGIR)
  assert.strictEqual(fin.resultado, 'PERDIÓ')
  assert.strictEqual(fin.causa, CAUSAS.GRUA_PARADA)
})

test('7. Viento con la aguja en 3 y dado 6 → vuelco antes de elegir acción (§9 caso 4)', () => {
  const antes = estadoCon({ aguja: { numero: 3, lado: DERECHA } })

  const turno = iniciarTurno(antes, 6)

  assert.strictEqual(textoAguja(turno.estado.aguja), '4 hacia la derecha')
  assert.strictEqual(turno.fin.resultado, 'PERDIÓ')
  assert.strictEqual(turno.fin.causa, CAUSAS.VUELCO)
  assert.strictEqual(turno.fin.seccionDelManual, '§4 paso 4')
})

test('8. Jugada ilegal: el estado devuelto es idéntico al de entrada (§4 paso 7)', () => {
  const antes = estadoCon({ gruaEn: DERECHA, cajasDerecha: 0, cajasIzquierda: 4 })
  const copia = structuredClone(antes)

  const resultado = jugar(antes, ACCIONES.BAJAR_UNA.id)

  assert.strictEqual(resultado.ilegal, true)
  assert.strictEqual(resultado.fin, null)
  assert.deepStrictEqual(resultado.estado, copia, 'nada cambió, ni el combustible')
  assert.deepStrictEqual(antes, copia, 'tampoco se mutó el estado de entrada')
})

// El viento y el ejemplo de la §8, como red de seguridad de las funciones puras.
test('extra: el viento no actúa con el barco derecho aunque salga 6 (§4 paso 3)', () => {
  const antes = estadoInicial(IZQUIERDA)
  const despues = aplicarViento(antes, 6)
  assert.strictEqual(textoAguja(despues.aguja), '0')
  assert.deepStrictEqual(antes.aguja, { numero: 0, lado: null })
})

// ---------------------------------------------------------------------------
// Los piratas (§4 paso 4b)
// ---------------------------------------------------------------------------

test('9. Los piratas roban del costado de la grúa y esa caja no cuenta como entregada', () => {
  const antes = estadoCon({
    turno: PIRATAS_CADA, // el primer turno de abordaje
    gruaEn: IZQUIERDA,
    cajasIzquierda: 4,
    cajasDerecha: 5,
    cajasBajadas: 1,
  })

  const despues = aplicarPiratas(antes)

  assert.strictEqual(despues.cajasIzquierda, 3, 'se llevan 1 caja del costado de la grúa')
  assert.strictEqual(despues.cajasDerecha, 5, 'el otro costado no se toca')
  assert.strictEqual(despues.cajasBajadas, 1, 'la caja robada NO cuenta como entregada')
  // Le sacaron peso a la izquierda, así que la aguja se mueve hacia la derecha.
  assert.strictEqual(textoAguja(despues.aguja), '1 hacia la derecha')
  assert.strictEqual(despues.combustible, antes.combustible, 'el abordaje no gasta combustible')
})

test('10. Si el costado de la grúa está vacío, los piratas se van con las manos vacías', () => {
  const antes = estadoCon({
    turno: PIRATAS_CADA,
    gruaEn: IZQUIERDA,
    cajasIzquierda: 0,
    cajasDerecha: 5,
    aguja: { numero: 2, lado: DERECHA },
  })

  const despues = aplicarPiratas(antes)

  assert.strictEqual(despues.cajasIzquierda, 0)
  assert.strictEqual(despues.cajasDerecha, 5, 'no roban del otro costado')
  assert.strictEqual(textoAguja(despues.aguja), '2 hacia la derecha', 'la aguja no se mueve')
})

test('11. En un turno que no toca, los piratas no aparecen', () => {
  const antes = estadoCon({ turno: PIRATAS_CADA - 1, gruaEn: IZQUIERDA, cajasIzquierda: 4 })
  const despues = aplicarPiratas(antes)
  assert.deepStrictEqual(despues, antes, 'el estado queda idéntico, ni siquiera se anota nada')
})

test('12. Los piratas no vuelcan el barco: si la caja lo volcaría, se retiran', () => {
  // Grúa a la izquierda y aguja ya en 3 hacia la derecha: llevarse una caja de la
  // izquierda aliviana ese costado y empujaría la aguja a 4.
  const antes = estadoCon({
    turno: PIRATAS_CADA,
    gruaEn: IZQUIERDA,
    cajasIzquierda: 4,
    aguja: { numero: MARCA_DE_VUELCO - 1, lado: DERECHA },
  })

  const despues = aplicarPiratas(antes)

  assert.strictEqual(despues.cajasIzquierda, 4, 'no se llevan la caja')
  assert.strictEqual(textoAguja(despues.aguja), '3 hacia la derecha', 'la aguja no se mueve')

  // Y el turno completo sigue: el escalón 3 de la escala vuelve a ser jugable.
  const turno = iniciarTurno(antes, 2) // dado 2: sin novedad
  assert.strictEqual(turno.fin, null, 'la partida sigue')
  assert.strictEqual(textoAguja(turno.estado.aguja), '3 hacia la derecha')
})

test('13. Cruzar la grúa mueve el abordaje al otro costado', () => {
  const antes = estadoCon({ turno: PIRATAS_CADA, gruaEn: DERECHA, cajasIzquierda: 5, cajasDerecha: 4 })
  const despues = aplicarPiratas(antes)
  assert.strictEqual(despues.cajasDerecha, 3, 'roban del lado de la grúa')
  assert.strictEqual(despues.cajasIzquierda, 5)
})

// ---------------------------------------------------------------------------
// El dado ampliado (§4 paso 3)
// ---------------------------------------------------------------------------

test('14. El 1 endereza el barco una marca y puede cruzar el 0', () => {
  const antes = estadoCon({ aguja: { numero: 1, lado: DERECHA } })
  assert.strictEqual(textoAguja(aplicarViento(antes, 1).aguja), '0')

  const mas = estadoCon({ aguja: { numero: 2, lado: IZQUIERDA } })
  assert.strictEqual(textoAguja(aplicarViento(mas, 1).aguja), '1 hacia la izquierda')
})

test('15. El 5 sopla igual que el 6, y el 2, 3 y 4 no hacen nada', () => {
  const antes = estadoCon({ aguja: { numero: 1, lado: DERECHA } })
  assert.strictEqual(textoAguja(aplicarViento(antes, 5).aguja), '2 hacia la derecha')
  assert.strictEqual(textoAguja(aplicarViento(antes, 6).aguja), '2 hacia la derecha')
  for (const cara of [2, 3, 4]) {
    assert.strictEqual(textoAguja(aplicarViento(antes, cara).aguja), '1 hacia la derecha')
  }
})

test('16. Con el barco derecho ninguna cara del dado lo mueve', () => {
  const antes = estadoInicial(IZQUIERDA)
  for (let cara = 1; cara <= 6; cara++) {
    assert.strictEqual(textoAguja(aplicarViento(antes, cara).aguja), '0', 'cara ' + cara)
  }
})

test('17. La tabla que ve el jugador dice lo mismo que hace la regla', () => {
  // Cubre las seis caras, sin repetir ninguna.
  const caras = TABLA_DEL_DADO.flatMap((f) => f.caras).sort()
  assert.deepStrictEqual(caras, [1, 2, 3, 4, 5, 6])

  // Y para cada cara, lo que promete la tabla es lo que hace aplicarViento.
  const inclinado = estadoCon({ aguja: { numero: 2, lado: DERECHA } })
  for (const fila of TABLA_DEL_DADO) {
    for (const cara of fila.caras) {
      const despues = aplicarViento(inclinado, cara)
      const esperado =
        fila.nombre === 'Racha de viento'
          ? '3 hacia la derecha'
          : fila.nombre === 'Mar en calma'
            ? '1 hacia la derecha'
            : '2 hacia la derecha'
      assert.strictEqual(textoAguja(despues.aguja), esperado, fila.nombre + ', cara ' + cara)
    }
  }
})

// ---------------------------------------------------------------------------
// Lecturas derivadas que alimentan la interfaz (§3 y §6)
// ---------------------------------------------------------------------------

test('18. La carga disponible y el margen bajan cuando los piratas roban', () => {
  const antes = estadoCon({ turno: PIRATAS_CADA, gruaEn: IZQUIERDA })

  // Al empezar hay 10 cajas a bordo para una meta de 8: sobran 2.
  assert.strictEqual(cargaDisponible(antes), 10)
  assert.strictEqual(margenDeCarga(antes), 2)

  const despues = aplicarPiratas(antes)
  assert.strictEqual(cargaDisponible(despues), 9, 'la caja robada sale del total')
  assert.strictEqual(margenDeCarga(despues), 1)
})

test('19. Bajar una caja no cambia la carga disponible: solo la cambia de renglón', () => {
  const antes = estadoCon({ gruaEn: IZQUIERDA })
  const despues = ejecutarAccion(antes, ACCIONES.BAJAR_UNA.id)
  assert.strictEqual(cargaDisponible(despues), cargaDisponible(antes))
  assert.strictEqual(margenDeCarga(despues), margenDeCarga(antes))
})

test('20. estaEnPeligro avisa exactamente a una marca del vuelco', () => {
  assert.strictEqual(estaEnPeligro(estadoCon({ aguja: { numero: 2, lado: DERECHA } })), false)
  assert.strictEqual(estaEnPeligro(estadoCon({ aguja: { numero: 3, lado: DERECHA } })), true)
  assert.strictEqual(estaEnPeligro(estadoCon({ aguja: { numero: 3, lado: IZQUIERDA } })), true)
  assert.strictEqual(estaEnPeligro(estadoCon({ aguja: { numero: 0, lado: null } })), false)
})

test('21. El resumen de los piratas cuenta abordajes, robos y marcas empujadas', () => {
  let e = estadoCon({ turno: PIRATAS_CADA, gruaEn: IZQUIERDA })
  assert.deepStrictEqual(resumenDeLosPiratas(e), { abordajes: 0, cajasRobadas: 0, marcasEmpujadas: 0 })

  e = aplicarPiratas(e) // roban
  assert.deepStrictEqual(resumenDeLosPiratas(e), { abordajes: 1, cajasRobadas: 1, marcasEmpujadas: 1 })

  // Un abordaje al vacío cuenta como abordaje pero no como robo.
  e = aplicarPiratas(Object.assign({}, e, { cajasIzquierda: 0 }))
  assert.deepStrictEqual(resumenDeLosPiratas(e), { abordajes: 2, cajasRobadas: 1, marcasEmpujadas: 1 })
})

// ---------------------------------------------------------------------------
// La explicación del final (§6 y §9), que es lo que lee el jugador al perder
// ---------------------------------------------------------------------------

test('22. Los dos motivos de grúa parada de la §9 caso 3 se explican distinto', () => {
  // Motivo 1: no alcanza el combustible ni para lo más barato.
  const seco = estadoCon({ combustible: 0, gruaEn: IZQUIERDA, cajasIzquierda: 4 })
  const finSeco = revisarFin(seco, MOMENTOS.ANTES_DE_ELEGIR)
  assert.strictEqual(finSeco.causa, CAUSAS.GRUA_PARADA)
  assert.strictEqual(explicacionDelFinal(seco, finSeco).titulo, 'Te quedaste sin combustible')

  // Motivo 2: hay combustible, pero la grúa quedó del lado vacío y no alcanza a cruzar.
  const varado = estadoCon({ combustible: 2, gruaEn: IZQUIERDA, cajasIzquierda: 0, cajasDerecha: 3 })
  const finVarado = revisarFin(varado, MOMENTOS.ANTES_DE_ELEGIR)
  assert.strictEqual(finVarado.causa, CAUSAS.GRUA_PARADA)
  assert.strictEqual(explicacionDelFinal(varado, finVarado).titulo, 'La grúa quedó del lado vacío')
})

test('23. El vuelco nombra a quien empujó la aguja', () => {
  // Por el viento, al empezar el turno.
  const porViento = iniciarTurno(estadoCon({ aguja: { numero: 3, lado: DERECHA } }), 6)
  assert.strictEqual(explicacionDelFinal(porViento.estado, porViento.fin).titulo, 'Te volcó el viento')

  // Por la propia descarga del jugador.
  const propio = jugar(
    estadoCon({ gruaEn: IZQUIERDA, aguja: { numero: 3, lado: DERECHA }, cajasIzquierda: 3 }),
    ACCIONES.BAJAR_UNA.id
  )
  assert.strictEqual(propio.fin.causa, CAUSAS.VUELCO)
  assert.strictEqual(
    explicacionDelFinal(propio.estado, propio.fin).titulo,
    'Te volcaste solo, con tu propia descarga'
  )
})

test('24. La victoria también se explica, con los números de la partida', () => {
  const gana = jugar(
    estadoCon({ turno: 7, combustible: 6, gruaEn: IZQUIERDA, cajasBajadas: 7, cajasIzquierda: 2 }),
    ACCIONES.BAJAR_UNA.id
  )
  const e = explicacionDelFinal(gana.estado, gana.fin)
  assert.strictEqual(e.titulo, 'Entregaste la carga')
  assert.match(e.detalle, /8 cajas/)
  assert.match(e.detalle, /4 de combustible/)
})

test('25. El manual del juego dice los mismos números que aplica el motor', () => {
  // Todo el texto del manual junto, tal como lo lee el jugador en pantalla.
  const texto = JSON.stringify(MANUAL)

  // Las cifras del manual no están escritas a mano: salen de las constantes.
  // Si mañana cambia un costo y el texto no lo dice, esta prueba falla.
  assert.match(texto, new RegExp('turno ' + TURNO_FINAL))
  assert.match(texto, new RegExp('Bajar ' + META_CAJAS + ' cajas'))

  const acciones = MANUAL.find((s) => s.seccion === '§5').bloques.find((b) => b.tabla).tabla
  for (const id of Object.keys(ACCIONES)) {
    const fila = acciones.filas.find((f) => f[0] === ACCIONES[id].nombre)
    assert.ok(fila, 'el manual no lista la acción ' + id)
    assert.strictEqual(fila[2], String(ACCIONES[id].costo), 'costo mal escrito en ' + id)
    assert.match(fila[1], new RegExp('sea ' + ACCIONES[id].costo + ' o más'))
  }

  // Las cuatro causas de fin aparecen con su nombre exacto de la §6.
  const finales = MANUAL.find((s) => s.seccion === '§6').bloques.find((b) => b.tabla).tabla
  for (const causa of Object.values(CAUSAS)) {
    assert.ok(
      finales.filas.some((f) => f[0] === causa),
      'falta la condición de fin ' + causa
    )
  }
})

test('26. Cada bloque del manual es de un tipo que la interfaz sabe dibujar', () => {
  // La interfaz dibuja seis formas y nada más. Si el motor inventa una séptima,
  // el bloque saldría vacío en pantalla sin avisar: esta prueba lo impide.
  const formas = ['p', 'subtitulo', 'nota', 'pre', 'lista', 'pasos', 'tabla']

  for (const seccion of MANUAL) {
    assert.ok(seccion.seccion.startsWith('§'), 'sección sin número de manual')
    assert.ok(seccion.titulo.length > 0)
    assert.ok(seccion.bloques.length > 0)

    for (const bloque of seccion.bloques) {
      const suyas = Object.keys(bloque).filter((k) => formas.includes(k))
      assert.strictEqual(suyas.length, 1, 'bloque con forma desconocida: ' + JSON.stringify(bloque))
    }
  }
})
