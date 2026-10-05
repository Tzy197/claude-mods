import { expect, test } from 'claude-code/testing'
import type { FsEntry } from 'claude-code'

import type { ZielGraphAenderungen } from '../types'

import { graphDaten } from '../hooks/graph/zeilen'
import { sicht } from '../hooks/karten/karten'
import { AUFTRAG } from '../hooks/plan/ableiten'
import { leiteAb as laufe, leseGespeichert } from '../hooks/plan/lauf'
import type { LaufZugang } from '../hooks/plan/lauf'
import { aenderungsArt, aenderungsListe, aenderungsMarke, aenderungsZeile } from '../hooks/plan/lesen'
import { leseAenderungen, vergleiche } from '../hooks/plan/vergleich'
import { lesePlan, zeichneGraph, zeichneKarten } from '../hooks/probe'

import { CHAT, GOAL, KEINE, QUELLEN, STAMM_MIT_GOAL, ZEILEN, antwort, antwortOhneGoal, gelungen, umfeld } from './shop'
import type { Zeile } from './shop'
import { BREIT, GITHUB, GRAPH, HEIM, JETZT, ORDNER, TAG, VERBRAUCH, WURZEL, baue, befehl, gespeichert, inhalt, legeShop, leiteAb, mitBildern, mitPlan } from './welt'

// Der Plan wird fortgeschrieben: Ein Lauf bekommt den vorigen Plan in Kurzform, und danach
// sagen beide Ansichten, was sich gegenüber dem vorigen geändert hat. Alle Testdaten sind erfunden.

// ---------- Der Shop eine Woche später ----------

// Dieselben Bündel, mit je einer Änderung jeder Art: Die Katalog-Texte sind erledigt, die
// Gutscheine stehen in einem anderen Strang, die Rückfragen sind möglich geworden, die
// Suchfelder heißen anders, die Rechnungen sind weg, der Versand ist neu.
const ZWEITE: Zeile[] = [
  ...ZEILEN.filter(one => one.id !== 'rechnungen').map(one =>
    one.id === 'katalog-texte'
      ? { ...one, zone: 'hinter', stand: 'erledigt', meta: '' }
      : one.id === 'gutscheine'
        ? { ...one, bahn: 'katalog' }
        : one.id === 'rueckfragen'
          ? { ...one, zone: 'jetzt', stand: 'bereit', meta: '' }
          : one.id === 'suchfelder'
            ? { ...one, titel: 'Suchfelder, Sortierung und Filter' }
            : one,
  ),
  { id: 'versand', bahn: 'kasse', zone: 'spaeter', stand: 'blockiert', titel: 'Versandkosten berechnen', meta: 'wartet auf die Regeln', quelle: 'docs/kasse.md' },
]
// Dazu ein neuer Schritt auf dem Stamm.
const LAGER = { id: 'lager', art: 'schritt', titel: 'Lageranbindung', meta: '', quelle: 'README.md', vermutet: false }
const zweiteAntwort = (): string => antwort({ zeilen: ZWEITE, stamm: [...STAMM_MIT_GOAL, LAGER] })

const AENDERUNGEN: ZielGraphAenderungen = {
  eintraege: [
    {
      was: 'buendel',
      id: 'katalog-texte',
      vorher: { titel: 'Katalog-Texte abnehmen', strang: 'Katalog', zone: 'jetzt', stand: 'bereit' },
      nachher: { titel: 'Katalog-Texte abnehmen', strang: 'Katalog', zone: 'hinter', stand: 'erledigt' },
    },
    {
      was: 'buendel',
      id: 'gutscheine',
      vorher: { titel: 'Entwurf Gutschein-Einlösung', strang: 'Kasse', zone: 'jetzt', stand: 'bereit' },
      nachher: { titel: 'Entwurf Gutschein-Einlösung', strang: 'Katalog', zone: 'jetzt', stand: 'bereit' },
    },
    {
      was: 'buendel',
      id: 'rueckfragen',
      vorher: { titel: '10 Rückfragen an den Einkauf', strang: 'Katalog', zone: 'spaeter', stand: 'blockiert' },
      nachher: { titel: '10 Rückfragen an den Einkauf', strang: 'Katalog', zone: 'jetzt', stand: 'bereit' },
    },
    {
      was: 'buendel',
      id: 'suchfelder',
      vorher: { titel: 'Suchfelder und Sortierung', strang: 'Suche', zone: 'jetzt', stand: 'bereit' },
      nachher: { titel: 'Suchfelder, Sortierung und Filter', strang: 'Suche', zone: 'jetzt', stand: 'bereit' },
    },
    { was: 'buendel', id: 'versand', vorher: null, nachher: { titel: 'Versandkosten berechnen', strang: 'Kasse', zone: 'spaeter', stand: 'blockiert' } },
    { was: 'schritt', id: 'lager', vorher: null, nachher: { titel: 'Lageranbindung', strang: '', zone: 'stamm', stand: 'offen' } },
    { was: 'buendel', id: 'rechnungen', vorher: { titel: 'Block Rechnungen', strang: 'Kasse', zone: 'spaeter', stand: 'blockiert' }, nachher: null },
  ],
  endziel: null,
}

