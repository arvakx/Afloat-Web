# AFLOAT — versión web

Implementación jugable del juego descrito en `afloat-manual.md`. El manual es la
fuente de verdad: no se cambió ningún valor, costo, precondición ni orden de pasos.

## Cómo correrlo

```bash
npm install
npm run dev      # abre el juego en http://localhost:5173
npm test         # corre los ocho casos del manual
```

No hace falta ningún paso extra: no hay backend, ni base de datos, ni variables de
entorno. El estado vive en memoria y se pierde al recargar la página.

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` ejecuta los tests, construye el sitio
con Vite y publica `dist` cuando se hace push a `main`. En GitHub, configura una sola
vez **Settings → Pages → Build and deployment → Source → GitHub Actions**.

El `base` de Vite es `/Afloat-Web/`, que corresponde a la URL del repositorio:
`https://arvakx.github.io/Afloat-Web/`.

## Dependencias

Una sola, y de desarrollo: `vite`. Cero dependencias de producción.
Los tests usan `node:test` y `node:assert`, que ya vienen con Node.

## Cómo está organizado

```
index.html
src/engine.js     ← toda la lógica del juego. No importa ni toca el DOM.
src/main.js       ← solo DOM y eventos. No contiene ninguna regla del juego.
src/style.css     ← CSS a mano, un solo archivo.
test/engine.test.js
```

La separación es estricta y a propósito: **ningún número de las reglas aparece en
`main.js`**. Los 12 turnos, los 24 de combustible, las 5 cajas por lado, la meta de
8, la marca de vuelco en 4 y los costos 2, 5 y 3 están declarados una sola vez, arriba
de `src/engine.js`, y todo lo demás los importa desde ahí.

Cada función de `engine.js` lleva encima un comentario que cita el paso del manual que
implementa (`// §4 paso 3 — viento`), para poder leerla en voz alta contra el
pseudocódigo de la §7.

### El manual dentro del juego

El botón **REGLAS** (en la pantalla de título y en la barra de la hoja de estado) abre el
manual completo sin salir de la partida. Se cierra con `Esc`, con el botón, o tocando
fuera de la hoja.

El texto vive en la constante `MANUAL` de `src/engine.js`, no en el HTML, **y arma sus
cifras a partir de las mismas constantes que aplica el motor**. Si mañana cambia el costo
de una acción, el manual que lee el jugador cambia solo: no hay forma de que el texto y
las reglas discrepen. La prueba 25 lo verifica.

`main.js` dibuja seis formas de bloque (`p`, `subtitulo`, `nota`, `pre`, `lista`, `pasos`,
`tabla`) y no sabe qué dice ninguna. La prueba 26 verifica que el motor no invente una
séptima forma que quedaría invisible en pantalla.

### Contrato de `engine.js`

Las funciones son puras: reciben un estado y devuelven uno **nuevo**, sin modificar
nunca el que recibieron.

| Función | Qué implementa |
|---|---|
| `estadoInicial(ladoGrua)` | §7, preparar la partida, pasos 1 a 3 |
| `tirarDado()` | §4 paso 2. La única función no pura, aislada a propósito |
| `aplicarViento(estado, dado)` | §4 paso 3 — la regla ampliada del dado |
| `TABLA_DEL_DADO` / `efectoDelDado(dado)` | §4 paso 3 — la tabla que ve el jugador |
| `aplicarPiratas(estado)` | §4 paso 4b — la regla agregada |
| `turnosParaElAbordaje(estado)` | §4 paso 4b — cuántos turnos faltan para el abordaje |
| `resumenDeLosPiratas(estado)` | §4 paso 4b — qué hicieron los piratas en toda la partida |
| `cargaDisponible(estado)` / `margenDeCarga(estado)` | §6 — cuánta carga queda en juego y cuánta se puede perder |
| `estaEnPeligro(estado)` | §3 — el barco está a una marca del vuelco |
| `explicacionDelFinal(estado, fin)` | §6 y §9 — por qué terminó así, en castellano |
| `accionesLegales(estado)` | §5. Una sola fuente para el paso 5 y el paso 7 |
| `ejecutarAccion(estado, accion)` | §4 pasos 8 a 12, con la descarga doble de a una marca |
| `revisarFin(estado, momento)` | §6, con la prioridad de la §9 caso 1 |
| `iniciarTurno(estado, dado)` | §4 pasos 2 a 5, atados |
| `jugar(estado, accion)` | §4 pasos 7 a 13, atados |

