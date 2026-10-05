import type { ZielGraphFarben, ZielGraphZone } from '../../types'

import { STAMM } from './daten'
import type { GraphBahn, GraphDaten, GraphKnoten, GraphWahl, GraphZeile } from './daten'

// Reine Zeichenlogik im Aussehen „Ruhig“: aus Daten und Einstellung wird erst eine Sicht
// (was ist zu sehen, in welcher Reihenfolge), daraus das SVG. Kein `$`, kein Zustand.

export const ALLE = 'alle'

// Die Grenze der Engine für `Svg.source`.
export const SVG_GRENZE = 131072

export const ZONEN: readonly { id: ZielGraphZone; titel: string }[] = [
  { id: 'hinter', titel: 'Hinter uns' },
  { id: 'jetzt', titel: 'Jetzt möglich' },
  { id: 'spaeter', titel: 'Später' },
]

export type Eintrag =
  | { typ: 'zone'; zone: ZielGraphZone; titel: string }
  | {
      typ: 'zeile'
      zeile: GraphZeile
      // null für die gemeinsame Bahn ab dem Treffpunkt
      bahn: GraphBahn | null
      aufklappbar: boolean
      offen: boolean
    }
  | { typ: 'ticket'; text: string }

export type Sicht = {
  ansicht: GraphWahl['ansicht']
  // das wirksame Ziel: 'alle', wenn die gewählte Bahn gerade nicht wählbar ist
  ziel: string
  // Bahnen der eingeblendeten Personen: für Filter-Knöpfe und Ziel-Auswahl
  waehlbar: GraphBahn[]
  // Bahnen, die gezeichnet werden, in der Reihenfolge der Spalten
  bahnen: GraphBahn[]
  eintraege: Eintrag[]
  aufklappbar: { id: string; titel: string; anzahl: number; offen: boolean }[]
  // '' wenn nichts ausgeblendet ist
  ausgeblendet: string
  zaehler: string
}

export const sicht = (daten: GraphDaten, zustand: GraphWahl): Sicht => {
  const istPersonAn = (id: string): boolean => !zustand.personenAus.includes(id)
  const waehlbar = daten.bahnen.filter(one => istPersonAn(one.person))
  const ziel = waehlbar.some(one => one.id === zustand.ziel) ? zustand.ziel : ALLE
  const bahnen = waehlbar.filter(one =>
    ziel === ALLE ? !zustand.bahnenAus.includes(one.id) : one.id === ziel,
  )
  const nachId = new Map(bahnen.map(one => [one.id, one]))
  const istSichtbar = (zeile: GraphZeile): boolean =>
    zeile.bahn === STAMM || nachId.has(zeile.bahn)

  const eintraege: Eintrag[] = []
  const aufklappbar: Sicht['aufklappbar'] = []
  const nimm = (zeile: GraphZeile): void => {
    const tickets = zeile.tickets ?? []
    const offen = tickets.length > 0 && zustand.offen.includes(zeile.id)

    eintraege.push({
      typ: 'zeile',
      zeile,
      bahn: nachId.get(zeile.bahn) ?? null,
      aufklappbar: tickets.length > 0,
      offen,
    })

    if (tickets.length > 0) {
      aufklappbar.push({ id: zeile.id, titel: zeile.titel, anzahl: tickets.length, offen })
    }

    if (offen) {
      for (const text of tickets) {
        eintraege.push({ typ: 'ticket', text })
      }
    }
  }

  if (zustand.ansicht === 'schritte') {
    const zeilen = daten.schritte.filter(istSichtbar)

    for (const zone of ZONEN) {
      const inZone = zeilen.filter(one => one.bahn !== STAMM && one.zone === zone.id)

      // Eine leere Zone bekommt keine Überschrift; „Jetzt möglich“ steht immer da.
      if (inZone.length > 0 || zone.id === 'jetzt') {
        eintraege.push({ typ: 'zone', zone: zone.id, titel: zone.titel })
        inZone.forEach(nimm)
      }
    }

    zeilen.filter(one => one.bahn === STAMM).forEach(nimm)
  } else {
    daten.uebersicht.filter(istSichtbar).forEach(nimm)
  }

  // Ausgeblendet: erst die eigenen Bahnen, dann je ausgeblendeter Person ihre Bahnen.
  const teile: string[] = []
  const eigene = waehlbar.filter(one => !nachId.has(one.id)).map(one => one.name)

  if (eigene.length > 0) {
    teile.push(eigene.join(', '))
  }

  for (const person of daten.personen.filter(one => !istPersonAn(one.id))) {
    const namen = daten.bahnen.filter(one => one.person === person.id).map(one => one.name)

    if (namen.length > 0) {
      teile.push(`${namen.join(', ')} (${person.name})`)
    }
  }

  const jetzt = daten.schritte.filter(one => one.zone === 'jetzt' && istSichtbar(one))
  const laufen = jetzt.filter(one => one.chat !== undefined).length
  const warten = jetzt.filter(one => one.chat === 'wartet').length

  return {
    ansicht: zustand.ansicht,
    ziel,
    waehlbar,
    bahnen,
    eintraege,
    aufklappbar,
    ausgeblendet: teile.join(' · '),
    zaehler: `${jetzt.length} Bündel jetzt möglich · ${laufen} laufen · ${warten} warten auf dich`,
  }
}

