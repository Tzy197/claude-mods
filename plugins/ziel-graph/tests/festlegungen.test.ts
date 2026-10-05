import { expect, test } from 'claude-code/testing'

import { AUFTRAG } from '../hooks/plan/ableiten'
import { FEST_DATEI, fuegeZusammen, gleicheSaetze, legeFest, leseLokale, liesFestlegungen, nimmFestZurueck } from '../hooks/plan/festlegungen'
import { GOAL_FORMAT, istLeer, leseGoal, promptFestlegungen, promptGoalAnlegen, satzSchluessel } from '../hooks/plan/goal'
import { festAuftrag, festZeile } from '../hooks/plan/lesen'

import { GOAL, STAMM_OHNE_GOAL, antwort } from './shop'
import { BREIT, GRAPH, JETZT, ORDNER, VERBRAUCH, WURZEL, alleKnoten, baue, befehl, gespeichert, inhalt, legeShop, leiteAb, mitBildern, mitPlan } from './welt'
import type { Knoten } from './welt'

// Festlegungen: Sätze des Nutzers, die bei jedem Ableiten gewinnen. Wie GOAL.md sie nennt,
// wie eine neue in der breiten Ansicht entsteht, wo sie liegt und wann ihre lokale Kopie
// wegfällt. Alle Testdaten sind erfunden.

const GUTSCHEINE = 'Die Gutscheine gehören zur Kasse, nicht zum Katalog.'
const LASTTEST = 'Der Lasttest kommt erst nach dem großen Umbau.'
const DATEI = `${ORDNER}/${FEST_DATEI}`

// ---------- GOAL.md ----------

test('GOAL.md nennt die Festlegungen als Liste von Sätzen; der Abschnitt darf eigenwillig geschrieben sein', () => {
  const goal = leseGoal(`${GOAL}
## Festlegungen
Diese Sätze gelten bei jedem Ableiten:

- ${GUTSCHEINE}
- **Der Lasttest** kommt erst
  nach dem großen Umbau.
  - weil er sonst zweimal läuft
- [x] Rechnungen und Warenkorb bleiben getrennt
1. Die Suche bekommt keine eigenen Bilder
- noch offen
- <ein Satz, der bei jedem Ableiten des Plans gewinnt>
- die gutscheine gehören  zur Kasse, nicht zum Katalog

## Notizen
- Kein Satz
`)

  expect(goal.festlegungen).toEqual([
    GUTSCHEINE,
    LASTTEST,
    'Rechnungen und Warenkorb bleiben getrennt',
    'Die Suche bekommt keine eigenen Bilder',
  ])
  expect(goal.hinweise).toEqual([
    'GOAL.md nennt die Festlegung „die gutscheine gehören zur Kasse, nicht zum Katalog“ zweimal: Die zweite fällt weg.',
  ])
  // Alles andere der Datei liest sich wie ohne den Abschnitt.
  expect({ ...goal, festlegungen: [], hinweise: [] }).toEqual(leseGoal(GOAL))

  // Ohne Liste zählt jede Zeile; die Überschrift darf auch „Festlegung:“ heißen und tiefer stehen.
  expect(leseGoal(`### Festlegung:\n${GUTSCHEINE}\n${LASTTEST}\n`).festlegungen).toEqual([GUTSCHEINE, LASTTEST])
  // Eine Datei, die nur Festlegungen nennt, sagt noch nichts über Ziele: Sie gilt dafür weiter als leer.
  expect(istLeer(leseGoal(`## Festlegungen\n- ${GUTSCHEINE}\n`))).toBe(true)
  expect(leseGoal(`## Festlegungen\n- ${GUTSCHEINE}\n`).festlegungen).toEqual([GUTSCHEINE])
  // Kommentare und Code-Blöcke zählen auch hier nicht.
  expect(leseGoal(`## Festlegungen\n<!-- - ${GUTSCHEINE} -->\n\`\`\`\n- ${LASTTEST}\n\`\`\`\n`).festlegungen).toEqual([])

  // Das Format, das der Chat bekommt, kennt den Abschnitt.
  expect(GOAL_FORMAT.endsWith('## Festlegungen\n- <ein Satz, der bei jedem Ableiten des Plans gewinnt>')).toBe(true)
  expect(promptGoalAnlegen()).toContain('Unter „Festlegungen“ stehen Sätze von mir, die bei jedem Ableiten des Plans gelten.')
})

