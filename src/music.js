// Banda sonora original de AFLOAT, sintetizada con Web Audio.
// No descarga archivos: la pista se construye en memoria la primera vez que
// el jugador interactua con la pagina.

const CLAVE_PREFERENCIA = 'afloat-musica-activa'
const VOLUMEN = 0.16

let contexto = null
let volumen = null
let fuente = null
let musicaSolicitada = false
let activa = leerPreferencia()

function leerPreferencia() {
  try {
    return localStorage.getItem(CLAVE_PREFERENCIA) !== 'false'
  } catch {
    return true
  }
}

function guardarPreferencia() {
  try {
    localStorage.setItem(CLAVE_PREFERENCIA, String(activa))
  } catch {
    // El juego sigue funcionando si el navegador bloquea el almacenamiento.
  }
}

function frecuencia(notaMidi) {
  return 440 * 2 ** ((notaMidi - 69) / 12)
}

function ondaCuadrada(fase) {
  return Math.sin(fase) >= 0 ? 1 : -1
}

function ondaTriangular(fase) {
  return (2 / Math.PI) * Math.asin(Math.sin(fase))
}

function envolvente(t, duracion, salida = 0.1) {
  const ataque = Math.min(1, t / 0.012)
  const restante = duracion - t
  const cierre = Math.min(1, restante / salida)
  return Math.max(0, Math.min(ataque, cierre))
}

// Melodia pentatonica de 32 pasos, escrita para el juego. Los null son
// silencios y ayudan a que el bucle respire sin competir con la interfaz.
const MELODIA = [
  76, null, 79, 81, 83, 81, 79, null,
  76, 79, 83, null, 81, 79, 76, null,
  74, null, 76, 79, 81, 79, 76, null,
  71, 74, 76, null, 74, 71, 69, null,
]

const BAJO = [45, 45, 41, 41, 43, 43, 40, 40, 45, 45, 41, 41, 43, 43, 40, 40]
const ARPEGIO = [57, 64, 69, 64, 53, 60, 65, 60, 55, 62, 67, 62, 52, 59, 64, 59]

function crearPista(audio) {
  const bpm = 118
  const duracionPaso = 60 / bpm / 2
  const duracion = MELODIA.length * duracionPaso
  const muestras = Math.ceil(duracion * audio.sampleRate)
  const buffer = audio.createBuffer(1, muestras, audio.sampleRate)
  const canal = buffer.getChannelData(0)

  for (let i = 0; i < muestras; i++) {
    const tiempo = i / audio.sampleRate
    const paso = Math.floor(tiempo / duracionPaso) % MELODIA.length
    const tiempoEnPaso = tiempo % duracionPaso
    const nota = MELODIA[paso]
    const notaBajo = BAJO[Math.floor(paso / 2) % BAJO.length]
    const notaArpegio = ARPEGIO[paso % ARPEGIO.length]

    let muestra = 0

    if (nota !== null) {
      const fase = 2 * Math.PI * frecuencia(nota) * tiempoEnPaso
      muestra += 0.28 * ondaCuadrada(fase) * envolvente(tiempoEnPaso, duracionPaso, 0.07)
    }

    // El bajo dura dos pasos para sostener la maniobra sin hacerse estridente.
    const tiempoEnBajo = tiempo % (duracionPaso * 2)
    muestra +=
      0.24 *
      ondaTriangular(2 * Math.PI * frecuencia(notaBajo) * tiempoEnBajo) *
      envolvente(tiempoEnBajo, duracionPaso * 2, 0.16)

    muestra +=
      0.09 *
      ondaCuadrada(2 * Math.PI * frecuencia(notaArpegio) * tiempoEnPaso) *
      envolvente(tiempoEnPaso, duracionPaso, 0.14)

    // Un golpe corto cada cuatro pasos hace de bombo. La frecuencia cae con
    // rapidez para conservar el caracter de consola antigua.
    if (paso % 4 === 0 && tiempoEnPaso < 0.13) {
      const caida = 105 - 55 * (tiempoEnPaso / 0.13)
      muestra +=
        0.34 *
        Math.sin(2 * Math.PI * caida * tiempoEnPaso) *
        (1 - tiempoEnPaso / 0.13) ** 2
    }

    canal[i] = Math.max(-1, Math.min(1, muestra))
  }

  return buffer
}

function prepararAudio() {
  if (contexto) return true

  const AudioContexto = window.AudioContext || window.webkitAudioContext
  if (!AudioContexto) return false

  contexto = new AudioContexto()
  volumen = contexto.createGain()
  volumen.gain.value = 0.0001
  volumen.connect(contexto.destination)

  fuente = contexto.createBufferSource()
  fuente.buffer = crearPista(contexto)
  fuente.loop = true
  fuente.connect(volumen)
  fuente.start()
  return true
}

export function musicaEstaActiva() {
  return activa
}

export async function iniciarMusica() {
  musicaSolicitada = true
  if (!activa || document.hidden || !prepararAudio()) return

  try {
    await contexto.resume()
    volumen.gain.cancelScheduledValues(contexto.currentTime)
    volumen.gain.setTargetAtTime(VOLUMEN, contexto.currentTime, 0.08)
  } catch {
    // Algunos navegadores pueden rechazar resume() fuera de un gesto; el
    // siguiente clic en el control vuelve a intentarlo.
  }
}

export function alternarMusica() {
  activa = !activa
  guardarPreferencia()

  if (activa) {
    iniciarMusica()
  } else if (contexto) {
    volumen.gain.cancelScheduledValues(contexto.currentTime)
    volumen.gain.setTargetAtTime(0.0001, contexto.currentTime, 0.035)
  }

  return activa
}

export function pausarMusica() {
  if (contexto && contexto.state === 'running') {
    contexto.suspend().catch(() => {})
  }
}

export function reanudarMusica() {
  if (musicaSolicitada && activa) iniciarMusica()
}
