import { expect, test } from 'claude-code/testing'

import { AUFTRAG } from '../hooks/plan/ableiten'
import { promptEndziel, promptGoalAnlegen, promptStrangZiel } from '../hooks/plan/goal'
import { strangFrage } from '../hooks/plan/lesen'
import { auftragFuer, erklaerungFuer, fertigId, sicht } from '../hooks/karten/karten'
import { SVG_GRENZE, baueFlaeche } from '../hooks/karten/zeichnen'

import { CHAT, GOAL, LAUFEND, QUELLEN, STAMM_OHNE_GOAL, ZEILEN, antwort, gelungen } from './shop'
import {
  BREIT,
  GITHUB,
  HEIM,
  JETZT,
  ORDNER,
  SURFACES,
  VERBRAUCH,
  WURZEL,
  baue,
  befehl,
  gespeichert,
  inhalt,
  kartenPane,
  legeChat,
  legeShop,
  leiteAb,
  mitPlan,
  schluesselVon,
} from './welt'
import type { Zeichnung } from './welt'

// Die breite Ansicht `/orchestrator`: der Plan als Prozesskarten, die Detail-Fläche und der
// Lauf, der den Plan ableitet und speichert. Alle Testdaten sind erfunden.

for (const surface of SURFACES) {
  test(`${surface}: /orchestrator öffnet die Leiste breit; ohne GOAL.md sagt sie „GOAL.md fehlt“ und bietet den Entwurf an`, async ($, on) => {
    const welt = baue(on)

    legeShop(welt, null)

    const ui = await $.ui.mount({ ...BREIT, surface })

    // Vor dem Befehl weiß die Leiste noch nichts: kein Plan, und kein Urteil über GOAL.md.
    expect(await ui.drawn()).toMatchObject({ type: 'Box' })
    expect(await inhalt(ui)).toContain('Noch kein Plan für dieses Repo.')
    expect(await inhalt(ui)).not.toContain('GOAL.md fehlt')

    expect(await befehl($, 'orchestrator')).toBe(
      'Orchestrator geöffnet. Noch kein Plan für dieses Repo: „Neu ableiten“ in der Leiste leitet ihn ab.',
    )
    expect(welt.geoeffnet).toEqual([{ id: 'orchestrator', title: 'Orchestrator', columns: 172 }])

    const text = await inhalt(ui)

    expect(text).toContain('GOAL.md fehlt')
    expect(text).toContain('GOAL.md in der Wurzel des Repos ist der Anker des Plans')
    expect(text).toContain('GOAL.md mit dem Chat entwerfen')
    expect(text).toContain('Neu ableiten')
    expect(text).toContain('Neu laden')
    expect(text.indexOf('GOAL.md fehlt') < text.indexOf('Noch kein Plan für dieses Repo.')).toBe(true)
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
    // Auch ohne Plan stehen die laufenden Chats da.
    expect(text).toContain('Laufende Chats')
    expect(text).toContain('● Warenkorb-Regeln · wartet auf dich')
    expect(text).not.toContain('Herausgenommen')
    expect(text).not.toContain('Uralt')

    // Der Knopf legt den Auftrag ins Eingabefeld; geschrieben wird nichts.
    await ui.press({ key: 'goal-anlegen' })
    expect(welt.gefuellt).toEqual([{ text: promptGoalAnlegen(), mode: 'replace' }])
    expect(welt.toasts).toEqual(['Der Auftrag für GOAL.md liegt im Eingabefeld. Prüfen und abschicken.'])
    expect(welt.geschrieben.size).toBe(0)
    expect(welt.fragen).toHaveLength(0)
    expect(welt.prompts).toHaveLength(0)

    // Steht im Eingabefeld schon etwas, bleibt es stehen, und der Auftrag kommt dahinter.
    welt.entwurf = 'Moment, erst noch'
    await ui.press({ key: 'goal-anlegen' })
    expect(welt.gefuellt[1]).toEqual({ text: `\n\n${promptGoalAnlegen()}`, mode: 'append' })
    expect(welt.toasts[1]).toBe('Der Auftrag für GOAL.md liegt im Eingabefeld, hinter deinem Entwurf. Prüfen und abschicken.')

    // Sobald der Chat die Datei geschrieben hat, zeigt „Neu laden“ das; eine leere Datei gilt als leer.
    welt.dateien.set(`${WURZEL}/GOAL.md`, '# Ziel\n')
    await ui.press({ key: 'laden' })
    expect(await inhalt(ui)).toContain('GOAL.md ist noch leer')
    expect(await inhalt(ui)).not.toContain('GOAL.md fehlt')

    welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL)
    await ui.press({ key: 'laden' })
    expect(await inhalt(ui)).not.toContain('GOAL.md ist noch leer')
    expect(await ui.findAll({ key: 'goal-anlegen' })).toHaveLength(0)

    await ui.unmount()
  })
}