const ZEILE = 'Seit dem letzten Ableiten: 2 neu, 1 erledigt, 2 verschoben, 1 umbenannt, 1 weggefallen'

const LISTE = [
  'Erledigt: Katalog-Texte abnehmen (Katalog) · Jetzt möglich → Hinter uns',
  'Verschoben: Entwurf Gutschein-Einlösung · Strang Kasse → Katalog',
  'Verschoben: 10 Rückfragen an den Einkauf (Katalog) · Später → Jetzt möglich',
  'Umbenannt: Suchfelder, Sortierung und Filter (Suche) · hieß „Suchfelder und Sortierung“',
  'Neu: Versandkosten berechnen (Kasse, Später)',
  'Neu: Lageranbindung (auf dem Stamm)',
  'Weggefallen: Block Rechnungen (zuletzt Kasse, Später)',
]

// Der erste Plan des Shops, so wie ihn der zweite Lauf als Vorgabe bekommt.
const KURZFORM = [
  '<voriger-plan abgeleitet="2026-10-04">',
  'zeilen:',
  '{"id":"grundstock","bahn":"katalog","zone":"hinter","stand":"erledigt","titel":"Grundstock: 13 Produktseiten fertig"}',
  '{"id":"bilder","bahn":"katalog","zone":"hinter","stand":"erledigt","titel":"Bilder für Schuhe und Jacken"}',
  '{"id":"zahlarten","bahn":"kasse","zone":"hinter","stand":"erledigt","titel":"Zahlarten geklärt und 5 Entwürfe"}',
  '{"id":"katalog-texte","bahn":"katalog","zone":"jetzt","stand":"bereit","titel":"Katalog-Texte abnehmen"}',
  '{"id":"warenkorb","bahn":"kasse","zone":"jetzt","stand":"bereit","titel":"Entwurf Warenkorb-Regeln"}',
  '{"id":"gutscheine","bahn":"kasse","zone":"jetzt","stand":"bereit","titel":"Entwurf Gutschein-Einlösung"}',
  '{"id":"suchfelder","bahn":"suche","zone":"jetzt","stand":"bereit","titel":"Suchfelder und Sortierung"}',
  '{"id":"ladezeit","bahn":"betrieb","zone":"jetzt","stand":"bereit","titel":"Ladezeit der Startseite senken"}',
  '{"id":"build-skripte","bahn":"betrieb","zone":"jetzt","stand":"teilweise","titel":"Umbau der Build-Skripte"}',
  '{"id":"rueckfragen","bahn":"katalog","zone":"spaeter","stand":"blockiert","titel":"10 Rückfragen an den Einkauf"}',
  '{"id":"rechnungen","bahn":"kasse","zone":"spaeter","stand":"blockiert","titel":"Block Rechnungen"}',
  'stamm:',
  '{"id":"grundstock-steht","art":"zwischenziel","titel":"Grundstock steht"}',
  '{"id":"grosser-umbau","art":"zwischenziel","titel":"Großer Umbau"}',
  '{"id":"lasttest-bestanden","art":"zwischenziel","titel":"Lasttest bestanden"}',
  '</voriger-plan>',
].join('\n')

// ---------- Der Vergleich ----------