test('zwei Sätze sind dieselbe Festlegung, wenn nur Leerraum, Schreibung oder der Punkt am Ende sie trennt', () => {
  expect(satzSchluessel(GUTSCHEINE)).toBe('die gutscheine gehören zur kasse, nicht zum katalog')

  for (const gleich of [
    'Die Gutscheine gehören zur Kasse, nicht zum Katalog',
    '  die  GUTSCHEINE gehören zur Kasse,\n nicht zum Katalog. ',
    'Die Gutscheine gehören zur Kasse, nicht zum Katalog!',
    '**Die Gutscheine** gehören zur `Kasse`, nicht zum Katalog.',
  ]) {
    expect(satzSchluessel(gleich)).toBe(satzSchluessel(GUTSCHEINE))
  }

  expect(satzSchluessel('Die Gutscheine gehören zum Katalog.')).not.toBe(satzSchluessel(GUTSCHEINE))
  expect(gleicheSaetze([GUTSCHEINE, LASTTEST], ['der lasttest kommt erst nach dem großen umbau', GUTSCHEINE])).toBe(true)
  expect(gleicheSaetze([GUTSCHEINE], [GUTSCHEINE, LASTTEST])).toBe(false)
  expect(gleicheSaetze([], [])).toBe(true)
})

// ---------- Die lokale Datei ----------