for (const surface of SURFACES) {
  test(`${surface}: „Neu ableiten“ liest GOAL.md zuerst, fragt Sonnet 5.5 einmal und zeigt den Plan als Karten`, async ($, on) => {
    const welt = baue(on)

    legeShop(welt)
    await befehl($, 'orchestrator')

    const ui = await $.ui.mount({ ...BREIT, surface })

    // Der Knopf kehrt sofort zurück: Der Lauf beginnt erst danach.
    await ui.press({ key: 'neu' })
    expect(welt.fragen).toHaveLength(0)
    expect(await inhalt(ui)).toContain('Ableiten läuft …')

    await welt.uhr.advance(10_000)
    expect(welt.fragen).toHaveLength(1)
    expect(await inhalt(ui)).toContain('Ableiten läuft … seit 10 s')
    expect(await inhalt(ui)).toContain('Ein Modell-Aufruf mit claude-sonnet-5-5')
    expect(welt.toasts).toHaveLength(0)

    // Ein zweiter Lauf, während einer läuft, wird übergangen.
    await ui.press({ key: 'neu' })
    expect(welt.toasts).toEqual(['Ein Lauf ist schon unterwegs.'])

    await welt.uhr.advance(13_000)

    // Ein Aufruf, mit Sonnet 5.5, dem Auftrag als System-Prompt und großzügigen Grenzen.
    expect(welt.fragen).toHaveLength(1)
    expect(welt.fragen[0]?.model).toBe('claude-sonnet-5-5')
    expect(welt.fragen[0]?.system).toBe(AUFTRAG)
    expect(welt.fragen[0]?.maxTokens).toBe(16_000)
    expect(welt.fragen[0]?.timeoutMs).toBe(240_000)

    // GOAL.md steht zuerst, dann die Doku, der eine laufende Chat und die Commits.
    const eingabe = welt.fragen[0]?.prompt ?? ''

    expect(eingabe.startsWith(`Leite den Plan für dieses Repo ab. Heute ist der 2026-10-04.\n\n<goal datei="GOAL.md">\n${GOAL.trim()}\n</goal>\n\n<goal-gelesen>\n`)).toBe(true)
    expect(eingabe).toContain('- id "kasse": Kasse · kein Ziel festgelegt · gehört zu "grosser-umbau"')
    expect(eingabe.match(/<doku datei="[^"]+"/g)).toEqual([
      '<doku datei="README.md"',
      '<doku datei="CLAUDE.md"',
      '<doku datei="docs/kasse.md"',
      '<doku datei="docs/katalog.md"',
      '<doku datei="docs/plan/suche.md"',
    ])
    expect(eingabe).toContain('c1 · Warenkorb-Regeln · Branch t21-warenkorb')
    expect(eingabe).toContain('Offene Frage an den Nutzer: Sollen Gutscheine auch den Versand decken?')
    expect(eingabe).not.toContain('Herausgenommen')
    expect(eingabe).not.toContain('Uralt')
    expect(eingabe).not.toContain('Nicht unter docs')
    expect(eingabe).toContain('2026-09-01 Katalog: Schritt 1\n</commits>')
    expect(welt.laeufe).toEqual(['git log -n 30 --date=short --pretty=format:%ad %s'])

    // Die Leiste zeigt den Plan: mit Svg als Karten, im Terminal als Liste.
    const svg = await ui.findAll({ type: 'Svg' })
    const text = await inhalt(ui)

    expect(await ui.drawn()).toMatchObject({ type: 'Box' })
    expect(svg.length > 0).toBe(surface !== 'terminal')
    expect(text).not.toContain('Ableiten läuft')
    expect(text).not.toContain('GOAL.md fehlt')
    expect(text).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
    expect(text).toContain('6 Bündel jetzt möglich · 1 Chat · 1 wartet auf dich')
    expect(text).toContain('Abgeleitet gerade eben in 23 s aus 5 Dateien, 1 Chat und 30 Commits · claude-sonnet-5-5')
    expect(text).toContain('Katalog-Texte abnehmen')
    expect(text).toContain('2 erledigt')
    expect(text).toContain('[Chat wartet auf dich]')
    expect(text).toContain('kein Ziel festgelegt')
    expect(text).toContain('Großer Umbau')
    expect(text).toContain('Festgelegt ist nur, was in GOAL.md steht und was du als Festlegung eingegeben hast.')
    expect(text).toContain(`Der Plan liegt in ${ORDNER}/plan.json.`)
    // Eine Antwort nach Vorschrift braucht keinen Hinweis.
    expect(text).not.toContain('Beim Ableiten aufgefallen')
    // Das Endziel steht in GOAL.md: kein Knopf dafür. Kasse und Betrieb haben kein Ziel: je ein Knopf.
    expect(await ui.findAll({ key: 'endziel-festlegen' })).toHaveLength(0)
    expect(await schluesselVon(ui, 'ziel-')).toEqual(['ziel-kasse', 'ziel-betrieb'])
    expect(welt.toasts).toEqual(['Ein Lauf ist schon unterwegs.', 'Ableiten fertig nach 23 s: 11 Bündel in 4 Strängen'])
    expect(welt.meldungen).toHaveLength(0)

    // Der Lauf und der Plan liegen als JSON da, unter dem Schlüssel des Repos.
    const lauf = gespeichert(welt, `${ORDNER}/letzter.json`)

    expect(welt.dateien.get(`${ORDNER}/lauf-2026-10-04T12-00-00-000Z.json`)).toBe(welt.dateien.get(`${ORDNER}/letzter.json`))
    expect(welt.dateien.get(`${ORDNER}/letzte-eingabe.txt`)).toBe(eingabe)
    expect(lauf).toMatchObject({
      zeit: '2026-10-04T12:00:00.000Z',
      dauerMs: 23_000,
      modellMs: 23_000,
      modell: 'claude-sonnet-5-5',
      maxTokens: 16_000,
      timeoutMs: 240_000,
      ergebnis: 'abgeleitet',
      grund: '',
      usage: VERBRAUCH,
      quellen: {
        wurzel: WURZEL,
        schluessel: 'github.com+beispiel+shop',
        goal: { zeichen: GOAL.length },
        chats: [{ kennung: 'c1', id: 'sitzung-7', name: 'Warenkorb-Regeln', wartet: true }],
        commits: { anzahl: 30 },
        hinweise: [],
      },
      prompt: { systemZeichen: AUFTRAG.length, eingabeZeichen: eingabe.length },
      antwort: antwort(),
      warnungen: [],
    })

    const plan = gespeichert(welt, `${ORDNER}/plan.json`)

    expect(plan).toMatchObject({
      version: 2,
      fakten: { zeit: JETZT, dauerMs: 23_000, modellMs: 23_000, dateien: 5, chats: 1, commits: 30, modell: 'claude-sonnet-5-5', datei: `${ORDNER}/plan.json` },
      antwort: antwort(),
      umfeld: { chats: [CHAT], quellen: QUELLEN },
      goal: GOAL,
      // Der erste Lauf: keine Festlegung, und kein Plan davor, mit dem sich vergleichen ließe.
      festlegungen: [],
      aenderungen: null,
      warnungen: [],
    })
    expect(plan.plan).toEqual(gelungen(antwort()).plan)
    expect(lauf.plan).toEqual(plan.plan)
    // Der Mod schreibt nur in den Unterordner des Plans: nie GOAL.md, nie zwischen die Stände der Chats.
    expect([...welt.geschrieben.keys()].sort()).toEqual(
      ['lauf-2026-10-04T12-00-00-000Z.json', 'letzte-eingabe.txt', 'letzter.json', 'plan.json'].map(one => `${ORDNER}/${one}`),
    )

    await ui.unmount()
  })
}

