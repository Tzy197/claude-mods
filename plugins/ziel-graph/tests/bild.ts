import { expect } from 'claude-code/testing'

import { STRANG_FARBEN } from '../hooks/fest'
import { STAMM } from '../hooks/graph/daten'
import type { GraphDaten, GraphWahl } from '../hooks/graph/daten'
import { schneide } from '../hooks/graph/streifen'
import { ALLE, SVG_GRENZE, sicht, zeichneSvg } from '../hooks/graph/zeichnen'
import type { Bild } from '../hooks/graph/zeichnen'

// Was jedes Bild des Graphen einhalten muss, und wie ein Test es in seine Streifen zerlegt.

export const wahl = (ansicht: GraphWahl['ansicht'], offen: string[]): GraphWahl => ({
  ansicht,
  ziel: ALLE,
  bahnenAus: [],
  personenAus: [],
  offen,
  farben: 'auto',
})

// Der Anfang eines Streifens: Nur hier darf er sich vom ganzen Bild unterscheiden.
const KOPF = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 (\d+) (\d+) (\d+)" width="(\d+)" height="(\d+)" /

export const ausschnittVon = (source: string) => {
  const kopf = KOPF.exec(source)

  if (kopf === null) {
    throw new Error(`Kein Ausschnitt am Anfang: ${source.slice(0, 120)}`)
  }

  return {
    oben: Number(kopf[1]),
    breite: Number(kopf[2]),
    hoehe: Number(kopf[3]),
    width: Number(kopf[4]),
    height: Number(kopf[5]),
    rumpf: source.slice(kopf[0].length),
  }
}

// Der Rumpf eines Streifens ohne seinen Beschnitt, und das Rechteck, auf das er beschnitten ist.
const BESCHNITT = /<clipPath id="schnitt"><rect x="0" y="(\d+)" width="(\d+)" height="(\d+)"\/><\/clipPath><g clip-path="url\(#schnitt\)">/

const ohneBeschnitt = (rumpf: string) => {
  const schnitt = BESCHNITT.exec(rumpf)

  if (schnitt === null || !rumpf.endsWith('</g></svg>')) {
    throw new Error(`Kein Beschnitt im Streifen: ${rumpf.slice(0, 160)}`)
  }

  return {
    rumpf: `${rumpf.slice(0, schnitt.index)}${rumpf.slice(schnitt.index + schnitt[0].length, -'</g></svg>'.length)}</svg>`,
    rechteck: [Number(schnitt[1]), Number(schnitt[2]), Number(schnitt[3])],
  }
}

// Die Streifen teilen das Bild genau: lückenlos und ohne Überlappung von 0 bis zur ganzen
// Höhe, geschnitten an der Oberkante jeder Zeile. Jeder trägt dasselbe Bild und unterscheidet
// sich nur in viewBox, width und height und im Beschnitt auf genau diesen Ausschnitt. `breite`
// ist die Breite, die der Streifen der Surface nennt; eine Höhe nennt er nicht.
export const pruefeTeilung = (
  ganz: Bild,
  teile: readonly { source: string; breite: unknown; hoehe: unknown }[],
): void => {
  const { rumpf } = ausschnittVon(ganz.source)
  let unten = 0

  for (const teil of teile) {
    const schnitt = ausschnittVon(teil.source)

    expect(schnitt.oben).toBe(unten)
    expect(schnitt.hoehe > 0).toBe(true)
    expect([schnitt.breite, schnitt.width, teil.breite]).toEqual([ganz.breite, ganz.breite, ganz.breite])
    expect([schnitt.height, teil.hoehe]).toEqual([schnitt.hoehe, schnitt.hoehe])
    const beschnitten = ohneBeschnitt(schnitt.rumpf)

    expect(beschnitten.rumpf === rumpf).toBe(true)
    expect(beschnitten.rechteck).toEqual([schnitt.oben, schnitt.breite, schnitt.hoehe])
    unten += schnitt.hoehe
  }

  expect(unten).toBe(ganz.hoehe)
  // Der Kopf, dann je Zeile ein Streifen ab ihrer Oberkante.
  expect(teile.slice(1).map(one => ausschnittVon(one.source).oben)).toEqual(ganz.zeilen.map(one => one.oben))
}