test('lokale Festlegungen: Die Datei wird nachsichtig gelesen, und was GOAL.md schon nennt, fällt aus ihr heraus', async () => {
  const dateien = new Map<string, string>()
  const zugang = {
    lies: async (pfad: string): Promise<string> => {
      const text = dateien.get(pfad)

      if (text === undefined) {
        throw new Error(`ENOENT: ${pfad}`)
      }

      return text
    },
    schreibe: async (pfad: string, text: string): Promise<void> => {
      dateien.set(pfad, text)
    },
  }
  const lokale = (): unknown => JSON.parse(dateien.get(`/plan/${FEST_DATEI}`) ?? 'null')

  // Ohne Datei gibt es keine, und das Lesen schreibt nichts.
  expect(await liesFestlegungen(zugang, '/plan', [GUTSCHEINE])).toEqual([{ satz: GUTSCHEINE, ort: 'goal' }])
  expect(dateien.size).toBe(0)

  for (const kaputt of [null, '', 'kein JSON', '[]', '{"festlegungen": "viele"}', '{"festlegungen": [7, {"satz": " "}, {"zeit": 3}]}']) {
    expect(leseLokale(kaputt)).toEqual([])
  }

  expect(leseLokale('{"festlegungen": [{"satz": "Erst die Kasse."}, {"satz": "Dann die Suche.", "zeit": 5}]}')).toEqual([
    { satz: 'Erst die Kasse.', zeit: 0 },
    { satz: 'Dann die Suche.', zeit: 5 },
  ])

  // Aufnehmen: ein Satz in einer Zeile; leer, zu lang, „noch offen“ und doppelt geht nicht.
  expect(await legeFest(zugang, '/plan', [], `  ${GUTSCHEINE.replace(', ', ',\n\t')} `, 100)).toEqual({ ok: true })
  expect(lokale()).toEqual({ version: 1, festlegungen: [{ satz: GUTSCHEINE, zeit: 100 }] })
  expect(dateien.get(`/plan/${FEST_DATEI}`)).toBe(JSON.stringify({ version: 1, festlegungen: [{ satz: GUTSCHEINE, zeit: 100 }] }, null, 2))

  for (const [eingabe, grund] of [
    ['', 'Die Festlegung ist leer.'],
    [' \n ', 'Die Festlegung ist leer.'],
    ['...', 'Die Festlegung ist leer.'],
    ['noch offen', 'Die Festlegung ist leer.'],
    ['x'.repeat(301), 'Die Festlegung ist zu lang: Sie ist ein Satz von höchstens 300 Zeichen.'],
    ['die gutscheine gehören zur kasse, nicht zum katalog', 'Diese Festlegung gibt es schon.'],
    ['der lasttest kommt erst nach dem großen umbau', 'Diese Festlegung steht schon in GOAL.md.'],
  ] as const) {
    expect(await legeFest(zugang, '/plan', [LASTTEST], eingabe, 200)).toEqual({ ok: false, grund })
  }

  expect(await legeFest(zugang, '/plan', [LASTTEST], 'Rechnungen und Warenkorb bleiben getrennt', 300)).toEqual({ ok: true })

  // Zusammen: erst GOAL.md, dann die lokalen.
  expect(await liesFestlegungen(zugang, '/plan', [LASTTEST])).toEqual([
    { satz: LASTTEST, ort: 'goal' },
    { satz: GUTSCHEINE, ort: 'lokal' },
    { satz: 'Rechnungen und Warenkorb bleiben getrennt', ort: 'lokal' },
  ])

  // Steht ein lokaler Satz inzwischen in GOAL.md, fällt seine Kopie aus der Datei, auch wenn
  // der Chat ihn dort eine Spur anders geschrieben hat.
  const vorher = dateien.get(`/plan/${FEST_DATEI}`)

  expect(await liesFestlegungen(zugang, '/plan', [LASTTEST, 'die Gutscheine gehören zur Kasse, nicht zum Katalog'])).toEqual([
    { satz: LASTTEST, ort: 'goal' },
    { satz: 'die Gutscheine gehören zur Kasse, nicht zum Katalog', ort: 'goal' },
    { satz: 'Rechnungen und Warenkorb bleiben getrennt', ort: 'lokal' },
  ])
  expect(dateien.get(`/plan/${FEST_DATEI}`)).not.toBe(vorher)
  expect(lokale()).toEqual({ version: 1, festlegungen: [{ satz: 'Rechnungen und Warenkorb bleiben getrennt', zeit: 300 }] })
  // Streicht der Nutzer ihn später wieder aus GOAL.md, kommt er nicht von selbst zurück.
  expect(await liesFestlegungen(zugang, '/plan', [])).toEqual([{ satz: 'Rechnungen und Warenkorb bleiben getrennt', ort: 'lokal' }])

  // Zurücknehmen trifft den Satz auch in anderer Schreibweise.
  await nimmFestZurueck(zugang, '/plan', [], 'rechnungen und warenkorb bleiben getrennt.')
  expect(lokale()).toEqual({ version: 1, festlegungen: [] })

  // Lässt sich die Datei nicht schreiben, stimmt die Liste trotzdem.
  dateien.set(`/plan/${FEST_DATEI}`, JSON.stringify({ festlegungen: [{ satz: GUTSCHEINE }, { satz: LASTTEST }, { satz: GUTSCHEINE }] }))

  const nurLesen = { lies: zugang.lies, schreibe: async (): Promise<void> => Promise.reject(new Error('EROFS')) }

  expect(await liesFestlegungen(nurLesen, '/plan', [LASTTEST])).toEqual([
    { satz: LASTTEST, ort: 'goal' },
    { satz: GUTSCHEINE, ort: 'lokal' },
  ])
  expect(fuegeZusammen([], [{ satz: GUTSCHEINE, zeit: 1 }, { satz: GUTSCHEINE.toLowerCase(), zeit: 2 }])).toEqual([{ satz: GUTSCHEINE, ort: 'lokal' }])
})

