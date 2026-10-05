import { chatMarke } from './zeichnen'
import type { Bild, Sicht } from './zeichnen'

// Das Bild des Graphen als Stapel von Streifen, je Zeile einer. Ein Bild nimmt keine
// Klicks an; über einem Streifen aber kann ein Knopf liegen, an dem Platz, den das Bild
// rechts in jeder Zeile frei lässt. Jeder Streifen ist das ganze Bild mit einem eigenen
// Ausschnitt (viewBox): Bahnen, Zonen-Grund und Linien laufen so von selbst über die
// Schnitte weiter. Reine Logik: kein `$`, kein Zustand.

export type Streifen = {
  // die Zeile, zu der der Streifen gehört; null: der Kopf über der ersten Zeile
  zeile: string | null
  // der Ausschnitt aus dem ganzen Bild, in px
  oben: number
  hoehe: number
  breite: number
  // das ganze Bild mit diesem Ausschnitt als viewBox, width und height, auf ihn beschnitten
  source: string
  alt: string
  // die Zeile hat Unterzeilen; offen: Sie stehen gerade im Streifen
  aufklappbar: boolean
  offen: boolean
}

const ausschnitt = (oben: number, breite: number, hoehe: number): string =>
  `viewBox="0 ${oben} ${breite} ${hoehe}" width="${breite}" height="${hoehe}"`

// Der Ausschnitt allein schneidet nichts ab: Zeigt die Surface einen Streifen in einem
// anderen Seitenverhältnis (eine Leiste, die schmaler ist als das Bild), füllt sie den Rest
// mit dem, was über und unter dem Ausschnitt liegt. Dann stünde der Titel der nächsten
// Zeile ein zweites Mal am unteren Rand. Deshalb wird jeder Streifen auf seinen Ausschnitt
// beschnitten.
const SCHNITT = 'schnitt'

const beschneide = (rest: string, oben: number, breite: number, hoehe: number): string => {
  const anfang = rest.indexOf('>') + 1
  const ende = rest.lastIndexOf('</svg>')

  if (anfang === 0 || ende < anfang) {
    return rest
  }

  return (
    `${rest.slice(0, anfang)}<clipPath id="${SCHNITT}"><rect x="0" y="${oben}" width="${breite}" height="${hoehe}"/></clipPath>` +
    `<g clip-path="url(#${SCHNITT})">${rest.slice(anfang, ende)}</g></svg>`
  )
}

type ZeilenEintrag = Extract<Sicht['eintraege'][number], { typ: 'zeile' }>

// Was der Streifen einer Zeile zeigt, für jemanden, der ihn nicht sieht: ihr Titel und,
// wenn sie offen ist, ihre Unterzeilen.
const beschreibe = (eintrag: ZeilenEintrag): string => {
  const unterzeilen = eintrag.offen ? (eintrag.zeile.tickets ?? []) : []

  return (
    `${eintrag.zeile.titel}${chatMarke(eintrag.zeile)}` +
    (unterzeilen.length === 0 ? '' : `: ${unterzeilen.join('; ')}`)
  )
}

// Geschnitten wird an der Oberkante jeder Zeile: Der Kopf reicht von 0 bis zur ersten
// Zeile (Legende, erste Zonen-Überschrift), jeder weitere Streifen von seiner Zeile bis
// zur nächsten, der letzte bis zum unteren Rand. Was unter einer Zeile steht (ihre
// Unterzeilen, eine Zonen-Überschrift), gehört damit zu ihrem Streifen. Die Streifen
// teilen das Bild lückenlos und ohne Überlappung.
//
// Kein Streifen mit Knopf ist kürzer als eine Zeile des Bildes.
export const schneide = (bild: Bild, sicht: Sicht): Streifen[] => {
  const ganz = ausschnitt(0, bild.breite, bild.hoehe)
  const stelle = bild.source.indexOf(ganz)
  const kopf: Streifen = {
    zeile: null,
    oben: 0,
    hoehe: bild.hoehe,
    breite: bild.breite,
    source: bild.source,
    alt: bild.alt,
    aufklappbar: false,
    offen: false,
  }

  // Ohne den erwarteten Anfang des Bildes lässt sich kein Ausschnitt setzen: Es bleibt ganz.
  if (stelle === -1) {
    return [kopf]
  }

  const davor = bild.source.slice(0, stelle)
  const danach = bild.source.slice(stelle + ganz.length)
  const eintraege = new Map(
    sicht.eintraege.flatMap(one => (one.typ === 'zeile' ? [[one.zeile.id, one] as const] : [])),
  )

  // Nur Schnitte, die im Bild liegen und nach unten wandern: So bleibt die Teilung genau.
  const schnitte: Bild['zeilen'] = []

  for (const zeile of bild.zeilen) {
    if (zeile.oben > (schnitte.at(-1)?.oben ?? 0) && zeile.oben < bild.hoehe) {
      schnitte.push(zeile)
    }
  }

  const teile: (Bild['zeilen'][number] | null)[] = [null, ...schnitte]

  return teile.map((teil, i) => {
    const oben = teil?.oben ?? 0
    const hoehe = (schnitte[i]?.oben ?? bild.hoehe) - oben
    const eintrag = teil === null ? undefined : eintraege.get(teil.id)

    return {
      zeile: teil?.id ?? null,
      oben,
      hoehe,
      breite: bild.breite,
      source: `${davor}${ausschnitt(oben, bild.breite, hoehe)}${beschneide(danach, oben, bild.breite, hoehe)}`,
      // Der Kopf beschreibt den ganzen Graphen, jeder weitere Streifen seine Zeile.
      alt: teil === null ? bild.alt : eintrag === undefined ? teil.id : beschreibe(eintrag),
      aufklappbar: eintrag?.aufklappbar ?? false,
      offen: eintrag?.offen ?? false,
    }
  })
}
