import { expect, test } from 'claude-code/testing'

import { sicht } from '../hooks/karten/karten'
import { baueFlaeche, vorschau, wunschZellen } from '../hooks/karten/zeichnen'
import { lesePlan, zeichneGraph, zeichneKarten } from '../hooks/probe'

import { pruefeGraph, pruefePlatz } from './bild'
import { GOAL, QUELLEN, CHAT, antwort, gelungen, umfeld } from './shop'
import { GRAPH, ORDNER, mitPlan } from './welt'

// Die Probe ohne App: aus dem Text einer gespeicherten Plan-Datei der Graph der schmalen
// Ansicht und ein Bild der Karten der breiten, je hell und dunkel.

test('aus der Plan-Datei, die ein Lauf schreibt, baut die Probe den Graphen und die Karten, hell und dunkel', async ($, on) => {
  const welt = await mitPlan($, on)
  const json = welt.dateien.get(`${ORDNER}/plan.json`) ?? ''
  const { plan } = gelungen(antwort())

  // Der Plan, so wie beide Ansichten ihn nach „Neu laden“ zeigen. Ohne Angabe laufen die
  // Chats, die das Modell beim Ableiten kannte, und keiner wartet.
  const gelesen = lesePlan(json)

  expect(gelesen?.plan).toEqual(plan)
  expect(gelesen?.warnungen).toEqual([])
  expect(gelesen?.chats.chats.map(one => `${one.id}|${one.name}|${one.frage}`)).toEqual(['sitzung-7|Warenkorb-Regeln|'])
  // Am Dauerläufer „Betrieb“ hängt kein Chat: Er ruht, in der Probe wie in den Ansichten.
  expect([...(gelesen?.ruhend ?? [])]).toEqual(['betrieb'])

  // (a) Der Graph der schmalen Ansicht, im Aussehen „Ruhig“.
  for (const [farben, grund] of [['hell', '#ffffff'], ['dunkel', '#18242a']] as const) {
    const probe = zeichneGraph(json, { farben })

    if (probe === null) {
      throw new Error('kein Graph')
    }

    pruefeGraph(probe.daten)
    pruefePlatz(probe.bild)
    expect(probe.bild.breite).toBe(500)
    expect(probe.bild.source.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 ')).toBe(true)
    expect(probe.bild.source.endsWith('</svg>')).toBe(true)
    // Ein festes Farbschema: Das Bild sieht außerhalb der App so aus wie in ihr.
    expect(probe.bild.source).not.toContain('prefers-color-scheme')
    expect(probe.bild.source).toContain(`fill="${grund}"`)
    expect(probe.bild.source).toContain('>Katalog: 2 erledigt</text>')
    expect(probe.bild.source).toContain('>Großer Umbau</text>')
    expect(probe.bild.zeilen.map(one => one.id)).toEqual([
      'erledigt-katalog',
      'erledigt-kasse',
      'katalog-texte',
      'warenkorb',
      'gutscheine',
      'suchfelder',
      'ruht-betrieb',
      'rueckfragen',
      'rechnungen',
      'grundstock-steht',
      'grosser-umbau',
      'lasttest-bestanden',
      'endziel',
    ])
  }

  // Dasselbe Bild zeigt die Leiste, in Streifen geschnitten: Jeder Streifen trägt es ganz.
  const ui = await $.ui.mount({ ...GRAPH, surface: 'desktop' })
  const leiste = zeichneGraph(json, { chats: [{ id: 'sitzung-7', frage: 'Sollen Gutscheine auch den Versand decken?' }] })
  const streifen = await ui.findAll({ type: 'Svg' })

  expect(streifen).toHaveLength(14)
  expect(String(streifen[0]?.props.source).slice(String(streifen[0]?.props.source).indexOf('<style>'))).toContain(
    (leiste?.bild.source ?? '-').slice((leiste?.bild.source ?? '-').indexOf('<style>'), -'</svg>'.length),
  )
  await ui.unmount()

  // Aufgeklappt, die Übersicht, und Chats nach Wahl: ohne, oder mit einer Frage.
  expect(zeichneGraph(json, { offen: ['katalog-texte'] })?.bild.source).toContain('>Jacken: Farbgruppen</text>')
  expect(zeichneGraph(json)?.bild.source).not.toContain('>Jacken: Farbgruppen</text>')
  expect(zeichneGraph(json, { ansicht: 'uebersicht' })?.bild.alt).toContain('Ansicht Übersicht')
  expect(zeichneGraph(json)?.sicht.zaehler).toBe('4 Bündel jetzt möglich · 1 laufen · 0 warten auf dich')
  expect(zeichneGraph(json, { chats: [] })?.sicht.zaehler).toBe('4 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
  expect(zeichneGraph(json, { chats: [{ id: 'sitzung-7', frage: 'Ja?' }] })?.sicht.zaehler).toBe(
    '4 Bündel jetzt möglich · 1 laufen · 1 warten auf dich',
  )
  // Der Dauerläufer, der ruht, zählt nicht mit; aufgeklappt nennt seine Zeile seine zwei Bündel.
  expect(zeichneGraph(json, { offen: ['ruht-betrieb'] })?.bild.source).toContain('>Umbau der Build-Skripte</text>')

  // (b) Die Karten der breiten Ansicht als ein Bild.
  for (const [farben, karte, grund] of [['hell', '#ffffff', '#f4f6f7'], ['dunkel', '#1d242b', '#14191e']] as const) {
    const bild = zeichneKarten(json, { farben })

    expect(bild?.source.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ')).toBe(true)
    expect(bild?.source.endsWith('</svg>')).toBe(true)
    expect(bild?.source.split('<svg ').length).toBe(bild?.source.split('</svg>').length)
    expect(bild?.source).not.toMatch(/NaN|undefined|prefers-color-scheme/)
    expect(bild?.source).toContain(`fill="${grund}"`)
    expect(bild?.source).toContain(`fill="${karte}"`)
    expect(bild?.source).toContain('>Block Rechnungen</text>')
    expect(bild?.source).toContain('>→ Großer Umbau</text>')
    expect(bild?.source).toContain('>Chat läuft</text>')
    expect((bild?.breite ?? 0) > 1000 && (bild?.hoehe ?? 0) > 500).toBe(true)
    // So breit, wie `/orchestrator` sich die Leiste wünscht: dieselbe Fläche wie dort.
    expect(bild?.source).toContain('>ruht · 2 offen</text>')
    expect(bild?.source).not.toContain('>Umbau der Build-Skripte</text>')
    expect(bild).toEqual(
      vorschau(
        baueFlaeche(sicht(plan, gelesen?.chats ?? { ich: '', chats: [], gelesen: 0 }, '', null, gelesen?.ruhend), { zellen: wunschZellen(4), farben }),
        farben,
      ),
    )
  }

  // Schmaler stehen die Stränge untereinander; eine gewählte Karte ist kräftig umrandet.
  expect((zeichneKarten(json, { zellen: 58 })?.breite ?? 0) < 400).toBe(true)
  expect(zeichneKarten(json, { karte: 'gutscheine' })?.source).toContain('stroke-width="2" fill="#ffffff" stroke="#16242b"')
  expect(zeichneKarten(json, { chats: [{ id: 'sitzung-7', frage: 'Ja?' }] })?.source).toContain('>Chat wartet auf dich</text>')
  expect(zeichneKarten(json, { chats: [] })?.source).not.toContain('>Chat läuft</text>')
})

test('die Probe räumt gegen die GOAL.md auf, die in der Plan-Datei steht, oder gegen eine andere', () => {
  // Eine Plan-Datei, wie sie auf der Platte liegt: die rohe Antwort, ihr Umfeld und der Text von GOAL.md.
  const json = JSON.stringify({
    version: 1,
    fakten: { zeit: 0, dauerMs: 31_000, modellMs: 30_000, dateien: 5, chats: 1, commits: 30, modell: 'claude-sonnet-5-5', datei: '' },
    antwort: antwort(),
    umfeld: { chats: [CHAT], quellen: QUELLEN },
    goal: GOAL,
    hinweise: [],
  })

  expect(lesePlan(json)?.plan).toEqual(gelungen(antwort()).plan)
  expect(zeichneGraph(json)?.daten.endziel).toBe('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')

  // Ohne GOAL.md gilt, was das Modell nennt, als vermutet; mit einer anderen gilt die andere.
  expect(lesePlan(json, { goal: null })?.plan).toEqual(gelungen(antwort(), umfeld(null)).plan)
  expect(zeichneGraph(json, { goal: null })?.daten.endziel).toBe('Endziel (vermutet): der Shop im Betrieb')
  expect(zeichneKarten(json, { goal: null })?.source).toContain('>kein Ziel festgelegt</text>')
  expect(zeichneGraph(json, { goal: '## Endziel\nNur die Kasse.\n' })?.daten.endziel).toBe('Endziel: Nur die Kasse.')

  // Was keine Plan-Datei ist oder keinen Plan ergibt, ergibt kein Bild.
  for (const kaputt of ['', 'kein JSON', '{}', JSON.stringify({ version: 7, antwort: antwort() }), JSON.stringify({ version: 1, antwort: 'ohne JSON' })]) {
    expect(lesePlan(kaputt)).toBe(null)
    expect(zeichneGraph(kaputt)).toBe(null)
    expect(zeichneKarten(kaputt)).toBe(null)
  }
})