test('die Zeile über die Festlegungen und der Auftrag, sie in GOAL.md einzutragen', () => {
  const goal = { satz: LASTTEST, ort: 'goal' } as const
  const lokal = { satz: GUTSCHEINE, ort: 'lokal' } as const

  expect(festZeile([])).toBe('Keine Festlegungen')
  expect(festZeile([goal])).toBe('1 Festlegung, sie steht in GOAL.md')
  expect(festZeile([goal, goal])).toBe('2 Festlegungen, alle in GOAL.md')
  expect(festZeile([lokal])).toBe('1 Festlegung, 1 noch nicht in GOAL.md')
  expect(festZeile([goal, goal, lokal])).toBe('3 Festlegungen, 1 noch nicht in GOAL.md')

  expect(promptFestlegungen([GUTSCHEINE], true)).toBe(
    [
      `Trag diese Festlegung in GOAL.md ein, unter „## Festlegungen“, je Satz ein Listenpunkt und wörtlich:\n\n- ${GUTSCHEINE}`,
      'Gibt es den Abschnitt „## Festlegungen“ noch nicht, leg ihn am Ende der Datei an. Was dort schon steht, bleibt stehen. Ändere sonst nichts an der Datei.',
      'Das sind Sätze von mir, die bei jedem Ableiten des Plans gelten: Der Ziel-Graph liest sie aus GOAL.md.',
    ].join('\n\n'),
  )
  expect(promptFestlegungen([GUTSCHEINE, LASTTEST], false)).toContain(`Trag diese Festlegungen in GOAL.md ein`)
  expect(promptFestlegungen([GUTSCHEINE, LASTTEST], false)).toContain(`- ${GUTSCHEINE}\n- ${LASTTEST}`)
  expect(promptFestlegungen([GUTSCHEINE, LASTTEST], false)).toContain(`GOAL.md gibt es noch nicht. Leg sie in der Wurzel des Repos an, in diesem Format, und lass offen, was noch nicht klar ist:\n\n${GOAL_FORMAT}`)
  // Der Auftrag nennt nur, was erst lokal liegt; ohne lokale gibt es nichts zu legen.
  expect(festAuftrag([goal, lokal], true)).toEqual({ text: promptFestlegungen([GUTSCHEINE], true), was: 'Der Auftrag „Festlegungen eintragen“' })
  expect(festAuftrag([goal], true).text).toBe(null)
})

// ---------- In den zwei Ansichten ----------

