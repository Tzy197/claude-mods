import type { ZielGraphFarben, ZielGraphZone } from '../../types'

import { ZONEN_FOLGE, ZONEN_NAME } from '../plan/ableiten'

import { chatMarke, zeichenText } from './karten'
import type { Karte, KartenZeichen, Sicht } from './karten'

// Reine Zeichenlogik: aus der Sicht wird eine Fläche aus vielen kleinen Bildern. Jede Karte
// ist ihr eigenes SVG, mit dem Stück Verbindungslinie über und unter sich; kein Bild liegt
// über einem anderen. Die Leiste setzt die Bilder nur neben- und untereinander. Kein `$`.

// Die Grenze der Engine für `Svg.source`.
export const SVG_GRENZE = 131072
// So breit ist eine Zeichenzelle der Leiste in der Desktop-App, in CSS-Pixeln.
export const ZELLE_PX = 7.8

export type Bild = { source: string; alt: string; breite: number; hoehe: number }

type Paar = { hell: string; dunkel: string }

// Eine Karte bringt ihren eigenen Grund mit: Ein SVG als Bild erbt keine Seitenfarben. Linien
// und Beschriftungen am Rand stehen direkt auf der Leiste und nehmen mittlere Töne, die auf
// hellem wie auf dunklem Grund lesbar sind.
type Palette = {
  karte: string
  rand: string
  text: string
  leise: string
  meta: string
  warm: string
  warmGrund: string
  warmSchrift: string
  pille: string
  pilleSchrift: string
  gewaehlt: string
  linie: string
  jetzt: string
}

const HELL: Palette = {
  karte: '#ffffff',
  rand: '#c3cfd5',
  text: '#16242b',
  leise: '#42555e',
  meta: '#5a6d76',
  warm: '#c27a00',
  warmGrund: '#fdeecb',
  warmSchrift: '#7a4a00',
  pille: '#e3eaed',
  pilleSchrift: '#33464f',
  gewaehlt: '#16242b',
  linie: '#9fb0b8',
  jetzt: '#2f9e44',
}

const DUNKEL: Palette = {
  karte: '#1d242b',
  rand: '#3a4651',
  text: '#e9eef1',
  leise: '#aeb8bf',
  meta: '#8e9aa2',
  warm: '#e09a1a',
  warmGrund: '#4a3410',
  warmSchrift: '#ffd08a',
  pille: '#2a343d',
  pilleSchrift: '#c3ccd2',
  gewaehlt: '#e9eef1',
  linie: '#52626d',
  jetzt: '#7fd992',
}

type Rolle = keyof Palette | 'strang'

// Die Farben der Karten auf dem Stamm: Zwischenziele warm, das Endziel in der Schriftfarbe.
const ZWISCHENZIEL: Paar = { hell: HELL.warm, dunkel: DUNKEL.warm }
const SCHRITT: Paar = { hell: HELL.meta, dunkel: DUNKEL.meta }
const ZIEL: Paar = { hell: HELL.text, dunkel: DUNKEL.text }

// ---------- Maße, in CSS-Pixeln ----------

// Der Rand links mit dem Namen des Abschnitts.
export const RAND = 84
// Der Platz neben einer Karte für ihren Knopf.
export const KNOPF = 36
export const KARTE_MIN = 184
export const KARTE_MAX = 286
// Die Detail-Fläche, wenn sie neben den Karten steht.
export const DETAIL = 330
const KARTE = 68
// Das Stück Verbindungslinie über und unter jeder Karte.
const STUMMEL = 6
export const KARTE_HOEHE = KARTE + 2 * STUMMEL
export const KOPF_HOEHE = 66
export const ENDE_HOEHE = 30
// Hier läuft die Verbindungslinie: durch die Mitte des Zeichens.
const LINIE_X = 25
// So viel bleibt rechts in jedem Bild frei, damit der Knopf nicht an der Karte klebt.
const LUFT = 6
const SCHRIFT = "-apple-system, 'Segoe UI', system-ui, sans-serif"

// ---------- Kleine Helfer ----------

const esc = (wert: string): string =>
  wert
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Ein SVG-Text bricht nicht um: Wie viele Zeichen passen, wird aus der Breite geschätzt.
const passen = (px: number, groesse: number, fett: boolean): number =>
  Math.max(4, Math.floor(px / (groesse * (fett ? 0.56 : 0.52))))