for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
  test(`${surface}: die Karten als Fläche: je Karte ein kleines Bild und ein Knopf, je nach Breite daneben oder darunter die Detail-Fläche`, async ($, on) => {
    await mitPlan($, on)

    const { plan } = gelungen(antwort())
    const karten = [
      fertigId('katalog'),
      fertigId('kasse'),
      'katalog-texte',
      'warenkorb',
      'gutscheine',
      'suchfelder',
      'ladezeit',
      'build-skripte',
      'rueckfragen',
      'rechnungen',
      'grundstock-steht',
      'grosser-umbau',
      'lasttest-bestanden',
      'endziel',
    ].map(one => `karte-${one}`)

    for (const zellen of [200, 150, 58]) {
      const ui = await $.ui.mount({ ...kartenPane(zellen), surface })
      const svg = await ui.findAll({ type: 'Svg' })
      const flaeche = baueFlaeche(sicht(plan, { ...LAUFEND, chats: LAUFEND.chats.slice(0, 1) }, ''), { zellen, farben: 'auto' })
      const gestapelt = flaeche.art === 'gestapelt'

      expect(flaeche.art).toBe(zellen === 200 ? 'neben' : zellen === 150 ? 'unter' : 'gestapelt')
      // Gestapelt gibt es keine Ränder und keine Spalten-Enden.
      expect(svg).toHaveLength(gestapelt ? 4 + 10 + 4 : 3 + 4 + 3 + 16 + 4 + 4)
      // Zusammen ist das Markup einer Zeichnung genau das der Fläche: kein Bild steht doppelt da.
      expect(svg.reduce((summe, one) => summe + String(one.props.source).length, 0)).toBe(flaeche.zeichen)

      for (const eines of svg) {
        expect(String(eines.props.source).length < SVG_GRENZE).toBe(true)
        expect(String(eines.props.alt)).not.toBe('')
        expect(typeof eines.props.width).toBe('number')
        expect(typeof eines.props.height).toBe('number')
      }

      // Je Karte ein Knopf „›“, in der Reihenfolge der Spalten.
      expect((await schluesselVon(ui, 'karte-')).sort()).toEqual([...karten].sort())
      expect(await schluesselVon(ui, 'ziel-')).toEqual(['ziel-kasse', 'ziel-betrieb'])

      const boxen = await ui.findAll({ type: 'Box' })

      // Die Spalten sind feste Boxen im Fluss: Keine Box ist über eine andere gelegt.
      expect(boxen.some(one => one.props.position === 'absolute')).toBe(false)
      expect(boxen.filter(one => one.props.minWidth === flaeche.spalte && one.props.flexShrink === 0)).toHaveLength(gestapelt ? 0 : 4 + 3 * 4 + 4)
      // Steht die Detail-Fläche daneben, hat sie eine feste Breite.
      expect(boxen.filter(one => one.props.width === 42 && one.props.flexGrow === 1)).toHaveLength(flaeche.art === 'neben' ? 1 : 0)

      const text = await inhalt(ui)

      expect(text).toContain('◉ Entwurf Warenkorb-Regeln [Chat wartet auf dich]')
      expect(text).toContain('✓ 2 erledigt (Grundstock: 13 Produktseiten fertig · Bilder für Schuhe und Jacken)')
      expect(text).toContain('Strang Kasse: kein Ziel festgelegt, vermutet: Bestellen ohne Umweg')
      expect(text).toContain('◎ Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an. (aus GOAL.md)')

      if (gestapelt) {
        expect(text).toContain('JETZT MÖGLICH')
      } else {
        expect(text).toContain('Abschnitt Jetzt möglich')
        expect(text).toContain('→ Großer Umbau')
      }

      await ui.unmount()
    }

    // Die Farbwahl wechselt die Palette der Bilder.
    const quelle = async (ui: Zeichnung): Promise<string> =>
      (await ui.findAll({ type: 'Svg' })).map(one => String(one.props.source)).join('')
    const vorher = await $.ui.mount({ ...BREIT, surface })

    expect(await quelle(vorher)).toContain('prefers-color-scheme:dark')
    expect(await quelle(vorher)).toContain('fill="#ffffff"')
    await vorher.unmount()

    if (surface === 'mobile') {
      // Die mobile App hat kein Select: Dort wechselt ein Knopf reihum.
      const ui = await $.ui.mount({ ...BREIT, surface })

      expect(await ui.findAll({ type: 'Select' })).toHaveLength(0)
      await ui.press({ key: 'farben' })
      await ui.press({ key: 'farben' })
      await ui.unmount()
    } else {
      const ui = await $.ui.mount({ ...BREIT, surface })

      await ui.select({ key: 'farben', value: 'dunkel' })
      await ui.unmount()
    }

    const nachher = await $.ui.mount({ ...BREIT, surface })

    expect(await quelle(nachher)).not.toContain('prefers-color-scheme')
    expect(await quelle(nachher)).toContain('fill="#1d242b"')
    await nachher.unmount()
  })
}