for (const surface of ['desktop', 'terminal', 'vscode'] as const) {
  test(`${surface}: eine Festlegung eingeben: Sie liegt erst lokal, geht beim nächsten Ableiten ans Modell und fällt weg, sobald sie in GOAL.md steht`, async ($, on) => {
    const welt = await mitPlan($, on)
    const ui = await $.ui.mount({ ...BREIT, surface })
    const zeit = JETZT + 23_000

    // Das Feld steht immer da, an keine Karte gebunden. Erst gibt es keine Festlegung.
    expect(await inhalt(ui)).toContain('Keine Festlegungen')
    expect(await inhalt(ui)).toContain('Eine Festlegung ist ein Satz von dir, der bei jedem Ableiten gewinnt')
    expect(await inhalt(ui)).not.toContain('Festlegungen (')
    expect(await ui.findAll({ type: 'Input', key: 'fest-eingabe' })).toHaveLength(1)
    expect(await ui.findAll({ key: 'festlegen' })).toHaveLength(1)
    expect(await ui.findAll({ key: 'fest-eintragen' })).toHaveLength(0)
    await ui.press({ key: 'karte-endziel' })
    expect(await ui.findAll({ type: 'Input', key: 'fest-eingabe' })).toHaveLength(1)

    // Es steht gleich unter „Neu ableiten“ und „Neu laden“, über den Karten.
    const folge = alleKnoten((await ui.drawn()) as Knoten).map(one => String(one.props?.key ?? ''))

    expect(folge.indexOf('laden') < folge.indexOf('fest-eingabe')).toBe(true)
    expect(folge.indexOf('fest-eingabe') < folge.indexOf('festlegen')).toBe(true)
    expect(folge.indexOf('festlegen') < folge.findIndex(one => one.startsWith('karte-'))).toBe(true)

    // Ein leeres Feld legt nichts fest.
    await ui.press({ key: 'festlegen' })
    expect(welt.toasts).toEqual(['Die Festlegung ist leer.'])
    expect(welt.dateien.has(DATEI)).toBe(false)

    // Tippen und der Knopf: Der Satz liegt lokal, im Ordner des Plans, und das Feld ist wieder leer.
    await ui.input({ key: 'fest-eingabe', text: `  ${GUTSCHEINE.replace(', ', ',\n')} `, kind: 'change' })
    expect(welt.dateien.has(DATEI)).toBe(false)
    await ui.press({ key: 'festlegen' })
    expect(gespeichert(welt, DATEI)).toEqual({ version: 1, festlegungen: [{ satz: GUTSCHEINE, zeit }] })
    expect(welt.toasts[1]).toBe('Festgelegt. Der Satz gilt ab dem nächsten Ableiten.')
    expect((await ui.findAll({ type: 'Input', key: 'fest-eingabe' }))[0]?.props.value).toBe('')
    // GOAL.md schreibt der Mod nie, und ein Modell-Aufruf war das nicht.
    expect(welt.geschrieben.has(`${WURZEL}/GOAL.md`)).toBe(false)
    expect(welt.fragen).toHaveLength(1)

    const eine = await inhalt(ui)

    expect(eine).toContain('1 Festlegung, 1 noch nicht in GOAL.md')
    expect(eine).toContain('Die Festlegungen sind andere als beim letzten Ableiten: „Neu ableiten“ wendet sie an.')
    expect(eine).toContain('Festlegungen (1)')
    expect(eine).toContain(`– ${GUTSCHEINE} (noch nicht in GOAL.md)`)
    expect(eine).not.toContain('Eine Festlegung ist ein Satz von dir')

    // Enter im Feld legt auch fest. Derselbe Satz ein zweites Mal nicht: Er bleibt im Feld stehen.
    await ui.input({ key: 'fest-eingabe', text: LASTTEST })
    await ui.input({ key: 'fest-eingabe', text: 'die gutscheine  gehören zur Kasse, nicht zum Katalog' })
    expect(welt.toasts.slice(2)).toEqual(['Festgelegt. Der Satz gilt ab dem nächsten Ableiten.', 'Diese Festlegung gibt es schon.'])
    expect(gespeichert(welt, DATEI)).toEqual({ version: 1, festlegungen: [{ satz: GUTSCHEINE, zeit }, { satz: LASTTEST, zeit }] })
    expect(await inhalt(ui)).toContain('2 Festlegungen, 2 noch nicht in GOAL.md')

    // Eine lokale Festlegung lässt sich zurücknehmen.
    await ui.press({ key: 'fest-weg-1' })
    expect(welt.toasts.at(-1)).toBe('Festlegung entfernt.')
    expect(gespeichert(welt, DATEI)).toEqual({ version: 1, festlegungen: [{ satz: GUTSCHEINE, zeit }] })
    expect(await inhalt(ui)).not.toContain(LASTTEST)
    await ui.input({ key: 'fest-eingabe', text: LASTTEST })

    // Der Knopf legt den Auftrag ins Eingabefeld des Chats: Der trägt sie in GOAL.md ein.
    await ui.press({ key: 'fest-eintragen' })
    expect(welt.gefuellt).toEqual([{ text: promptFestlegungen([GUTSCHEINE, LASTTEST], true), mode: 'replace' }])
    expect(welt.toasts.at(-1)).toBe('Der Auftrag „Festlegungen eintragen“ liegt im Eingabefeld. Prüfen und abschicken.')
    expect(welt.prompts).toHaveLength(0)

    // Das nächste Ableiten: Das Modell bekommt beide, gleich nach GOAL.md, unter demselben Auftrag.
    await leiteAb(ui, welt)

    const eingabe = welt.fragen[1]?.prompt ?? ''

    expect(welt.fragen[1]?.system).toBe(AUFTRAG)
    expect(eingabe).toContain(`</goal-gelesen>\n\n<festlegungen>\n- ${GUTSCHEINE}\n- ${LASTTEST}\n</festlegungen>\n\n<doku datei="README.md">`)
    expect(welt.fragen[0]?.prompt).not.toContain('<festlegungen>')
    expect(gespeichert(welt, `${ORDNER}/plan.json`).festlegungen).toEqual([GUTSCHEINE, LASTTEST])
    expect(gespeichert(welt, `${ORDNER}/letzter.json`)).toMatchObject({
      quellen: { festlegungen: [{ satz: GUTSCHEINE, ort: 'lokal' }, { satz: LASTTEST, ort: 'lokal' }] },
    })
    expect(await inhalt(ui)).toContain('2 Festlegungen, 2 noch nicht in GOAL.md')
    expect(await inhalt(ui)).not.toContain('Die Festlegungen sind andere als beim letzten Ableiten')

    // Der Chat hat die erste in GOAL.md eingetragen, eine Spur anders geschrieben: „Neu laden“
    // zeigt sie von dort, und ihre lokale Kopie ist weg.
    welt.dateien.set(`${WURZEL}/GOAL.md`, `${GOAL}\n## Festlegungen\n- die Gutscheine gehören zur Kasse,\n  nicht zum Katalog\n`)
    await ui.press({ key: 'laden' })

    const halb = await inhalt(ui)

    expect(halb).toContain('2 Festlegungen, 1 noch nicht in GOAL.md')
    expect(halb).toContain('– die Gutscheine gehören zur Kasse, nicht zum Katalog')
    expect(halb).not.toContain('die Gutscheine gehören zur Kasse, nicht zum Katalog (noch nicht in GOAL.md)')
    expect(halb).toContain(`– ${LASTTEST} (noch nicht in GOAL.md)`)
    expect(gespeichert(welt, DATEI)).toEqual({ version: 1, festlegungen: [{ satz: LASTTEST, zeit }] })
    // Es sind dieselben Sätze wie beim Ableiten: nichts, was ein neuer Lauf erst anwenden müsste.
    expect(halb).not.toContain('Die Festlegungen sind andere als beim letzten Ableiten')
    expect(await ui.findAll({ key: 'fest-weg-0' })).toHaveLength(0)
    expect(await ui.findAll({ key: 'fest-weg-1' })).toHaveLength(1)

    // Streicht der Nutzer den Satz wieder aus GOAL.md, kommt er nicht von selbst zurück.
    welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL)
    await ui.press({ key: 'laden' })
    expect(await inhalt(ui)).toContain('1 Festlegung, 1 noch nicht in GOAL.md')
    expect(await inhalt(ui)).toContain('Die Festlegungen sind andere als beim letzten Ableiten')
    expect(welt.fragen).toHaveLength(2)

    await ui.unmount()
  })
}