test('der Vergleich zweier Pläne nach der id: neu, weg, umbenannt, in anderer Zone, anderem Stand, anderem Strang', () => {
  const vorher = gelungen(antwort()).plan
  const neu = gelungen(zweiteAntwort()).plan

  expect(vergleiche(vorher, neu)).toEqual(AENDERUNGEN)
  // Derselbe Plan gegen sich selbst: nichts.
  expect(vergleiche(vorher, vorher)).toEqual({ eintraege: [], endziel: null })
  expect(vergleiche(neu, gelungen(zweiteAntwort()).plan)).toEqual({ eintraege: [], endziel: null })
  // Andersherum ist neu, was weg war, und was weg ist, steht zuletzt.
  expect(vergleiche(neu, vorher).eintraege.map(one => `${one.id}:${aenderungsArt(one)}`)).toEqual([
    'katalog-texte:verschoben',
    'gutscheine:verschoben',
    'suchfelder:umbenannt',
    'rueckfragen:verschoben',
    'rechnungen:neu',
    'versand:weg',
    'lager:weg',
  ])

  // Nur der Stand: Die Zone bleibt, das Bündel ist nicht mehr nur zum Teil möglich. Meta,
  // Punkte, Quelle und „wartet auf“ zählen nicht.
  const dritte = gelungen(
    antwort({
      zeilen: ZEILEN.map(one => (one.id === 'build-skripte' ? { ...one, stand: 'bereit', wartetAuf: '', meta: 'alles da' } : { ...one, meta: 'anders', punkte: ['Neuer Punkt'], quelle: 'README.md' })),
    }),
  ).plan

  expect(vergleiche(vorher, dritte).eintraege).toEqual([
    {
      was: 'buendel',
      id: 'build-skripte',
      vorher: { titel: 'Umbau der Build-Skripte', strang: 'Betrieb', zone: 'jetzt', stand: 'teilweise' },
      nachher: { titel: 'Umbau der Build-Skripte', strang: 'Betrieb', zone: 'jetzt', stand: 'bereit' },
    },
  ])

  // Derselbe Strang unter anderer id ist kein anderer: Ohne GOAL.md kürzt das Modell ihn
  // „kat“, mit GOAL.md heißt er „katalog“. Der Stamm und das Endziel sind dann andere.
  const ohneGoal = gelungen(antwortOhneGoal(), umfeld(null)).plan
  const anders = vergleiche(ohneGoal, vorher)

  expect(anders.eintraege.map(one => `${one.was}:${one.id}:${aenderungsArt(one)}`)).toEqual([
    'buendel:bilder:neu',
    'schritt:grundstock-steht:neu',
    'schritt:grosser-umbau:neu',
    'schritt:lasttest-bestanden:neu',
    'schritt:umbau:weg',
    'schritt:lasttest:weg',
    'schritt:lager:weg',
  ])
  expect(anders.endziel).toEqual({ vorher: 'der Shop im Betrieb', nachher: 'Der Shop ist im Betrieb und nimmt Bestellungen an.' })

  // Ein Zwischenziel, das GOAL.md inzwischen abhakt, ist erreicht.
  const abgehakt = gelungen(antwort(), umfeld(GOAL.replace('- Großer Umbau', '- [x] Großer Umbau'))).plan

  expect(vergleiche(vorher, abgehakt).eintraege).toEqual([
    {
      was: 'schritt',
      id: 'grosser-umbau',
      vorher: { titel: 'Großer Umbau', strang: '', zone: 'stamm', stand: 'offen' },
      nachher: { titel: 'Großer Umbau', strang: '', zone: 'stamm', stand: 'erreicht' },
    },
  ])
})

test('die Änderungen in Worten: eine Zeile, die zählt, und je Änderung eine Zeile', () => {
  const vorher = gelungen(antwort()).plan

  expect(aenderungsZeile(AENDERUNGEN)).toBe(ZEILE)
  expect(aenderungsListe(AENDERUNGEN)).toEqual(LISTE)
  expect(AENDERUNGEN.eintraege.map(aenderungsArt)).toEqual(['erledigt', 'verschoben', 'verschoben', 'umbenannt', 'neu', 'neu', 'weg'])

  // Ohne Plan davor steht nichts da; mit einem, an dem sich nichts getan hat, steht das da.
  expect(aenderungsZeile(null)).toBe('')
  expect(aenderungsListe(null)).toEqual([])
  expect(aenderungsZeile({ eintraege: [], endziel: null })).toBe('Seit dem letzten Ableiten: nichts geändert')
  expect(aenderungsListe({ eintraege: [], endziel: null })).toEqual([])

  // Das Endziel steht zuerst; ein offenes heißt „nicht festgelegt“.
  const anders = vergleiche(gelungen(antwortOhneGoal(), umfeld(null)).plan, vorher)

  expect(aenderungsZeile(anders)).toBe('Seit dem letzten Ableiten: 4 neu, 3 weggefallen, Endziel geändert')
  expect(aenderungsListe(anders).slice(0, 3)).toEqual([
    'Endziel geändert: „der Shop im Betrieb“ → „Der Shop ist im Betrieb und nimmt Bestellungen an.“',
    'Neu: Bilder für Schuhe und Jacken (Katalog, Hinter uns)',
    'Neu: Grundstock steht (auf dem Stamm)',
  ])
  expect(aenderungsListe(anders).at(-1)).toBe('Weggefallen: Lageranbindung (zuletzt auf dem Stamm)')
  expect(aenderungsListe({ eintraege: [], endziel: { vorher: '', nachher: 'der Shop im Betrieb' } })).toEqual([
    'Endziel geändert: nicht festgelegt → „der Shop im Betrieb“',
  ])

  // Mehreres auf einmal steht in einer Zeile; der Stand für sich nur, wo die Zone blieb.
  expect(
    aenderungsListe({
      endziel: null,
      eintraege: [
        {
          was: 'buendel',
          id: 'gutscheine',
          vorher: { titel: 'Entwurf Gutschein-Einlösung', strang: 'Katalog', zone: 'spaeter', stand: 'blockiert' },
          nachher: { titel: 'Gutscheine einlösen', strang: 'Kasse', zone: 'jetzt', stand: 'teilweise' },
        },
        {
          was: 'buendel',
          id: 'build-skripte',
          vorher: { titel: 'Umbau der Build-Skripte', strang: 'Betrieb', zone: 'jetzt', stand: 'teilweise' },
          nachher: { titel: 'Umbau der Build-Skripte', strang: 'Betrieb', zone: 'jetzt', stand: 'bereit' },
        },
        {
          was: 'schritt',
          id: 'grosser-umbau',
          vorher: { titel: 'Großer Umbau', strang: '', zone: 'stamm', stand: 'offen' },
          nachher: { titel: 'Großer Umbau', strang: '', zone: 'stamm', stand: 'erreicht' },
        },
      ],
    }),
  ).toEqual([
    'Verschoben: Gutscheine einlösen · hieß „Entwurf Gutschein-Einlösung“ · Strang Katalog → Kasse · Später → Jetzt möglich',
    'Verschoben: Umbau der Build-Skripte (Betrieb) · zum Teil möglich → bereit',
    'Erreicht: Großer Umbau (auf dem Stamm) · offen → erreicht',
  ])
})