test('terminal: die Karten als Liste, je Karte eine Zeile, die sich drücken lässt', async ($, on) => {
  await mitPlan($, on)

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })
  const text = await inhalt(ui)

  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
  expect(await ui.findAll({ type: 'Select' })).toHaveLength(0)
  expect(await ui.findAll({ key: 'farben' })).toHaveLength(0)
  expect(text).toContain('STRÄNGE')
  expect(text).toContain('Katalog — Alle Produkte mit Text und Bild im Shop')
  expect(text).toContain('Kasse — kein Ziel festgelegt · vermutet: Bestellen ohne Umweg')
  expect(text).toContain('Ziel festlegen: Kasse')
  expect(text).toContain('HINTER UNS')
  expect(text).toContain('JETZT MÖGLICH')
  expect(text).toContain('SPÄTER')
  expect(text).toContain('  ✓ Katalog · 2 erledigt — Grundstock: 13 Produktseiten fertig · Bilder für Schuhe und Jacken')
  expect(text).toContain('▸ ◉ Kasse · Entwurf Warenkorb-Regeln [Chat wartet auf dich]')
  expect(text).toContain('  ◐ Betrieb · Umbau der Build-Skripte — 1 von 3 erledigt · Rest wartet auf den Lasttest')
  expect(text).toContain('  · Kasse · Block Rechnungen — vermutet · wartet auf: Entwurf Warenkorb-Regeln')
  expect(text).toContain('ZIELE')
  expect(text).toContain('  ✓ Grundstock steht — erreicht')
  expect(text).toContain('  ◎ Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an. — aus GOAL.md')
  expect(await schluesselVon(ui, 'karte-')).toHaveLength(14)

  // Eine Zeile drücken wählt die Karte: Darunter steht, was dazugehört.
  await ui.press({ key: 'karte-katalog-texte' })

  const gewaehlt = await inhalt(ui)

  expect(gewaehlt).toContain('▸ ○ Katalog · Katalog-Texte abnehmen — 3 von 5 Kategorien abgenommen')
  expect(gewaehlt).toContain('  ◉ Kasse · Entwurf Warenkorb-Regeln [Chat wartet auf dich]')
  expect(gewaehlt).toContain('Jetzt möglich · Strang Katalog')
  expect(gewaehlt).toContain('– Jacken: Farbgruppen')
  expect(gewaehlt).toContain('Quelle: docs/katalog.md')

  await ui.unmount()
})

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}: die Detail-Fläche legt Auftrag und Erklärung ins Eingabefeld; der Chat einer Karte steht mit Stand, „Weiter“ und Frage da`, async ($, on) => {
    const welt = await mitPlan($, on)
    const { plan } = gelungen(antwort())
    const ui = await $.ui.mount({ ...BREIT, surface })

    // Ohne Wahl steht die Karte da, an der ein Chat auf den Nutzer wartet.
    const wartend = await inhalt(ui)

    expect(wartend).toContain('Jetzt möglich · Strang Kasse')
    expect(wartend).toContain('● Chat: Warenkorb-Regeln')
    expect(wartend).toContain('gerade eben · t21-warenkorb')
    expect(wartend).toContain('Stand: Der Entwurf der Regeln steht.')
    expect(wartend).toContain('Weiter: Die Rundung der Beträge prüfen.')
    expect(wartend).toContain('Wartet auf dich: Sollen Gutscheine auch den Versand decken?')

    await ui.press({ key: 'karte-gutscheine' })

    const text = await inhalt(ui)

    expect(text).toContain('Entwurf Gutschein-Einlösung')
    expect(text).toContain('Ziel des Strangs: kein Ziel festgelegt')
    expect(text).toContain('– Restbetrag merken')
    expect(text).toContain('Quelle: docs/kasse.md')
    expect(text).not.toContain('● Chat: Warenkorb-Regeln')
    expect(await ui.findAll({ key: 'auftrag' })).toHaveLength(1)
    expect(await ui.findAll({ key: 'erklaeren' })).toHaveLength(1)

    await ui.press({ key: 'auftrag' })
    await ui.press({ key: 'erklaeren' })
    expect(welt.gefuellt).toEqual([
      { text: auftragFuer(plan, 'gutscheine'), mode: 'replace' },
      { text: erklaerungFuer(plan, 'gutscheine'), mode: 'replace' },
    ])
    expect(welt.toasts).toEqual([
      'Der Auftrag liegt im Eingabefeld. Prüfen und abschicken.',
      'Die Bitte um eine Erklärung liegt im Eingabefeld. Prüfen und abschicken.',
    ])
    // Abschicken tut der Nutzer selbst: Der Mod reicht nichts ein.
    expect(welt.prompts).toHaveLength(0)

    // Eine Karte in „Später“ und die erledigten haben keine Knöpfe.
    await ui.press({ key: 'karte-rechnungen' })
    expect(await inhalt(ui)).toContain('Wartet auf: Entwurf Warenkorb-Regeln')
    expect(await ui.findAll({ key: 'auftrag' })).toHaveLength(0)
    await ui.press({ key: `karte-${fertigId('katalog')}` })
    expect(await inhalt(ui)).toContain('– Bilder für Schuhe und Jacken (seit September)')
    expect(await ui.findAll({ key: 'erklaeren' })).toHaveLength(0)

    // Ein Strang ohne Ziel: Der Knopf an seinem Kopf legt den Auftrag ins Eingabefeld.
    await ui.press({ key: 'ziel-kasse' })

    const frage = strangFrage(plan, 'kasse')

    expect(welt.gefuellt[2]).toEqual({ text: frage === null ? '' : promptStrangZiel(frage), mode: 'replace' })
    expect(welt.gefuellt[2]?.text).toContain('Für den Strang „Kasse“ ist in GOAL.md noch kein Ziel festgelegt.')
    expect(welt.gefuellt[2]?.text).toContain('Es fehlt die Zeile „Ziel: …“ unter „### Kasse“.')
    expect(welt.gefuellt[2]?.text).toContain('Der Plan vermutet als Ziel: Bestellen ohne Umweg')
    expect(welt.gefuellt[2]?.text).toContain('- Entwurf Gutschein-Einlösung')
    expect(welt.toasts[2]).toBe('Der Auftrag „Ziel festlegen“ liegt im Eingabefeld. Prüfen und abschicken.')
    expect(welt.geschrieben.has(`${WURZEL}/GOAL.md`)).toBe(false)

    await ui.unmount()
  })
}

test('nach „Neu laden“ gilt, was jetzt in GOAL.md steht: ohne neuen Modell-Aufruf', async ($, on) => {
  const welt = await mitPlan($, on)
  const ui = await $.ui.mount({ ...BREIT, surface: 'desktop' })

  expect(await schluesselVon(ui, 'ziel-')).toEqual(['ziel-kasse', 'ziel-betrieb'])
  expect(await inhalt(ui)).not.toContain('GOAL.md hat sich seit dem letzten Ableiten geändert.')

  // Der Chat hat das Ziel der Kasse eingetragen, das Endziel geöffnet und einen Strang ergänzt.
  welt.dateien.set(
    `${WURZEL}/GOAL.md`,
    `${GOAL.replace('Ziel:\n', 'Ziel: Bestellen ohne Umweg\n').replace('Der Shop ist im Betrieb und nimmt Bestellungen an.', 'noch offen')}\n### Lager\n`,
  )
  await ui.press({ key: 'laden' })

  const text = await inhalt(ui)

  expect(welt.fragen).toHaveLength(1)
  expect(text).toContain('Strang Kasse: Bestellen ohne Umweg')
  expect(text).toContain('Strang Lager: kein Ziel festgelegt')
  expect(await schluesselVon(ui, 'ziel-')).toEqual(['ziel-betrieb', 'ziel-lager'])
  expect(text).toContain('GOAL.md hat sich seit dem letzten Ableiten geändert.')
  expect(text).toContain('Strang „Lager“ hat kein Bündel.')
  // Das Endziel ist jetzt offen: Es steht als vermutet da, mit dem Knopf, es festzulegen.
  expect(text).toContain('Endziel (vermutet): der Shop im Betrieb')

  await ui.press({ key: 'endziel-festlegen' })
  expect(welt.gefuellt).toEqual([{ text: promptEndziel(true, 'der Shop im Betrieb'), mode: 'replace' }])

  // Die Karte des Endziels hat denselben Knopf.
  await ui.press({ key: 'karte-endziel' })
  expect(await inhalt(ui)).toContain('Vermutet: In GOAL.md ist kein Endziel festgelegt.')
  await ui.press({ key: 'endziel-detail' })
  expect(welt.gefuellt[1]).toEqual(welt.gefuellt[0])

  // Die Chats liest die Leiste alle 20 Sekunden von selbst neu.
  legeChat(welt, 'sitzung-7', { name: 'Warenkorb-Regeln', stand: 'Die Regeln sind fertig.', frage: '' })
  await welt.uhr.advance(20_000)
  expect(await inhalt(ui)).toContain('◉ Entwurf Warenkorb-Regeln [Chat läuft]')
  expect(await inhalt(ui)).toContain('keiner wartet auf dich')
  expect(welt.fragen).toHaveLength(1)

  // Ändert sich an den Chats nichts, lässt der Takt die Leiste in Ruhe: Sie wird nicht neu
  // gezeichnet, also bleibt auch die Zeitangabe stehen, bis jemand „Neu laden“ drückt.
  await welt.uhr.advance(30 * 60_000)
  expect(await inhalt(ui)).toContain('Abgeleitet gerade eben in 23 s')
  await ui.press({ key: 'laden' })
  expect(await inhalt(ui)).toContain('Abgeleitet vor 31 Min in 23 s')

  await ui.unmount()
})

