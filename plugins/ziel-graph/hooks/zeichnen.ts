import type {
  ZielGraphBahn,
  ZielGraphDaten,
  ZielGraphFarben,
  ZielGraphKnoten,
  ZielGraphZeile,
  ZielGraphZone,
  ZielGraphZustand,
} from '../types'

import { STAMM } from './daten'

// Reine Zeichenlogik: aus Daten und Zustand wird erst eine Sicht (was ist zu
// sehen, in welcher Reihenfolge), daraus das SVG. Kein `$`, kein Zustand.

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
      zeile: ZielGraphZeile
      // null für die gemeinsame Bahn ab dem Treffpunkt
      bahn: ZielGraphBahn | null
      aufklappbar: boolean
      offen: boolean
    }
  | { typ: 'ticket'; text: string }

export type Sicht = {
  ansicht: ZielGraphZustand['ansicht']
  // das wirksame Ziel: 'alle', wenn die gewählte Bahn gerade nicht wählbar ist
  ziel: string
  // Bahnen der eingeblendeten Personen: für Filter-Knöpfe und Ziel-Auswahl
  waehlbar: ZielGraphBahn[]
  // Bahnen, die gezeichnet werden, in der Reihenfolge der Spalten
  bahnen: ZielGraphBahn[]
  eintraege: Eintrag[]
  aufklappbar: { id: string; titel: string; anzahl: number; offen: boolean }[]
  // '' wenn nichts ausgeblendet ist
  ausgeblendet: string
  zaehler: string
}

