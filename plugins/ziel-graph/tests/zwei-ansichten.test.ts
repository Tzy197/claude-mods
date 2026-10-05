import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { graphDaten } from '../hooks/graph/zeilen'
import { detail, sicht } from '../hooks/karten/karten'

import { GOAL, KEINE, STAMM_MIT_GOAL, antwort, gelungen } from './shop'
import {
  BREIT,
  CHATS,
  GRAPH,
  JETZT,
  ORDNER,
  TAG,
  WURZEL,
  alleKnoten,
  baue,
  befehl,
  gespeichert,
  inhalt,
  legeChat,
  legeShop,
  leiteAb,
  mitBildern,
  mitPlan,
  schluesselVon,
} from './welt'
import type { Knoten, Zeichnung } from './welt'

// Ein Plan, zwei Ansichten: Die schmale `/graph` und die breite `/orchestrator` zeigen
// denselben Plan und dieselben Chats, und keine stört die andere.

// Was der Mod in den Zustand der Session schreibt, in der Reihenfolge der Schreiber: je
// Schlüssel der letzte Wert. Der Test hört nur zu; gespeichert wird weiter darunter.
const hoereZustand = (on: On): Map<string, unknown> => {
  const werte = new Map<string, unknown>()

  on('state.set', (_$, e, next) => {
    werte.set(e.key, e.value)

    return next(e)
  })

  return werte
}

const schluessel = async (ui: Zeichnung): Promise<string[]> =>
  alleKnoten((await ui.drawn()) as Knoten).map(one => String(one.props?.key ?? ''))

const arten = async (ui: Zeichnung): Promise<string[]> => alleKnoten((await ui.drawn()) as Knoten).map(one => one.type)