for (const surface of SURFACES) {
  test(`${surface}: ohne GOAL.md läuft das Ableiten wie bisher, und alles über Ziele steht als vermutet da`, async ($, on) => {
    const welt = await mitPlan($, on, { modell: { isAnswered: true, text: antwort({ stamm: STAMM_OHNE_GOAL }), usage: VERBRAUCH } }, null)
    const ui = await $.ui.mount({ ...BREIT, surface })
    const text = await inhalt(ui)

    expect(welt.fragen[0]?.prompt).not.toContain('<goal')
    expect(text).toContain('GOAL.md fehlt')
    expect(text).toContain('Endziel (vermutet): der Shop im Betrieb')
    expect(text).toContain('kein Ziel festgelegt')
    expect(text).toContain('vermutet: Bestellen ohne Umweg')
    expect(text).toContain('vermutet · sobald Katalog, Kasse und Suche fertig sind')
    expect(await ui.findAll({ key: 'goal-anlegen' })).toHaveLength(1)
    expect(await ui.findAll({ key: 'endziel-festlegen' })).toHaveLength(1)
    expect(await schluesselVon(ui, 'ziel-')).toEqual(['ziel-katalog', 'ziel-kasse', 'ziel-suche', 'ziel-betrieb'])

    await ui.press({ key: 'ziel-suche' })
    expect(welt.gefuellt[0]?.text).toContain('Für den Strang „Suche“ ist in GOAL.md noch kein Ziel festgelegt.')
    expect(welt.gefuellt[0]?.text).toContain('GOAL.md gibt es noch nicht. Leg sie in der Wurzel des Repos an')
    await ui.press({ key: 'endziel-festlegen' })
    expect(welt.gefuellt[1]?.text).toBe(promptEndziel(false, 'der Shop im Betrieb'))

    await ui.unmount()
  })
}

