import { expect, test } from 'claude-code/testing'

// Die Pane wird durch den Mod auf einer benannten Surface gezeichnet. Ein Baum,
// den die Surface nicht zeichnen kann, lässt schon `mount` scheitern.

const PLUGIN = 'ziel-graph'
const PANE = {
  title: 'Ziel-Graph',
  isFocused: false,
  bodyColumns: 58,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
} as const
const VIEWPORT = { columns: 58, rows: 40, isFullscreen: true }
const ZIEL = { plugin: PLUGIN, component: 'Pane', requestId: PLUGIN, props: PANE, viewport: VIEWPORT } as const

type Gefunden = { type: string; text: string; props: Record<string, unknown> }
type Zeichnung = {
  findAll: (query: { type?: string; key?: string; text?: string | RegExp }) => Promise<Gefunden[]>
}

// Alles, was die Zeichnung zeigt, als ein Text: auf dem Desktop steckt der Graph
// im SVG, im Terminal in Text-Zeilen und Knopf-Beschriftungen.
const inhalt = async (ui: Zeichnung): Promise<string> => {
  const svg = await ui.findAll({ type: 'Svg' })
  const texte = await ui.findAll({ type: 'Text' })
  const knoepfe = await ui.findAll({ type: 'Button' })

  return [
    ...svg.map(one => String(one.props.source)),
    ...texte.map(one => one.text),
    ...knoepfe.map(one => one.text),
  ].join('\n')
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}: die Pane zeichnet den Graphen der Schritte`, async $ => {
    const ui = await $.ui.mount({ ...ZIEL, surface })

    expect(await ui.drawn()).toMatchObject({ type: 'Box' })

    const svg = await ui.findAll({ type: 'Svg' })
    expect(svg).toHaveLength(surface === 'desktop' ? 1 : 0)

    if (surface === 'desktop') {
      const source = String(svg[0]?.props.source)

      expect(source.startsWith('<svg ')).toBe(true)
      expect(source.endsWith('</svg>')).toBe(true)
      expect(source.length < 131072).toBe(true)
      expect(String(svg[0]?.props.alt)).toContain('Ansicht Schritte')
    }

    const text = await inhalt(ui)

    expect(text).toContain('Endziel: der Shop im Betrieb')
    expect(text).toContain('7 Bündel jetzt möglich · 3 laufen · 2 warten auf dich')
    expect(text).toContain('Grundstock: 13 Produktseiten fertig')
    expect(text).toContain('JETZT MÖGLICH')
    expect(text).toContain('Treffpunkt: Großer Umbau')
    expect(text).toContain('#8 · Schuhe: Größen als Variante oder Filter')
    expect(text).toContain('Ausgeblendet: Import, Tests (Person 2)')
    expect(text).not.toContain('Import: Umzug in Etappen')

    await ui.unmount()
  })

  test(`${surface}: der Wechsel der Ansicht zeigt die Übersicht und zurück`, async $ => {
    const ui = await $.ui.mount({ ...ZIEL, surface })

    await ui.press({ key: 'ansicht-uebersicht' })

    const uebersicht = await inhalt(ui)

    expect(uebersicht).toContain('Katalog füllen')
    expect(uebersicht).toContain('12 offen · 5 bereit · 1 Chat')
    expect(uebersicht).not.toContain('Grundstock: 13 Produktseiten fertig')
    expect(uebersicht).not.toContain('JETZT MÖGLICH')

    await ui.press({ key: 'ansicht-schritte' })
    expect(await inhalt(ui)).toContain('Grundstock: 13 Produktseiten fertig')

    await ui.unmount()
  })

  test(`${surface}: die Filter blenden Bahnen und Personen aus und ein`, async $ => {
    const ui = await $.ui.mount({ ...ZIEL, surface })

    await ui.press({ key: 'bahn-kat' })

    const ohneKatalog = await inhalt(ui)

    expect(ohneKatalog).not.toContain('Katalog-Texte abnehmen')
    expect(ohneKatalog).toContain('Entwurf Warenkorb-Regeln')
    expect(ohneKatalog).toContain('Ausgeblendet: Katalog · Import, Tests (Person 2)')
    expect(ohneKatalog).toContain('5 Bündel jetzt möglich · 2 laufen · 1 warten auf dich')

    await ui.press({ key: 'bahn-kat' })
    await ui.press({ key: 'person-person-2' })

    const mitPerson2 = await inhalt(ui)

    expect(mitPerson2).toContain('Katalog-Texte abnehmen')
    expect(mitPerson2).toContain('Import: Umzug in Etappen')
    expect(mitPerson2).not.toContain('Ausgeblendet')

    await ui.press({ key: 'person-ich' })

    const nurPerson2 = await inhalt(ui)

    expect(nurPerson2).not.toContain('Katalog-Texte abnehmen')
    expect(nurPerson2).toContain('Tests: Testdaten bremsen den Lauf')
    expect(nurPerson2).toContain('(Ich)')

    await ui.unmount()
  })

  test(`${surface}: ein Bündel klappt zu und wieder auf`, async $ => {
    const ui = await $.ui.mount({ ...ZIEL, surface })

    expect(await inhalt(ui)).toContain('#9 · Jacken: Farbgruppen')
    expect(await inhalt(ui)).not.toContain('#26 · Suche: Sortierung')

    await ui.press({ key: 'auf-recherchen' })

    const zu = await inhalt(ui)

    expect(zu).not.toContain('#9 · Jacken: Farbgruppen')
    expect(zu).toContain('8 Recherchen zu den Kategorien')

    await ui.press({ key: 'auf-suchfelder' })
    expect(await inhalt(ui)).toContain('#26 · Suche: Sortierung')

    await ui.press({ key: 'auf-recherchen' })
    expect(await inhalt(ui)).toContain('#9 · Jacken: Farbgruppen')

    await ui.unmount()
  })

  test(`${surface}: die Ziel-Auswahl zeigt eine einzelne Bahn`, async $ => {
    const ui = await $.ui.mount({ ...ZIEL, surface })

    await ui.select({ key: 'ziel', value: 'kas' })

    const nurKasse = await inhalt(ui)

    expect(nurKasse).toContain('Entwurf Warenkorb-Regeln')
    expect(nurKasse).not.toContain('Katalog-Texte abnehmen')
    expect(nurKasse).not.toContain('Ladezeit')
    expect(nurKasse).toContain('Treffpunkt: Großer Umbau')
    expect(await ui.findAll({ key: 'bahn-kat' })).toHaveLength(0)

    // Eine leere Zone bekommt keine Überschrift, „Jetzt möglich“ bleibt.
    await ui.select({ key: 'ziel', value: 'btr' })

    const nurBetrieb = await inhalt(ui)

    expect(nurBetrieb).toContain('Ladezeit der Startseite senken')
    expect(nurBetrieb).toContain('JETZT MÖGLICH')
    expect(nurBetrieb).not.toContain('HINTER UNS')
    expect(nurBetrieb).not.toContain('SPÄTER')

    await ui.select({ key: 'ziel', value: 'alle' })
    expect(await inhalt(ui)).toContain('Katalog-Texte abnehmen')
    expect(await ui.findAll({ key: 'bahn-kat' })).toHaveLength(1)

    await ui.unmount()
  })
}

test('vscode und mobile: die Pane wird ebenfalls gezeichnet', async $ => {
  for (const surface of ['vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...ZIEL, surface })

    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(1)
    // Die mobile App hat kein Select: dort ist die Ziel-Auswahl ein Knopf.
    expect(await ui.findAll({ type: 'Select' })).toHaveLength(surface === 'mobile' ? 0 : 2)
    await ui.press({ key: 'ansicht-uebersicht' })
    expect(await inhalt(ui)).toContain('Katalog füllen')
    await ui.press({ key: 'ansicht-schritte' })
    await ui.unmount()
  }
})

test('desktop: die Farbwahl wechselt die Palette des Bildes', async $ => {
  const ui = await $.ui.mount({ ...ZIEL, surface: 'desktop' })
  const quelle = async (): Promise<string> =>
    String((await ui.findAll({ type: 'Svg' }))[0]?.props.source)

  // Auto: helle Farben als Attribute, dunkle über prefers-color-scheme.
  expect(await quelle()).toContain('prefers-color-scheme: dark')
  expect(await quelle()).toContain('fill="#ffffff"')

  await ui.select({ key: 'farben', value: 'dunkel' })
  expect(await quelle()).not.toContain('prefers-color-scheme')
  expect(await quelle()).toContain('fill="#18242a"')

  await ui.select({ key: 'farben', value: 'auto' })
  await ui.unmount()
})

test('der Befehl /graph öffnet die Pane „Ziel-Graph“', async ($, on) => {
  const geoeffnet: unknown[] = []

  on('ui.open', (_$, e) => {
    geoeffnet.push(e)

    return { value: { isPlaced: true } }
  })

  const antwort = await $.command.run({ command: 'graph' })

  expect(antwort.text).toBe('Ziel-Graph geöffnet.')
  expect(geoeffnet).toHaveLength(1)
  expect(geoeffnet[0]).toMatchObject({ id: 'ziel-graph', title: 'Ziel-Graph' })
})