for (const von of ['graph', 'orchestrator'] as const) {
  test(`ein Lauf aus der Ansicht /${von}: Danach zeigen beide Ansichten denselben Plan`, async ($, on) => {
    const welt = baue(on)

    legeShop(welt)
    await befehl($, 'graph')
    await befehl($, 'orchestrator')

    const graph = await $.ui.mount({ ...GRAPH, surface: 'desktop' })
    const karten = await $.ui.mount({ ...BREIT, surface: 'desktop' })
    const [hier, dort] = von === 'graph' ? [graph, karten] : [karten, graph]

    expect(await mitBildern(graph)).toContain('Noch kein Plan für dieses Repo:')
    expect(await inhalt(karten)).toContain('Noch kein Plan für dieses Repo.')

    // Der Knopf der einen Ansicht startet den Lauf: Beide sagen, dass er läuft, und zählen mit.
    await hier.press({ key: 'neu' })
    expect(await mitBildern(graph)).toContain('Ableiten läuft …')
    expect(await inhalt(karten)).toContain('Ableiten läuft …')
    await welt.uhr.advance(10_000)
    expect(await mitBildern(graph)).toContain('Ableiten läuft … seit 10 s')
    expect(await inhalt(karten)).toContain('Ableiten läuft … seit 10 s')

    // Der Knopf der anderen startet keinen zweiten: ein Lauf, ein Plan.
    await dort.press({ key: 'neu' })
    expect(welt.toasts).toEqual(['Ein Lauf ist schon unterwegs.'])
    await welt.uhr.advance(13_000)
    expect(welt.fragen).toHaveLength(1)
    expect([...welt.dateien.keys()].filter(one => one.startsWith(`${ORDNER}/lauf-`))).toHaveLength(1)
    expect(welt.toasts).toEqual(['Ein Lauf ist schon unterwegs.', 'Ableiten fertig nach 23 s: 11 Bündel in 4 Strängen'])

    // Der eine Plan liegt gespeichert da, und beide Ansichten zeichnen ihn.
    const { plan } = gelungen(antwort())
    const imGraphen = await mitBildern(graph)
    const aufKarten = await inhalt(karten)

    expect(gespeichert(welt, `${ORDNER}/plan.json`).plan).toEqual(plan)

    for (const text of [imGraphen, aufKarten]) {
      expect(text).not.toContain('Ableiten läuft')
      expect(text).not.toContain('Noch kein Plan')
      expect(text).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
      expect(text).toContain('Abgeleitet gerade eben in 23 s aus 5 Dateien, 1 Chat und 30 Commits · claude-sonnet-5-5')

      // Jedes offene Bündel und jedes Zwischenziel des Plans, mit seinem Titel. Nur die zwei
      // Bündel des Dauerläufers „Betrieb“ nicht: Er ruht und steht als Ganzes da.
      for (const eines of plan.buendel.filter(one => one.zone !== 'hinter' && one.strang !== 'betrieb')) {
        expect(text).toContain(eines.titel)
      }

      for (const schritt of plan.stamm) {
        expect(text).toContain(schritt.titel)
      }
    }

    // Was hinter uns liegt, fasst jede Ansicht je Strang zusammen.
    expect(imGraphen).toContain('Katalog: 2 erledigt')
    expect(aufKarten).toContain('✓ 2 erledigt (Grundstock: 13 Produktseiten fertig · Bilder für Schuhe und Jacken)')
    // Derselbe Chat markiert in beiden dasselbe Bündel.
    expect((await graph.findAll({ type: 'Svg' })).map(one => String(one.props.alt))).toContain(
      'Entwurf Warenkorb-Regeln [Chat · wartet auf dich]',
    )
    expect(aufKarten).toContain('◉ Entwurf Warenkorb-Regeln [Chat wartet auf dich]')
    // Der Dauerläufer, der ruht, ist in beiden eine Zeile, und was er offen hat, zählt in keiner mit.
    expect(imGraphen).toContain('>Betrieb: ruht · 2 offen</text>')
    expect(aufKarten).toContain('· ruht · 2 offen (Ladezeit der Startseite senken · Umbau der Build-Skripte)')
    expect(imGraphen).toContain('4 Bündel jetzt möglich · 1 laufen · 1 warten auf dich')
    expect(aufKarten).toContain('4 Bündel jetzt möglich · 1 Chat · 1 wartet auf dich')

    // Dieselben Stränge ohne Ziel, und derselbe Auftrag dazu aus beiden Ansichten.
    expect(imGraphen).toContain('Ohne Ziel in GOAL.md: Kasse, Betrieb')
    expect(await schluesselVon(graph, 'ziel-')).toEqual(['ziel-kasse', 'ziel-betrieb'])
    expect(await schluesselVon(karten, 'ziel-')).toEqual(['ziel-kasse', 'ziel-betrieb'])
    await graph.press({ key: 'ziel-kasse' })
    await karten.press({ key: 'ziel-kasse' })
    expect(welt.gefuellt).toHaveLength(2)
    expect(welt.gefuellt[0]).toEqual(welt.gefuellt[1])

    // „Neu laden“ in der einen Ansicht liest GOAL.md neu: Beide zeigen das Ziel, das jetzt dort steht.
    welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL.replace('Ziel:\n', 'Ziel: Bestellen ohne Umweg\n'))
    await dort.press({ key: 'laden' })
    expect(await mitBildern(graph)).toContain('Ohne Ziel in GOAL.md: Betrieb')
    expect(await schluesselVon(graph, 'ziel-')).toEqual(['ziel-betrieb'])
    expect(await inhalt(karten)).toContain('Strang Kasse: Bestellen ohne Umweg')
    expect(await schluesselVon(karten, 'ziel-')).toEqual(['ziel-betrieb'])
    expect(welt.fragen).toHaveLength(1)

    await graph.unmount()
    await karten.unmount()
  })
}