test('scheitert der Modell-Aufruf, steht der Grund da, und der vorige Plan bleibt', async ($, on) => {
  const welt = await mitPlan($, on)
  const ui = await $.ui.mount({ ...BREIT, surface: 'desktop' })
  const vorher = welt.dateien.get(`${ORDNER}/plan.json`)

  welt.modell = { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: VERBRAUCH }
  await welt.uhr.advance(60_000)
  await leiteAb(ui, welt)

  const text = await inhalt(ui)

  expect(text).toContain(`Ableiten fehlgeschlagen: Das Modell hat nicht geantwortet: API-Fehler 529 (overloaded). Der Lauf liegt in ${ORDNER}/letzter.json.`)
  expect(text).toContain('Darunter steht weiter der vorige Plan.')
  expect(text).toContain('Katalog-Texte abnehmen')
  expect(welt.toasts.at(-1)).toContain('Ableiten fehlgeschlagen: Das Modell hat nicht geantwortet')
  expect(gespeichert(welt, `${ORDNER}/letzter.json`)).toMatchObject({ ergebnis: 'gescheitert', antwort: null, plan: null })
  // Der gespeicherte Plan bleibt der letzte gelungene.
  expect(welt.dateien.get(`${ORDNER}/plan.json`)).toBe(vorher)

  // Eine abgeschnittene Antwort und eine ohne Text sagen, woran es lag.
  welt.modell = { isAnswered: true, text: antwort().slice(0, 500), usage: { ...VERBRAUCH, output_tokens: 16_000 } }
  await leiteAb(ui, welt)
  expect(await inhalt(ui)).toContain('In der Antwort des Modells steht kein JSON-Objekt. Sie endet an der Grenze von 16000 Tokens und ist wohl abgeschnitten.')

  welt.modell = { isAnswered: false, reason: 'aborted', usage: VERBRAUCH }
  await leiteAb(ui, welt)
  expect(await inhalt(ui)).toContain('Der Modell-Aufruf wurde abgebrochen, spätestens nach 240 s.')

  // Eine neue Session lädt den letzten gelungenen Plan, ohne Modell-Aufruf.
  welt.modell = { isAnswered: true, text: antwort(), usage: VERBRAUCH }
  await leiteAb(ui, welt)
  expect(await inhalt(ui)).not.toContain('Ableiten fehlgeschlagen')
  await ui.unmount()
})