test('eine Karte und eine Zeile des Graphen sagen vorn in ihrer zweiten Zeile, was der letzte Lauf an ihnen geändert hat', () => {
  const { plan } = gelungen(zweiteAntwort())

  expect(aenderungsMarke(AENDERUNGEN, 'buendel', 'versand')).toBe('neu')
  expect(aenderungsMarke(AENDERUNGEN, 'buendel', 'gutscheine')).toBe('verschoben')
  expect(aenderungsMarke(AENDERUNGEN, 'buendel', 'suchfelder')).toBe('umbenannt')
  expect(aenderungsMarke(AENDERUNGEN, 'schritt', 'lager')).toBe('neu')
  // Was erledigt ist, fassen beide Ansichten zusammen; was weg ist, hat keine Karte mehr.
  expect(aenderungsMarke(AENDERUNGEN, 'buendel', 'katalog-texte')).toBe('')
  expect(aenderungsMarke(AENDERUNGEN, 'buendel', 'rechnungen')).toBe('')
  expect(aenderungsMarke(AENDERUNGEN, 'buendel', 'warenkorb')).toBe('')
  expect(aenderungsMarke(AENDERUNGEN, 'buendel', 'lager')).toBe('')
  expect(aenderungsMarke(null, 'buendel', 'versand')).toBe('')

  // Die Karten der breiten Ansicht.
  const karten = sicht(plan, KEINE, '', AENDERUNGEN)
  const karte = (id: string): string =>
    [...karten.spalten.flatMap(one => [...one.karten.jetzt, ...one.karten.spaeter]), ...karten.stamm].find(one => one.id === id)?.meta ?? '-'

  expect(karte('versand')).toBe('neu · wartet auf die Regeln')
  expect(karte('gutscheine')).toBe('verschoben')
  expect(karte('rueckfragen')).toBe('verschoben')
  expect(karte('suchfelder')).toBe('umbenannt')
  expect(karte('lager')).toBe('neu · nicht in GOAL.md')
  expect(karte('warenkorb')).toBe('')
  expect(karte('build-skripte')).toBe('1 von 3 erledigt · Rest wartet auf den Lasttest')
  // Ohne Änderungen steht alles da wie zuvor.
  expect(sicht(plan, KEINE, '').spalten[1]?.karten.spaeter[0]?.meta).toBe('wartet auf die Regeln')

  // Die Zeilen der schmalen Ansicht.
  const daten = graphDaten(plan, KEINE, AENDERUNGEN)
  const zeile = (id: string): string => daten.schritte.find(one => one.id === id)?.meta ?? '-'

  expect(zeile('versand')).toBe('neu · wartet auf die Regeln')
  expect(zeile('gutscheine')).toBe('verschoben')
  expect(zeile('suchfelder')).toBe('umbenannt')
  expect(zeile('lager')).toBe('neu')
  expect(zeile('warenkorb')).toBe('')
  expect(graphDaten(plan, KEINE).schritte.find(one => one.id === 'versand')?.meta).toBe('wartet auf die Regeln')
})

