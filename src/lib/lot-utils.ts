// ─── Utilidades de lotes: probabilidades y display ────────────────────────────

export interface LotProbs {
  champion: number
  pos32: number
  pos48: number
}

/** Parsea el campo notes del lote para extraer probabilidades */
export function parseProbs(notes: string | null | undefined): LotProbs {
  if (!notes) return { champion: 0, pos32: 0, pos48: 0 }
  const champion = parseFloat(notes.match(/Camp\.([\d.]+)%/)?.[1] ?? '0')
  const pos32 = parseFloat(notes.match(/#32:([\d.]+)%/)?.[1] ?? '0')
  const pos48 = parseFloat(notes.match(/#48:([\d.]+)%/)?.[1] ?? '0')
  return { champion, pos32, pos48 }
}

/**
 * Reglas de display por lote:
 * - Lotes 1-8: mostrar campeón, ocultar #32 y #48
 * - Lotes 9-18: mostrar solo el mayor entre #32 y #48
 */
export function getLotDisplayProbs(lotNumber: number, probs: LotProbs): {
  show: 'champion' | 'pos32' | 'pos48'
  value: number
  label: string
  prize: string
} {
  if (lotNumber <= 8) {
    return { show: 'champion', value: probs.champion, label: '1.º Campeón', prize: '30% polla' }
  }
  // Combos 9-18: mostrar el mayor entre #32 y #48
  if (probs.pos32 >= probs.pos48) {
    return { show: 'pos32', value: probs.pos32, label: '32.º Peor 8vos', prize: '20% polla' }
  }
  return { show: 'pos48', value: probs.pos48, label: '48.º Último', prize: '20% polla' }
}

/** Código de bandera ISO para flagcdn.com */
export function flagCode(countryCode: string): string {
  const map: Record<string, string> = {
    ENG: 'gb-eng', SCO: 'gb-sct', USA: 'us', GER: 'de', FRA: 'fr', ESP: 'es',
    ARG: 'ar', BRA: 'br', POR: 'pt', NED: 'nl', BEL: 'be', CRO: 'hr',
    MAR: 'ma', COL: 'co', MEX: 'mx', URU: 'uy', SUI: 'ch', JPN: 'jp',
    SEN: 'sn', IRN: 'ir', KOR: 'kr', ECU: 'ec', AUT: 'at', TUR: 'tr',
    AUS: 'au', CAN: 'ca', NOR: 'no', PAN: 'pa', ALG: 'dz', EGY: 'eg',
    PRY: 'py', TUN: 'tn', CIV: 'ci', SWE: 'se', CZE: 'cz', UZB: 'uz',
    QAT: 'qa', COD: 'cd', IRQ: 'iq', SAU: 'sa', ZAF: 'za', JOR: 'jo',
    CPV: 'cv', GHA: 'gh', BIH: 'ba', CUW: 'cw', HTI: 'ht', NZL: 'nz',
  }
  return map[countryCode] ?? countryCode.toLowerCase().slice(0, 2)
}