test('eine neue Session lädt den gespeicherten Plan des Repos; eine fremde oder kaputte Datei nicht', async ($, on) => {
  const welt = baue(on)

  legeShop(welt)
  welt.dateien.set(
    `${ORDNER}/plan.json`,
    JSON.stringify({
      version: 1,
      // So hat die Version 0.1.0 der breiten Ansicht ihren Plan abgelegt, damals in einem eigenen Ordner.
      fakten: { zeit: JETZT - 3 * 60 * 60_000, dauerMs: 31_000, modellMs: 30_000, dateien: 5, chats: 1, commits: 30, modell: 'claude-sonnet-5-5', datei: `${HEIM}/.claude/orchestrator/github.com+beispiel+shop/plan.json` },
      antwort: antwort(),
      umfeld: { chats: [CHAT], quellen: QUELLEN },
      goal: GOAL,
      hinweise: ['docs/kasse.md gekürzt: 12000 von 20000 Zeichen.'],
    }),
  )

  // Schon der Start der Session lädt: Eine Leiste, die noch offen ist, steht nicht leer da.
  await $.session.start({ cwd: WURZEL, surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BREIT, surface: 'desktop' })
  const text = await inhalt(ui)

  expect(welt.fragen).toHaveLength(0)
  expect(welt.geschrieben.size).toBe(0)
  expect(text).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
  expect(text).toContain('Abgeleitet vor 3 Std in 31 s aus 5 Dateien, 1 Chat und 30 Commits · claude-sonnet-5-5')
  expect(text).toContain('Beim Ableiten aufgefallen (1)')
  expect(text).toContain('– docs/kasse.md gekürzt: 12000 von 20000 Zeichen.')
  expect(text).toContain('◉ Entwurf Warenkorb-Regeln [Chat wartet auf dich]')
  // Wo der Plan liegt, sagt die Leiste nach dem Ort, von dem sie ihn gelesen hat.
  expect(text).toContain(`Der Plan liegt in ${ORDNER}/plan.json.`)
  expect(await befehl($, 'orchestrator')).toBe('Orchestrator geöffnet. Letzter Plan geladen: 11 Bündel in 4 Strängen.')
  expect(welt.geoeffnet.at(-1)).toEqual({ id: 'orchestrator', title: 'Orchestrator', columns: 200 })

  welt.platz = { isPlaced: false, reason: 'keine verbundene Oberfläche zeichnet Leisten' }
  expect(await befehl($, 'orchestrator')).toBe(
    'Orchestrator wartet und wird nicht gezeichnet: keine verbundene Oberfläche zeichnet Leisten. Letzter Plan geladen: 11 Bündel in 4 Strängen.',
  )

  for (const kaputt of ['kein JSON', JSON.stringify({ version: 7, antwort: antwort() }), JSON.stringify({ version: 1, antwort: 'ohne JSON' })]) {
    welt.dateien.set(`${ORDNER}/plan.json`, kaputt)
    await ui.press({ key: 'laden' })
    expect(await inhalt(ui)).toContain('Noch kein Plan für dieses Repo.')
    expect(await inhalt(ui)).toContain('Der gespeicherte Plan ist nicht lesbar')
  }

  await ui.unmount()
})