// Rechts in jeder Zeile hält das Bild einen Platz frei, 30 px breit, vor dem Rand von 8 px:
// Dort liegt in den Streifen der Aufklapp-Knopf.
export const PLATZ = { links: 462, rechts: 492 }

// Die x-Werte, die ein Pfad berührt.
const xVonPfad = (d: string): number[] =>
  [...d.matchAll(/([MVCLAZ])([^MVCLAZ]*)/g)].flatMap(([, befehl, rest = '']) => {
    const zahlen = rest.trim().split(/[\s,]+/).filter(one => one !== '').map(Number)
    const stellen = befehl === 'M' || befehl === 'L' ? [0] : befehl === 'C' ? [0, 2, 4] : befehl === 'A' ? [5] : []

    return stellen.map(one => zahlen[one] ?? Number.NaN)
  })

// Im freien Platz zeichnet das Bild nichts: Kein Text, kein Knoten, keine Marke und keine
// Linie reicht über seine linke Kante. Nur der Grund des Bildes und der Zone läuft durch,
// und die Legende über den Zeilen (Schrift 13, Punkte mit Radius 5) darf bis an den Rand.
// Gibt zurück, wie weit nach rechts das Bild in den Zeilen reicht.
export const pruefePlatz = (bild: Bild): number => {
  const enden: number[] = []

  for (const [, x, groesse, mehr, inhalt = ''] of bild.source.matchAll(
    /<text x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)" font-weight="\d+"([^>]*)>([^<]*)<\/text>/g,
  )) {
    if (groesse === '13') {
      continue
    }

    // So schätzt auch zeichnen.ts die Breite eines Textes: Titel breiter, alles andere schmaler.
    const zeichen = inhalt.replace(/&(amp|lt|gt|quot);/g, '·').length
    const breite = zeichen * Number(groesse) * (groesse === '15' ? 0.56 : 0.52)

    enden.push(Number(x) + (mehr?.includes('text-anchor="middle"') === true ? breite / 2 : breite))
  }

  expect(enden.length > 0).toBe(true)
  // Jeder Text des Bildes ist dabei erfasst, bis auf die Legende.
  expect(enden.length + bild.source.split('font-size="13"').length - 1).toBe(bild.source.split('<text ').length - 1)

  for (const [, x, breite] of bild.source.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)) {
    if (Number(breite) < bild.breite - 2) {
      enden.push(Number(x) + Number(breite))
    }
  }

  for (const [, cx, r] of bild.source.matchAll(/<circle cx="([\d.]+)" cy="[\d.]+" r="([\d.]+)"/g)) {
    if (r !== '5') {
      enden.push(Number(cx) + Number(r))
    }
  }

  for (const [, d = ''] of bild.source.matchAll(/<path d="([^"]*)"/g)) {
    enden.push(...xVonPfad(d))
  }

  const rechts = Math.max(...enden)

  expect(enden.every(one => Number.isFinite(one))).toBe(true)
  expect(rechts <= PLATZ.links).toBe(true)

  return rechts
}

const KNOTEN_IN_ZONE: Record<string, string[]> = {
  hinter: ['erledigt'],
  jetzt: ['laeuft', 'bereit', 'teilweise'],
  spaeter: ['blockiert'],
}

