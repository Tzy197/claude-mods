// Kleine Helfer für Texte und Kennungen. Kein `$`, kein Zustand.

export const text = (wert: unknown): string =>
  typeof wert === 'string' ? wert : typeof wert === 'number' ? String(wert) : ''

// Ein Text für ein Bild: Steuerzeichen machen ein SVG ungültig, Zeilenumbrüche zeichnet es
// nicht. Beides wird zu einem Leerzeichen, zu lange Texte enden in „…“.
export const sauber = (wert: unknown, laenge: number): string => {
  const glatt = text(wert)
    .replace(/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const kurz = glatt.length > laenge ? `${glatt.slice(0, laenge - 1).trimEnd()}…` : glatt

  // Ein Schnitt mitten durch ein Zeichen aus zwei Hälften lässt eine Hälfte übrig.
  return kurz.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '')
}

// Eine Kennung, die als Knopf-Schlüssel und als Verweis taugt: nur a-z, 0-9 und einzelne
// Bindestriche. Zwei Bindestriche hintereinander kommen darin nie vor.
export const kennung = (wert: unknown): string =>
  text(wert)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')

// Das erste Wort eines Werts, als Kennung: "Jetzt möglich" wird "jetzt", "Später" "spaeter".
export const wort = (wert: unknown): string => kennung(wert).split('-')[0] ?? ''

export const eindeutig = (wunsch: string, vergeben: Set<string>): string => {
  let id = wunsch

  for (let n = 2; vergeben.has(id); n += 1) {
    id = `${wunsch}-${n}`
  }

  vergeben.add(id)

  return id
}

export const mehrzahl = (anzahl: number, eins: string, viele: string): string =>
  `${anzahl} ${anzahl === 1 ? eins : viele}`

// Eine Dauer in ganzen Sekunden, nie weniger als eine.
export const sekunden = (ms: number): number => Math.max(1, Math.round(ms / 1000))