// ---------- Text-Ersatz (Terminal) ----------

export const ZEICHEN: Record<GraphKnoten, string> = {
  erledigt: '●',
  laeuft: '◉',
  bereit: '○',
  teilweise: '◐',
  blockiert: '·',
  treffpunkt: '◆',
  stamm: '○',
  endziel: '◎',
}

export const chatMarke = (zeile: GraphZeile): string =>
  zeile.chat === undefined ? '' : zeile.chat === 'wartet' ? ' [Chat · wartet auf dich]' : ' [Chat]'

export const klappZeichen = (offen: boolean): string => (offen ? '▾' : '▸')

// ---------- SVG ----------

// Die Karte bringt ihren eigenen Grund mit: ein SVG als Bild erbt keine Seitenfarben.
type Palette = {
  flaeche: string
  schrift: string
  leise: string
  linie: string
  stamm: string
  neu: string
  zone: string
  chat: string
  chatSchrift: string
}

const HELL: Palette = {
  flaeche: '#ffffff',
  schrift: '#16242b',
  leise: '#5a6d76',
  linie: '#c9d5da',
  stamm: '#16242b',
  neu: '#f2b01e',
  zone: '#e4f4ea',
  chat: '#16242b',
  chatSchrift: '#ffffff',
}

const DUNKEL: Palette = {
  flaeche: '#18242a',
  schrift: '#e6eef1',
  leise: '#94a7b0',
  linie: '#33464f',
  stamm: '#e6eef1',
  neu: '#e09a00',
  zone: '#173326',
  chat: '#e6eef1',
  chatSchrift: '#10181c',
}

const BREITE = 500
const SPALTE_0 = 18
const SPALTE = 26
const ZEILE = 46
const TICKET = 21
const TICKET_LUFT = 6
const ZONE = 32
// Die Legende mit einer Zeile; jede weitere Zeile der Legende kommt dazu.
const LEGENDE = 34
const LEGENDE_ZEILE = 19
// Vor dem Treffpunkt etwas Luft: Dort laufen die Bahnen zusammen.
const STAMM_LUFT = 18
// Der Rand rechts, und davor in jeder Zeile ein freier Platz: Dort zeichnet das Bild
// nichts. Wer das Bild in Streifen zeigt, legt den Aufklapp-Knopf der Zeile dorthin.
const RAND = 8
const KNOPF_PLATZ = 30
const SCHRIFT = "'Segoe UI', system-ui, -apple-system, sans-serif"

// Eine kleine Pfeilspitze an der Stelle (x, y), die in die Richtung (dx, dy) zeigt.
const spitze = (x: number, y: number, dx: number, dy: number): string => {
  const laenge = Math.hypot(dx, dy) || 1
  const ex = dx / laenge
  const ey = dy / laenge
  const r = (wert: number): number => Math.round(wert * 10) / 10

  return (
    `M${r(x + ex * 6)} ${r(y + ey * 6)} L${r(x - ex * 4 - ey * 4.5)} ${r(y - ey * 4 + ex * 4.5)}` +
    ` L${r(x - ex * 4 + ey * 4.5)} ${r(y - ey * 4 - ex * 4.5)} Z`
  )
}

const esc = (wert: string): string =>
  wert
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Ein SVG-Text bricht nicht um: zu lange Texte werden nach geschätzter Breite gekürzt.
const kuerze = (wert: string, breite: number, groesse: number, fett: boolean): string => {
  const platz = Math.floor(breite / (groesse * (fett ? 0.56 : 0.52)))

  return wert.length > platz ? `${wert.slice(0, Math.max(1, platz - 1)).trimEnd()}…` : wert
}