const kuerze = (wert: string, px: number, groesse: number, fett: boolean): string => {
  const platz = passen(px, groesse, fett)

  return wert.length > platz ? `${wert.slice(0, platz - 1).trimEnd()}…` : wert
}

// Ein Text auf höchstens zwei Zeilen: am letzten Leerzeichen geteilt, der Rest gekürzt.
const umbruch = (wert: string, px: number, groesse: number, fett: boolean): string[] => {
  const platz = passen(px, groesse, fett)

  if (wert.length <= platz) {
    return [wert]
  }

  // Geteilt wird nach einem Leerzeichen oder hinter einem Bindestrich, sonst mitten im Wort.
  const leer = wert.lastIndexOf(' ', platz)
  const strich = wert.lastIndexOf('-', platz - 1) + 1
  const schnitt = Math.max(leer, strich)
  const erste = schnitt > platz * 0.4 ? wert.slice(0, schnitt) : wert.slice(0, platz)

  return [erste.trimEnd(), kuerze(wert.slice(erste.length).trim(), px, groesse, fett)]
}

// Die Farben eines Bildes. Sie stehen als Attribute am Element, damit das Bild auch ohne
// <style> stimmt. Bei 'auto' kommt je Rolle eine Klasse dazu, die ein <style>-Block im
// dunklen Schema überschreibt; er nennt nur die Rollen, die das Bild wirklich nutzt.
const stift = (farben: ZielGraphFarben, strang: Paar) => {
  const regeln = new Map<string, string>()
  const paarVon = (rolle: Rolle): Paar =>
    rolle === 'strang' ? strang : { hell: HELL[rolle], dunkel: DUNKEL[rolle] }
  const eine = (art: 'fill' | 'stroke', rolle: Rolle | undefined): [string, string] => {
    if (rolle === undefined) {
      return ['', '']
    }

    const paar = paarVon(rolle)
    // Die Klasse eines Strangs heißt nach seiner Farbe: So stimmt sie auch, wenn mehrere
    // Bilder in einem Dokument stehen.
    const klasse = `${art[0]}-${rolle === 'strang' ? paar.dunkel.replace('#', 'x') : rolle}`

    if (farben === 'auto') {
      regeln.set(klasse, `.${klasse}{${art}:${paar.dunkel}}`)
    }

    return [` ${art}="${farben === 'dunkel' ? paar.dunkel : paar.hell}"`, farben === 'auto' ? klasse : '']
  }

  return {
    farbe: ({ f, s }: { f?: Rolle; s?: Rolle }): string => {
      const [fill, fKlasse] = eine('fill', f)
      const [stroke, sKlasse] = eine('stroke', s)
      const klassen = [fKlasse, sKlasse].filter(one => one !== '').join(' ')

      return `${fill}${stroke}${klassen === '' ? '' : ` class="${klassen}"`}`
    },
    stil: (): string =>
      regeln.size === 0
        ? ''
        : `<style>@media (prefers-color-scheme:dark){${[...regeln.values()].join('')}}</style>`,
  }
}

const huelle = (breite: number, hoehe: number, inhalt: string, stil: string, alt: string): Bild => ({
  source:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite} ${hoehe}" width="${breite}" height="${hoehe}" role="img">` +
    `${stil}<g font-family="${SCHRIFT}">${inhalt}</g></svg>`,
  alt,
  breite,
  hoehe,
})

const schrift = (
  x: number,
  y: number,
  inhalt: string,
  groesse: number,
  gewicht: number,
  farbe: string,
  mehr = '',
): string =>
  `<text x="${x}" y="${y}" font-size="${groesse}" font-weight="${gewicht}"${farbe}${mehr}>${esc(inhalt)}</text>`

export type Linie = 'fest' | 'offen' | 'ohne'

// Ein Stück der Verbindungslinie einer Spalte: durchgezogen hinter uns, gestrichelt davor.
const strich = (von: number, bis: number, art: Linie, farbe: string): string =>
  art === 'ohne' || bis <= von
    ? ''
    : `<path d="M${LINIE_X} ${von}V${bis}" fill="none" stroke-width="2"${art === 'offen' ? ' stroke-dasharray="3 4"' : ''}${farbe}/>`

