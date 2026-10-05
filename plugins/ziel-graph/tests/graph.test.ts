import { expect, test } from 'claude-code/testing'

import { STRANG_FARBEN } from '../hooks/fest'
import type { GraphDaten, GraphWahl, GraphZeile } from '../hooks/graph/daten'
import { fasseErledigtes } from '../hooks/graph/ruhig'
import { schneide } from '../hooks/graph/streifen'
import { ALLE, sicht, zeichneSvg } from '../hooks/graph/zeichnen'
import { graphDaten } from '../hooks/graph/zeilen'

import { BEISPIEL } from './beispiel'
import { PLATZ, pruefeGraph, pruefePlatz, pruefeTeilung, wahl } from './bild'
import { GOAL, KEINE, LAUFEND, OHNE_GOAL, amWarenkorb, antwort, antwortOhneGoal, gelungen, umfeld } from './shop'

// Der Graph ohne Engine: wie aus dem einen Plan die Zeilen werden, das Aussehen „Ruhig“,
// die Pfeilspitzen und die Streifen. Die Maße hängen am Shop ohne GOAL.md; alle Testdaten
// sind erfunden.

// Der Plan des Shops ohne GOAL.md, und die Daten des Graphen dazu. Ein Chat arbeitet am Warenkorb.
const ohneGoal = (anders: Record<string, unknown> = {}, chats = amWarenkorb()) =>
  graphDaten(gelungen(antwortOhneGoal(anders), umfeld(null)).plan, chats)

const zeileMit = (daten: GraphDaten, id: string) => daten.schritte.find(one => one.id === id)

// ---------- Aus dem Plan werden die Zeilen ----------

test('aus dem Plan werden die Zeilen des Graphen: je Strang eine Bahn, je Bündel eine Zeile, darunter der Stamm', () => {
  const { plan, warnungen } = gelungen(antwortOhneGoal(), umfeld(null))
  const vorher = JSON.stringify(plan)
  const daten = graphDaten(plan, amWarenkorb())

  expect(warnungen).toEqual([])
  pruefeGraph(daten)
  // Der Plan bleibt, wie er ist: Die Karten lesen denselben.
  expect(JSON.stringify(plan)).toBe(vorher)

  expect(daten.endziel).toBe('Endziel (vermutet): der Shop im Betrieb')
  expect(daten.personen).toEqual([{ id: 'ich', name: 'Ich' }])
  expect(daten.bahnen.map(one => `${one.id}:${one.art}:${one.begonnen}`)).toEqual([
    'kat:ziel:true',
    'kas:ziel:true',
    'suc:ziel:false',
    'btr:dauer:false',
  ])
  // Die Farben kommen aus dem Plan: dieselben wie auf den Karten.
  expect(daten.bahnen.map(one => one.farbe)).toEqual(plan.straenge.map(one => one.farbe))
  expect(daten.bahnen.map(one => one.farbe)).toEqual(STRANG_FARBEN.slice(0, 4))

  // Zone für Zone, darin Bahn für Bahn; danach Treffpunkt, Stamm und Endziel.
  expect(daten.schritte.map(one => one.id)).toEqual([
    'grundstock',
    'zahlarten',
    'katalog-texte',
    'warenkorb',
    'gutscheine',
    'suchfelder',
    'ladezeit',
    'build-skripte',
    'rueckfragen',
    'rechnungen',
    'umbau',
    'lasttest',
    'lager',
    'endziel',
  ])

  // Der Chat, der gerade am Bündel arbeitet, lässt die Zeile laufen.
  expect(zeileMit(daten, 'warenkorb')).toEqual({
    id: 'warenkorb',
    art: 'laeuft',
    bahn: 'kas',
    titel: 'Entwurf Warenkorb-Regeln',
    meta: '',
    zone: 'jetzt',
    chat: 'laeuft',
    tickets: ['Chat: Warenkorb-Regeln', 'Quelle: laufende Chats'],
  })

  // Die Punkte und die Quelle stehen unter dem Bündel.
  expect(zeileMit(daten, 'katalog-texte')).toMatchObject({
    art: 'bereit',
    meta: '3 von 5 Kategorien abgenommen',
    tickets: [
      'Schuhe: Größen als Variante oder Filter',
      'Jacken: Farbgruppen',
      'Taschen: Leder oder Stoff',
      'Quelle: docs/katalog.md',
    ],
  })
  expect(zeileMit(daten, 'grundstock')?.tickets).toEqual(['Quelle: Git-Verlauf'])

  // „Wartet auf“ zeigt auf den Stamm und auf eine andere Zeile.
  expect(zeileMit(daten, 'build-skripte')).toMatchObject({
    art: 'teilweise',
    meta: '1 von 3 erledigt · Rest wartet auf den Lasttest',
    wartetAuf: 'lasttest',
  })
  expect(zeileMit(daten, 'rechnungen')).toMatchObject({
    art: 'blockiert',
    zone: 'spaeter',
    // Worauf ein Bündel wartet, steht als Text da; die Linie gibt es nur zwischen zwei Bahnen.
    meta: 'wartet auf: Entwurf Warenkorb-Regeln (vermutet)',
    wartetAuf: 'warenkorb',
  })

  // Ohne GOAL.md hat niemand den Treffpunkt bestätigt: Seine zweite Zeile sagt „vermutet“.
  expect(zeileMit(daten, 'umbau')).toEqual({
    id: 'umbau',
    art: 'treffpunkt',
    bahn: 'stamm',
    titel: 'Treffpunkt: Großer Umbau',
    meta: 'vermutet · sobald Katalog, Kasse und Suche fertig sind',
    tickets: ['Quelle: README.md'],
  })
  expect(daten.schritte.at(-1)).toEqual({
    id: 'endziel',
    art: 'endziel',
    bahn: 'stamm',
    titel: 'Endziel (vermutet): der Shop im Betrieb',
    meta: '',
  })

  // Die Übersicht zählt je Bahn ihre Bündel zusammen; darunter steht derselbe Stamm.
  expect(daten.uebersicht).toEqual([
    { id: 'ziel-kat', art: 'bereit', bahn: 'kat', titel: 'Katalog', meta: '2 offen · 1 jetzt möglich' },
    { id: 'ziel-kas', art: 'laeuft', bahn: 'kas', titel: 'Kasse', meta: '3 offen · 2 jetzt möglich · 1 Chat' },
    { id: 'ziel-suc', art: 'bereit', bahn: 'suc', titel: 'Suche', meta: '1 offen · 1 jetzt möglich' },
    { id: 'ziel-btr', art: 'bereit', bahn: 'btr', titel: 'Betrieb · Dauerläufer', meta: '2 offen · 2 jetzt möglich' },
    { id: 'umbau', art: 'treffpunkt', bahn: 'stamm', titel: 'Treffpunkt: Großer Umbau', meta: 'vermutet · sobald Katalog, Kasse und Suche fertig sind' },
    { id: 'lasttest', art: 'stamm', bahn: 'stamm', titel: 'Lasttest', meta: '' },
    { id: 'lager', art: 'stamm', bahn: 'stamm', titel: 'Lageranbindung', meta: 'noch nicht ausgearbeitet' },
    { id: 'endziel', art: 'endziel', bahn: 'stamm', titel: 'Endziel (vermutet): der Shop im Betrieb', meta: '' },
  ])

  // Die Kopfzeile des Graphen zählt richtig.
  expect(sicht(daten, wahl('schritte', [])).zaehler).toBe('6 Bündel jetzt möglich · 1 laufen · 0 warten auf dich')
})