test('die Änderungen aus einer Plan-Datei: Was nicht passt, fällt weg', () => {
  expect(leseAenderungen(JSON.parse(JSON.stringify(AENDERUNGEN)))).toEqual(AENDERUNGEN)

  for (const keine of [undefined, null, 'viele', 7, [], {}, { eintraege: 'viele' }]) {
    expect(leseAenderungen(keine)).toBe(null)
  }

  const lage = { titel: 'Block Rechnungen', strang: 'Kasse', zone: 'spaeter', stand: 'blockiert' }

  expect(
    leseAenderungen({
      eintraege: [
        { was: 'buendel', id: 'rechnungen', vorher: lage, nachher: null },
        { was: 'buendel', id: 'rechnungen', vorher: lage },
        { was: 'ticket', id: 'x', vorher: lage, nachher: lage },
        { was: 'buendel', vorher: lage, nachher: lage },
        { was: 'buendel', id: 'beides-fehlt', vorher: null, nachher: null },
        { was: 'buendel', id: 'fremde-zone', vorher: { ...lage, zone: 'irgendwann' }, nachher: { ...lage, stand: 'läuft' } },
        { was: 'schritt', id: 'ohne-titel', vorher: null, nachher: { strang: '', zone: 'stamm', stand: 'offen' } },
        'kein Eintrag',
      ],
      endziel: { vorher: 7, nachher: 'der Shop im Betrieb' },
    }),
  ).toEqual({
    eintraege: [
      { was: 'buendel', id: 'rechnungen', vorher: lage, nachher: null },
      { was: 'buendel', id: 'rechnungen', vorher: lage, nachher: null },
    ],
    endziel: null,
  })
})

// ---------- Der Lauf ----------

