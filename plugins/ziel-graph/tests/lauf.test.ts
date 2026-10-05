import { expect, test } from 'claude-code/testing'

import { GOAL, antwort, antwortOhneGoal } from './shop'
import {
  GRAPH,
  ORDNER,
  SCHLUESSEL,
  SURFACES,
  VERBRAUCH,
  WURZEL,
  baue,
  gespeichert,
  legeShop,
  leiteAb,
  mitBildern,
} from './welt'

// Der Lauf, der den Plan ableitet, wenn etwas schiefgeht: gestartet aus der schmalen
// Ansicht. Wie er gelingt und was er speichert, prüft orchestrator.test.ts aus der breiten.

for (const surface of SURFACES) {
  test(`${surface}: Scheitert der Modell-Aufruf, steht der Grund da, und der vorige Graph bleibt`, async ($, on) => {
    const welt = baue(on)

    legeShop(welt, null)

    const ui = await $.ui.mount({ ...GRAPH, surface })

    // Schon der erste Lauf scheitert: Es gibt noch keinen Graphen, nur den Grund.
    welt.modell = { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: { ...VERBRAUCH, output_tokens: 0 } }
    await leiteAb(ui, welt)

    const ohne = await mitBildern(ui)

    expect(ohne).toContain('Ableiten fehlgeschlagen: Das Modell hat nicht geantwortet: API-Fehler 529 (overloaded).')
    expect(ohne).toContain(`Der Lauf liegt in ${ORDNER}/letzter.json.`)
    expect(ohne).not.toContain('Darunter steht weiter der vorige Plan.')
    expect(ohne).not.toContain('Endziel')
    expect(await ui.findAll({ key: 'neu' })).toHaveLength(1)
    expect(welt.toasts).toHaveLength(1)
    expect(welt.toasts[0]).toContain('Ableiten fehlgeschlagen: Das Modell hat nicht geantwortet: API-Fehler 529 (overloaded).')
    expect(gespeichert(welt, `${ORDNER}/letzter.json`)).toMatchObject({
      ergebnis: 'gescheitert',
      grund: 'Das Modell hat nicht geantwortet: API-Fehler 529 (overloaded).',
      antwort: null,
      plan: null,
      dauerMs: 23_000,
    })
    // Ein gescheiterter Lauf hinterlässt keinen Plan.
    expect(welt.dateien.has(`${ORDNER}/plan.json`)).toBe(false)

    // Der zweite Lauf gelingt.
    welt.modell = { isAnswered: true, text: antwortOhneGoal(), usage: VERBRAUCH }
    await leiteAb(ui, welt)
    expect(await mitBildern(ui)).toContain('Endziel (vermutet): der Shop im Betrieb')
    expect(await mitBildern(ui)).not.toContain('Ableiten fehlgeschlagen')

    const plan = welt.dateien.get(`${ORDNER}/plan.json`)

    // Der dritte liefert kein JSON: Der Grund steht da, der Graph des zweiten bleibt.
    welt.modell = { isAnswered: true, text: 'Dazu kann ich leider nichts sagen.', usage: VERBRAUCH }
    await leiteAb(ui, welt)

    const mit = await mitBildern(ui)

    expect(mit).toContain('Ableiten fehlgeschlagen: In der Antwort des Modells steht kein JSON-Objekt.')
    expect(mit).toContain('Darunter steht weiter der vorige Plan.')
    expect(mit).toContain('Endziel (vermutet): der Shop im Betrieb')
    expect(mit).toContain('Entwurf Warenkorb-Regeln')
    expect(mit).toContain('in 23 s aus 5 Dateien, 1 Chat und 30 Commits')
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(surface === 'terminal' ? 0 : 15)
    // Auch der gescheiterte Lauf liegt da, mit der rohen Antwort; der Plan bleibt der letzte gelungene.
    expect(gespeichert(welt, `${ORDNER}/letzter.json`)).toMatchObject({
      ergebnis: 'gescheitert',
      grund: 'In der Antwort des Modells steht kein JSON-Objekt.',
      antwort: 'Dazu kann ich leider nichts sagen.',
      plan: null,
    })
    expect([...welt.dateien.keys()].filter(one => one.startsWith(`${ORDNER}/lauf-`))).toHaveLength(3)
    expect(welt.dateien.get(`${ORDNER}/plan.json`)).toBe(plan)

    await ui.unmount()
  })
}

