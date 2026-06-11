/**
 * Sonidos de subasta generados con Web Audio API.
 * No requiere archivos externos — funciona en todos los browsers modernos.
 */

function ctx(): AudioContext | null {
  try { return new AudioContext() } catch { return null }
}

/** Ding cuando alguien hace un bid */
export function playBidSound() {
  const ac = ctx(); if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain); gain.connect(ac.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1047, ac.currentTime)           // C6
  osc.frequency.exponentialRampToValueAtTime(1318, ac.currentTime + 0.05) // E6
  gain.gain.setValueAtTime(0.35, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4)
  osc.start(); osc.stop(ac.currentTime + 0.4)
}

/** Tres golpes de martillo — lote vendido 🔨 */
export function playSoldSound() {
  const ac = ctx(); if (!ac) return
  const freqs = [523, 440, 349]  // C5, A4, F4 — descendente
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain); gain.connect(ac.destination)
    osc.type = 'triangle'
    const t = ac.currentTime + i * 0.22
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(i === 2 ? 0.6 : 0.4, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.start(t); osc.stop(t + 0.2)
  })
}

/** Beeps urgentes cuando quedan ≤ 5 segundos */
export function playTimerWarning() {
  const ac = ctx(); if (!ac) return
  for (let i = 0; i < 3; i++) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain); gain.connect(ac.destination)
    osc.type = 'square'
    osc.frequency.value = 880
    const t = ac.currentTime + i * 0.18
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.start(t); osc.stop(t + 0.13)
  }
}

/** Alarma cuando el timer llega a 0 */
export function playTimerEnd() {
  const ac = ctx(); if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain); gain.connect(ac.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(660, ac.currentTime)
  osc.frequency.setValueAtTime(550, ac.currentTime + 0.15)
  osc.frequency.setValueAtTime(440, ac.currentTime + 0.30)
  gain.gain.setValueAtTime(0.4, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6)
  osc.start(); osc.stop(ac.currentTime + 0.65)
}