type Farbe = { f?: string; s?: string }

export type Bild = {
  source: string
  alt: string
  breite: number
  hoehe: number
  // die Oberkante jeder gezeichneten Zeile, von oben nach unten: dort lässt sich das Bild
  // in Streifen schneiden
  zeilen: { id: string; oben: number }[]
}

export const zeichneSvg = (
  daten: GraphDaten,
  bild: Sicht,
  farben: ZielGraphFarben,
): Bild => {
  const basis = farben === 'dunkel' ? DUNKEL : HELL
  const istAuto = farben === 'auto'
  const rollen = new Map<string, { hell: string; dunkel: string }>()

  for (const name of Object.keys(HELL) as (keyof Palette)[]) {
    rollen.set(name, { hell: HELL[name], dunkel: DUNKEL[name] })
  }

  for (const bahn of daten.bahnen) {
    rollen.set(`b-${bahn.id}`, bahn.farbe)
  }

  const wert = (rolle: string): string => {
    const farbe = rollen.get(rolle)

    if (farbe === undefined) {
      return basis.schrift
    }

    return farben === 'dunkel' ? farbe.dunkel : farbe.hell
  }

  // Farben stehen als Attribute am Element, damit das Bild auch ohne <style>
  // stimmt. Bei 'auto' kommt je Rolle eine Klasse dazu, die ein <style>-Block
  // im dunklen Schema überschreibt.
  const farbe = ({ f, s }: Farbe): string => {
    const klassen = [f === undefined ? '' : `f-${f}`, s === undefined ? '' : `s-${s}`]
      .filter(one => one !== '')
      .join(' ')

    return (
      (f === undefined ? '' : ` fill="${wert(f)}"`) +
      (s === undefined ? '' : ` stroke="${wert(s)}"`) +
      (istAuto && klassen !== '' ? ` class="${klassen}"` : '')
    )
  }

  // Spalten: jede sichtbare Bahn eine; der Stamm sitzt auf der mittleren Ziel-Bahn.
  const xVon = new Map(bild.bahnen.map((one, i) => [one.id, SPALTE_0 + SPALTE * i]))
  const zielBahnen = bild.bahnen.filter(one => one.art === 'ziel')
  const mitte = zielBahnen[Math.floor((zielBahnen.length - 1) / 2)]
  const hatEigeneSpalte = mitte === undefined
  const xStamm =
    mitte === undefined
      ? SPALTE_0 + SPALTE * bild.bahnen.length
      : (xVon.get(mitte.id) ?? SPALTE_0)
  const spalten = bild.bahnen.length + (hatEigeneSpalte ? 1 : 0)
  const xText = SPALTE_0 + SPALTE * Math.max(0, spalten - 1) + 24
  const xRand = BREITE - RAND
  // Titel, Beschreibung, Unterzeilen und die Chat-Marke enden vor dem freien Platz.
  const xRechts = xRand - KNOPF_PLATZ

  const texte: string[] = []
  const knoten: string[] = []
  const text = (
    x: number,
    y: number,
    inhalt: string,
    groesse: number,
    gewicht: number,
    rolle: string,
    mehr = '',
  ): string =>
    `<text x="${x}" y="${y}" font-size="${groesse}" font-weight="${gewicht}"${farbe({ f: rolle })}${mehr}>${esc(inhalt)}</text>`

  // Legende: je sichtbarer Bahn ein Farbpunkt mit Namen, mit Umbruch.
  const xLinks = SPALTE_0 - 4
  let xLegende = xLinks
  let yLegende = LEGENDE - 12

  for (const bahn of bild.bahnen) {
    const breite = 15 + Math.ceil(bahn.name.length * 7) + 14

    if (xLegende + breite > xRand && xLegende > xLinks) {
      xLegende = xLinks
      yLegende += LEGENDE_ZEILE
    }

    knoten.push(`<circle cx="${xLegende + 5}" cy="${yLegende - 5}" r="5"${farbe({ f: `b-${bahn.id}` })}/>`)
    texte.push(text(xLegende + 15, yLegende, bahn.name, 13, 500, 'leise'))
    xLegende += breite
  }

  // Zeilen von oben nach unten setzen: unter der Legende, ohne Bahnen unter einem schmalen Rand.
  let y = bild.bahnen.length === 0 ? 17 : yLegende + 12
  // Die Bahnen setzen kurz unter der Legende an.
  const yBahnStart = y + 4
  const yZone = new Map<ZielGraphZone, number>()
  const yZeile = new Map<string, number>()
  const xZeile = new Map<string, number>()
  const zeilen: Bild['zeilen'] = []
  const worte: string[] = []
  let warTicket = false
  let warStamm = false
  let inJetzt = false
  let yJetztEnde: number | undefined

  for (const eintrag of bild.eintraege) {
    // Tickets stehen als Block: etwas Luft davor und danach.
    if ((eintrag.typ === 'ticket') !== warTicket) {
      y += TICKET_LUFT
    }

    warTicket = eintrag.typ === 'ticket'

    // Die Zone „jetzt“ endet an der nächsten Überschrift oder am Stamm.
    const istStamm = eintrag.typ === 'zeile' && eintrag.bahn === null

    if (inJetzt && (eintrag.typ === 'zone' || istStamm)) {
      yJetztEnde = y
      inJetzt = false
    }

    // Die erste Zeile des Stamms rückt ab, wenn über ihr schon etwas steht.
    if (istStamm && !warStamm && eintrag !== bild.eintraege[0]) {
      y += STAMM_LUFT
    }

    warStamm = warStamm || istStamm

    if (eintrag.typ === 'zone') {
      inJetzt = eintrag.zone === 'jetzt'
      yZone.set(eintrag.zone, y)
      texte.push(
        text(xText, y + 21, eintrag.titel.toUpperCase(), 12, 700, 'leise', ' letter-spacing="1"'),
      )
      worte.push(`${eintrag.titel}:`)
      y += ZONE
      continue
    }

    if (eintrag.typ === 'ticket') {
      texte.push(
        text(xText + 14, y + 5, kuerze(eintrag.text, xRechts - xText - 14, 12.5, false), 12.5, 400, 'leise'),
      )
      y += TICKET
      continue
    }

    const { zeile } = eintrag
    const cy = y + 16
    const x = eintrag.bahn === null ? xStamm : (xVon.get(eintrag.bahn.id) ?? xStamm)
    const k = eintrag.bahn === null ? 'stamm' : `b-${eintrag.bahn.id}`
    const grund = farbe({ f: 'flaeche', s: k })

    yZeile.set(zeile.id, cy)
    xZeile.set(zeile.id, x)
    zeilen.push({ id: zeile.id, oben: y })

    if (zeile.art === 'erledigt') {
      knoten.push(`<circle cx="${x}" cy="${cy}" r="5.5"${farbe({ f: k })}/>`)
    } else if (zeile.art === 'laeuft') {
      knoten.push(
        `<circle cx="${x}" cy="${cy}" r="8" stroke-width="3"${grund}/>` +
          `<circle cx="${x}" cy="${cy}" r="3.5"${farbe({ f: k })}/>`,
      )
    } else if (zeile.art === 'bereit' || zeile.art === 'stamm') {
      knoten.push(`<circle cx="${x}" cy="${cy}" r="8" stroke-width="3"${grund}/>`)
    } else if (zeile.art === 'teilweise') {
      knoten.push(
        `<circle cx="${x}" cy="${cy}" r="8" stroke-width="3"${grund}/>` +
          `<path d="M${x} ${cy - 8} A8 8 0 0 0 ${x} ${cy + 8} Z"${farbe({ f: k })}/>`,
      )
    } else if (zeile.art === 'blockiert') {
      knoten.push(`<circle cx="${x}" cy="${cy}" r="4.5" stroke-width="2" opacity="0.75"${grund}/>`)
    } else if (zeile.art === 'treffpunkt') {
      knoten.push(
        `<circle cx="${x}" cy="${cy}" r="10.5" stroke-width="3"${farbe({ f: 'neu', s: 'stamm' })}/>`,
      )
    } else {
      knoten.push(
        `<circle cx="${x}" cy="${cy}" r="11.5" stroke-width="3"${farbe({ f: 'flaeche', s: 'stamm' })}/>` +
          `<circle cx="${x}" cy="${cy}" r="5.5"${farbe({ f: 'stamm' })}/>`,
      )
    }

    const istLeise = zeile.art === 'erledigt' || zeile.art === 'blockiert'
    const istFett = zeile.art === 'treffpunkt' || zeile.art === 'endziel'
    const hatChat = zeile.chat !== undefined
    // Der Titel beginnt gleich nach den Bahnen und endet vor der Chat-Marke.
    const platz = (hatChat ? xRechts - 69 : xRechts) - xText

    texte.push(
      text(
        xText,
        cy - 1,
        kuerze(zeile.titel, platz, 15, true),
        15,
        istFett ? 700 : istLeise ? 500 : 600,
        istLeise ? 'leise' : 'schrift',
      ),
    )

    if (zeile.meta !== '') {
      texte.push(text(xText, cy + 17, kuerze(zeile.meta, xRechts - xText, 12.5, false), 12.5, 400, 'leise'))
    }

    if (hatChat) {
      texte.push(
        `<rect x="${xRechts - 50}" y="${cy - 15.5}" width="50" height="20" rx="10"${farbe({ f: 'chat' })}/>` +
          text(xRechts - 25, cy - 1, 'Chat', 12.5, 600, 'chatSchrift', ' text-anchor="middle"'),
      )

      if (zeile.chat === 'wartet') {
        texte.push(`<circle cx="${xRechts - 61}" cy="${cy - 5.5}" r="5.5"${farbe({ f: 'neu' })}/>`)
      }
    }

    worte.push(`${zeile.titel}${chatMarke(zeile)};`)
    y += ZEILE
  }

  const hoehe = y + 19

  // Bahnen: durchgezogen = hinter uns, gepunktet = noch zu tun.
  const hatZonen = yZone.has('jetzt')
  const yJetzt = yZone.get('jetzt') ?? yBahnStart
  const ySpaeter = yJetztEnde ?? (inJetzt ? y : yJetzt)
  const treff = bild.eintraege.find(one => one.typ === 'zeile' && one.zeile.art === 'treffpunkt')
  const ende = bild.eintraege.find(one => one.typ === 'zeile' && one.zeile.art === 'endziel')
  const yTreff = treff?.typ === 'zeile' ? yZeile.get(treff.zeile.id) : undefined
  const yEnde = ende?.typ === 'zeile' ? yZeile.get(ende.zeile.id) : undefined
  // Wo die Bahnen der Ziele in den Stamm münden: kurz über dem Treffpunkt. Hat der Plan
  // keinen (GOAL.md nennt kein offenes Zwischenziel mehr), münden sie ins Endziel.
  const yMuendung = yTreff !== undefined ? yTreff - 12 : yEnde !== undefined ? yEnde - 13 : undefined
  const fest = ' fill="none" stroke-width="3" stroke-linecap="round"'
  const offen = `${fest} stroke-dasharray="2 7"`
  const bahnen: string[] = []

  if (hatZonen) {
    bahnen.push(
      `<rect x="1" y="${yJetzt}" width="${BREITE - 2}" height="${ySpaeter - yJetzt}"${farbe({ f: 'zone' })}/>`,
    )
  }

  for (const bahn of bild.bahnen) {
    const x = xVon.get(bahn.id) ?? SPALTE_0
    const s = farbe({ s: `b-${bahn.id}` })
    const istFest = hatZonen && bahn.begonnen
    const yStart = istFest ? yJetzt : yBahnStart

    if (istFest) {
      bahnen.push(`<path d="M${x} ${yBahnStart} V${yJetzt}"${fest}${s}/>`)
    }

    if (bahn.art === 'ziel' && yMuendung !== undefined) {
      const yKnick = Math.max(yStart, yMuendung - 24)
      const weg =
        x === xStamm
          ? `M${x} ${yStart} V${yMuendung}`
          : `M${x} ${yStart} V${yKnick} C${x} ${yMuendung - 5} ${xStamm} ${yMuendung - 14} ${xStamm} ${yMuendung}`

      bahnen.push(`<path d="${weg}"${offen}${s}/>`)
    } else {
      // Dauerläufer: die Bahn endet unten in einem Pfeil statt in einem Punkt.
      bahnen.push(
        `<path d="M${x} ${yStart} V${hoehe - 19}"${offen}${s}/>` +
          `<path d="M${x - 5.5} ${hoehe - 17} L${x + 5.5} ${hoehe - 17} L${x} ${hoehe - 6} Z"${farbe({ f: `b-${bahn.id}` })}/>`,
      )
    }
  }

  if (yTreff !== undefined && yEnde !== undefined) {
    bahnen.push(`<path d="M${xStamm} ${yTreff + 12} V${yEnde - 13}"${offen}${farbe({ s: 'stamm' })}/>`)
  }

  // „Wartet auf“: dünne gestrichelte Linie vom Bündel zu seinem Ziel, nur wenn das Ziel in
  // einer anderen Bahn liegt. Was in derselben Bahn wartet, sagen die Reihenfolge und der
  // Text der Zeile: Eine Linie dorthin liefe nur über die eigene Bahn.
  // Zwei Pfeilspitzen zeigen die Richtung: vom Schritt, der zuerst fertig sein muss, zu dem,
  // der wartet. Eine sitzt auf dem Bogen, eine vor dem wartenden Bündel.
  const bahnVon = new Map(
    bild.eintraege.flatMap(one => (one.typ === 'zeile' ? [[one.zeile.id, one.zeile.bahn] as const] : [])),
  )

  for (const eintrag of bild.eintraege) {
    if (eintrag.typ !== 'zeile' || eintrag.zeile.wartetAuf === undefined || eintrag.bahn === null) {
      continue
    }

    if (bahnVon.get(eintrag.zeile.wartetAuf) === eintrag.zeile.bahn) {
      continue
    }

    const yVon = yZeile.get(eintrag.zeile.id)
    const yNach = yZeile.get(eintrag.zeile.wartetAuf)
    const xNach = xZeile.get(eintrag.zeile.wartetAuf)
    const x = xVon.get(eintrag.bahn.id)

    if (yVon === undefined || yNach === undefined || xNach === undefined || x === undefined) {
      continue
    }

    // Das Ziel liegt unter oder über dem Bündel, links oder rechts von seiner Bahn.
    const hin = yNach >= yVon ? 1 : -1
    const seite = x >= xNach ? 1 : -1
    const zug = Math.min(33, Math.abs(x - xNach))
    const yKnick = hin === 1 ? Math.max(yVon + 10, yNach - 40) : Math.min(yVon - 10, yNach + 40)

    bahnen.push(
      `<path d="M${x} ${yVon + 10 * hin} V${yKnick} C${x} ${yNach - 10 * hin} ${xNach + zug * seite} ${yNach} ${xNach + 10 * seite} ${yNach}"` +
        ` fill="none" stroke-width="1.9" stroke-dasharray="6 5"${farbe({ s: `b-${eintrag.bahn.id}` })}/>`,
    )

    // Der Bogen läuft von (x, yKnick) zum Ziel; die Spitze auf ihm zeigt zurück zur eigenen Bahn.
    const t = 0.55
    const u = 1 - t
    const c1y = yNach - 10 * hin
    const c2x = xNach + zug * seite
    const p3x = xNach + 10 * seite
    const bx = u * u * u * x + 3 * u * u * t * x + 3 * u * t * t * c2x + t * t * t * p3x
    const by = u * u * u * yKnick + 3 * u * u * t * c1y + 3 * u * t * t * yNach + t * t * t * yNach
    const dx = -(6 * u * t * (c2x - x) + 3 * t * t * (p3x - c2x))
    const dy = -(3 * u * u * (c1y - yKnick) + 6 * u * t * (yNach - c1y))
    const fuellung = farbe({ f: `b-${eintrag.bahn.id}` })

    bahnen.push(
      `<path d="${spitze(bx, by, dx, dy)}" stroke-linejoin="round"${fuellung}/>` +
        `<path d="${spitze(x, yVon + 17 * hin, 0, -hin)}" stroke-linejoin="round"${fuellung}/>`,
    )
  }

  const dunkel = istAuto
    ? `<style>@media (prefers-color-scheme: dark){${[...rollen]
        .map(([rolle, one]) => `.f-${rolle}{fill:${one.dunkel}}.s-${rolle}{stroke:${one.dunkel}}`)
        .join('')}}</style>`
    : ''
  const alt =
    `Ziel-Graph, Ansicht ${bild.ansicht === 'schritte' ? 'Schritte' : 'Übersicht'}. ` +
    `Bahnen: ${bild.bahnen.map(one => one.name).join(', ') || 'keine'}. ${worte.join(' ')}`
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BREITE} ${hoehe}" width="${BREITE}" height="${hoehe}" role="img" aria-label="${esc(alt)}">` +
    dunkel +
    `<rect x="0.5" y="0.5" width="${BREITE - 1}" height="${hoehe - 1}" rx="9"${farbe({ f: 'flaeche', s: 'linie' })}/>` +
    `<g font-family="${SCHRIFT}">` +
    bahnen.join('') +
    knoten.join('') +
    texte.join('') +
    '</g></svg>'

  return { source, alt, breite: BREITE, hoehe, zeilen }
}