test('die anderen Arten zu scheitern: ohne Text, Zeitgrenze, abgeschnitten, gesperrtes Modell', async ($, on) => {
  const welt = baue(on)

  legeShop(welt)

  const ui = await $.ui.mount({ ...GRAPH, surface: 'desktop' })

  welt.modell = { isAnswered: false, reason: 'empty-reply', usage: VERBRAUCH }
  await leiteAb(ui, welt)
  expect(await mitBildern(ui)).toContain('Ableiten fehlgeschlagen: Das Modell hat ohne Text geantwortet.')

  welt.modell = { isAnswered: false, reason: 'aborted', usage: VERBRAUCH }
  await leiteAb(ui, welt)
  expect(await mitBildern(ui)).toContain('Ableiten fehlgeschlagen: Der Modell-Aufruf wurde abgebrochen, spätestens nach 240 s.')

  welt.modell = { isAnswered: true, text: antwort().slice(0, 900), usage: { ...VERBRAUCH, output_tokens: 16_000 } }
  await leiteAb(ui, welt)
  expect(await mitBildern(ui)).toContain(
    'In der Antwort des Modells steht kein JSON-Objekt. Sie endet an der Grenze von 16000 Tokens und ist wohl abgeschnitten.',
  )

  // Einen Aufruf, den die Engine nicht sendet, wirft sie zurück: Auch das ist nur ein Grund.
  welt.istGesperrt = true
  await leiteAb(ui, welt)
  expect(await mitBildern(ui)).toContain('Ableiten fehlgeschlagen: Der Modell-Aufruf wurde nicht angenommen:')
  expect(await mitBildern(ui)).toContain('Das Modell ist in dieser Umgebung gesperrt.')
  expect(gespeichert(welt, `${ORDNER}/letzter.json`)).toMatchObject({ ergebnis: 'gescheitert', usage: null, dauerMs: 0 })

  // Danach geht es weiter: Kein Lauf bleibt hängen.
  welt.istGesperrt = false
  welt.modell = { isAnswered: true, text: antwort(), usage: VERBRAUCH }
  await leiteAb(ui, welt)
  expect(await mitBildern(ui)).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
  expect(await mitBildern(ui)).not.toContain('Ableiten fehlgeschlagen')
  expect(welt.fragen).toHaveLength(5)

  await ui.unmount()
})

test('ein Lauf, der sich nie mehr meldet, sperrt den Knopf nicht für immer und überschreibt den neueren Plan nicht', async ($, on) => {
  // Das Modell braucht zehn Minuten: länger, als ein Aufruf dauern darf.
  const welt = baue(on, { dauer: 600_000 })

  legeShop(welt)
  welt.modell = { isAnswered: true, usage: VERBRAUCH, text: antwort({ endziel: 'der verlorene Lauf' }) }
  // Mit offenem Endziel in GOAL.md zeigt der Plan das Endziel, das das Modell nennt.
  welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL.replace('Der Shop ist im Betrieb und nimmt Bestellungen an.', 'noch offen'))

  const ui = await $.ui.mount({ ...GRAPH, surface: 'desktop' })

  await ui.press({ key: 'neu' })
  await welt.uhr.advance(299_000)
  await ui.press({ key: 'neu' })
  await welt.uhr.settle()
  expect(welt.fragen).toHaveLength(1)
  expect(welt.toasts).toEqual(['Ein Lauf ist schon unterwegs.'])

  // Eine Minute nach der Zeitgrenze des Modell-Aufrufs gilt der Lauf als verloren.
  welt.dauer = 9_000
  welt.modell = { isAnswered: true, usage: VERBRAUCH, text: antwort() }
  await welt.uhr.advance(1_000)
  await ui.press({ key: 'neu' })
  await welt.uhr.advance(9_000)

  expect(welt.fragen).toHaveLength(2)
  expect(await mitBildern(ui)).toContain('Endziel (vermutet): der Shop im Betrieb')
  expect(await mitBildern(ui)).toContain('Abgeleitet gerade eben in 9 s')

  const plan = welt.dateien.get(`${ORDNER}/plan.json`)

  // Meldet sich der verlorene Lauf doch noch, ändert er nichts mehr: nicht an der Leiste
  // und nicht am gespeicherten Plan.
  await welt.uhr.advance(600_000)
  expect(await mitBildern(ui)).toContain('Endziel (vermutet): der Shop im Betrieb')
  expect(await mitBildern(ui)).not.toContain('der verlorene Lauf')
  expect(await mitBildern(ui)).not.toContain('Ableiten läuft')
  expect(welt.toasts).toHaveLength(2)
  expect(welt.dateien.get(`${ORDNER}/plan.json`)).toBe(plan)
  await ui.press({ key: 'laden' })
  expect(await mitBildern(ui)).toContain('Endziel (vermutet): der Shop im Betrieb')
  expect(await mitBildern(ui)).not.toContain('der verlorene Lauf')

  // Und der Knopf geht danach weiter.
  await ui.press({ key: 'neu' })
  await welt.uhr.advance(9_000)
  expect(welt.fragen).toHaveLength(3)

  await ui.unmount()
})