test('ein laufender Chat markiert seine Zeile: Ob er noch läuft und ob er wartet, sagen die Chats von jetzt', () => {
  const { plan } = gelungen(antwortOhneGoal(), umfeld(null))

  // Zugeordnet hat ihn das Modell beim Ableiten. Läuft er nicht mehr, ist die Zeile nur bereit.
  const ruht = graphDaten(plan, KEINE)

  pruefeGraph(ruht)
  expect(zeileMit(ruht, 'warenkorb')).toEqual({
    id: 'warenkorb',
    art: 'bereit',
    bahn: 'kas',
    titel: 'Entwurf Warenkorb-Regeln',
    meta: '',
    zone: 'jetzt',
    tickets: ['Quelle: laufende Chats'],
  })
  expect(sicht(ruht, wahl('schritte', [])).zaehler).toBe('6 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
  expect(ruht.uebersicht[1]).toMatchObject({ art: 'bereit', meta: '3 offen · 2 jetzt möglich' })

  // Wartet er mit einer Frage, trägt die Zeile die Marke mit dem auffälligen Punkt.
  const wartet = graphDaten(plan, amWarenkorb('Auch für den Versand?'))

  pruefeGraph(wartet)
  expect(zeileMit(wartet, 'warenkorb')).toMatchObject({
    art: 'laeuft',
    chat: 'wartet',
    tickets: ['Chat: Warenkorb-Regeln · wartet auf dich', 'Quelle: laufende Chats'],
  })
  expect(sicht(wartet, wahl('schritte', [])).zaehler).toBe('6 Bündel jetzt möglich · 1 laufen · 1 warten auf dich')

  // Ein Chat, der an keinem Bündel hängt, markiert nichts; einer ohne Namen heißt „Neuer Chat“.
  const fremd = graphDaten(plan, {
    ich: 'sitzung-1',
    gelesen: 1,
    chats: [
      { id: 'sitzung-4', name: 'Bilder zuschneiden', aktiv: true, branch: '', stand: '', naechster: '', frage: 'Welche Größe?', zeit: 1 },
      { id: 'sitzung-7', name: '', aktiv: true, branch: '', stand: '', naechster: '', frage: '', zeit: 1 },
    ],
  })

  expect(fremd.schritte.filter(one => one.chat !== undefined).map(one => one.id)).toEqual(['warenkorb'])
  expect(zeileMit(fremd, 'warenkorb')?.tickets).toEqual(['Chat: Neuer Chat', 'Quelle: laufende Chats'])
})

test('mit GOAL.md: Die Zwischenziele stehen auf dem Stamm, und die Bahnen der Ziele münden ins erste offene', () => {
  const { plan } = gelungen(antwort())
  const daten = graphDaten(plan, LAUFEND)

  pruefeGraph(daten)
  pruefeGraph(fasseErledigtes(daten))
  expect(daten.endziel).toBe('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
  expect(daten.bahnen.map(one => `${one.id}:${one.name}:${one.art}`)).toEqual([
    'katalog:Katalog:ziel',
    'kasse:Kasse:ziel',
    'suche:Suche:ziel',
    'betrieb:Betrieb:dauer',
  ])
  expect(daten.schritte.filter(one => one.bahn === 'stamm')).toEqual([
    // In GOAL.md abgehakt: Es liegt hinter uns und trägt den gefüllten Punkt.
    { id: 'grundstock-steht', art: 'erledigt', bahn: 'stamm', titel: 'Grundstock steht', meta: 'erreicht', tickets: ['Quelle: GOAL.md'] },
    // Das erste offene Zwischenziel ist der Treffpunkt; welche Stränge laut GOAL.md dazugehören, steht darunter.
    {
      id: 'grosser-umbau',
      art: 'treffpunkt',
      bahn: 'stamm',
      titel: 'Großer Umbau',
      meta: 'sobald Katalog und Kasse fertig sind',
      tickets: ['Stränge: Katalog, Kasse', 'Quelle: GOAL.md'],
    },
    { id: 'lasttest-bestanden', art: 'stamm', bahn: 'stamm', titel: 'Lasttest bestanden', meta: '', tickets: ['Quelle: GOAL.md'] },
    { id: 'endziel', art: 'endziel', bahn: 'stamm', titel: 'Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.', meta: '' },
  ])
  // Der wartende Chat am Warenkorb, und ein Bündel, das auf ein Zwischenziel wartet.
  expect(zeileMit(daten, 'warenkorb')).toMatchObject({ art: 'laeuft', chat: 'wartet' })
  expect(zeileMit(daten, 'build-skripte')).toMatchObject({ art: 'teilweise', wartetAuf: 'lasttest-bestanden' })
  expect(sicht(daten, wahl('schritte', [])).zaehler).toBe('6 Bündel jetzt möglich · 1 laufen · 1 warten auf dich')

  // „Ruhig“ fasst je Bahn zusammen, was hinter uns liegt; das erreichte Zwischenziel bleibt auf dem Stamm.
  const ruhig = fasseErledigtes(daten)

  expect(ruhig.schritte.slice(0, 2).map(one => `${one.id}|${one.titel}`)).toEqual([
    'erledigt-katalog|Katalog: 2 erledigt',
    'erledigt-kasse|Kasse: 1 erledigt',
  ])
  expect(ruhig.schritte.filter(one => one.bahn === 'stamm')).toEqual(daten.schritte.filter(one => one.bahn === 'stamm'))

  // Nennt das Modell einen Strang aus GOAL.md einen Dauerläufer, rückt seine Bahn hinter die
  // Ziele: So sitzt der Stamm in der Mitte der Ziele. Seine Farbe behält er.
  const gemischt = gelungen(antwort({ bahnen: [{ id: 'katalog', art: 'ziel' }, { id: 'kasse', art: 'dauer' }, { id: 'suche', art: 'ziel' }, { id: 'betrieb', art: 'ziel' }] }))
  const umgestellt = graphDaten(gemischt.plan, KEINE)

  pruefeGraph(umgestellt)
  expect(gemischt.plan.straenge.map(one => one.id)).toEqual(['katalog', 'kasse', 'suche', 'betrieb'])
  expect(umgestellt.bahnen.map(one => one.id)).toEqual(['katalog', 'suche', 'betrieb', 'kasse'])
  expect(umgestellt.bahnen.map(one => one.farbe)).toEqual([STRANG_FARBEN[0], STRANG_FARBEN[2], STRANG_FARBEN[3], STRANG_FARBEN[1]])
  expect(umgestellt.schritte.filter(one => one.zone === 'jetzt').map(one => one.bahn)).toEqual([
    'katalog',
    'suche',
    'betrieb',
    'betrieb',
    'kasse',
    'kasse',
  ])
})

test('ohne Treffpunkt und ohne offenes Zwischenziel münden die Bahnen der Ziele ins Endziel', () => {
  // Der Bogen, mit dem eine Bahn in den Stamm mündet: von ihrer Spalte in die des Stamms.
  const bogen = (daten: GraphDaten, x: number, xStamm: number, y: number): boolean =>
    zeichneSvg(daten, sicht(daten, wahl('schritte', [])), 'hell').source.includes(
      ` C${x} ${y - 5} ${xStamm} ${y - 14} ${xStamm} ${y}"`,
    )
  const mitte = (daten: GraphDaten, id: string): number =>
    (zeichneSvg(daten, sicht(daten, wahl('schritte', [])), 'hell').zeilen.find(one => one.id === id)?.oben ?? Number.NaN) + 16
  // Der Pfeil am Ende einer Bahn ohne Ende, nicht die Spitzen einer „wartet auf“-Linie.
  const pfeile = (daten: GraphDaten): number =>
    zeichneSvg(daten, sicht(daten, wahl('schritte', [])), 'hell').source.split(
      /<path d="M[\d.]+ \d+ L[\d.]+ \d+ L[\d.]+ \d+ Z"(?! stroke-linejoin)/,
    ).length - 1

  // Mit Treffpunkt: Katalog (18 px) und Suche (70 px) münden 12 px über ihm in den Stamm,
  // der auf der mittleren Ziel-Bahn sitzt (Kasse, 44 px). Nur der Dauerläufer endet im Pfeil.
  const mit = ohneGoal()

  expect(bogen(mit, 18, 44, mitte(mit, 'umbau') - 12)).toBe(true)
  expect(bogen(mit, 70, 44, mitte(mit, 'umbau') - 12)).toBe(true)
  expect(pfeile(mit)).toBe(1)

  // Alle Zwischenziele aus GOAL.md sind abgehakt: Es gibt keinen Treffpunkt mehr.
  const { plan } = gelungen(antwort(), umfeld(GOAL.replace('- Großer Umbau', '- [x] Großer Umbau').replace('- Lasttest bestanden', '- [x] Lasttest bestanden')))
  const daten = graphDaten(plan, KEINE)

  pruefeGraph(daten)
  expect(daten.schritte.filter(one => one.bahn === 'stamm').map(one => `${one.id}:${one.art}:${one.meta}`)).toEqual([
    'grundstock-steht:erledigt:erreicht',
    'grosser-umbau:erledigt:erreicht · sobald Katalog und Kasse fertig sind',
    'lasttest-bestanden:erledigt:erreicht',
    'endziel:endziel:',
  ])
  // Die Bahnen der Ziele enden nicht im Pfeil wie ein Dauerläufer: Sie münden 13 px über dem Endziel.
  expect(bogen(daten, 18, 44, mitte(daten, 'endziel') - 13)).toBe(true)
  expect(bogen(daten, 70, 44, mitte(daten, 'endziel') - 13)).toBe(true)
  expect(pfeile(daten)).toBe(1)

  // Ganz ohne Stamm ebenso; und ohne ein einziges Ziel enden alle Bahnen im Pfeil.
  const kein = ohneGoal({ stamm: [] })

  pruefeGraph(kein)
  expect(kein.schritte.filter(one => one.bahn === 'stamm').map(one => one.art)).toEqual(['endziel'])
  expect(bogen(kein, 18, 44, mitte(kein, 'endziel') - 13)).toBe(true)
  expect(pfeile(kein)).toBe(1)

  const nurDauer = ohneGoal({ bahnen: OHNE_GOAL.bahnen.map(one => ({ ...one, art: 'dauer' })) })

  pruefeGraph(nurDauer)
  expect(pfeile(nurDauer)).toBe(4)
})

test('die zweite Zeile sagt „vermutet“, wenn das Modell etwas nur schließt; die Quelle steht darunter', () => {
  const zeilen = [
    { id: 'a', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Genau genannt', quelle: 'docs/plan/suche.md' },
    { id: 'd', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Erfundene Datei', meta: '2 von 5 erledigt', quelle: 'docs/geheim.md' },
    { id: 'e', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Ohne Quelle' },
    { id: 'f', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Vermutet ohne Wort', meta: 'braucht wohl die Suche', quelle: 'README.md', vermutet: true },
    { id: 'g', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Vermutet mit Wort', meta: 'Vermutet: braucht die Suche', quelle: 'README.md', vermutet: 'true' },
    { id: 'h', bahn: 'kat', zone: 'spaeter', stand: 'blockiert', titel: 'Wartet sicher', meta: 'braucht die Texte', wartetAuf: 'a', quelle: 'chats' },
    { id: 'i', bahn: 'kat', zone: 'jetzt', stand: 'teilweise', titel: 'Wartet zum Teil', meta: '1 von 2 erledigt', wartetAuf: 'a', quelle: 'commits' },
    { id: 'j', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Wartet ohne eigene Zeile', wartetAuf: 'a', quelle: 'README.md' },
  ]
  const daten = ohneGoal({ zeilen, chats: [] }, KEINE)

  pruefeGraph(daten)
  expect(daten.schritte.slice(0, 8).map(one => `${one.id}: ${one.meta} | ${(one.tickets ?? []).join(', ')}`)).toEqual([
    'a:  | Quelle: docs/plan/suche.md',
    'd: vermutet · 2 von 5 erledigt | ',
    'e: vermutet | ',
    'f: vermutet · braucht wohl die Suche | Quelle: README.md',
    'g: Vermutet: braucht die Suche | Quelle: README.md',
    // Ein Bündel, das zum Teil möglich ist, behält seinen Fortschritt; sonst steht da, worauf es wartet.
    'i: 1 von 2 erledigt | Quelle: Git-Verlauf',
    'j: wartet auf: Genau genannt | Quelle: README.md',
    'h: wartet auf: Genau genannt | Quelle: laufende Chats',
  ])
})

test('zu viel und zu lang: Auch mit allem aufgeklappt bleibt das Bild unter der Grenze der Engine', () => {
  const lang = 'Sehr langer Text über die Kasse und den Katalog. '.repeat(20)
  const zeilen = Array.from({ length: 55 }, (_, n) => ({
    id: `z${n}`,
    bahn: OHNE_GOAL.bahnen[n % 4]?.id,
    zone: ['hinter', 'jetzt', 'spaeter'][n % 3],
    stand: ['erledigt', 'bereit', 'blockiert'][n % 3],
    titel: n === 0 ? 'Mit\nUmbruch\tund\u0000Steuerzeichen <b>&"quot"</b>' : `${n}: ${lang}`,
    meta: lang,
    punkte: Array.from({ length: 12 }, (_unused, p) => `Punkt ${p}: ${lang}`),
    quelle: 'README.md',
  }))
  const daten = ohneGoal({ zeilen, chats: [], endziel: lang }, KEINE)
  const inBahnen = daten.schritte.filter(one => one.bahn !== 'stamm')

  // Die Deckel des Plans halten das Bild unter der Grenze, auch mit allem aufgeklappt.
  pruefeGraph(daten)
  pruefeGraph(fasseErledigtes(daten))
  expect(inBahnen).toHaveLength(40)
  expect(inBahnen.every(one => (one.tickets ?? []).length <= 9)).toBe(true)
  expect(daten.endziel.length <= 'Endziel (vermutet): '.length + 80).toBe(true)

  // Nichts bricht das SVG: Was Markup sein könnte, steht als Text da.
  const zu = zeichneSvg(daten, sicht(daten, wahl('schritte', [])), 'auto')

  expect(zu.source).toContain('Mit Umbruch und Steuerzeichen &lt;b&gt;&amp;&quot;quot&quot;&lt;/b&gt;')
})

// ---------- Das Bild: „Ruhig“ ----------

test('Bild: 500 px breit, Bahnen im Abstand von 26 px, Zeilen von 46 px, größere Schrift und Knoten', () => {
  const daten = ohneGoal()
  const bild = sicht(daten, wahl('schritte', ['katalog-texte']))
  const svg = zeichneSvg(daten, bild, 'auto')
  const oben = new Map(svg.zeilen.map(one => [one.id, one.oben]))

  expect(svg.breite).toBe(500)
  expect(svg.source.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 ${svg.hoehe}" width="500" height="${svg.hoehe}" `)).toBe(true)

  // Die Legende ist 34 px hoch, eine Zonen-Überschrift 32, eine Zeile 46.
  expect(oben.get('grundstock')).toBe(34 + 32)
  expect(oben.get('zahlarten')).toBe(34 + 32 + 46)
  expect(oben.get('katalog-texte')).toBe(34 + 32 + 46 + 46 + 32)
  // Eine Unterzeile ist 21 px hoch; vor und nach dem Block stehen je 6 px Luft.
  expect(oben.get('warenkorb')).toBe(190 + 46 + 6 + 4 * 21 + 6)
  expect((oben.get('gutscheine') ?? 0) - (oben.get('warenkorb') ?? 0)).toBe(46)
  // Vor dem Treffpunkt stehen 18 px Luft, unter der letzten Zeile 19 px bis zum Rand.
  expect((oben.get('umbau') ?? 0) - (oben.get('rechnungen') ?? 0)).toBe(46 + 18)
  expect(svg.hoehe - (oben.get('endziel') ?? 0)).toBe(46 + 19)
  expect(svg.hoehe).toBe(34 + 3 * 32 + 14 * 46 + (6 + 4 * 21 + 6) + 18 + 19)

  // Die erste Bahn steht bei 18 px, jede weitere 26 px daneben; der Titel beginnt 24 px
  // nach der letzten Bahn, ohne Platz für ein Klapp-Zeichen.
  expect(svg.source).toContain('<circle cx="18" cy="82" r="5.5"')
  expect(svg.source).toContain('<circle cx="44" cy="128" r="5.5"')
  expect(svg.source).toContain('<circle cx="18" cy="206" r="8" stroke-width="3"')
  expect(svg.source).toContain('<circle cx="70" cy="')
  expect(svg.source).toContain('<circle cx="96" cy="')
  expect(svg.source).toContain(
    '<text x="120" y="205" font-size="15" font-weight="600" fill="#16242b" class="f-schrift">Katalog-Texte abnehmen</text>',
  )
  expect(svg.source).toContain(
    '<text x="120" y="223" font-size="12.5" font-weight="400" fill="#5a6d76" class="f-leise">3 von 5 Kategorien abgenommen</text>',
  )
  expect(svg.source).toContain(
    '<text x="134" y="247" font-size="12.5" font-weight="400" fill="#5a6d76" class="f-leise">Schuhe: Größen als Variante oder Filter</text>',
  )
  expect(svg.source).toContain('<text x="120" y="55" font-size="12" font-weight="700"')
  expect(svg.source).toContain('>HINTER UNS</text>')
  expect(svg.source).toContain('<text x="29" y="22" font-size="13" font-weight="500"')
  // Kein Klapp-Zeichen im Bild: Den Pfeil zeigt der Knopf, oder im Terminal die Liste.
  expect(svg.source).not.toMatch(/[▸▾]/)
  expect(svg.source).not.toContain('<tspan')

  // Die Knoten sind etwa ein Fünftel größer: blockiert, Treffpunkt, Stamm, Endziel.
  expect(svg.source).toContain('r="4.5" stroke-width="2" opacity="0.75"')
  expect(svg.source).toContain('r="10.5" stroke-width="3"')
  expect(svg.source).toContain('r="11.5" stroke-width="3"')
  expect(svg.source).not.toMatch(/ r="(6\.5|9\.5|3)"/)

  // Hell und Dunkel legen die Farben fest, „Auto“ folgt dem Farbschema.
  expect(svg.source).toContain('prefers-color-scheme: dark')
  expect(zeichneSvg(daten, bild, 'hell').source).not.toContain('prefers-color-scheme')
  expect(zeichneSvg(daten, bild, 'hell').source).toContain('fill="#ffffff"')
  expect(zeichneSvg(daten, bild, 'dunkel').source).toContain('fill="#18242a"')

  // Mit jeder Bahn rückt der Text um 26 px nach rechts.
  const mitBahnen = (anzahl: number): string => {
    const bahnen = daten.bahnen.slice(0, anzahl)

    return zeichneSvg({ ...daten, bahnen }, sicht({ ...daten, bahnen }, wahl('schritte', [])), 'auto').source
  }

  expect(mitBahnen(3)).toContain('<text x="94" y="55" font-size="12" ')
  expect(mitBahnen(2)).toContain('<text x="68" y="55" font-size="12" ')
})

test('Bild: Rechts bleibt in jeder Zeile ein Platz frei; Titel, Beschreibung, Unterzeilen und die Chat-Marke enden davor', () => {
  const lang = 'Ein sehr langer Text, der gewiss nicht in eine Zeile des Bildes passt, wie breit es auch ist'
  const zeilen = OHNE_GOAL.zeilen.map(one =>
    one.id === 'warenkorb' || one.id === 'katalog-texte'
      ? { ...one, titel: `${one.titel}: ${lang}`, meta: lang, punkte: [lang, lang] }
      : one,
  )
  const daten = ohneGoal({ zeilen })
  const bild = sicht(daten, wahl('schritte', ['katalog-texte', 'warenkorb']))
  const svg = zeichneSvg(daten, bild, 'auto')
  const texte = [...svg.source.matchAll(/<text x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map(
    ([, x, groesse, inhalt = '']) => ({ x: Number(x), groesse: Number(groesse), inhalt }),
  )
  const gekuerzt = texte.filter(one => one.inhalt.endsWith('…'))

  // Der Platz ist leer, und die langen Texte reichen bis kurz davor.
  expect(pruefePlatz(svg)).toBe(PLATZ.links)
  // Zwei Titel, ihre Beschreibungen und je zwei Unterzeilen sind gekürzt, dazu die
  // Beschreibung der Zeile, die auf das Bündel mit dem langen Titel wartet, und die des
  // Treffpunkts, vor der „vermutet“ steht.
  expect(gekuerzt.map(one => one.groesse)).toEqual([15, 12.5, 12.5, 12.5, 15, 12.5, 12.5, 12.5, 12.5, 12.5])
  expect(gekuerzt.map(one => one.inhalt.length)).toEqual([40, 52, 50, 50, 32, 52, 50, 50, 52, 52])

  const [ohneChat, , , , mitChat] = gekuerzt

  expect(ohneChat?.inhalt.startsWith('Katalog-Texte abnehmen: Ein sehr langer')).toBe(true)
  expect(mitChat?.inhalt.startsWith('Entwurf Warenkorb-Regeln: Ein')).toBe(true)
  expect(gekuerzt.at(-1)?.inhalt).toBe('vermutet · sobald Katalog, Kasse und Suche fertig s…')
  // Ein Titel endet vor dem freien Platz; mit einer Chat-Marke endet er schon vor ihr.
  expect(120 + (ohneChat?.inhalt.length ?? 0) * 15 * 0.56 <= PLATZ.links).toBe(true)
  expect((ohneChat?.inhalt.length ?? 0) - (mitChat?.inhalt.length ?? 0)).toBe(8)
  expect(120 + (mitChat?.inhalt.length ?? 0) * 15 * 0.56 <= 412 - 19).toBe(true)
  // Die Chat-Marke steht links vom freien Platz: von 412 bis 462 px. Ihre Zeile beginnt
  // unter dem offenen Bündel darüber, bei 190 + 46 + 6 + 3 × 21 + 6 = 311 px.
  expect(svg.zeilen.find(one => one.id === 'warenkorb')?.oben).toBe(311)
  expect(svg.source).toContain('<rect x="412" y="311.5" width="50" height="20" rx="10"')
  expect(svg.source).toContain('<text x="437" y="326" font-size="12.5" font-weight="600"')

  // Wartet der Chat auf den Nutzer, steht sein Punkt links von der Marke.
  const wartend = ohneGoal({ zeilen }, amWarenkorb('Auch für den Versand?'))
  const wartendSvg = zeichneSvg(wartend, sicht(wartend, wahl('schritte', [])), 'auto')

  expect(wartendSvg.source).toContain('<rect x="412" y="236.5" width="50" height="20" rx="10"')
  expect(wartendSvg.source).toContain('<circle cx="401" cy="246.5" r="5.5"')
  expect(pruefePlatz(wartendSvg)).toBe(PLATZ.links)

  // Auch mit sieben Bahnen und einer Legende über drei Zeilen bleibt der Platz frei.
  const [erste] = daten.bahnen
  const viele: GraphDaten = {
    ...daten,
    bahnen: [
      ...daten.bahnen.slice(0, 3),
      ...['Logistik und Versand', 'Kundenkonto und Anmeldung', 'Rechnungen und Mahnwesen'].map((name, n) =>
        erste === undefined ? [] : [{ ...erste, id: `mehr${n}`, name }],
      ).flat(),
      ...daten.bahnen.slice(3),
    ],
  }
  const vieleSvg = zeichneSvg(viele, sicht(viele, wahl('schritte', ['katalog-texte'])), 'auto')

  expect(pruefePlatz(vieleSvg)).toBe(PLATZ.links)
  // Jede weitere Zeile der Legende schiebt alles um 19 px nach unten; die Legende selbst
  // darf bis an den Rand reichen.
  expect(vieleSvg.source.split('font-size="13"').length - 1).toBe(7)
  expect(vieleSvg.source).toContain('<text x="29" y="60" font-size="13" font-weight="500"')
  expect(vieleSvg.zeilen[0]?.oben).toBe(34 + 2 * 19 + 32)
  expect(vieleSvg.source).toContain('<text x="198" y="93" font-size="12" ')
})

// ---------- „Ruhig“: Was hinter uns liegt, je Bahn in einer Zeile ----------

test('Ruhig: „Hinter uns“ zeigt je Bahn eine Zeile mit der Zahl der erledigten Bündel und ihren Titeln', () => {
  const voll = ohneGoal({
    zeilen: [
      ...OHNE_GOAL.zeilen,
      { id: 'fotos', bahn: 'kat', zone: 'hinter', stand: 'erledigt', titel: 'Fotos der ersten Kollektion', quelle: 'commits' },
      { id: 'filter', bahn: 'kat', zone: 'hinter', stand: 'erledigt', titel: 'Filter nach Größe und Farbe', quelle: 'commits' },
    ],
  })
  const vorher = JSON.stringify(voll)
  const daten = fasseErledigtes(voll)

  // Die vollen Daten bleiben, wie sie sind.
  expect(JSON.stringify(voll)).toBe(vorher)
  expect(voll.schritte.filter(one => one.zone === 'hinter').map(one => one.id)).toEqual([
    'grundstock',
    'fotos',
    'filter',
    'zahlarten',
  ])

  // Je Bahn mit Erledigtem eine Zeile, in der Reihenfolge der Bahnen; Suche und Betrieb haben keine.
  expect(daten.schritte.filter(one => one.zone === 'hinter')).toEqual([
    {
      id: 'erledigt-kat',
      art: 'erledigt',
      bahn: 'kat',
      zone: 'hinter',
      titel: 'Katalog: 3 erledigt',
      meta: 'Grundstock: 13 Produktseiten fertig · Fotos der ersten Kollektion · Filter nach Größe und Farbe',
      tickets: ['Grundstock: 13 Produktseiten fertig', 'Fotos der ersten Kollektion', 'Filter nach Größe und Farbe'],
    },
    {
      id: 'erledigt-kas',
      art: 'erledigt',
      bahn: 'kas',
      zone: 'hinter',
      titel: 'Kasse: 1 erledigt',
      meta: 'Zahlarten geklärt und 5 Entwürfe',
      tickets: ['Zahlarten geklärt und 5 Entwürfe'],
    },
  ])
  // Alles andere bleibt: die offenen Bündel, der Stamm, die Übersicht, die Bahnen.
  expect(daten.schritte.slice(2)).toEqual(voll.schritte.filter(one => one.zone !== 'hinter'))
  expect({ ...daten, schritte: [] }).toEqual({ ...voll, schritte: [] })
  pruefeGraph(daten)

  // Die Zeile über dem Graphen zählt wie vorher.
  expect(sicht(daten, wahl('schritte', [])).zaehler).toBe(sicht(voll, wahl('schritte', [])).zaehler)
  expect(sicht(daten, wahl('schritte', [])).zaehler).toBe('6 Bündel jetzt möglich · 1 laufen · 0 warten auf dich')

  // Im Bild: der erledigte Knoten auf der Bahn, der Titel, und die Titel der Bündel als
  // Beschreibung, gekürzt vor dem freien Platz.
  const zu = sicht(daten, wahl('schritte', []))
  const zuSvg = zeichneSvg(daten, zu, 'auto')

  expect(zu.eintraege.slice(0, 4).map(one => (one.typ === 'zeile' ? one.zeile.id : one.typ))).toEqual([
    'zone',
    'erledigt-kat',
    'erledigt-kas',
    'zone',
  ])
  expect(zu.aufklappbar.slice(0, 2)).toEqual([
    { id: 'erledigt-kat', titel: 'Katalog: 3 erledigt', anzahl: 3, offen: false },
    { id: 'erledigt-kas', titel: 'Kasse: 1 erledigt', anzahl: 1, offen: false },
  ])
  expect(zuSvg.source).toContain('<circle cx="18" cy="82" r="5.5"')
  expect(zuSvg.source).toContain('<circle cx="44" cy="128" r="5.5"')
  expect(zuSvg.source).toContain('>Katalog: 3 erledigt</text>')
  expect(zuSvg.source).toContain('>Grundstock: 13 Produktseiten fertig · Fotos der ers…</text>')
  expect(zuSvg.source).toContain('>Kasse: 1 erledigt</text>')
  expect(zuSvg.source).not.toContain('>Fotos der ersten Kollektion</text>')
  expect(zuSvg.zeilen.slice(0, 3)).toEqual([
    { id: 'erledigt-kat', oben: 66 },
    { id: 'erledigt-kas', oben: 112 },
    { id: 'katalog-texte', oben: 190 },
  ])
  pruefePlatz(zuSvg)

  // Aufgeklappt stehen die erledigten Bündel einzeln da, je eines in einer Unterzeile.
  const auf = sicht(daten, wahl('schritte', ['erledigt-kat']))
  const aufSvg = zeichneSvg(daten, auf, 'auto')

  expect(auf.eintraege.slice(1, 6)).toMatchObject([
    { typ: 'zeile', offen: true },
    { typ: 'ticket', text: 'Grundstock: 13 Produktseiten fertig' },
    { typ: 'ticket', text: 'Fotos der ersten Kollektion' },
    { typ: 'ticket', text: 'Filter nach Größe und Farbe' },
    { typ: 'zeile', offen: false },
  ])
  expect(aufSvg.source).toContain('>Fotos der ersten Kollektion</text>')
  expect(aufSvg.zeilen[1]).toEqual({ id: 'erledigt-kas', oben: 112 + 6 + 3 * 21 + 6 })

  // Ohne Erledigtes ändert sich nichts.
  const offen = ohneGoal({ zeilen: OHNE_GOAL.zeilen.filter(one => one.zone !== 'hinter') })

  expect(fasseErledigtes(offen)).toBe(offen)

  // Die Kennung einer Sammel-Zeile gehört keiner anderen Zeile; wer auf ein erledigtes
  // Bündel zeigte, zeigt auf keine Zeile mehr.
  const eng: GraphDaten = {
    ...voll,
    schritte: voll.schritte.map(one =>
      one.id === 'katalog-texte'
        ? { ...one, id: 'erledigt-kat', wartetAuf: 'grundstock' }
        : one.id === 'rechnungen'
          ? { ...one, wartetAuf: 'warenkorb' }
          : one,
    ),
  }
  const engRuhig = fasseErledigtes(eng)

  expect(engRuhig.schritte.slice(0, 3).map(one => one.id)).toEqual(['erledigt-kat-x', 'erledigt-kas', 'erledigt-kat'])
  expect(engRuhig.schritte[2]).not.toHaveProperty('wartetAuf')
  expect(engRuhig.schritte.find(one => one.id === 'rechnungen')?.wartetAuf).toBe('warenkorb')
})

// ---------- „Wartet auf“ ----------

test('„wartet auf“ zwischen zwei Bahnen trägt zwei Pfeilspitzen: vom Schritt davor zum wartenden Bündel', () => {
  const daten = ohneGoal()
  const pfeile = (schritte: GraphDaten['schritte']): number[][] => {
    const mit = { ...daten, schritte }

    return [...zeichneSvg(mit, sicht(mit, wahl('schritte', [])), 'hell').source.matchAll(/<path d="(M[^"]+ Z)" stroke-linejoin="round"/g)].map(
      one => (one[1]?.match(/-?\d+(\.\d+)?/g) ?? []).map(Number),
    )
  }
  const ohne = daten.schritte.map(({ wartetAuf: _, ...rest }) => rest)
  const nur = (id: string, ziel: string) => ohne.map(one => (one.id === id ? { ...one, wartetAuf: ziel } : one))
  const von = (id: string) => daten.schritte.find(one => one.id === id)

  // Ohne „wartet auf“ und in derselben Bahn: keine Linie, also auch keine Spitze.
  expect(pfeile(ohne)).toHaveLength(0)
  expect(von('rechnungen')?.bahn).toBe(von('warenkorb')?.bahn)
  expect(pfeile(nur('rechnungen', 'warenkorb'))).toHaveLength(0)

  // In eine andere Bahn, weiter oben: Die Spitze vor dem wartenden Bündel zeigt nach unten
  // auf es, die auf dem Bogen liegt zwischen den beiden Bahnen.
  expect(von('rechnungen')?.bahn).not.toBe(von('katalog-texte')?.bahn)

  const [bogen, ankunft] = pfeile(nur('rechnungen', 'katalog-texte'))

  expect(pfeile(nur('rechnungen', 'katalog-texte'))).toHaveLength(2)
  // Jede Spitze: drei Punkte, der erste ist die Spitze selbst.
  expect(bogen).toHaveLength(6)
  expect(ankunft).toHaveLength(6)
  // Die Ankunft liegt über dem wartenden Bündel und zeigt nach unten: Die Spitze ist der tiefste Punkt.
  expect((ankunft?.[1] ?? 0) > (ankunft?.[3] ?? 0) && (ankunft?.[1] ?? 0) > (ankunft?.[5] ?? 0)).toBe(true)
  // Der Bogen liegt höher als die Ankunft: zwischen dem Schritt davor und dem wartenden Bündel.
  expect((bogen?.[1] ?? 0) < (ankunft?.[1] ?? 0)).toBe(true)

  // Im Plan des Shops wartet der Umbau der Build-Skripte auf den Lasttest auf dem Stamm: eine
  // Linie, zwei Spitzen. Der Block Rechnungen wartet in der eigenen Bahn: keine.
  expect(pfeile(daten.schritte)).toHaveLength(2)
})

test('„wartet auf“ ist nur zwischen zwei Bahnen eine Linie, auch zu einem Ziel weiter oben', () => {
  const alles: GraphWahl = { ...wahl('schritte', []), farben: 'hell' }
  const linien = (daten: GraphDaten): string[] =>
    [
      ...zeichneSvg(daten, sicht(daten, alles), 'hell').source.matchAll(
        /<path d="([^"]+)"[^>]*stroke-dasharray="6 5"/g,
      ),
    ].map(one => one[1] ?? '')
  const ohneWarten = ({ wartetAuf: _, ...rest }: GraphZeile): GraphZeile => rest
  // Nur die genannte Zeile wartet, und zwar auf das genannte Ziel.
  const nur = (id: string, ziel: string): GraphDaten => ({
    ...BEISPIEL,
    schritte: BEISPIEL.schritte.map(one => (one.id === id ? { ...one, wartetAuf: ziel } : ohneWarten(one))),
  })
  const zahlen = (weg: string): number[] => (weg.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

  // Die Testdaten: Die Build-Skripte (Werkzeug) warten auf den Lasttest auf dem Stamm, weiter unten.
  const [nachUnten] = linien(BEISPIEL)

  expect(linien(BEISPIEL)).toHaveLength(1)
  expect(zahlen(nachUnten ?? '').at(-1)).toBeGreaterThan(zahlen(nachUnten ?? '')[1] ?? 0)

  // In derselben Bahn sagt es die Reihenfolge: keine Linie, ob das Ziel oben oder unten liegt.
  expect(linien(nur('kasse-rechnungen', 'warenkorb'))).toHaveLength(0)
  expect(linien(nur('warenkorb', 'kasse-rechnungen'))).toHaveLength(0)

  // In einer anderen Bahn und weiter oben: eine Linie, die nach oben läuft.
  const [nachOben] = linien(nur('kasse-rechnungen', 'katalog-texte'))

  expect(linien(nur('kasse-rechnungen', 'katalog-texte'))).toHaveLength(1)
  expect(nachOben).not.toContain('NaN')
  expect(zahlen(nachOben ?? '').at(-1)).toBeLessThan(zahlen(nachOben ?? '')[1] ?? 0)
})

// ---------- Die Streifen ----------

test('Streifen: geschnitten wird an der Oberkante jeder Zeile; was unter ihr steht, gehört zu ihrem Streifen', () => {
  const daten = ohneGoal()
  const bild = sicht(daten, wahl('schritte', ['katalog-texte']))
  const svg = zeichneSvg(daten, bild, 'auto')
  const streifen = schneide(svg, bild)
  const nach = new Map(streifen.map(one => [one.zeile, one]))

  pruefeTeilung(svg, streifen)
  expect(streifen.map(one => one.zeile)).toEqual([null, ...daten.schritte.map(one => one.id)])
  // Jeder Streifen trägt das ganze Bild: Er ist so groß wie das Bild, bis auf die Ziffern
  // seines Ausschnitts und den Beschnitt darauf (gut hundert Zeichen).
  expect(streifen.every(one => one.source.length - svg.source.length > 90 && one.source.length - svg.source.length < 140)).toBe(true)

  // Der Kopf: die Legende und die erste Zonen-Überschrift. Er beschreibt den ganzen Graphen.
  expect(streifen[0]).toMatchObject({ zeile: null, oben: 0, hoehe: 34 + 32, aufklappbar: false, offen: false, alt: svg.alt })
  // Eine Zeile ist 46 px hoch; jeder weitere Streifen beschreibt seine Zeile.
  expect(nach.get('grundstock')).toMatchObject({
    oben: 66,
    hoehe: 46,
    breite: 500,
    aufklappbar: true,
    offen: false,
    alt: 'Grundstock: 13 Produktseiten fertig',
  })
  expect(nach.get('warenkorb')?.alt).toBe('Entwurf Warenkorb-Regeln [Chat]')
  // Die Zonen-Überschrift unter einer Zeile gehört zu deren Streifen.
  expect(nach.get('zahlarten')).toMatchObject({ oben: 112, hoehe: 46 + 32 })
  // Ein offenes Bündel: seine vier Unterzeilen stehen in seinem Streifen, mit Luft davor und danach.
  expect(nach.get('katalog-texte')).toMatchObject({
    oben: 190,
    hoehe: 46 + 6 + 4 * 21 + 6,
    aufklappbar: true,
    offen: true,
    alt:
      'Katalog-Texte abnehmen: Schuhe: Größen als Variante oder Filter; Jacken: Farbgruppen; ' +
      'Taschen: Leder oder Stoff; Quelle: docs/katalog.md',
  })
  // Die Luft vor dem Treffpunkt gehört zum Streifen der Zeile darüber.
  expect(nach.get('rechnungen')).toMatchObject({ hoehe: 46 + 18 })
  // Der letzte Streifen reicht bis zum unteren Rand. Das Endziel hat keine Unterzeilen.
  expect(nach.get('endziel')).toMatchObject({ oben: svg.hoehe - 65, hoehe: 46 + 19, aufklappbar: false, offen: false })
  // Wer einen Knopf bekommt, ist nie kürzer als eine Zeile.
  expect(streifen.filter(one => one.aufklappbar)).toHaveLength(13)
  expect(streifen.filter(one => one.aufklappbar).every(one => one.hoehe >= 46)).toBe(true)

  // Die Übersicht wird genauso geschnitten. Ein Ziel mit Unterzeilen ließe sich auch dort aufklappen.
  const mit: GraphDaten = {
    ...daten,
    uebersicht: daten.uebersicht.map(one => (one.id === 'ziel-kas' ? { ...one, tickets: ['Entwurf Warenkorb-Regeln'] } : one)),
  }
  const ueberBild = sicht(mit, wahl('uebersicht', ['ziel-kas']))
  const ueberSvg = zeichneSvg(mit, ueberBild, 'auto')
  const ueber = schneide(ueberSvg, ueberBild)

  pruefeTeilung(ueberSvg, ueber)
  expect(ueber.map(one => `${one.zeile}:${one.aufklappbar}:${one.offen}:${one.hoehe}`)).toEqual([
    'null:false:false:34',
    'ziel-kat:false:false:46',
    'ziel-kas:true:true:79',
    'ziel-suc:false:false:46',
    'ziel-btr:false:false:64',
    'umbau:false:false:46',
    'lasttest:false:false:46',
    'lager:false:false:46',
    'endziel:false:false:65',
  ])

  // Ein Bild, dessen Anfang nicht der erwartete ist, bleibt ganz: ein Streifen, kein Knopf.
  const fremd = { ...svg, source: svg.source.replace('viewBox="0 0 500 ', 'viewBox="0  0 500 ') }

  expect(fremd.source).not.toBe(svg.source)
  expect(schneide(fremd, bild)).toEqual([
    { zeile: null, oben: 0, hoehe: svg.hoehe, breite: 500, source: fremd.source, alt: svg.alt, aufklappbar: false, offen: false },
  ])
})

// ---------- Die Sicht: Ziel-Auswahl und Filter ----------

// Die Leiste stellt heute weder ein Ziel noch einen Filter ein; die Zeichenlogik kann es
// weiter. Geprüft wird es an den Testdaten, die bis 0.2.1 der Beispiel-Graph der Leiste waren.
const START: GraphWahl = {
  ansicht: 'schritte',
  ziel: ALLE,
  bahnenAus: [],
  personenAus: ['person-2'],
  offen: ['recherchen'],
  farben: 'auto',
}

// Alles, was eine Sicht zeigt, als ein Text, und dass sie sich zeichnen und schneiden lässt.
const worte = (einstellung: GraphWahl): string => {
  const bild = sicht(BEISPIEL, einstellung)
  const svg = zeichneSvg(BEISPIEL, bild, einstellung.farben)

  expect(svg.source).not.toMatch(/NaN|undefined/)
  expect(svg.source.length < 131072).toBe(true)
  pruefeTeilung(svg, schneide(svg, bild))
  pruefePlatz(svg)

  return [
    bild.zaehler,
    bild.ausgeblendet === '' ? '' : `Ausgeblendet: ${bild.ausgeblendet}`,
    ...bild.eintraege.map(one =>
      one.typ === 'zone' ? one.titel.toUpperCase() : one.typ === 'ticket' ? one.text : `${one.zeile.titel} · ${one.zeile.meta}`,
    ),
  ].join('\n')
}

test('die Sicht der Schritte: Zonen, Stamm, offene Bündel, und was eine ausgeblendete Person verbirgt', () => {
  const text = worte(START)

  expect(text).toContain('7 Bündel jetzt möglich · 3 laufen · 2 warten auf dich')
  expect(text).toContain('Grundstock: 13 Produktseiten fertig')
  expect(text).toContain('HINTER UNS')
  expect(text).toContain('JETZT MÖGLICH')
  expect(text).toContain('SPÄTER')
  expect(text).toContain('Treffpunkt: Großer Umbau')
  expect(text).toContain('Endziel: der Shop im Betrieb')
  expect(text).toContain('#8 · Schuhe: Größen als Variante oder Filter')
  expect(text).toContain('Ausgeblendet: Import, Tests (Person 2)')
  expect(text).not.toContain('Import: Umzug in Etappen')
  expect(String(zeichneSvg(BEISPIEL, sicht(BEISPIEL, START), 'auto').alt)).toContain('Ansicht Schritte')

  // Ein Bündel klappt zu und ein anderes auf.
  expect(text).toContain('#9 · Jacken: Farbgruppen')
  expect(text).not.toContain('#26 · Suche: Sortierung')

  const anders = worte({ ...START, offen: ['suchfelder'] })

  expect(anders).not.toContain('#9 · Jacken: Farbgruppen')
  expect(anders).toContain('8 Recherchen zu den Kategorien')
  expect(anders).toContain('#26 · Suche: Sortierung')

  // Die Übersicht zeigt je Zeile ein ganzes Ziel, ohne Zonen.
  const uebersicht = worte({ ...START, ansicht: 'uebersicht' })

  expect(uebersicht).toContain('Katalog füllen')
  expect(uebersicht).toContain('12 offen · 5 bereit · 1 Chat')
  expect(uebersicht).not.toContain('Grundstock: 13 Produktseiten fertig')
  expect(uebersicht).not.toContain('JETZT MÖGLICH')
  expect(String(zeichneSvg(BEISPIEL, sicht(BEISPIEL, { ...START, ansicht: 'uebersicht' }), 'auto').alt)).toContain('Ansicht Übersicht')
})

test('die Sicht blendet Bahnen und Personen aus und ein und zeigt auf Wunsch ein einzelnes Ziel', () => {
  const ohneKatalog = worte({ ...START, bahnenAus: ['kat'] })

  expect(ohneKatalog).not.toContain('Katalog-Texte abnehmen')
  expect(ohneKatalog).toContain('Entwurf Warenkorb-Regeln')
  expect(ohneKatalog).toContain('Ausgeblendet: Katalog · Import, Tests (Person 2)')
  expect(ohneKatalog).toContain('5 Bündel jetzt möglich · 2 laufen · 1 warten auf dich')

  const mitPerson2 = worte({ ...START, personenAus: [] })

  expect(mitPerson2).toContain('Katalog-Texte abnehmen')
  expect(mitPerson2).toContain('Import: Umzug in Etappen')
  expect(mitPerson2).not.toContain('Ausgeblendet')

  const nurPerson2 = worte({ ...START, personenAus: ['ich'] })

  expect(nurPerson2).not.toContain('Katalog-Texte abnehmen')
  expect(nurPerson2).toContain('Tests: Testdaten bremsen den Lauf')
  expect(nurPerson2).toContain('(Ich)')

  // Ein einzelnes Ziel: nur seine Bahn und der Stamm.
  const nurKasse = worte({ ...START, ziel: 'kas' })

  expect(nurKasse).toContain('Entwurf Warenkorb-Regeln')
  expect(nurKasse).not.toContain('Katalog-Texte abnehmen')
  expect(nurKasse).not.toContain('Ladezeit')
  expect(nurKasse).toContain('Treffpunkt: Großer Umbau')
  expect(sicht(BEISPIEL, { ...START, ziel: 'kas' }).bahnen.map(one => one.id)).toEqual(['kas'])

  // Eine leere Zone bekommt keine Überschrift, „Jetzt möglich“ bleibt.
  const nurBetrieb = worte({ ...START, ziel: 'btr' })

  expect(nurBetrieb).toContain('Ladezeit der Startseite senken')
  expect(nurBetrieb).toContain('JETZT MÖGLICH')
  expect(nurBetrieb).not.toContain('HINTER UNS')
  expect(nurBetrieb).not.toContain('SPÄTER')

  // Ein Ziel, das gerade nicht wählbar ist, gilt als „alle“.
  expect(sicht(BEISPIEL, { ...START, ziel: 'imp' }).ziel).toBe(ALLE)
  expect(sicht(BEISPIEL, { ...START, ziel: 'alle' }).bahnen.map(one => one.id)).toEqual(['kat', 'kas', 'suc', 'btr', 'wkz'])
})