test('eine Festlegung, die während eines Laufs dazukommt, gilt erst für den nächsten, und die Fläche sagt das', async ($, on) => {
  const welt = await mitPlan($, on)
  const ui = await $.ui.mount({ ...BREIT, surface: 'desktop' })

  await ui.press({ key: 'neu' })
  await welt.uhr.advance(10_000)
  expect(welt.fragen).toHaveLength(2)
  expect(await inhalt(ui)).toContain('Ableiten läuft … seit 10 s')

  // Das Feld bleibt während des Laufs bedienbar; der Lauf selbst kennt den Satz nicht mehr.
  await ui.input({ key: 'fest-eingabe', text: GUTSCHEINE })
  expect(await inhalt(ui)).toContain('1 Festlegung, 1 noch nicht in GOAL.md')
  await welt.uhr.advance(13_000)

  expect(welt.fragen[1]?.prompt).not.toContain('<festlegungen>')
  expect(gespeichert(welt, `${ORDNER}/plan.json`).festlegungen).toEqual([])
  expect(await inhalt(ui)).not.toContain('Ableiten läuft')
  expect(await inhalt(ui)).toContain('1 Festlegung, 1 noch nicht in GOAL.md')
  expect(await inhalt(ui)).toContain(`– ${GUTSCHEINE} (noch nicht in GOAL.md)`)
  expect(await inhalt(ui)).toContain('Die Festlegungen sind andere als beim letzten Ableiten: „Neu ableiten“ wendet sie an.')

  // Der nächste Lauf wendet ihn an.
  await leiteAb(ui, welt)
  expect(welt.fragen[2]?.prompt).toContain(`<festlegungen>\n- ${GUTSCHEINE}\n</festlegungen>`)
  expect(await inhalt(ui)).not.toContain('Die Festlegungen sind andere als beim letzten Ableiten')

  await ui.unmount()
})