test('die Doku ist gedeckelt: jede Datei bei 24000 Zeichen, alle zusammen bei 96000', async ($, on) => {
  const welt = baue(on, { modell: { isAnswered: true, usage: VERBRAUCH, text: antwortOhneGoal({ chats: [] }) } })

  // Eine gewöhnliche Datei von 20000 Zeichen geht ganz ans Modell.
  welt.dateien.set(`${WURZEL}/README.md`, `# Shop\n${'Der Katalog wächst. '.repeat(1000)}`)

  for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) {
    welt.dateien.set(`${WURZEL}/docs/${name}.md`, `# Datei ${name}\n${'x'.repeat(25_000)}`)
  }

  const ui = await $.ui.mount({ ...GRAPH, surface: 'terminal' })

  await leiteAb(ui, welt)

  const lauf = gespeichert(welt, `${ORDNER}/letzter.json`)
  const quellen = lauf.quellen as { doku: { datei: string; zeichen: number; gesendet: number; gekuerzt: boolean }[]; hinweise: string[] }

  expect(quellen.doku).toEqual([
    { datei: 'README.md', zeichen: 20_007, gesendet: 20_007, gekuerzt: false },
    { datei: 'docs/a.md', zeichen: 25_010, gesendet: 24_000, gekuerzt: true },
    { datei: 'docs/b.md', zeichen: 25_010, gesendet: 24_000, gekuerzt: true },
    { datei: 'docs/c.md', zeichen: 25_010, gesendet: 24_000, gekuerzt: true },
    // Die letzte Datei bekommt, was von den 96000 Zeichen noch übrig ist.
    { datei: 'docs/d.md', zeichen: 25_010, gesendet: 3_993, gekuerzt: true },
  ])
  expect(quellen.hinweise).toEqual([
    'docs/a.md gekürzt: 24000 von 25010 Zeichen.',
    'docs/b.md gekürzt: 24000 von 25010 Zeichen.',
    'docs/c.md gekürzt: 24000 von 25010 Zeichen.',
    'docs/d.md gekürzt: 3993 von 25010 Zeichen.',
    'docs/e.md ausgelassen: Die Grenze für die Doku ist erreicht.',
    'docs/f.md ausgelassen: Die Grenze für die Doku ist erreicht.',
  ])
  expect(welt.fragen[0]?.prompt).toContain('<doku datei="README.md">')
  expect(welt.fragen[0]?.prompt).toContain('<doku datei="docs/d.md" gekuerzt="ja">')
  expect(welt.fragen[0]?.prompt).not.toContain('# Datei e')
  expect((welt.fragen[0]?.prompt ?? '').length < 97_500).toBe(true)

  await ui.unmount()
})

test('läuft die Session in einem Unterordner ohne Doku, gilt die Wurzel des Repos', async ($, on) => {
  const welt = baue(on, { ordner: `${WURZEL}/pakete/kasse` })

  legeShop(welt)

  const ui = await $.ui.mount({ ...GRAPH, surface: 'terminal' })

  await leiteAb(ui, welt)

  expect(gespeichert(welt, `${ORDNER}/letzter.json`)).toMatchObject({
    quellen: { wurzel: WURZEL, schluessel: SCHLUESSEL, chats: [{ name: 'Warenkorb-Regeln' }] },
  })
  expect(welt.fragen[0]?.prompt).toContain(`<goal datei="GOAL.md">\n${GOAL.trim()}\n</goal>`)
  expect(welt.fragen[0]?.prompt).toContain('<doku datei="docs/plan/suche.md">')
  expect(welt.toasts).toEqual(['Ableiten fertig nach 23 s: 11 Bündel in 4 Strängen'])

  await ui.unmount()
})