test('was der Nutzer in der einen Ansicht einstellt, lässt die andere, wie sie ist', async ($, on) => {
  const zustand = hoereZustand(on)

  await mitPlan($, on)

  const graph = await $.ui.mount({ ...GRAPH, surface: 'desktop' })
  const karten = await $.ui.mount({ ...BREIT, surface: 'desktop' })
  const kartenVorher = await karten.drawn()

  // Im Graphen: ein Bündel aufklappen, alles aufklappen, die Übersicht wählen.
  const graphVorher = await graph.drawn()

  await graph.press({ key: 'auf-katalog-texte' })
  expect(await graph.drawn()).not.toEqual(graphVorher)
  expect(await karten.drawn()).toEqual(kartenVorher)
  await graph.press({ key: 'alles' })
  await graph.press({ key: 'ansicht-uebersicht' })
  expect(await karten.drawn()).toEqual(kartenVorher)

  // Auf den Karten: eine Karte wählen, die Farben festlegen.
  const graphDanach = await graph.drawn()

  await karten.press({ key: 'karte-gutscheine' })
  expect(await karten.drawn()).not.toEqual(kartenVorher)
  expect(await inhalt(karten)).toContain('– Restbetrag merken')
  expect(await graph.drawn()).toEqual(graphDanach)
  await karten.select({ key: 'farben', value: 'dunkel' })
  expect(await graph.drawn()).toEqual(graphDanach)
  // Die Karten sind jetzt dunkel; der Graph folgt weiter dem Farbschema und zeigt die Übersicht.
  expect((await karten.findAll({ type: 'Svg' })).map(one => String(one.props.source)).join('')).toContain('fill="#1d242b"')
  expect(String((await graph.findAll({ type: 'Svg' }))[0]?.props.source)).toContain('prefers-color-scheme: dark')
  expect(String((await graph.findAll({ type: 'Svg' }))[0]?.props.alt)).toContain('Ansicht Übersicht')

  // Jede Ansicht hat ihre eigene Einstellung im Zustand der Session.
  expect(zustand.get('graph')).toMatchObject({ ansicht: 'uebersicht' })
  expect(zustand.get('karten')).toEqual({ wahl: 'gutscheine', farben: 'dunkel' })

  await graph.unmount()
  await karten.unmount()
})

test('der Unterordner des Plans stört die Liste der Chats nicht', async ($, on) => {
  const welt = await mitPlan($, on)

  // Im Ordner des Repos liegen direkt die Stände der Chats, im Unterordner Plan und Lauf.
  expect(
    [...welt.dateien.keys()]
      .filter(one => one.startsWith(`${CHATS}/`))
      .map(one => one.slice(CHATS.length + 1))
      .sort(),
  ).toEqual([
    'kaputt.json',
    'plan/lauf-2026-10-04T12-00-00-000Z.json',
    'plan/letzte-eingabe.txt',
    'plan/letzter.json',
    'plan/plan.json',
    'sitzung-7.json',
    'sitzung-8.json',
    'sitzung-9.json',
  ])

  // Selbst eine Datei im Unterordner, die wie der Stand eines Chats aussieht, ist keiner.
  welt.dateien.set(
    `${ORDNER}/sitzung-x.json`,
    JSON.stringify({ id: 'sitzung-x', name: 'Im Unterordner', aktiv: true, branch: '', stand: '', naechster: '', frage: 'Bin ich ein Chat?', zeit: JETZT }),
  )

  const graph = await $.ui.mount({ ...GRAPH, surface: 'terminal' })

  await graph.press({ key: 'laden' })
  expect(await mitBildern(graph)).toContain('1 Chat, 1 wartet auf dich')
  expect(await mitBildern(graph)).toContain('● Warenkorb-Regeln')
  expect(await mitBildern(graph)).not.toContain('Im Unterordner')
  expect(welt.toasts).toEqual([])
  // Der Plan daneben bleibt lesbar.
  expect(await mitBildern(graph)).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')

  // Auch das Ableiten bekommt nur die echten Chats.
  await leiteAb(graph, welt)
  expect(welt.fragen[1]?.prompt).toContain('c1 · Warenkorb-Regeln')
  expect(welt.fragen[1]?.prompt).not.toContain('c2 ·')
  expect(welt.fragen[1]?.prompt).not.toContain('Im Unterordner')

  // Und ein Chat, der sich aufnimmt, schreibt seinen Stand weiter direkt in den Ordner.
  await graph.press({ key: 'auf' })
  expect(welt.dateien.has(`${CHATS}/sitzung-1.json`)).toBe(true)
  expect(await mitBildern(graph)).toContain('2 Chats, 1 wartet auf dich')
  expect(await mitBildern(graph)).toContain('○ Neuer Chat (dieser Chat)')

  await graph.unmount()
})