test('ohne git, ohne Doku, ohne Chats und ohne Repo läuft der Lauf trotzdem; im Worktree zählt auch die GOAL.md der Haupt-Wurzel', async ($, on) => {
  const karg = baue(on, {
    remote: undefined,
    commits: null,
    modell: { isAnswered: true, text: antwort({ stamm: STAMM_OHNE_GOAL, chats: [], zeilen: ZEILEN.map(one => ({ ...one, quelle: 'commits' })) }), usage: VERBRAUCH },
  })
  const ordner = `${HEIM}/.claude/ziel-graph/lokal+arbeit+shop/plan`

  await befehl($, 'orchestrator')

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(ui, karg)

  const eingabe = karg.fragen[0]?.prompt ?? ''

  expect(eingabe).not.toContain('<goal')
  expect(eingabe).toContain('Das Repo hat keine Markdown-Doku.')
  expect(eingabe).toContain('Es laufen keine Chats.')
  expect(eingabe).toContain('Kein Git-Verlauf lesbar.')
  expect(await inhalt(ui)).toContain('Endziel (vermutet): der Shop im Betrieb')
  expect(await inhalt(ui)).toContain('0 Chats · keiner wartet auf dich')
  expect(await inhalt(ui)).toContain('– Kein Git-Verlauf: git ließ sich nicht starten.')
  expect(await inhalt(ui)).toContain(`Der Plan liegt in ${ordner}/plan.json.`)
  expect(karg.meldungen).toHaveLength(0)

  // Jetzt ein Worktree: Die Session läuft daneben, GOAL.md und die Chats liegen beim Repo.
  karg.remote = GITHUB
  karg.ordner = '/arbeit/shop-worktrees/kasse'
  karg.dateien.set(`${WURZEL}/GOAL.md`, GOAL)
  karg.dateien.set(`${WURZEL}/README.md`, '# Shop\n')
  await ui.press({ key: 'laden' })
  expect(await inhalt(ui)).toContain('Noch kein Plan für dieses Repo.')
  expect(await inhalt(ui)).not.toContain('GOAL.md fehlt')

  karg.modell = { isAnswered: true, text: antwort({ chats: [] }), usage: VERBRAUCH }
  await leiteAb(ui, karg)
  expect(karg.fragen[1]?.prompt).toContain(`<goal datei="GOAL.md">\n${GOAL.trim()}\n</goal>`)
  expect(karg.fragen[1]?.prompt).toContain('<doku datei="README.md">')
  expect(await inhalt(ui)).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
  expect(karg.dateien.has(`${ORDNER}/plan.json`)).toBe(true)

  // Die eigene GOAL.md des Worktrees geht vor.
  karg.dateien.set('/arbeit/shop-worktrees/kasse/GOAL.md', '## Endziel\nNur die Kasse.\n')
  await ui.press({ key: 'laden' })
  expect(await inhalt(ui)).toContain('Endziel: Nur die Kasse.')

  await ui.unmount()
})