export const sicht = (daten: ZielGraphDaten, zustand: ZielGraphZustand): Sicht => {
  const istPersonAn = (id: string): boolean => !zustand.personenAus.includes(id)
  const waehlbar = daten.bahnen.filter(one => istPersonAn(one.person))
  const ziel = waehlbar.some(one => one.id === zustand.ziel) ? zustand.ziel : ALLE
  const bahnen = waehlbar.filter(one =>
    ziel === ALLE ? !zustand.bahnenAus.includes(one.id) : one.id === ziel,
  )
  const nachId = new Map(bahnen.map(one => [one.id, one]))
  const istSichtbar = (zeile: ZielGraphZeile): boolean =>
    zeile.bahn === STAMM || nachId.has(zeile.bahn)

  const eintraege: Eintrag[] = []
  const aufklappbar: Sicht['aufklappbar'] = []
  const nimm = (zeile: ZielGraphZeile): void => {
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

export const ZEICHEN: Record<ZielGraphKnoten, string> = {
  erledigt: '●',
  laeuft: '◉',
  bereit: '○',
  teilweise: '◐',
  blockiert: '·',
  treffpunkt: '◆',
  stamm: '○',
  endziel: '◎',
}

export const chatMarke = (zeile: ZielGraphZeile): string =>
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

const BREITE = 420
const SPALTE_0 = 14
const SPALTE = 18
const ZEILE = 36
const TICKET = 18
const TICKET_LUFT = 5
const ZONE = 22
const SCHRIFT = "'Segoe UI', system-ui, -apple-system, sans-serif"

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

export type Bild = { source: string; alt: string; breite: number; hoehe: number }

export const zeichneSvg = (
  daten: ZielGraphDaten,
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
  const xText = SPALTE_0 + SPALTE * Math.max(0, spalten - 1) + 20
  const xRechts = BREITE - 8

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
  let xLegende = 12
  let yLegende = 18

  for (const bahn of bild.bahnen) {
    const breite = 12 + Math.ceil(bahn.name.length * 5.9) + 12

    if (xLegende + breite > xRechts && xLegende > 12) {
      xLegende = 12
      yLegende += 16
    }

    knoten.push(`<circle cx="${xLegende + 4}" cy="${yLegende - 4}" r="4"${farbe({ f: `b-${bahn.id}` })}/>`)
    texte.push(text(xLegende + 12, yLegende, bahn.name, 11, 500, 'leise'))
    xLegende += breite
  }

  const oben = bild.bahnen.length === 0 ? 0 : yLegende + 8
  const yBahnStart = oben + 8

  // Zeilen von oben nach unten setzen.
  let y = oben + 14
  const yZone = new Map<ZielGraphZone, number>()
  const yZeile = new Map<string, number>()
  const xZeile = new Map<string, number>()
  const worte: string[] = []
  let warTicket = false
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

    if (eintrag.typ === 'zone') {
      inJetzt = eintrag.zone === 'jetzt'
      yZone.set(eintrag.zone, y)
      texte.push(
        text(xText, y + 13, eintrag.titel.toUpperCase(), 10, 700, 'leise', ' letter-spacing="0.8"'),
      )
      worte.push(`${eintrag.titel}:`)
      y += ZONE
      continue
    }

    if (eintrag.typ === 'ticket') {
      texte.push(
        text(xText + 12, y + 4, kuerze(eintrag.text, xRechts - xText - 12, 11, false), 11, 400, 'leise'),
      )
      y += TICKET
      continue
    }

    const { zeile } = eintrag
    const cy = y + 14
    const x = eintrag.bahn === null ? xStamm : (xVon.get(eintrag.bahn.id) ?? xStamm)
    const k = eintrag.bahn === null ? 'stamm' : `b-${eintrag.bahn.id}`
    const grund = farbe({ f: 'flaeche', s: k })

    yZeile.set(zeile.id, cy)
    xZeile.set(zeile.id, x)

    if (zeile.art === 'erledigt') {
      knoten.push(`<circle cx="${x}" cy="${cy}" r="4.5"${farbe({ f: k })}/>`)
    } else if (zeile.art === 'laeuft') {
      knoten.push(
        `<circle cx="${x}" cy="${cy}" r="6.5" stroke-width="3"${grund}/>` +
          `<circle cx="${x}" cy="${cy}" r="3"${farbe({ f: k })}/>`,
      )
    } else if (zeile.art === 'bereit' || zeile.art === 'stamm') {
      knoten.push(`<circle cx="${x}" cy="${cy}" r="6.5" stroke-width="3"${grund}/>`)
    } else if (zeile.art === 'teilweise') {
      knoten.push(
        `<circle cx="${x}" cy="${cy}" r="6.5" stroke-width="3"${grund}/>` +
          `<path d="M${x} ${cy - 6.5} A6.5 6.5 0 0 0 ${x} ${cy + 6.5} Z"${farbe({ f: k })}/>`,
      )
    } else if (zeile.art === 'blockiert') {
      knoten.push(`<circle cx="${x}" cy="${cy}" r="3.5" stroke-width="2" opacity="0.75"${grund}/>`)
    } else if (zeile.art === 'treffpunkt') {
      knoten.push(
        `<circle cx="${x}" cy="${cy}" r="8.5" stroke-width="3"${farbe({ f: 'neu', s: 'stamm' })}/>`,
      )
    } else {
      knoten.push(
        `<circle cx="${x}" cy="${cy}" r="9.5" stroke-width="3"${farbe({ f: 'flaeche', s: 'stamm' })}/>` +
          `<circle cx="${x}" cy="${cy}" r="4.5"${farbe({ f: 'stamm' })}/>`,
      )
    }

    const istLeise = zeile.art === 'erledigt' || zeile.art === 'blockiert'
    const istFett = zeile.art === 'treffpunkt' || zeile.art === 'endziel'
    const hatChat = zeile.chat !== undefined
    const titel = eintrag.aufklappbar
      ? `${klappZeichen(eintrag.offen)} ${zeile.titel}`
      : zeile.titel
    const platz = (hatChat ? BREITE - 66 : xRechts) - xText

    texte.push(
      text(
        xText,
        cy - 1,
        kuerze(titel, platz, 12.5, true),
        12.5,
        istFett ? 700 : istLeise ? 500 : 600,
        istLeise ? 'leise' : 'schrift',
      ),
    )

    if (zeile.meta !== '') {
      texte.push(text(xText, cy + 13, kuerze(zeile.meta, xRechts - xText, 11, false), 11, 400, 'leise'))
    }

    if (hatChat) {
      texte.push(
        `<rect x="${BREITE - 50}" y="${cy - 13}" width="42" height="17" rx="8.5"${farbe({ f: 'chat' })}/>` +
          text(BREITE - 29, cy - 1, 'Chat', 10.5, 600, 'chatSchrift', ' text-anchor="middle"'),
      )

      if (zeile.chat === 'wartet') {
        texte.push(`<circle cx="${BREITE - 59}" cy="${cy - 5}" r="4.5"${farbe({ f: 'neu' })}/>`)
      }
    }

    worte.push(`${zeile.titel}${chatMarke(zeile)};`)
    y += ZEILE
  }

  const hoehe = y + 16

  // Bahnen: durchgezogen = hinter uns, gepunktet = noch zu tun.
  const hatZonen = yZone.has('jetzt')
  const yJetzt = yZone.get('jetzt') ?? yBahnStart
  const ySpaeter = yJetztEnde ?? (inJetzt ? y : yJetzt)
  const treff = bild.eintraege.find(one => one.typ === 'zeile' && one.zeile.art === 'treffpunkt')
  const ende = bild.eintraege.find(one => one.typ === 'zeile' && one.zeile.art === 'endziel')
  const yTreff = treff?.typ === 'zeile' ? yZeile.get(treff.zeile.id) : undefined
  const yEnde = ende?.typ === 'zeile' ? yZeile.get(ende.zeile.id) : undefined
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

    if (bahn.art === 'ziel' && yTreff !== undefined) {
      const yKnick = Math.max(yStart, yTreff - 30)
      const weg =
        x === xStamm
          ? `M${x} ${yStart} V${yTreff - 10}`
          : `M${x} ${yStart} V${yKnick} C${x} ${yTreff - 14} ${xStamm} ${yTreff - 22} ${xStamm} ${yTreff - 10}`

      bahnen.push(`<path d="${weg}"${offen}${s}/>`)
    } else {
      // Dauerläufer: die Bahn endet unten in einem Pfeil statt in einem Punkt.
      bahnen.push(
        `<path d="M${x} ${yStart} V${hoehe - 16}"${offen}${s}/>` +
          `<path d="M${x - 4.5} ${hoehe - 14} L${x + 4.5} ${hoehe - 14} L${x} ${hoehe - 5} Z"${farbe({ f: `b-${bahn.id}` })}/>`,
      )
    }
  }

  if (yTreff !== undefined && yEnde !== undefined) {
    bahnen.push(`<path d="M${xStamm} ${yTreff + 10} V${yEnde - 11}"${offen}${farbe({ s: 'stamm' })}/>`)
  }

  // „Wartet auf“: dünne gestrichelte Linie vom Bündel zu seinem Ziel, nur wenn das Ziel in
  // einer anderen Bahn liegt. Was in derselben Bahn wartet, sagen die Reihenfolge und der
  // Text der Zeile: Eine Linie dorthin liefe nur über die eigene Bahn.
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
    const zug = Math.min(28, Math.abs(x - xNach))
    const yKnick = hin === 1 ? Math.max(yVon + 8, yNach - 34) : Math.min(yVon - 8, yNach + 34)

    bahnen.push(
      `<path d="M${x} ${yVon + 8 * hin} V${yKnick} C${x} ${yNach - 8 * hin} ${xNach + zug * seite} ${yNach} ${xNach + 8 * seite} ${yNach}"` +
        ` fill="none" stroke-width="1.6" stroke-dasharray="5 4"${farbe({ s: `b-${eintrag.bahn.id}` })}/>`,
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
    `<rect x="0.5" y="0.5" width="${BREITE - 1}" height="${hoehe - 1}" rx="8"${farbe({ f: 'flaeche', s: 'linie' })}/>` +
    `<g font-family="${SCHRIFT}">` +
    bahnen.join('') +
    knoten.join('') +
    texte.join('') +
    '</g></svg>'

  return { source, alt, breite: BREITE, hoehe }
}