test('der zweite Lauf schreibt den vorigen Plan fort: Er bekommt ihn in Kurzform, und beide Ansichten sagen, was sich geändert hat', async ($, on) => {
  const welt = await mitPlan($, on)
  const graph = await $.ui.mount({ ...GRAPH, surface: 'desktop' })
  const karten = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  // Der erste Lauf hatte keinen Plan vor sich: Er lief wie bisher, und über Änderungen steht nichts da.
  expect(welt.fragen[0]?.prompt).not.toContain('<voriger-plan')
  expect(await mitBildern(graph)).not.toContain('Seit dem letzten Ableiten')
  expect(await inhalt(karten)).not.toContain('Seit dem letzten Ableiten')
  expect(gespeichert(welt, `${ORDNER}/plan.json`).aenderungen).toBe(null)
  expect(gespeichert(welt, `${ORDNER}/letzter.json`)).toMatchObject({ quellen: { voriger: null }, aenderungen: null })

  await welt.uhr.advance(60_000)
  welt.modell = { isAnswered: true, usage: VERBRAUCH, text: zweiteAntwort() }
  await leiteAb(karten, welt)

  // Derselbe Auftrag; der vorige Plan steht in Kurzform am Ende der Eingabe.
  const eingabe = welt.fragen[1]?.prompt ?? ''

  expect(welt.fragen).toHaveLength(2)
  expect(welt.fragen[1]?.system).toBe(AUFTRAG)
  expect(eingabe.endsWith(`2026-09-01 Katalog: Schritt 1\n</commits>\n\n${KURZFORM}`)).toBe(true)
  expect(eingabe.startsWith(`Leite den Plan für dieses Repo ab. Heute ist der 2026-10-04.\n\n<goal datei="GOAL.md">\n${GOAL.trim()}\n</goal>\n\n<goal-gelesen>\n`)).toBe(true)
  expect(welt.toasts).toEqual(['Ableiten fertig nach 23 s: 11 Bündel in 4 Strängen'])

  // Was sich geändert hat, liegt beim Plan.
  expect(gespeichert(welt, `${ORDNER}/plan.json`)).toMatchObject({ version: 2, antwort: zweiteAntwort() })
  expect(gespeichert(welt, `${ORDNER}/plan.json`).aenderungen).toEqual(AENDERUNGEN)
  expect(gespeichert(welt, `${ORDNER}/letzter.json`)).toMatchObject({
    quellen: { voriger: { zeit: '2026-10-04T12:00:00.000Z', buendel: 11, stamm: 3 } },
    aenderungen: AENDERUNGEN,
  })

  // Die schmale Ansicht sagt es in einer Zeile, die breite als Liste.
  const imGraphen = await mitBildern(graph)
  const aufKarten = await inhalt(karten)

  expect(imGraphen).toContain(ZEILE)
  expect(imGraphen).not.toContain('Weggefallen: Block Rechnungen')
  expect(aufKarten).toContain(ZEILE)

  for (const zeile of LISTE) {
    expect(aufKarten).toContain(`– ${zeile}`)
  }

  // Die geänderten Karten und Zeilen sagen es vorn in ihrer zweiten Zeile.
  expect(aufKarten).toContain('  · Kasse · Versandkosten berechnen — neu · wartet auf die Regeln')
  expect(aufKarten).toContain('  ○ Katalog · Entwurf Gutschein-Einlösung — verschoben')
  expect(aufKarten).toContain('  ○ Katalog · 10 Rückfragen an den Einkauf — verschoben')
  expect(aufKarten).toContain('  ○ Suche · Suchfelder, Sortierung und Filter — umbenannt')
  expect(aufKarten).toContain('  ○ Lageranbindung — neu · nicht in GOAL.md')
  expect(aufKarten).toContain('▸ ◉ Kasse · Entwurf Warenkorb-Regeln [Chat wartet auf dich]')
  expect(imGraphen).toContain('>neu · wartet auf die Regeln</text>')
  expect(imGraphen).toContain('>verschoben</text>')
  expect(imGraphen).toContain('>umbenannt</text>')

  // Die Probe ohne App zeichnet dieselben Marken aus der Plan-Datei.
  const json = welt.dateien.get(`${ORDNER}/plan.json`) ?? ''

  expect(lesePlan(json)?.aenderungen).toEqual(AENDERUNGEN)
  expect(zeichneGraph(json)?.bild.source).toContain('>neu · wartet auf die Regeln</text>')
  // Auf der Karte ist die Zeile kürzer: Die Marke steht vorn und bleibt so in jedem Fall stehen.
  expect(zeichneKarten(json)?.source).toContain('>neu · wartet auf die')
  expect(zeichneKarten(json)?.source).toContain('>verschoben</text>')

  // Bis zum nächsten Ableiten bleibt das stehen: nach „Neu laden“ und nach einem Lauf, der scheitert.
  await karten.press({ key: 'laden' })
  expect(await inhalt(karten)).toContain(`– ${LISTE[0]}`)
  welt.modell = { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: VERBRAUCH }
  await leiteAb(graph, welt)
  expect(await mitBildern(graph)).toContain('Ableiten fehlgeschlagen')
  expect(await mitBildern(graph)).toContain(ZEILE)
  expect(await inhalt(karten)).toContain(`– ${LISTE[6]}`)

  // Der nächste gelungene Lauf vergleicht mit dem zweiten Plan: Dieselbe Antwort ändert nichts.
  welt.modell = { isAnswered: true, usage: VERBRAUCH, text: zweiteAntwort() }
  await leiteAb(graph, welt)
  expect(welt.fragen[3]?.prompt).toContain('{"id":"versand","bahn":"kasse","zone":"spaeter","stand":"blockiert","titel":"Versandkosten berechnen"}')
  expect(welt.fragen[3]?.prompt).toContain('{"id":"lager","art":"schritt","titel":"Lageranbindung"}\n</voriger-plan>')
  expect(welt.fragen[3]?.prompt).not.toContain('"id":"rechnungen"')
  expect(gespeichert(welt, `${ORDNER}/plan.json`).aenderungen).toEqual({ eintraege: [], endziel: null })
  expect(await mitBildern(graph)).toContain('Seit dem letzten Ableiten: nichts geändert')
  expect(await mitBildern(graph)).not.toContain('>verschoben</text>')
  expect(await inhalt(karten)).toContain('Seit dem letzten Ableiten: nichts geändert')
  expect(await inhalt(karten)).not.toContain('– Neu: Versandkosten berechnen')
  expect(await inhalt(karten)).toContain('  · Kasse · Versandkosten berechnen — wartet auf die Regeln')

  await graph.unmount()
  await karten.unmount()
})

test('eine Plan-Datei der Version 1 lädt weiter und gilt beim nächsten Lauf als voriger Plan', async ($, on) => {
  const welt = baue(on)
  // So lag der Plan bis Version 0.3.0 da: ohne Festlegungen und ohne Änderungen.
  const alt = JSON.stringify({
    version: 1,
    fakten: { zeit: JETZT - 3 * TAG, dauerMs: 31_000, modellMs: 30_000, dateien: 5, chats: 1, commits: 30, modell: 'claude-sonnet-5-5', datei: `${ORDNER}/plan.json` },
    antwort: antwort(),
    umfeld: { chats: [CHAT], quellen: QUELLEN },
    goal: GOAL,
    hinweise: [],
  })

  legeShop(welt)
  welt.dateien.set(`${ORDNER}/plan.json`, alt)
  expect(leseGespeichert(alt)).toMatchObject({ antwort: antwort(), goal: GOAL, festlegungen: [], aenderungen: null })
  expect(lesePlan(alt)).toMatchObject({ plan: gelungen(antwort()).plan, aenderungen: null })
  await befehl($, 'orchestrator')

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })
  const text = await inhalt(ui)

  expect(text).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
  expect(text).toContain('Abgeleitet vor 3 Tagen in 31 s')
  expect(text).toContain('Keine Festlegungen')
  expect(text).not.toContain('Seit dem letzten Ableiten')
  expect(text).not.toContain('Die Festlegungen sind andere als beim letzten Ableiten')
  expect(welt.geschrieben.size).toBe(0)

  // Der nächste Lauf schreibt ihn fort und legt die Datei in der neuen Form ab.
  await leiteAb(ui, welt)
  expect(welt.fragen[0]?.prompt.endsWith(KURZFORM.replace('2026-10-04', '2026-10-01'))).toBe(true)
  expect(gespeichert(welt, `${ORDNER}/plan.json`)).toMatchObject({ version: 2, festlegungen: [], aenderungen: { eintraege: [], endziel: null } })
  expect(await inhalt(ui)).toContain('Seit dem letzten Ableiten: nichts geändert')

  await ui.unmount()
})