El estado es un objeto plano con las siete variables de la §3 más el registro de la
partida:

```js
{ turno, combustible, cajasIzquierda, cajasDerecha, gruaEn, aguja, cajasBajadas, registro }
```

La aguja es un solo valor, `{ numero, lado }`, tal como la describe la §3: un número
acompañado de un lado, y `lado: null` cuando está en 0 y el barco está derecho.

## Reglas agregadas

Estas dos reglas **no están en `afloat-manual.md`**. Se agregaron después de medir que
el juego original se ganaba el **97,5 %** de las veces jugando de forma óptima, con una
línea ganadora sencilla: 3 cajas de un lado, cruzar, 5 del otro, listo en el turno 9 con
combustible y turnos de sobra.

### 1. El dado ampliado (§4 paso 3)

El manual solo le da efecto al 6. Ahora el dado importa en 4 de sus 6 caras:

| Cara | Efecto |
|---|---|
| **1** | Mar en calma: la aguja baja 1 marca hacia el lado contrario. Puede cruzar el 0. |
| **2, 3, 4** | Sin novedad: el viento no toca el barco. |
| **5, 6** | Racha de viento: la aguja sube 1 marca hacia el lado al que ya está inclinada. |

Como siempre, con el barco derecho (aguja en 0) el viento no tiene de dónde agarrarlo y
ninguna cara hace nada.

Esta tabla **se muestra en pantalla durante toda la partida**, con la fila que salió
resaltada, para que se pueda planificar. Las caras y los textos salen de
`TABLA_DEL_DADO` en el motor, construida a partir de las mismas constantes que usa la
regla, así que la tabla y el comportamiento no pueden discrepar. Hay un test que lo
verifica cara por cara.

### 2. Los piratas (§4 paso 4b)

> **§4 paso 4b — El abordaje.** Después de revisar el vuelco del paso 4, si el número de
> turno es múltiplo de 3 los piratas abordan por el costado donde está parada la grúa y
> se llevan **1 caja** de ese costado. Esa caja **no cuenta como entregada**: sale de las
> 10 que trae el barco. Como le sacaron peso a ese costado, la aguja se mueve 1 marca
> hacia el lado contrario, con la misma regla de la §3.
>
> Los piratas **no se llevan la caja si eso volcaría el barco**: quieren la carga, no un
> naufragio, así que ven el barco escorado y se retiran. Tampoco encuentran nada si de
> ese costado no queda ninguna caja. El abordaje no cuesta combustible y no consume el
> turno.

Cuatro decisiones de diseño, con su porqué:

1. **Es determinista, no aleatorio.** Abordan en los turnos 3, 6, 9 y 12, y la interfaz
   muestra la cuenta regresiva. El juego ya tiene azar con el dado; un segundo actor
   aleatorio haría que perder se sintiera injusto. Así se ven venir y hay que prepararse.
2. **No agrega ninguna variable de estado.** El turno del abordaje se deduce del número
   de turno, que ya está en la hoja de la §3. La afirmación del manual de que todo el
   estado cabe en siete números sigue siendo cierta.
3. **Roban del costado de la grúa a propósito.** Se midieron las cuatro opciones: robar
   del costado alto deja la dificultad en 97,3 %, del costado lejano en 97,4 %, del que
   tiene más cajas en 96,2 %, y del costado de la grúa en 93,4 %. Es el único que muerde,
   porque obliga a cruzar, y cruzar gasta combustible, que es la restricción real.