test('beide Ansichten sagen, wie viele Festlegungen es gibt und wie viele noch nicht in GOAL.md stehen', async ($, on) => {
  const welt = baue(on)

  legeShop(welt, `${GOAL}\n## Festlegungen\n- ${LASTTEST}\n`)
  welt.dateien.set(DATEI, JSON.stringify({ version: 1, festlegungen: [{ satz: GUTSCHEINE, zeit: JETZT }] }))
  await befehl($, 'graph')

  const graph = await $.ui.mount({ ...GRAPH, surface: 'desktop' })
  const karten = await $.ui.mount({ ...BREIT, surface: 'desktop' })

  // Schon ohne Plan, und ohne dass das Laden etwas schreibt.
  expect(await mitBildern(graph)).toContain('2 Festlegungen, 1 noch nicht in GOAL.md. Sie stehen in der Ansicht /orchestrator.')
  expect(await inhalt(karten)).toContain('2 Festlegungen, 1 noch nicht in GOAL.md')
  expect(await inhalt(karten)).toContain(`– ${LASTTEST}`)
  expect(await inhalt(karten)).toContain(`– ${GUTSCHEINE} (noch nicht in GOAL.md)`)
  expect(await inhalt(karten)).not.toContain('Die Festlegungen sind andere als beim letzten Ableiten')
  expect(welt.geschrieben.size).toBe(0)
  // Was in GOAL.md steht, streicht nur der Chat: Einen Knopf zum Entfernen hat nur die lokale.
  expect((await karten.findAll({ type: 'Button' })).map(one => String(one.props.key)).filter(one => one.startsWith('fest'))).toEqual([
    'festlegen',
    'fest-eintragen',
    'fest-weg-1',
  ])
  // Die schmale Ansicht hat dafür weder Feld noch Knopf.
  expect((await graph.findAll({ type: 'Button' })).map(one => String(one.props.key)).filter(one => one.startsWith('fest'))).toEqual([])
  expect(await graph.findAll({ type: 'Input' })).toHaveLength(0)

  // Das Modell bekommt beide: erst die aus GOAL.md, dann die lokale.
  await leiteAb(graph, welt)
  expect(welt.fragen[0]?.prompt).toContain(`</goal-gelesen>\n\n<festlegungen>\n- ${LASTTEST}\n- ${GUTSCHEINE}\n</festlegungen>\n\n<doku `)
  expect(await mitBildern(graph)).toContain('2 Festlegungen, 1 noch nicht in GOAL.md. Sie stehen in der Ansicht /orchestrator.')

  // Der Auftrag an den Chat nennt nur die lokale.
  await karten.press({ key: 'fest-eintragen' })
  expect(welt.gefuellt).toEqual([{ text: promptFestlegungen([GUTSCHEINE], true), mode: 'replace' }])

  // Steht alles in GOAL.md, sagt die Zeile das, und der Knopf dafür ist weg.
  welt.dateien.set(`${WURZEL}/GOAL.md`, `${GOAL}\n## Festlegungen\n- ${LASTTEST}\n- ${GUTSCHEINE}\n`)
  await karten.press({ key: 'laden' })
  expect(await mitBildern(graph)).toContain('2 Festlegungen, alle in GOAL.md. Sie stehen in der Ansicht /orchestrator.')
  expect(await inhalt(karten)).toContain('2 Festlegungen, alle in GOAL.md')
  expect(await karten.findAll({ key: 'fest-eintragen' })).toHaveLength(0)
  expect(gespeichert(welt, DATEI)).toEqual({ version: 1, festlegungen: [] })

  // Ohne Festlegung sagt die schmale Ansicht dazu nichts.
  welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL)
  await graph.press({ key: 'laden' })
  expect(await mitBildern(graph)).not.toContain('Festlegung')
  expect(await inhalt(karten)).toContain('Keine Festlegungen')

  await graph.unmount()
  await karten.unmount()
})