// Das Zeichen einer Karte, als Formen statt als Schriftzeichen: So sieht es überall gleich aus.
const zeichne = (zeichen: KartenZeichen, cx: number, cy: number, voll: string, kontur: string): string => {
  const ring = (r: number): string => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="2"${kontur}/>`
  const punkt = (r: number): string => `<circle cx="${cx}" cy="${cy}" r="${r}"${voll}/>`

  switch (zeichen) {
    case 'erledigt':
    case 'erreicht':
      return `<path d="M${cx - 6} ${cy}l4 4.5l8-9" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"${kontur}/>`
    case 'laeuft':
      return ring(6.5) + punkt(3)
    case 'teilweise':
      return ring(6.5) + `<path d="M${cx} ${cy - 6.5}A6.5 6.5 0 0 0 ${cx} ${cy + 6.5}Z"${voll}/>`
    case 'blockiert':
      return (
        `<rect x="${cx - 5}" y="${cy - 5.5}" width="3.4" height="11" rx="1"${voll}/>` +
        `<rect x="${cx + 1.6}" y="${cy - 5.5}" width="3.4" height="11" rx="1"${voll}/>`
      )
    case 'zwischenziel':
      return `<path d="M${cx} ${cy - 8}L${cx + 8} ${cy}L${cx} ${cy + 8}L${cx - 8} ${cy}Z"${voll}/>`
    case 'endziel':
      return ring(7.5) + punkt(3.5)
    case 'schritt':
      return ring(4.5)
    default:
      return ring(6.5)
  }
}

// ---------- Die Bilder ----------

export type KartenWahl = {
  breite: number
  farben: ZielGraphFarben
  // die Verbindungslinie über und unter der Karte
  oben: Linie
  unten: Linie
}

// Eine Karte: das Zeichen im Quadrat in der Farbe des Strangs, der Titel auf bis zu zwei
// Zeilen, darunter die Meta-Zeile oder die Marke des Chats. Eine Karte, deren Chat auf den
// Nutzer wartet, ist warm umrandet; die gewählte hat einen kräftigen Rand.
export const karteBild = (karte: Karte, strang: Paar, wahl: KartenWahl): Bild => {
  const { farbe, stil } = stift(wahl.farben, strang)
  const breite = wahl.breite - LUFT
  const oben = STUMMEL
  const wartet = karte.chat === 'wartet'
  const rand: Rolle = wartet ? 'warm' : karte.gewaehlt ? 'gewaehlt' : 'rand'
  const dick = wartet && karte.gewaehlt ? 3 : wartet || karte.gewaehlt ? 2 : 1
  const xText = 50
  const platz = breite - xText - 12
  const titelFarbe = farbe({ f: karte.leise ? 'leise' : 'text' })
  const gewicht = karte.leise ? 500 : 600
  const marke = chatMarke(karte)
  const zeilen = umbruch(karte.titel, platz, 13, true)
  const hatDritte = marke !== '' || karte.meta !== ''
  // Die Grundlinien: ein oder zwei Zeilen Titel, mit oder ohne dritte Zeile.
  const [yEins, yZwei, yDrei] =
    zeilen.length === 2 ? (hatDritte ? [22, 38, 56] : [30, 47, 0]) : hatDritte ? [29, 0, 49] : [39, 0, 0]
  const teile = [
    strich(0, oben, wahl.oben, farbe({ s: 'strang' })),
    strich(oben + KARTE, KARTE_HOEHE, wahl.unten, farbe({ s: 'strang' })),
    `<rect x="${dick / 2}" y="${oben + dick / 2}" width="${breite - dick}" height="${KARTE - dick}" rx="10" stroke-width="${dick}"${farbe({ f: 'karte', s: rand })}/>`,
    `<rect x="10" y="${oben + 19}" width="30" height="30" rx="8" fill-opacity="${karte.leise ? 0.14 : 0.22}"${farbe({ f: 'strang' })}/>`,
    zeichne(karte.zeichen, LINIE_X, oben + 34, farbe({ f: 'strang' }), farbe({ s: 'strang' })),
    schrift(xText, oben + (yEins ?? 0), zeilen[0] ?? '', 13, gewicht, titelFarbe),
    zeilen.length === 2 ? schrift(xText, oben + (yZwei ?? 0), zeilen[1] ?? '', 13, gewicht, titelFarbe) : '',
  ]

  if (marke !== '') {
    const breiteVon = (text: string): number => Math.ceil(text.length * 5.9) + 16
    // Auf einer schmalen Karte steht die Marke ohne das Wort „Chat“, statt abgeschnitten.
    const kurz = breiteVon(marke) <= platz ? marke : wartet ? 'wartet auf dich' : 'läuft'
    const lang = Math.min(platz, breiteVon(kurz))

    teile.push(
      `<rect x="${xText}" y="${oben + (yDrei ?? 0) - 12}" width="${lang}" height="17" rx="8.5"${farbe({ f: wartet ? 'warmGrund' : 'pille' })}/>`,
      schrift(
        xText + lang / 2,
        oben + (yDrei ?? 0),
        kuerze(kurz, lang - 10, 10.5, true),
        10.5,
        600,
        farbe({ f: wartet ? 'warmSchrift' : 'pilleSchrift' }),
        ' text-anchor="middle"',
      ),
    )
  } else if (karte.meta !== '') {
    teile.push(schrift(xText, oben + (yDrei ?? 0), kuerze(karte.meta, platz, 11, false), 11, 400, farbe({ f: 'meta' })))
  }

  return huelle(
    wahl.breite,
    KARTE_HOEHE,
    teile.join(''),
    stil(),
    `${zeichenText(karte)} ${karte.titel}${karte.meta === '' ? '' : ` (${karte.meta})`}${marke === '' ? '' : ` [${marke}]`}`,
  )
}