test('hat sich GOAL.md seit dem letzten Lauf geändert, gilt als voriger Plan der, den die Ansichten gerade zeigen', async ($, on) => {
  // Der erste Lauf ohne GOAL.md: Das Modell schneidet die Stränge selbst und nennt sie „kat“ und „kas“.
  const welt = await mitPlan($, on, { modell: { isAnswered: true, text: antwortOhneGoal(), usage: VERBRAUCH } }, null)
  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  // Der Chat hat GOAL.md angelegt. Der zweite Lauf bekommt den vorigen Plan mit ihren Strängen.
  welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL)
  welt.modell = { isAnswered: true, text: antwort(), usage: VERBRAUCH }
  await welt.uhr.advance(60_000)
  await leiteAb(ui, welt)

  const eingabe = welt.fragen[1]?.prompt ?? ''

  expect(eingabe).toContain('{"id":"grundstock","bahn":"katalog","zone":"hinter","stand":"erledigt","titel":"Grundstock: 13 Produktseiten fertig"}')
  expect(eingabe).toContain('{"id":"zahlarten","bahn":"kasse","zone":"hinter","stand":"erledigt","titel":"Zahlarten geklärt und 5 Entwürfe"}')
  expect(eingabe).not.toContain('"bahn":"kat"')
  // Auf dem Stamm stehen schon die Zwischenziele aus GOAL.md, dahinter, was das Modell damals nannte.
  expect(eingabe).toContain(
    [
      'stamm:',
      '{"id":"grundstock-steht","art":"zwischenziel","titel":"Grundstock steht"}',
      '{"id":"grosser-umbau","art":"zwischenziel","titel":"Großer Umbau"}',
      '{"id":"lasttest-bestanden","art":"zwischenziel","titel":"Lasttest bestanden"}',
      '{"id":"umbau","art":"schritt","titel":"Treffpunkt: Großer Umbau"}',
      '{"id":"lasttest","art":"schritt","titel":"Lasttest"}',
      '{"id":"lager","art":"schritt","titel":"Lageranbindung"}',
      '</voriger-plan>',
    ].join('\n'),
  )

  // Als Änderung zählt nur, was der Lauf selbst geändert hat: kein Bündel hat den Strang
  // gewechselt, und Endziel und Zwischenziele aus GOAL.md galten schon vorher.
  const text = await inhalt(ui)

  expect(text).toContain('Seit dem letzten Ableiten: 1 neu, 3 weggefallen')
  expect(text).toContain('– Neu: Bilder für Schuhe und Jacken (Katalog, Hinter uns)')
  expect(text).toContain('– Weggefallen: Treffpunkt: Großer Umbau (zuletzt auf dem Stamm)')
  expect(text).not.toContain('Endziel geändert')
  expect(text).not.toContain('Strang Katalog →')

  await ui.unmount()
})

// ---------- Ohne Engine ----------