test('ein fertiger oder ausgeblendeter Chat markiert in keiner Ansicht mehr ein Bündel, zählt nicht als wartend und geht nicht ans Modell', async ($, on) => {
  const welt = await mitPlan($, on)
  const graph = await $.ui.mount({ ...GRAPH, surface: 'terminal' })
  const karten = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  // Der Chat am Warenkorb läuft und wartet: Beide Ansichten markieren sein Bündel.
  expect(await mitBildern(graph)).toContain('◉ Entwurf Warenkorb-Regeln [Chat · wartet auf dich] ▸')
  expect(await mitBildern(graph)).toContain('4 Bündel jetzt möglich · 1 laufen · 1 warten auf dich')
  expect(await inhalt(karten)).toContain('◉ Kasse · Entwurf Warenkorb-Regeln [Chat wartet auf dich]')
  expect(await inhalt(karten)).toContain('4 Bündel jetzt möglich · 1 Chat · 1 wartet auf dich')

  // Er wird fertig. Sein Bündel ist wieder frei, in beiden Ansichten, und niemand wartet mehr.
  legeChat(welt, 'sitzung-7', { name: 'Warenkorb-Regeln', stand: 'Die Regeln sind zusammengeführt.', fertig: true })
  await graph.press({ key: 'laden' })

  const fertigImGraphen = await mitBildern(graph)
  const fertigAufKarten = await inhalt(karten)

  expect(fertigImGraphen).toContain('0 Chats, keiner wartet auf dich')
  expect(fertigImGraphen).toContain('✓ Warenkorb-Regeln · fertig')
  expect(fertigImGraphen).toContain('○ Entwurf Warenkorb-Regeln ▸')
  expect(fertigImGraphen).not.toContain('[Chat')
  expect(fertigImGraphen).toContain('4 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
  expect(fertigAufKarten).toContain('  ○ Kasse · Entwurf Warenkorb-Regeln')
  expect(fertigAufKarten).not.toContain('[Chat')
  expect(fertigAufKarten).toContain('4 Bündel jetzt möglich · 0 Chats · keiner wartet auf dich')
  // Ohne Karte steht er auch nicht da: Er läuft nicht mehr.
  expect(fertigAufKarten).not.toContain('Chats ohne Karte')
  expect(await schluesselVon(karten, 'karte-chat--')).toEqual([])
  // Aufgeklappt nennt die Zeile des Bündels keinen Chat mehr.
  await graph.press({ key: 'auf-warenkorb' })
  expect(await mitBildern(graph)).not.toContain('Chat: Warenkorb-Regeln')

  // Das Ableiten bekommt ihn nicht als laufenden Chat: Es laufen keine.
  await leiteAb(graph, welt)
  expect(welt.fragen).toHaveLength(2)
  expect(welt.fragen[1]?.prompt).toContain('<chats>\nEs laufen keine Chats.\n</chats>')
  expect(welt.fragen[1]?.prompt).not.toContain('Warenkorb-Regeln · Branch')
  expect(gespeichert(welt, `${ORDNER}/plan.json`).fakten).toMatchObject({ chats: 0 })

  // Derselbe Chat, nicht fertig, aber seit 8 Tagen still und mit einer Frage: ausgeblendet.
  // Er markiert nichts, zählt nicht als wartend und meldet sich nicht.
  legeChat(welt, 'sitzung-7', { name: 'Warenkorb-Regeln', frage: 'Noch da?', zeit: JETZT - 8 * TAG })
  welt.toasts.length = 0
  await graph.press({ key: 'laden' })
  expect(await mitBildern(graph)).toContain('0 Chats, keiner wartet auf dich')
  expect(await mitBildern(graph)).toContain('2 fertige oder stille Chats ausgeblendet')
  expect(await mitBildern(graph)).not.toContain('[Chat')
  expect(await inhalt(karten)).not.toContain('[Chat')
  expect(await inhalt(karten)).toContain('· 0 Chats · keiner wartet auf dich')
  expect(welt.toasts).toEqual([])

  await graph.unmount()
  await karten.unmount()
})

test('eine Session, die nur /graph öffnet, zeichnet die breite Ansicht nie', async ($, on) => {
  const zustand = hoereZustand(on)
  const welt = baue(on)

  legeShop(welt)
  await $.session.start({ cwd: WURZEL, surface: 'desktop', isInteractive: true })
  expect(await befehl($, 'graph')).toBe('Ziel-Graph geöffnet. (Oberflächen: desktop)')

  const ui = await $.ui.mount({ ...GRAPH, surface: 'desktop' })

  // Alles, was die schmale Ansicht kann: ableiten, aufklappen, umschalten, laden, einen Auftrag legen.
  await leiteAb(ui, welt)
  await ui.press({ key: 'auf-warenkorb' })
  await ui.press({ key: 'ansicht-uebersicht' })
  await ui.press({ key: 'ansicht-schritte' })
  await ui.press({ key: 'laden' })
  await ui.press({ key: 'ziel-kasse' })
  await welt.uhr.advance(60_000)

  // Geöffnet hat der Mod nur seine schmale Leiste.
  expect(welt.geoeffnet.map(one => one.id)).toEqual(['ziel-graph'])
  // In ihr steht nichts von der breiten: keine Karte, keine Detail-Fläche, kein Feld zum
  // Antworten, obwohl am Warenkorb ein Chat auf den Nutzer wartet.
  expect((await schluessel(ui)).filter(one => one.startsWith('karte-') || ['detail-zusatz', 'antwort', 'antwort-senden', 'farben'].includes(one))).toEqual([])
  expect((await arten(ui)).filter(one => one === 'Input' || one === 'Select')).toEqual([])
  expect(await mitBildern(ui)).toContain('Chat: Warenkorb-Regeln · wartet auf dich')
  expect(await mitBildern(ui)).not.toContain('Versuch: von hier antworten')
  // Und was die breite Ansicht einstellt, hat nie jemand geschrieben.
  expect([...zustand.keys()].sort()).toEqual(['chats', 'geladen', 'graph', 'lauf', 'uhr'])
  expect(zustand.get('graph')).toEqual({ ansicht: 'schritte', offen: ['warenkorb'] })

  await ui.unmount()
})

test('eine Session, die nur /orchestrator öffnet, zeichnet die schmale Ansicht nie', async ($, on) => {
  const zustand = hoereZustand(on)
  const welt = baue(on)

  legeShop(welt)
  await $.session.start({ cwd: WURZEL, surface: 'desktop', isInteractive: true })
  expect(await befehl($, 'orchestrator')).toBe('Orchestrator geöffnet. Noch kein Plan für dieses Repo: „Neu ableiten“ in der Leiste leitet ihn ab.')

  const ui = await $.ui.mount({ ...BREIT, surface: 'desktop' })

  // Alles, was die breite Ansicht kann: ableiten, eine Karte wählen, laden, Farben, antworten.
  await leiteAb(ui, welt)
  await ui.press({ key: 'karte-gutscheine' })
  await ui.press({ key: 'auftrag' })
  await ui.press({ key: 'laden' })
  await ui.select({ key: 'farben', value: 'hell' })
  await ui.press({ key: 'karte-warenkorb' })
  await ui.input({ key: 'antwort', text: 'Ja, ab 50 Euro.' })
  await welt.uhr.advance(60_000)

  // Geöffnet hat der Mod nur seine breite Leiste.
  expect(welt.geoeffnet.map(one => one.id)).toEqual(['orchestrator'])
  // In ihr steht nichts von der schmalen: keine Liste der Chats mit ihren Knöpfen, kein
  // Umschalter, kein Pfeil-Knopf über einem Streifen.
  expect(
    (await schluessel(ui)).filter(one => one.startsWith('auf-') || ['auf', 'heraus', 'alles', 'ansicht-schritte', 'ansicht-uebersicht'].includes(one)),
  ).toEqual([])
  expect(alleKnoten((await ui.drawn()) as Knoten).some(one => one.props?.position !== undefined)).toBe(false)
  expect((await ui.findAll({ type: 'Svg' })).every(one => typeof one.props.height === 'number')).toBe(true)
  expect(await inhalt(ui)).not.toContain('Diesen Chat aufnehmen')
  expect(await inhalt(ui)).toContain('Zugestellt.')
  // Die Einstellung der schmalen Ansicht steht, wie ein neuer Plan sie hinterlässt: nichts aufgeklappt.
  expect(zustand.get('graph')).toEqual({ ansicht: 'schritte', offen: [] })
  expect(zustand.get('karten')).toEqual({ wahl: 'warenkorb', farben: 'hell' })

  await ui.unmount()
})

test('ein erreichtes Zwischenziel sagt in beiden Ansichten genau einmal „erreicht“, was auch immer das Modell dazu schreibt', () => {
  const mit = (id: string, meta: string) =>
    gelungen(antwort({ stamm: STAMM_MIT_GOAL.map(one => (one.id === id ? { ...one, meta } : one)) })).plan

  for (const [meta, erwartet] of [
    ['', 'erreicht'],
    // So kam es in einem echten Lauf zurück: Vorher stand „erreicht · erreicht“ da.
    ['erreicht', 'erreicht'],
    ['Erreicht.', 'erreicht'],
    ['bereits erreicht', 'erreicht'],
    ['seit September', 'erreicht · seit September'],
  ] as const) {
    const plan = mit('grundstock-steht', meta)
    const daten = graphDaten(plan, KEINE)

    expect(sicht(plan, KEINE, '').stamm[0]?.meta).toBe(erwartet)
    expect(daten.schritte.find(one => one.id === 'grundstock-steht')?.meta).toBe(erwartet)
    expect(daten.uebersicht.find(one => one.id === 'grundstock-steht')?.meta).toBe(erwartet)
    // Die Detail-Fläche sagt es ohnehin in einem eigenen Satz.
    expect(detail(plan, KEINE, 'grundstock-steht')?.zeilen[0]).toEqual({ art: 'leise', text: 'In GOAL.md als erreicht abgehakt.' })
  }

  // Ein offenes Zwischenziel behält seine Zeile, auch wenn sie das Wort nennt.
  const offen = mit('grosser-umbau', 'erreicht, sobald Katalog und Kasse fertig sind')

  expect(sicht(offen, KEINE, '').stamm[1]?.meta).toBe('erreicht, sobald Katalog und Kasse fertig sind')
  expect(graphDaten(offen, KEINE).schritte.find(one => one.id === 'grosser-umbau')?.meta).toBe('erreicht, sobald Katalog und Kasse fertig sind')
})

test('ein Zustand aus einer älteren Fassung des Mods zeichnet trotzdem: Was ihm fehlt, füllen die Anfangswerte', async ($, on) => {
  // So lag der Plan bis Version 0.3.0 im Zustand der Session, der ein Neuladen des Mod-Codes
  // übersteht: ohne Festlegungen und ohne Änderungen.
  const alt = {
    plan: gelungen(antwort()).plan,
    warnungen: [],
    fakten: null,
    goal: { vorhanden: true, leer: false, geaendert: false },
    gelesen: JETZT,
  }

  on('state.get', (_$, e, next) => (e.key === 'geladen' ? { value: { value: alt, version: 1 } } : next(e)))
  baue(on)

  for (const surface of ['desktop', 'terminal'] as const) {
    const graph = await $.ui.mount({ ...GRAPH, surface })
    const karten = await $.ui.mount({ ...BREIT, surface })

    expect(await mitBildern(graph)).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
    expect(await mitBildern(graph)).not.toContain('Seit dem letzten Ableiten')
    expect(await inhalt(karten)).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
    expect(await inhalt(karten)).toContain('Keine Festlegungen')
    expect(await karten.findAll({ type: 'Input', key: 'fest-eingabe' })).toHaveLength(1)

    await graph.unmount()
    await karten.unmount()
  }
})