// Der Kopf einer Spalte: der Name des Strangs und darunter sein Ziel, oder „kein Ziel festgelegt“.
export const kopfBild = (
  name: string,
  zeilen: readonly string[],
  ohneZiel: boolean,
  strang: Paar,
  // die Breite einer Karte; `gesamt` ist die Breite des Bildes, mit dem Platz für den Knopf
  breite: number,
  gesamt: number,
  farben: ZielGraphFarben,
): Bild => {
  const { farbe, stil } = stift(farben, strang)
  const innen = breite - LUFT
  const platz = innen - 30
  const [eins = '', zwei = ''] = ohneZiel ? zeilen : umbruch(zeilen[0] ?? '', platz, 11, false)
  const teile = [
    `<rect x="0.5" y="0.5" width="${innen - 1}" height="${KOPF_HOEHE - 1}" rx="10"${farbe({ f: 'karte', s: 'rand' })}/>`,
    `<rect x="0.5" y="0.5" width="6" height="${KOPF_HOEHE - 1}" rx="3"${farbe({ f: 'strang' })}/>`,
    schrift(18, 24, kuerze(name, platz, 14.5, true), 14.5, 600, farbe({ f: 'text' })),
    schrift(18, 42, kuerze(eins, platz, 11, ohneZiel), 11, ohneZiel ? 600 : 400, farbe({ f: ohneZiel ? 'warm' : 'meta' })),
    zwei === '' ? '' : schrift(18, 57, kuerze(zwei, platz, 11, false), 11, 400, farbe({ f: 'meta' })),
  ]

  return huelle(gesamt, KOPF_HOEHE, teile.join(''), stil(), `Strang ${name}: ${zeilen.join(', ')}`)
}

// Der Rand links: der Name des Abschnitts und ein Strich, der zeigt, wie weit er reicht.
export const randBild = (titel: string, hoehe: number, betont: boolean, farben: ZielGraphFarben): Bild => {
  const { farbe, stil } = stift(farben, ZIEL)
  const worte = titel.toUpperCase().split(' ')
  const teile = [
    ...worte.map((one, i) =>
      schrift(2, 18 + i * 13, one, 10.5, 700, farbe({ f: betont ? 'jetzt' : 'meta' }), ' letter-spacing="0.9"'),
    ),
    hoehe <= 12
      ? ''
      : `<rect x="${RAND - 12}" y="6" width="3" height="${hoehe - 12}" rx="1.5"${farbe({ f: betont ? 'jetzt' : 'linie' })}/>`,
  ]

  return huelle(RAND, hoehe, teile.join(''), stil(), `Abschnitt ${titel}`)
}