test('leiteAb läuft ohne Engine mit einem schlichten Zugang aus elf Funktionen', async () => {
  const dateien = new Map<string, string>([
    [`${WURZEL}/GOAL.md`, `${GOAL}\n## Festlegungen\n- Der Lasttest kommt erst nach dem großen Umbau.\n`],
    [`${WURZEL}/README.md`, '# Shop\n'],
    [`${WURZEL}/docs/kasse.md`, '# Kasse\n'],
    [`${WURZEL}/docs/katalog.md`, '# Katalog\n'],
    [`${WURZEL}/docs/plan/suche.md`, '# Suche\n'],
    [`${ORDNER}/festlegungen.json`, JSON.stringify({ version: 1, festlegungen: [{ satz: 'Die Gutscheine gehören zur Kasse, nicht zum Katalog.', zeit: JETZT }] })],
  ])
  const fragen: { system: string; prompt: string }[] = []
  const benutzt = new Set<string>()
  let uhr = JETZT
  let text = antwort({ chats: [] })
  const eintraege = (ordner: string): FsEntry[] => {
    const namen = new Map<string, FsEntry>()

    for (const pfad of dateien.keys()) {
      const rest = pfad.startsWith(`${ordner}/`) ? pfad.slice(ordner.length + 1).split('/') : []
      const [name = ''] = rest

      if (name !== '') {
        namen.set(name, { name, kind: rest.length > 1 ? 'dir' : 'file', size: 0, mtimeMs: JETZT, isLink: false })
      }
    }

    return [...namen.values()]
  }
  // Genau diese elf Funktionen braucht ein Lauf. Der Stellvertreter merkt sich, welche er anfasst.
  const schlicht: LaufZugang = {
    sitzung: async () => 'sitzung-1',
    heim: async () => HEIM,
    repo: async () => ({ root: WURZEL, remote: GITHUB, internal: false, name: null }),
    wurzel: async () => WURZEL,
    jetzt: async () => {
      uhr += 1000

      return uhr
    },
    gibtEs: async pfad => [...dateien.keys()].some(one => one === pfad || one.startsWith(`${pfad}/`)),
    liste: async pfad => eintraege(pfad),
    lies: async pfad => {
      const inhaltDerDatei = dateien.get(pfad)

      if (inhaltDerDatei === undefined) {
        throw new Error(`ENOENT: ${pfad}`)
      }

      return inhaltDerDatei
    },
    schreibe: async (pfad, neu) => {
      dateien.set(pfad, neu)
    },
    laufe: async () => ({ exitCode: 0, stdout: '2026-09-30 Warenkorb merkt sich die Menge\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }),
    frage: async (system, prompt) => {
      fragen.push({ system, prompt })

      return { isAnswered: true, text, usage: VERBRAUCH }
    },
  }
  const zugang = new Proxy(schlicht, {
    get: (ziel, name, empfaenger) => {
      benutzt.add(String(name))

      return Reflect.get(ziel, name, empfaenger) as unknown
    },
  })
  const aufruf = { modell: 'claude-sonnet-5-5', maxTokens: 16_000, timeoutMs: 240_000 }
  const erster = await laufe(zugang, aufruf)

  expect([...benutzt].sort()).toEqual(['frage', 'gibtEs', 'heim', 'jetzt', 'laufe', 'lies', 'liste', 'repo', 'schreibe', 'sitzung', 'wurzel'])
  expect(erster).toMatchObject({
    ok: true,
    geladen: {
      warnungen: [],
      festlegungen: {
        liste: [
          { satz: 'Der Lasttest kommt erst nach dem großen Umbau.', ort: 'goal' },
          { satz: 'Die Gutscheine gehören zur Kasse, nicht zum Katalog.', ort: 'lokal' },
        ],
        geaendert: false,
      },
      aenderungen: null,
      fakten: { dateien: 4, chats: 0, commits: 1, modell: 'claude-sonnet-5-5', datei: `${ORDNER}/plan.json` },
    },
  })
  expect(fragen[0]?.system).toBe(AUFTRAG)
  expect(fragen[0]?.prompt).toContain('<festlegungen>\n- Der Lasttest kommt erst nach dem großen Umbau.\n- Die Gutscheine gehören zur Kasse, nicht zum Katalog.\n</festlegungen>')
  expect(fragen[0]?.prompt).not.toContain('<voriger-plan')
  expect([...dateien.keys()].filter(one => one.startsWith(`${ORDNER}/`)).map(one => one.slice(ORDNER.length + 1)).sort()).toEqual([
    'festlegungen.json',
    'lauf-2026-10-04T12-00-01-000Z.json',
    'letzte-eingabe.txt',
    'letzter.json',
    'plan.json',
  ])

  // Der zweite Lauf mit demselben Zugang: Er liest den Plan des ersten und vergleicht mit ihm.
  text = antwort({ chats: [], zeilen: ZWEITE, stamm: [...STAMM_MIT_GOAL, LAGER] })

  const zweiter = await laufe(zugang, aufruf)

  expect(fragen[1]?.prompt).toContain('<voriger-plan abgeleitet="2026-10-04">\nzeilen:\n{"id":"grundstock","bahn":"katalog"')
  expect(zweiter).toMatchObject({ ok: true, geladen: { aenderungen: AENDERUNGEN } })
  expect(JSON.parse(dateien.get(`${ORDNER}/plan.json`) ?? 'null')).toMatchObject({
    version: 2,
    festlegungen: ['Der Lasttest kommt erst nach dem großen Umbau.', 'Die Gutscheine gehören zur Kasse, nicht zum Katalog.'],
    aenderungen: AENDERUNGEN,
  })
})