4. **No son suicidas, y eso es un arreglo, no un adorno.** En la primera versión los
   piratas sí podían volcar el barco, y eso borraba un escalón entero de la escala del
   manual: con la aguja en 3, en turno de abordaje y con carga del lado de la grúa,
   **las 6 caras del dado volcaban el barco**. El manual dice que el barco aguanta hasta
   3, así que el juego había quedado de 0 a 2. Con la regla de que se retiran, vuelven a
   ser **4 de 6** las caras que dejan seguir.

**Efecto medido:** ganar jugando óptimo baja de **97,5 % a 63,3 %**. Verificado
resolviendo el juego con expectimax sobre `src/engine.js` (el motor de verdad, no una
copia), recorriendo los 5.750 estados alcanzables.

**Contrajuego:** si el costado de la grúa está vacío, los piratas se van sin nada, y si
el barco está muy escorado tampoco se llevan la caja. Cruzar la grúa a tiempo es una
defensa real, no solo un gasto. Medido sobre 36.520 abordajes con juego óptimo: el
73,5 % termina en robo, el 9,1 % se esquiva porque el costado estaba vacío y el 17,4 %
porque el barco estaba muy escorado.

**Qué hacen realmente, medido:** roban 1,34 cajas por partida y **nunca** ganan por
inanición — la derrota por grúa parada es el 0,0 % y la carga nunca llega a faltar. Su
daño real es indirecto: te vacían la pila donde estás trabajando (el óptimo pasa de 1 a
1,77 cruces por partida) y te empujan la aguja en la misma dirección en la que ya la
estás empujando. El 36,6 % de las partidas termina volcada. Descompuesto: sin piratas
se gana el 88,4 %, con piratas que solo empujan la aguja el 84,5 %, con piratas que solo
roban el 79,5 %, y con los dos efectos juntos el 63,3 %.

**Se estudió y se descartó** hacer que se pueda perder por quedarse sin carga. Se
midieron robos de 2 y 3 cajas, abordajes cada 2, 3, 4 y 5 turnos, primer abordaje en los
turnos 3 a 6, robo del costado con más carga y del costado alto, barcos de 12 y 14 cajas,
y sifonado de combustible. En todas las combinaciones o el barco se vuelca antes de
quedarse sin carga (el final por carga nunca supera el 21 %), o el juego se vuelve
trivial (79-90 %). La causa es estructural: el combustible y la aguja son restricciones
al filo y la carga tiene holgura, así que apretar la carga mata por otro lado primero.

## La pantalla

Una sola pantalla, sin rutas ni menús, con aspecto de consola de 8 bits: paleta fija,
bordes duros, cero curvas, animaciones en `steps()` para que el movimiento se vea a
saltos y no suavizado. Todo esta dibujado con CSS y `div`: no hay imágenes, ni fuentes
externas, ni librerías de gráficos.

- **HUD superior**: el turno como una fila de casillas, la cuenta regresiva de los
  piratas, el combustible como un tanque
  de 24 segmentos que se vacía y se pone rojo cuando ya no alcanza ni para la acción
  más barata, y la carga entregada como 8 ranuras que se van llenando.
- **La escena**: el barco se inclina de verdad, tantos grados como marcas tenga la
  aguja y hacia el lado al que apunta. Las cajas que quedan a bordo están dibujadas
  una por una de cada lado, y la grúa se para del lado que dice el estado y cruza
  cuando el jugador paga el cruce. El barco pirata se acerca por el costado de la grúa
  a medida que se acerca el turno del abordaje. Si el barco se vuelca, se da vuelta y
  se hunde.
- **La escala de inclinación** de la sección 3, de 4 izquierda a 4 derecha, con las dos
  marcas de vuelco en rojo.
- **El dado** con sus puntos dibujados, y debajo **la tabla de efectos de las seis
  caras**, con la fila que salió resaltada. Se sacude en rojo cuando el viento empuja.
  Cada tirada se explica con el nombre del efecto: "Dado 5 — Racha de viento. La aguja
  sube a 2 hacia la derecha.""
- **Tres botones de acción** con el costo a la vista. El que no cumple su precondición
  queda deshabilitado y muestra el motivo.
- **La hoja de estado** de la sección 3 y **la bitacora**, las dos en verde sobre negro,
  como una terminal.