// Ein leeres Stück Spalte: nur die Verbindungslinie läuft durch.
export const fuellBild = (
  strang: Paar,
  breite: number,
  hoehe: number,
  linie: Linie,
  farben: ZielGraphFarben,
): Bild => {
  const { farbe, stil } = stift(farben, strang)

  return huelle(breite, hoehe, strich(0, hoehe, linie, farbe({ s: 'strang' })), stil(), 'Verbindung')
}

// Das Ende einer Spalte: ein Pfeil und wohin der Strang führt.
export const endeBild = (
  wohin: string,
  strang: Paar,
  breite: number,
  gesamt: number,
  farben: ZielGraphFarben,
): Bild => {
  const { farbe, stil } = stift(farben, strang)
  const teile = [
    strich(0, 12, 'offen', farbe({ s: 'strang' })),
    `<path d="M${LINIE_X - 5} 11h10l-5 8z"${farbe({ f: 'strang' })}/>`,
    schrift(40, 19, kuerze(wohin, breite - LUFT - 44, 10.5, false), 10.5, 500, farbe({ f: 'meta' })),
  ]

  return huelle(gesamt, ENDE_HOEHE, teile.join(''), stil(), wohin)
}

// ---------- Die Fläche ----------

export type Anordnung = {
  // 'neben': die Detail-Fläche steht rechts neben den Karten. 'unter': sie steht darunter.
  // 'gestapelt': Für Spalten ist kein Platz, die Stränge stehen untereinander.
  art: 'neben' | 'unter' | 'gestapelt'
  // die Breite einer Karte
  karte: number
}

// Wie die Fläche in eine Leiste von so vielen Zeichenzellen passt. Die Karten werden so
// breit, wie der Platz es erlaubt, zwischen KARTE_MIN und KARTE_MAX.
export const anordnung = (zellen: number, straenge: number): Anordnung => {
  // Etwas weniger als gerechnet: Die Zellbreite ist geschätzt.
  const platz = Math.floor(zellen * ZELLE_PX * 0.97)
  // Je Spalte: die Karte, ihr Knopf und zwei Zellen Luft für das Runden auf ganze Zellen.
  const karteIn = (breite: number): number =>
    Math.floor((breite - RAND) / Math.max(1, straenge) - KNOPF - 2 * ZELLE_PX)
  const neben = karteIn(platz - DETAIL - 2 * ZELLE_PX)
  const unter = karteIn(platz)

  if (neben >= KARTE_MIN) {
    return { art: 'neben', karte: Math.min(KARTE_MAX, neben) }
  }

  return unter >= KARTE_MIN
    ? { art: 'unter', karte: Math.min(KARTE_MAX, unter) }
    : { art: 'gestapelt', karte: Math.max(160, Math.min(KARTE_MAX, platz - KNOPF)) }
}

// So viele Zeichenzellen wünscht sich die Fläche für so viele Stränge: bequem breite Karten
// und die Detail-Fläche daneben. Die Leiste darf schmaler sein, und der Nutzer zieht sie selbst.
export const wunschZellen = (straenge: number): number =>
  Math.min(200, Math.max(120, Math.ceil((RAND + Math.max(3, straenge) * (240 + KNOPF) + DETAIL) / ZELLE_PX) + 12))

// Ein Bild und, wenn es eine Karte ist, der Schlüssel ihres Knopfs ('' ohne Knopf).
export type Zelle = { bild: Bild; knopf: string }

export type FlaechenBand = {
  zone: ZielGraphZone
  titel: string
  rand: Bild
  // je Strang die Zellen von oben nach unten; in jeder Spalte gleich hoch
  spalten: Zelle[][]
}

export type Flaeche = {
  art: Anordnung['art']
  karte: number
  // die Breite einer Spalte in Zeichenzellen: Karte und Knopf
  spalte: number
  kopfRand: Bild
  koepfe: { id: string; name: string; bild: Bild; ohneZiel: boolean }[]
  baender: FlaechenBand[]
  // je Strang das Ende seiner Spalte, und davor der leere Rand
  endeRand: Bild
  enden: Bild[]
  stammRand: Bild
  stamm: Zelle[]
  // wie viele Zeichen Markup alle Bilder zusammen haben
  zeichen: number
}

export type FlaechenWahl = {
  // die Breite der Leiste in Zeichenzellen
  zellen: number
  farben: ZielGraphFarben
}