// Die Regeln, auf die sich zeichnen.ts verlässt, für die Daten, die zeilen.ts aus einem Plan
// macht. `gross`: Das Bild darf die Grenze sprengen, weil die Leiste dann die Liste zeichnet.
export const pruefeGraph = (daten: GraphDaten, gross = false): void => {
  const bahnen = new Set(daten.bahnen.map(one => one.id))
  const personen = new Set(daten.personen.map(one => one.id))

  expect(bahnen.size).toBe(daten.bahnen.length)
  expect(bahnen.has(STAMM)).toBe(false)

  for (const bahn of daten.bahnen) {
    expect(bahn.id).toMatch(/^[a-z0-9-]+$/)
    expect(personen.has(bahn.person)).toBe(true)
    expect(STRANG_FARBEN).toContainEqual(bahn.farbe)
  }

  // Erst die Ziele, dann die Dauerläufer.
  const arten = daten.bahnen.map(one => one.art).join(' ')

  expect(arten).not.toMatch(/dauer .*ziel/)

  for (const zeilen of [daten.schritte, daten.uebersicht]) {
    const ids = zeilen.map(one => one.id)
    const aufStamm = zeilen.filter(one => one.bahn === STAMM)

    expect(new Set(ids).size).toBe(ids.length)

    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/)
    }

    // Der Stamm steht am Ende: höchstens ein Treffpunkt, genau ein Endziel zuletzt. Davor
    // dürfen erreichte Zwischenziele stehen, danach die Schritte.
    expect(zeilen.slice(-aufStamm.length)).toEqual(aufStamm)
    expect(aufStamm.at(-1)?.art).toBe('endziel')
    expect(aufStamm.filter(one => one.art === 'treffpunkt').length <= 1).toBe(true)
    expect(aufStamm.filter(one => one.art === 'endziel')).toHaveLength(1)
    expect(aufStamm.slice(0, -1).every(one => ['erledigt', 'treffpunkt', 'stamm'].includes(one.art))).toBe(true)

    for (const zeile of zeilen) {
      // Kein Zeichen, das ein SVG ungültig macht.
      expect(`${zeile.titel}${zeile.meta}${(zeile.tickets ?? []).join('')}`).not.toMatch(/[\u0000-\u001f\u007f]/)

      if (zeile.bahn !== STAMM) {
        expect(bahnen.has(zeile.bahn)).toBe(true)
      }
    }
  }

  // In der Ansicht Schritte hat jede Bahn-Zeile ihre Zone und einen Stand, der dazu passt;
  // die Zonen stehen in ihrer Reihenfolge und darin die Bahnen in ihrer.
  const inBahnen = daten.schritte.filter(one => one.bahn !== STAMM)
  const folge = inBahnen.map(
    one =>
      ['hinter', 'jetzt', 'spaeter'].indexOf(one.zone ?? '') * 100 +
      daten.bahnen.findIndex(bahn => bahn.id === one.bahn),
  )

  expect(folge).toEqual([...folge].sort((a, b) => a - b))

  for (const zeile of inBahnen) {
    expect(KNOTEN_IN_ZONE[zeile.zone ?? '']).toContain(zeile.art)
    expect(zeile.chat !== undefined).toBe(zeile.art === 'laeuft')

    if (zeile.wartetAuf !== undefined) {
      expect(zeile.wartetAuf).not.toBe(zeile.id)
      expect(daten.schritte.map(one => one.id)).toContain(zeile.wartetAuf)
    }
  }

  for (const bahn of daten.bahnen) {
    expect(bahn.begonnen).toBe(inBahnen.some(one => one.bahn === bahn.id && one.zone === 'hinter'))
  }

  expect(daten.schritte.at(-1)?.titel).toBe(daten.endziel)

  // Beide Ansichten lassen sich zeichnen, zugeklappt und mit allem aufgeklappt.
  for (const ansicht of ['schritte', 'uebersicht'] as const) {
    for (const offen of [[], daten.schritte.map(one => one.id)]) {
      const bild = sicht(daten, wahl(ansicht, offen))
      const svg = zeichneSvg(daten, bild, 'auto')

      expect(svg.source.startsWith('<svg ')).toBe(true)
      expect(svg.source.endsWith('</svg>')).toBe(true)
      expect(svg.source).not.toMatch(/NaN|undefined|[\u0000-\u001f]/)
      expect(svg.source.split('<text ').length).toBe(svg.source.split('</text>').length)

      if (!gross) {
        expect(svg.source.length < SVG_GRENZE).toBe(true)
      }

      // Und jedes Bild lässt sich in Streifen schneiden: der Kopf und je Zeile einer.
      const streifen = schneide(svg, bild)

      pruefeTeilung(svg, streifen)
      expect(streifen.map(one => one.zeile)).toEqual([null, ...svg.zeilen.map(one => one.id)])

      // Das Bild zeigt kein Klapp-Zeichen und lässt rechts in jeder Zeile den Platz für
      // den Aufklapp-Knopf frei.
      expect(svg.source).not.toMatch(/[▸▾]/)
      expect(svg.breite).toBe(500)
      pruefePlatz(svg)
    }
  }
}