**Distribución.** En computadora (de 1024 px de ancho para arriba) la pantalla ocupa
exactamente el alto de la ventana y se parte en dos columnas: **80 % para el juego**
(HUD, escena, inclinación, viento y acciones) y **20 % a la derecha** para la hoja de
estado y la bitácora. No hay scroll de página: lo único que scrollea es la bitácora
dentro de su caja. En celular vuelve a una sola columna y la página sí scrollea, que
es lo razonable en esa pantalla.

La interfaz está en español neutro. No hay sonido, y `prefers-reduced-motion` apaga
todas las animaciones.

## Cómo auditar una partida

Todo cambio de estado queda anotado en la bitácora, con el número de turno, el texto
del evento y la sección del manual que lo produjo. Se puede seguir renglón por renglón
por qué bajó el combustible, por qué se movió la aguja y qué regla terminó la partida.
El cartel de fin de partida muestra la causa con el nombre exacto de la tabla de la §6.

## Diferencias con el manual impreso

Dos:

- **El dado lo tira la aplicación, no el jugador.** La §4 paso 2 dice que el jugador
  tira un dado físico de 6 caras y dice el número en voz alta. En esta versión el dado
  lo tira la aplicación con `Math.random()` al empezar cada turno, y muestra el
  resultado junto con si el viento actuó y por qué. Es la función `tirarDado()` de
  `src/engine.js`, deliberadamente aislada del resto para que se vea que es lo único
  no determinista del programa.

- **El dado ampliado (§4 paso 3) y los piratas (§4 paso 4b) no están en el manual
  impreso.** Son reglas agregadas a pedido, después de medir que el juego original era
  demasiado fácil. Las dos ya están escritas en el manual que se lee **dentro** del juego
  (constante `MANUAL` de `src/engine.js`), y su texto está también acá arriba, listo para
  copiar. **Mientras no se agreguen a `afloat-manual.md`, el manual impreso es el único
  de los tres que no coincide con el código.**

Todo lo demás —valores iniciales, costos, precondiciones, la regla de la aguja y sus
tres casos, el orden de los pasos del turno, las 4 condiciones de fin, su prioridad
y los 3 supuestos del final del manual— está implementado tal como está escrito.

## Observaciones sobre el balance del manual

No se cambió nada de esto. Se anota porque salió a la luz al implementarlo.

0. **El juego original se ganaba el 97,5 % de las veces jugando óptimo**, y la línea
   ganadora es sencilla: 3 cajas de un lado, cruzar, 5 del otro. Termina en el turno 9
   con 5 de combustible y 3 turnos de sobra. De ahí salió la regla de los piratas.
   Se midió además que **recortar turnos no sirve de nada**: de 12 a 8 turnos la tasa
   óptima no se mueve, porque el reloj nunca es la restricción.
1. **La condición "El barco zarpa cargado" (§6) es inalcanzable.** Con 24 de
   combustible y 12 turnos, y siendo 2 el costo de la acción más barata, para llegar
   vivo al turno 12 hay que haber gastado exactamente 2 por turno en los 11 turnos
   anteriores: es decir, haber bajado una caja 11 veces. Pero al llegar a 8 cajas la
   partida ya terminó con victoria en el turno 8. El turno más alto al que se puede
   llegar con la partida viva es el 11. Cualquier partida que no gane termina antes
   por vuelco o por grúa parada. Verificado recorriendo los 2408 estados alcanzables.
2. **El costo de cruzar la grúa (3) no es múltiplo del costo de bajar (2).** Cada
   cruce deja el combustible en un número impar, y como todas las acciones cuestan
   número entero, eso "desperdicia" 1 unidad que después nunca alcanza para nada.
   Es lo que hace que la derrota por grúa parada sea, de lejos, el final más común.
3. **La descarga doble casi nunca conviene.** Cuesta 5 por 2 cajas (2,5 por caja)
   contra 2 por caja de la acción simple, y además mueve la aguja dos marcas, que es
   justo lo que mata. Solo paga cuando faltan turnos, no combustible.