// Baut aus der Sicht die Fläche: der Kopf je Strang, je Abschnitt ein Band mit einer Spalte
// je Strang, das Ende jeder Spalte und darunter der Stamm mit Zwischenzielen und Endziel.
export const baueFlaeche = (bild: Sicht, wahl: FlaechenWahl): Flaeche => {
  const { farben } = wahl
  const lage = anordnung(wahl.zellen, bild.spalten.length)
  const istGestapelt = lage.art === 'gestapelt'
  const breite = lage.karte
  // In den Spalten ist jedes Bild ohne Knopf so breit wie Karte und Knopf zusammen: So ist
  // eine Spalte in jeder Reihe gleich breit, auch wo keine Karte steht.
  const gesamt = istGestapelt ? breite : breite + KNOPF
  // Die erste Karte einer Spalte hat nichts über sich.
  const begonnen = bild.spalten.map(() => false)

  const koepfe = bild.spalten.map(spalte => ({
    id: spalte.strang.id,
    name: spalte.strang.name,
    bild: kopfBild(spalte.strang.name, spalte.kopf, spalte.ohneZiel, spalte.strang.farbe, breite, gesamt, farben),
    ohneZiel: spalte.ohneZiel,
  }))

  const baender: FlaechenBand[] = []

  for (const zone of ZONEN_FOLGE) {
    const hoch = Math.max(...bild.spalten.map(one => one.karten[zone].length), zone === 'jetzt' ? 1 : 0)

    // Ein leerer Abschnitt bekommt kein Band; „Jetzt möglich“ steht immer da.
    if (hoch === 0) {
      continue
    }

    const art: Linie = zone === 'hinter' ? 'fest' : 'offen'

    baender.push({
      zone,
      titel: ZONEN_NAME[zone],
      rand: randBild(ZONEN_NAME[zone], hoch * KARTE_HOEHE, zone === 'jetzt', farben),
      spalten: bild.spalten.map((spalte, i) => {
        const karten = spalte.karten[zone]
        const zellen = karten.map((karte, k): Zelle => {
          const oben: Linie = istGestapelt || (k === 0 && begonnen[i] !== true) ? 'ohne' : art

          return {
            bild: karteBild(karte, spalte.strang.farbe, { breite, farben, oben, unten: istGestapelt ? 'ohne' : art }),
            knopf: karte.id,
          }
        })

        begonnen[i] = begonnen[i] === true || karten.length > 0

        // Unter den Karten läuft die Linie weiter, bis das Band zu Ende ist. Über der ersten
        // Karte einer Spalte läuft noch keine.
        if (!istGestapelt && karten.length < hoch) {
          const linie: Linie = begonnen[i] === true ? art : 'ohne'

          zellen.push({
            bild: fuellBild(spalte.strang.farbe, gesamt, (hoch - karten.length) * KARTE_HOEHE, linie, farben),
            knopf: '',
          })
        }

        return zellen
      }),
    })
  }

  const enden = bild.spalten.map(spalte => endeBild(spalte.wohin, spalte.strang.farbe, breite, gesamt, farben))

  const stammBreite = istGestapelt ? breite : Math.min(380, Math.round(breite * 1.35))
  const stamm = bild.stamm.map((karte, i): Zelle => {
    const farbe = karte.art === 'endziel' ? ZIEL : karte.zeichen === 'schritt' ? SCHRITT : ZWISCHENZIEL

    return {
      bild: karteBild(karte, farbe, {
        breite: stammBreite,
        farben,
        oben: i === 0 ? 'ohne' : 'offen',
        unten: i === bild.stamm.length - 1 ? 'ohne' : 'offen',
      }),
      knopf: karte.id,
    }
  })
  const kopfRand = randBild('Stränge', KOPF_HOEHE, false, farben)
  const endeRand = huelle(RAND, ENDE_HOEHE, '', '', 'Rand')
  const stammRand = randBild('Ziele', stamm.length * KARTE_HOEHE, false, farben)
  // Was die Leiste wirklich zeichnet: gestapelt ohne die Ränder und ohne die Enden der Spalten.
  const alle = [
    ...koepfe.map(one => one.bild),
    ...baender.flatMap(one => one.spalten.flat().map(zelle => zelle.bild)),
    ...stamm.map(one => one.bild),
    ...(istGestapelt ? [] : [kopfRand, endeRand, stammRand, ...baender.map(one => one.rand), ...enden]),
  ]

  return {
    art: lage.art,
    karte: breite,
    spalte: Math.ceil((breite + KNOPF) / ZELLE_PX) + 1,
    kopfRand,
    koepfe,
    baender,
    endeRand,
    enden,
    stammRand,
    stamm,
    zeichen: alle.reduce((summe, one) => summe + one.source.length, 0),
  }
}