test('mobile zeichnet kein Feld für eine Festlegung; ohne GOAL.md gelten die lokalen trotzdem', async ($, on) => {
  const welt = baue(on, { modell: { isAnswered: true, text: antwort({ stamm: STAMM_OHNE_GOAL }), usage: VERBRAUCH } })

  legeShop(welt, null)
  welt.dateien.set(DATEI, JSON.stringify({ version: 1, festlegungen: [{ satz: GUTSCHEINE, zeit: JETZT }] }))
  await befehl($, 'orchestrator')

  const handy = await $.ui.mount({ ...BREIT, surface: 'mobile' })

  expect(await inhalt(handy)).toContain('1 Festlegung, 1 noch nicht in GOAL.md')
  expect(await inhalt(handy)).toContain('Diese Oberfläche zeichnet kein Eingabefeld: Eine neue Festlegung gibst du am Rechner ein.')
  expect(await handy.findAll({ key: 'festlegen' })).toHaveLength(0)
  expect(await handy.findAll({ key: 'fest-weg-0' })).toHaveLength(1)

  // Ohne GOAL.md stehen die Festlegungen in der Eingabe ganz vorn, und der Auftrag an den
  // Chat sagt, dass die Datei erst anzulegen ist.
  await leiteAb(handy, welt)
  expect(welt.fragen[0]?.prompt.startsWith(`Leite den Plan für dieses Repo ab. Heute ist der 2026-10-04.\n\n<festlegungen>\n- ${GUTSCHEINE}\n</festlegungen>\n\n<doku `)).toBe(true)
  await handy.press({ key: 'fest-eintragen' })
  expect(welt.gefuellt).toEqual([{ text: promptFestlegungen([GUTSCHEINE], false), mode: 'replace' }])
  expect(welt.gefuellt[0]?.text).toContain('GOAL.md gibt es noch nicht.')
  await handy.unmount()

  // Lässt sich die Datei nicht schreiben, sagt die Leiste das, und der Satz bleibt im Feld.
  const ui = await $.ui.mount({ ...BREIT, surface: 'desktop' })

  welt.istNurLesbar = true
  await ui.input({ key: 'fest-eingabe', text: LASTTEST })
  expect(welt.toasts.at(-1)).toBe('Die Festlegung ließ sich nicht speichern.')
  expect(welt.meldungen.at(-1)).toContain('Festlegung nicht gespeichert:')
  expect(await inhalt(ui)).toContain('1 Festlegung, 1 noch nicht in GOAL.md')
  await ui.unmount()
})