// ---------- Vorschau ----------

// Die ganze Fläche als ein Bild, so wie die Leiste sie setzt: zum Ansehen außerhalb der App
// (als PNG, im Browser). Die Leiste selbst zeichnet nie dieses eine große Bild, sondern die
// vielen kleinen; die Knöpfe sind hier nur angedeutet.
export const vorschau = (flaeche: Flaeche, farben: 'hell' | 'dunkel'): Bild => {
  const palette = farben === 'dunkel' ? DUNKEL : HELL
  const grund = farben === 'dunkel' ? '#14191e' : '#f4f6f7'
  const teil = Math.round(flaeche.spalte * ZELLE_PX)
  const teile: string[] = []
  const setze = (bild: Bild, x: number, y: number): void => {
    teile.push(`<g transform="translate(${x} ${y})">${bild.source}</g>`)
  }
  const knopf = (x: number, y: number, text: string, lang: number): void => {
    teile.push(
      `<rect x="${x}" y="${y}" width="${lang}" height="24" rx="6" fill="${palette.pille}"/>` +
        `<text x="${x + lang / 2}" y="${y + 16}" font-size="12" text-anchor="middle" font-family="${SCHRIFT}" fill="${palette.text}">${esc(text)}</text>`,
    )
  }
  const zellen = (reihe: readonly Zelle[], x: number, von: number): number => {
    let y = von

    for (const zelle of reihe) {
      setze(zelle.bild, x, y)

      if (zelle.knopf !== '') {
        knopf(x + zelle.bild.breite + 2, y + (zelle.bild.hoehe - 24) / 2, '›', 24)
      }

      y += zelle.bild.hoehe
    }

    return y
  }
  const istGestapelt = flaeche.art === 'gestapelt'
  const links = istGestapelt ? 0 : RAND
  let y = 12

  if (!istGestapelt) {
    setze(flaeche.kopfRand, 0, y)
  }

  flaeche.koepfe.forEach((kopf, i) => {
    const x = istGestapelt ? 0 : links + i * teil
    const oben = istGestapelt ? y + i * (KOPF_HOEHE + 34) : y

    setze(kopf.bild, x, oben)

    if (kopf.ohneZiel) {
      knopf(x, oben + KOPF_HOEHE + 4, 'Ziel festlegen', 104)
    }
  })
  y += istGestapelt ? flaeche.koepfe.length * (KOPF_HOEHE + 34) : KOPF_HOEHE + 44

  for (const band of flaeche.baender) {
    if (istGestapelt) {
      teile.push(
        `<text x="0" y="${y + 14}" font-size="11" font-weight="700" font-family="${SCHRIFT}" fill="${palette.meta}">${esc(band.titel.toUpperCase())}</text>`,
      )
      y += 24

      for (const spalte of band.spalten) {
        y = zellen(spalte, 0, y)
      }
    } else {
      setze(band.rand, 0, y)
      band.spalten.forEach((spalte, i) => zellen(spalte, links + i * teil, y))
      y += band.rand.hoehe
    }
  }

  if (!istGestapelt) {
    flaeche.enden.forEach((ende, i) => setze(ende, links + i * teil, y))
    y += ENDE_HOEHE
  }

  y += 16

  if (!istGestapelt) {
    setze(flaeche.stammRand, 0, y)
  }

  y = zellen(flaeche.stamm, links, y) + 12

  const breite = Math.max(
    links + Math.max(1, istGestapelt ? 1 : flaeche.koepfe.length) * teil,
    links + (flaeche.stamm[0]?.bild.breite ?? 0) + KNOPF,
  )

  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite} ${y}" width="${breite}" height="${y}">` +
      `<rect width="${breite}" height="${y}" fill="${grund}"/>${teile.join('')}</svg>`,
    alt: 'Vorschau der Fläche',
    breite,
    hoehe: y,
  }
}
