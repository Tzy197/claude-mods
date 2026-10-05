import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { SVG_GRENZE } from '../hooks/graph/zeichnen'
import type { Bild } from '../hooks/graph/zeichnen'
import { AUFTRAG } from '../hooks/plan/ableiten'
import { promptEndziel, promptGoalAnlegen, promptStrangZiel } from '../hooks/plan/goal'
import { strangFrage } from '../hooks/plan/lesen'
import { zeichneGraph } from '../hooks/probe'
import type { GraphWunsch } from '../hooks/probe'

import { PLATZ, ausschnittVon, pruefePlatz, pruefeTeilung } from './bild'
import { GOAL, OHNE_GOAL, antwort, antwortOhneGoal, gelungen, umfeld } from './shop'
import {
  GRAPH,
  ORDNER,
  SURFACES,
  VERBRAUCH,
  WURZEL,
  alleKnoten,
  baue,
  befehl,
  gespeichert,
  kinder,
  legeChat,
  legeDoku,
  legeShop,
  leiteAb,
  mitBildern,
  zeilenVon,
} from './welt'
import type { Knoten, Vorgabe, Welt, Zeichnung } from './welt'

// Die schmale Ansicht `/graph`: unter den Chats der Plan als Graph, im Aussehen „Ruhig“, in
// Streifen mit einem echten Pfeil-Knopf je Zeile. Die Maße hängen am Shop ohne GOAL.md. An
// seinem Dauerläufer „Betrieb“ arbeitet kein Chat: Er ruht und steht in einer Zeile.

// Eine Session mit dem Shop ohne GOAL.md, in der die schmale Ansicht offen ist und das
// Modell die Bahnen selbst schneidet.
const ohneGoal = (on: On, vorgabe: Partial<Vorgabe> = {}): Welt => {
  const welt = baue(on, { modell: { isAnswered: true, text: antwortOhneGoal(), usage: VERBRAUCH }, ...vorgabe })

  legeShop(welt, null)

  return welt
}

// Das Bild, das die Leiste in Streifen zeigen muss: aus der gespeicherten Plan-Datei, nach
// „Ruhig“, mit diesen Zeilen offen. So baut es die Probe ohne App. Der Chat am Warenkorb wartet.
const WARTEND = [{ id: 'sitzung-7', frage: 'Sollen Gutscheine auch den Versand decken?' }]

const ganzesBild = (welt: Welt, wunsch: GraphWunsch = {}): Bild => {
  const probe = zeichneGraph(welt.dateien.get(`${ORDNER}/plan.json`) ?? '', { chats: WARTEND, ...wunsch })

  if (probe === null) {
    throw new Error('Die Plan-Datei ergibt keinen Graphen.')
  }

  return probe.bild
}

// Die Zeilen mit Unterzeilen: zuerst je Bahn die Zeile für das, was hinter uns liegt. Die
// zwei offenen Bündel des Dauerläufers „Betrieb“ stehen in der einen Zeile „ruht“.
const BUENDEL = [
  'erledigt-kat',
  'erledigt-kas',
  'katalog-texte',
  'warenkorb',
  'gutscheine',
  'suchfelder',
  'ruht-btr',
  'rueckfragen',
  'rechnungen',
  'umbau',
  'lasttest',
  'lager',
]

// Die Knöpfe über dem Graphen, von oben nach unten: zuerst der für den einen Chat des Shops,
// der seit Wochen still und deshalb ausgeblendet ist. Ohne GOAL.md steht ihr Hinweis dabei.
const KOPF_KNOEPFE = ['ausgeblendete', 'laden', 'auf', 'neu', 'goal-anlegen', 'ansicht-schritte', 'ansicht-uebersicht']

// Der Aufbau ohne die Blätter: welche Box mit welchen Angaben worin steckt.
const gerippe = (knoten: Knoten): unknown =>
  knoten.type === 'Box'
    ? { type: 'Box', props: knoten.props ?? {}, children: kinder(knoten).map(gerippe) }
    : knoten.type

// Ein Streifen, wie die Leiste ihn zeichnet: sein Ausschnitt, und der Knopf, der über ihm liegt.
type Gestapelt = {
  source: string
  alt: string
  breite: unknown
  hoehe: unknown
  oben: number
  // der Schlüssel des Knopfes und sein Zeichen; null: Der Streifen hat keinen
  knopf: string | null
  zeichen: string | null
}

// So steht ein Streifen mit Knopf da. Außen eine Reihe; darin eine Box, die als Kind der
// Reihe genau so breit ist wie ihr Inhalt, der Streifen. In ihr das Bild und nach ihm, also
// über ihm, der Knopf: `absolute` an der Oberkante der Zeile, eine Zelle vom rechten Rand
// des Streifens. Er hängt am rechten Rand, nicht am linken: Wie breit eine Zelle ist,
// verschiebt ihn so kaum. Keine Box hat eine Breite in Zellen, keine wächst, nichts hat
// `left`. Der Knopf braucht keinen Platz und kann die Streifen nicht auseinanderdrücken.
const REIHE = {
  type: 'Box',
  props: { flexDirection: 'row' },
  children: [
    {
      type: 'Box',
      props: { position: 'relative', alignItems: 'flex-start' },
      children: ['Svg', { type: 'Box', props: { position: 'absolute', top: 0, right: 1 }, children: ['Button'] }],
    },
  ],
}

// Der Stapel der Streifen aus dem gezeichneten Baum, von oben nach unten; leer, wenn die
// Leiste kein Bild zeichnet. Prüft dabei den Aufbau: eine Spalte ohne Abstand, darin je
// Streifen entweder das Bild allein oder das Bild mit dem Knopf darüber.
const stapel = async (ui: Zeichnung): Promise<Gestapelt[]> => {
  const baum = (await ui.drawn()) as Knoten
  const spalte = alleKnoten(baum).find(one => one.type === 'Box' && kinder(one).some(kind => kind.type === 'Svg'))

  if (spalte === undefined) {
    return []
  }

  expect(spalte.props).toEqual({ flexDirection: 'column' })

  return kinder(spalte).map(kind => {
    if (kind.type !== 'Svg') {
      expect(gerippe(kind)).toEqual(REIHE)
    }

    const svg = alleKnoten(kind).find(one => one.type === 'Svg')
    const knoepfe = alleKnoten(kind).filter(one => one.type === 'Button')
    const knopf = knoepfe[0]
    const source = String(svg?.props?.source)

    // Höchstens ein Knopf je Streifen: Über der ganzen Titelzeile liegt keiner.
    expect(knoepfe.length <= 1).toBe(true)

    if (knopf !== undefined) {
      // Ein schlichter Knopf, der nur das Zeichen trägt, mit je drei geschützten Leerzeichen
      // davor und dahinter: So ist er etwa so breit wie der freie Platz im Bild.
      expect(Object.keys(knopf.props ?? {}).sort()).toEqual(['key', 'label', 'plain'])
      expect(knopf.props?.plain).toBe(true)
      expect(/^ {3}[▸▾] {3}$/.test(String(knopf.props?.label))).toBe(true)
    }

    return {
      source,
      alt: String(svg?.props?.alt),
      breite: svg?.props?.width,
      // Die Höhe folgt aus dem Bild: Eine feste Höhe drückte den Streifen in einer schmalen
      // Leiste zusammen.
      hoehe: svg?.props?.height === undefined ? ausschnittVon(source).hoehe : 'feste Höhe',
      oben: ausschnittVon(source).oben,
      knopf: knopf === undefined ? null : String(knopf.props?.key),
      zeichen: knopf === undefined ? null : String(knopf.props?.label).replace(/ /g, ''),
    }
  })
}

// Wo jeder Streifen liegt und was neben ihm steht, ohne das Bild selbst.
const lage = (teile: readonly Gestapelt[]) =>
  teile.map(one => ({ oben: one.oben, hoehe: one.hoehe, knopf: one.knopf, zeichen: one.zeichen }))

const knoepfe = async (ui: Zeichnung): Promise<unknown[]> => (await ui.findAll({ type: 'Button' })).map(one => one.props.key)

// ---------- Ableiten und zeigen ----------

for (const surface of SURFACES) {
  test(`${surface}: „Neu ableiten“ in der schmalen Ansicht fragt Sonnet 5.5 einmal und zeigt den Plan als Graphen`, async ($, on) => {
    const welt = ohneGoal(on)

    // Die Leiste wünscht sich so viel Platz, wie das Bild breit ist, und etwas Rand.
    expect(await befehl($, 'graph')).toBe('Ziel-Graph geöffnet. (Oberflächen: desktop)')
    expect(welt.geoeffnet).toEqual([{ id: 'ziel-graph', title: 'Ziel-Graph', columns: 66 }])
    expect(66 * 7.8 >= 500 && 66 * 7.8 < 520).toBe(true)

    const ui = await $.ui.mount({ ...GRAPH, surface })

    // Ohne Plan: oben die Chats, darunter ein Satz, der Knopf und wie GOAL.md dasteht.
    const ohne = await mitBildern(ui)

    expect(ohne).toContain('1 Chat, 1 wartet auf dich')
    expect(ohne).toContain('Noch kein Plan für dieses Repo: „Neu ableiten“ leitet ihn aus GOAL.md, Doku, Chats und Commits ab.')
    expect(ohne).toContain('GOAL.md fehlt: Ohne sie ist alles über Ziele nur vermutet.')
    expect(ohne).toContain('1 fertiger oder stiller Chat ausgeblendet')
    expect(await knoepfe(ui)).toEqual(['ausgeblendete', 'laden', 'auf', 'neu', 'goal-anlegen'])
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)

    // Der Knopf kehrt sofort zurück: Der Lauf beginnt erst danach.
    await ui.press({ key: 'neu' })
    expect(welt.fragen).toHaveLength(0)
    expect(await mitBildern(ui)).toContain('Ableiten läuft …')
    expect(await mitBildern(ui)).not.toContain('Noch kein Plan')

    // Jetzt läuft der Modell-Aufruf, und die Leiste zählt mit.
    await welt.uhr.advance(10_000)
    expect(welt.fragen).toHaveLength(1)
    expect(await mitBildern(ui)).toContain('Ableiten läuft … seit 10 s')
    expect(await mitBildern(ui)).toContain('Ein Modell-Aufruf mit claude-sonnet-5-5 liest GOAL.md, Doku, Chats und Commits des Repos.')
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
    expect(welt.toasts).toHaveLength(0)

    await welt.uhr.advance(13_000)

    // Ein Aufruf, mit Sonnet 5.5, dem Auftrag als System-Prompt und großzügigen Grenzen.
    expect(welt.fragen).toHaveLength(1)
    expect(welt.fragen[0]?.model).toBe('claude-sonnet-5-5')
    expect(welt.fragen[0]?.system).toBe(AUFTRAG)
    expect(welt.fragen[0]?.maxTokens).toBe(16_000)
    expect(welt.fragen[0]?.timeoutMs).toBe(240_000)

    // Er kennt die Doku, den einen laufenden Chat und die Commits, und sonst nichts.
    const eingabe = welt.fragen[0]?.prompt ?? ''

    expect(eingabe).toContain('Heute ist der 2026-10-04.')
    expect(eingabe).not.toContain('<goal')
    expect(eingabe.match(/<doku datei="[^"]+"/g)).toEqual([
      '<doku datei="README.md"',
      '<doku datei="CLAUDE.md"',
      '<doku datei="docs/kasse.md"',
      '<doku datei="docs/katalog.md"',
      '<doku datei="docs/plan/suche.md"',
    ])
    expect(eingabe).toContain('13 Produktseiten stehen.')
    expect(eingabe).toContain('c1 · Warenkorb-Regeln · Branch t21-warenkorb')
    expect(eingabe).toContain('Stand: Der Entwurf der Regeln steht.')
    expect(eingabe).toContain('Offene Frage an den Nutzer: Sollen Gutscheine auch den Versand decken?')
    expect(eingabe).not.toContain('Herausgenommen')
    expect(eingabe).not.toContain('Uralt')
    expect(eingabe).not.toContain('Versteckt')
    expect(eingabe).not.toContain('Nicht unter docs')
    expect(eingabe).toContain('2026-09-30 Katalog: Schritt 30\n2026-09-29 Katalog: Schritt 29')
    expect(eingabe).toContain('2026-09-01 Katalog: Schritt 1\n</commits>')
    expect(welt.laeufe).toEqual(['git log -n 30 --date=short --pretty=format:%ad %s'])

    // Die Leiste zeigt den Graphen: mit Svg als Bild in Streifen (der Kopf und je Zeile
    // einer), im Terminal als Liste.
    const svg = await ui.findAll({ type: 'Svg' })

    expect(await ui.drawn()).toMatchObject({ type: 'Box' })
    expect(svg).toHaveLength(surface === 'terminal' ? 0 : 14)

    if (surface !== 'terminal') {
      const source = String(svg[0]?.props.source)

      expect(source.startsWith('<svg ')).toBe(true)
      expect(source.endsWith('</svg>')).toBe(true)
      expect(source.length < SVG_GRENZE).toBe(true)
      expect(String(svg[0]?.props.alt)).toContain('Ansicht Schritte')
    }

    const text = await mitBildern(ui)

    expect(text).not.toContain('Ableiten läuft')
    // Oben stehen weiter die Chats, wie bisher.
    expect(text).toContain('1 Chat, 1 wartet auf dich')
    expect(text).toContain('● Warenkorb-Regeln')
    expect(text).toContain('Wartet auf dich: Sollen Gutscheine auch den Versand decken?')
    // Darunter der Plan: Endziel, die Eckdaten des Laufs und die Zähler.
    expect(text).toContain('Endziel (vermutet): der Shop im Betrieb')
    expect(text).toContain('Abgeleitet gerade eben in 23 s aus 5 Dateien, 1 Chat und 30 Commits · claude-sonnet-5-5')
    // Was der Dauerläufer offen hat, zählt nicht mit: Er ruht.
    expect(text).toContain('4 Bündel jetzt möglich · 1 laufen · 1 warten auf dich')
    expect(text).toContain('HINTER UNS')
    expect(text).toContain('JETZT MÖGLICH')
    expect(text).toContain('SPÄTER')
    expect(text).toContain('Katalog: 1 erledigt')
    expect(text).toContain('Betrieb: ruht · 2 offen')
    expect(text).toContain('Entwurf Warenkorb-Regeln')
    expect(text).toContain('[Chat · wartet auf dich]')
    expect(text).toContain('Treffpunkt: Großer Umbau')
    // Eine Antwort nach Vorschrift braucht keinen Hinweis.
    expect(text).not.toContain('Beim Ableiten aufgefallen')
    // Kein Beispiel, keine erfundenen Daten mehr.
    expect(text).not.toContain('Beispiel')
    expect(welt.toasts).toEqual(['Ableiten fertig nach 23 s: 10 Bündel in 4 Strängen'])
    expect(welt.meldungen).toHaveLength(0)

    // Plan und Lauf liegen im Unterordner des Repos, neben den Ständen der Chats, nicht dazwischen.
    expect([...welt.geschrieben.keys()].sort()).toEqual(
      ['lauf-2026-10-04T12-00-00-000Z.json', 'letzte-eingabe.txt', 'letzter.json', 'plan.json'].map(one => `${ORDNER}/${one}`),
    )
    expect(gespeichert(welt, `${ORDNER}/plan.json`).plan).toEqual(gelungen(antwortOhneGoal(), umfeld(null)).plan)

    await ui.unmount()
  })
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}: Die Ansicht wechselt, Bündel klappen einzeln und alle auf einmal auf`, async ($, on) => {
    const welt = ohneGoal(on)
    const ui = await $.ui.mount({ ...GRAPH, surface })

    await leiteAb(ui, welt)

    // Zuerst ist alles zugeklappt.
    expect(await mitBildern(ui)).not.toContain('Jacken: Farbgruppen')
    expect(await mitBildern(ui)).not.toContain('Quelle: docs/kasse.md')

    await ui.press({ key: 'auf-katalog-texte' })
    expect(await mitBildern(ui)).toContain('Jacken: Farbgruppen')
    expect(await mitBildern(ui)).toContain('Quelle: docs/katalog.md')
    expect(await mitBildern(ui)).not.toContain('Quelle: docs/kasse.md')

    await ui.press({ key: 'auf-katalog-texte' })
    expect(await mitBildern(ui)).not.toContain('Jacken: Farbgruppen')

    await ui.press({ key: 'alles' })

    const offen = await mitBildern(ui)

    expect(offen).toContain('Jacken: Farbgruppen')
    expect(offen).toContain('Quelle: docs/kasse.md')
    expect(offen).toContain('Chat: Warenkorb-Regeln · wartet auf dich')
    expect(offen).toContain('Alles zuklappen')

    await ui.press({ key: 'alles' })
    expect(await mitBildern(ui)).not.toContain('Quelle: docs/kasse.md')

    await ui.press({ key: 'ansicht-uebersicht' })

    const uebersicht = await mitBildern(ui)

    expect(uebersicht).toContain('3 offen · 2 jetzt möglich · 1 Chat')
    expect(uebersicht).toContain('Betrieb · Dauerläufer')
    expect(uebersicht).toContain('Treffpunkt: Großer Umbau')
    expect(uebersicht).not.toContain('Grundstock: 13 Produktseiten fertig')
    expect(uebersicht).not.toContain('JETZT MÖGLICH')
    expect(await ui.findAll({ key: 'alles' })).toHaveLength(0)

    await ui.press({ key: 'ansicht-schritte' })
    expect(await mitBildern(ui)).toContain('Grundstock: 13 Produktseiten fertig')

    // Ein neuer Plan hat neue Zeilen: Was aufgeklappt war, ist danach wieder zu.
    await ui.press({ key: 'auf-katalog-texte' })
    expect(await mitBildern(ui)).toContain('Jacken: Farbgruppen')
    await leiteAb(ui, welt)
    expect(await mitBildern(ui)).not.toContain('Jacken: Farbgruppen')

    await ui.unmount()
  })
}

// ---------- Die Streifen und der Pfeil-Knopf ----------

for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
  test(`${surface}: Der Graph steht als Stapel von Streifen da, und jedes Bündel mit Unterzeilen hat seinen Pfeil rechts in der Zeile`, async ($, on) => {
    const welt = ohneGoal(on)
    const ui = await $.ui.mount({ ...GRAPH, surface })

    await leiteAb(ui, welt)

    const ganz = ganzesBild(welt)
    const teile = await stapel(ui)

    // Ein Svg je Streifen: der Kopf und je Zeile einer. Zusammen sind sie genau das eine Bild.
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(teile.length)
    expect(teile).toHaveLength(14)
    pruefeTeilung(ganz, teile)
    expect([ganz.breite, ganz.hoehe]).toEqual([500, 765])
    expect(teile.every(one => one.breite === 500)).toBe(true)
    expect(teile[0]?.alt).toContain('Ziel-Graph, Ansicht Schritte.')
    expect(teile[1]?.alt).toBe('Katalog: 1 erledigt')
    expect(teile[3]?.alt).toBe('Katalog-Texte abnehmen')

    // Der Kopf und das Endziel haben keinen Knopf, jede Zeile mit Unterzeilen genau einen:
    // über ihrem Streifen, am rechten Ende der Zeile, zugeklappt.
    expect(teile.map(one => one.knopf)).toEqual([null, ...BUENDEL.map(one => `auf-${one}`), null])
    expect(teile.map(one => one.zeichen)).toEqual([null, ...BUENDEL.map(() => '▸'), null])
    expect(ganz.zeilen.map(one => one.id)).toEqual([...BUENDEL, 'endziel'])
    // Ein Streifen mit Knopf ist nie kürzer als eine Zeile.
    expect(teile.filter(one => one.knopf !== null).every(one => Number(one.hoehe) >= 46)).toBe(true)
    // Kein doppelter Pfeil: Das Bild zeigt kein Klapp-Zeichen. Der Titel beginnt gleich
    // nach den Bahnen, und der Platz, auf dem der Knopf liegt, ist im Bild leer.
    expect(teile.some(one => /[▸▾]/.test(one.source))).toBe(false)
    expect(teile[3]?.source).toContain(
      '<text x="120" y="205" font-size="15" font-weight="600" fill="#16242b" class="f-schrift">Katalog-Texte abnehmen</text>',
    )
    expect(pruefePlatz(ganz) <= PLATZ.links).toBe(true)
    // Der Chat am Warenkorb markiert seine Zeile: Die Marke mit ihrem Punkt steht links vom freien Platz.
    expect(ganz.source).toContain('<rect x="412" y="236.5" width="50" height="20" rx="10"')
    expect(ganz.source).toContain('<circle cx="401" cy="246.5" r="5.5"')

    // „Hinter uns“ zeigt je Bahn eine Zeile; die erledigten Bündel stehen in ihrer Beschreibung.
    expect(ganz.source).toContain('>Katalog: 1 erledigt</text>')
    expect(ganz.source).toContain('>Grundstock: 13 Produktseiten fertig</text>')
    expect(ganz.source).toContain('>Kasse: 1 erledigt</text>')
    expect(await mitBildern(ui)).toContain('4 Bündel jetzt möglich · 1 laufen · 1 warten auf dich')

    // Der Dauerläufer, der ruht, steht in einer Zeile dort, wo seine zwei Bündel standen:
    // blass, mit dem kleinen Punkt, und seine Bahn endet weiter im Pfeil.
    expect(teile[7]?.alt).toBe('Betrieb: ruht · 2 offen')
    expect(ganz.source).toContain('font-weight="500" fill="#5a6d76" class="f-leise">Betrieb: ruht · 2 offen</text>')
    expect(ganz.source).toContain('>Ladezeit der Startseite senken · Umbau der Build-Sk…</text>')
    expect(ganz.source).toContain('<circle cx="96" cy="390" r="4.5" stroke-width="2" opacity="0.75"')
    expect(ganz.source).toContain(`<path d="M90.5 ${ganz.hoehe - 17} L101.5 ${ganz.hoehe - 17} L96 ${ganz.hoehe - 6} Z"`)

    // Sonst gibt es keinen Aufklapp-Knopf: Über dem Bild steht keine Liste dafür.
    expect(await knoepfe(ui)).toEqual([...KOPF_KNOEPFE, 'alles', ...BUENDEL.map(one => `auf-${one}`)])
    expect(await mitBildern(ui)).not.toContain('Bündel auf- und zuklappen')
    expect(await ui.findAll({ type: 'Text', text: 'zuklappen' })).toHaveLength(0)
    // Die schmale Ansicht hat keine Auswahl: weder Ziel noch Farben.
    expect(await ui.findAll({ type: 'Select' })).toHaveLength(0)

    // Der Plan selbst behält jedes erledigte Bündel für sich.
    const plan = gespeichert(welt, `${ORDNER}/plan.json`).plan as { buendel: { id: string }[] }

    expect(plan.buendel.slice(0, 2).map(one => one.id)).toEqual(['grundstock', 'zahlarten'])
    expect(plan.buendel.some(one => one.id.startsWith('erledigt-'))).toBe(false)

    // Die Probe ohne App baut aus der Plan-Datei dasselbe Bild; hell und dunkel legen die Farben fest.
    expect(ganzesBild(welt, { farben: 'dunkel' }).source).toContain('fill="#18242a"')
    expect(ganzesBild(welt, { farben: 'hell' }).source).not.toContain('prefers-color-scheme')
    expect(zeichneGraph('kein JSON')).toBe(null)

    await ui.unmount()
  })
}

test('desktop: Der Pfeil klappt das Bündel an seiner Zeile auf: Sein Streifen wächst, die darunter rücken nach', async ($, on) => {
  const welt = ohneGoal(on)
  const ui = await $.ui.mount({ ...GRAPH, surface: 'desktop' })

  await leiteAb(ui, welt)

  const zu = await stapel(ui)
  const stelle = zu.findIndex(one => one.knopf === 'auf-katalog-texte')
  const hoehe = (teile: readonly Gestapelt[]): number => teile.reduce((summe, one) => summe + Number(one.hoehe), 0)

  expect(stelle).toBe(3)
  expect(zu[stelle]).toMatchObject({ oben: 190, hoehe: 46, zeichen: '▸' })
  expect(hoehe(zu)).toBe(765)

  // Ein Druck auf den Pfeil: Die vier Unterzeilen stehen im Streifen des Bündels.
  await ui.press({ key: 'auf-katalog-texte' })

  const auf = await stapel(ui)
  const mehr = 6 + 4 * 21 + 6

  pruefeTeilung(ganzesBild(welt, { offen: ['katalog-texte'] }), auf)
  expect(auf[stelle]?.source).toContain('Jacken: Farbgruppen')
  expect(zu[stelle]?.source).not.toContain('Jacken: Farbgruppen')
  // Auch offen zeigt nur der Knopf den Pfeil, nicht das Bild.
  expect(auf.some(one => /[▸▾]/.test(one.source))).toBe(false)
  // Darüber bleibt alles, wo es war.
  expect(lage(auf.slice(0, stelle))).toEqual(lage(zu.slice(0, stelle)))
  // Der Streifen des Bündels wächst an seiner Stelle, und sein Pfeil zeigt nach unten.
  expect(lage(auf.slice(stelle, stelle + 1))).toEqual([
    { oben: 190, hoehe: 46 + mehr, knopf: 'auf-katalog-texte', zeichen: '▾' },
  ])
  // Die Streifen darunter sind dieselben, nur tiefer; das ganze Bild ist um so viel höher.
  expect(lage(auf.slice(stelle + 1))).toEqual(
    lage(zu.slice(stelle + 1)).map(one => ({ ...one, oben: one.oben + mehr })),
  )
  expect(hoehe(auf)).toBe(765 + mehr)

  // Noch ein Druck klappt es wieder zu: derselbe Stapel wie vorher.
  await ui.press({ key: 'auf-katalog-texte' })
  expect(await stapel(ui)).toEqual(zu)

  // Die Zeile „Katalog: 1 erledigt“ klappt genauso auf: Darunter steht das erledigte Bündel.
  await ui.press({ key: 'auf-erledigt-kat' })

  const erledigt = await stapel(ui)

  pruefeTeilung(ganzesBild(welt, { offen: ['erledigt-kat'] }), erledigt)
  expect(lage(erledigt.slice(1, 2))).toEqual([
    { oben: 66, hoehe: 46 + 6 + 21 + 6, knopf: 'auf-erledigt-kat', zeichen: '▾' },
  ])
  expect(erledigt[1]?.alt).toBe('Katalog: 1 erledigt: Grundstock: 13 Produktseiten fertig')
  expect(erledigt[1]?.source).toContain(
    '<text x="134" y="123" font-size="12.5" font-weight="400" fill="#5a6d76" class="f-leise">Grundstock: 13 Produktseiten fertig</text>',
  )
  await ui.press({ key: 'auf-erledigt-kat' })
  expect(await stapel(ui)).toEqual(zu)

  // „Alles aufklappen“ öffnet jede Zeile mit Unterzeilen an ihrer Stelle.
  await ui.press({ key: 'alles' })

  const alle = await stapel(ui)

  pruefeTeilung(ganzesBild(welt, { offen: BUENDEL }), alle)
  expect(alle.map(one => one.knopf)).toEqual(zu.map(one => one.knopf))
  expect(alle.map(one => one.zeichen)).toEqual([null, ...BUENDEL.map(() => '▾'), null])
  // Jeder Streifen mit Knopf ist gewachsen, die anderen nicht.
  expect(alle.map((one, i) => Number(one.hoehe) > Number(zu[i]?.hoehe))).toEqual(zu.map(one => one.knopf !== null))
  expect(alle.map((one, i) => Number(one.hoehe) >= Number(zu[i]?.hoehe))).toEqual(zu.map(() => true))
  // Acht Zeilen mit einer Unterzeile, dazu vier, zwei und drei und die zwei Bündel des
  // Dauerläufers, der ruht: je 21 px und 12 px Luft je Block.
  expect(hoehe(alle)).toBe(765 + 12 * 12 + (8 + 4 + 2 + 3 + 2) * 21)
  expect(await mitBildern(ui)).toContain('Alles zuklappen')

  // Ein einzelnes Bündel klappt auch dann an seiner Zeile wieder zu.
  await ui.press({ key: 'auf-umbau' })
  expect((await stapel(ui)).map(one => one.zeichen)).toEqual([
    null,
    ...BUENDEL.map(one => (one === 'umbau' ? '▸' : '▾')),
    null,
  ])
  expect(await mitBildern(ui)).toContain('Alles aufklappen')

  await ui.press({ key: 'alles' })
  await ui.press({ key: 'alles' })
  expect(await stapel(ui)).toEqual(zu)

  // Die Übersicht steht genauso in Streifen da. Dort hat keine Zeile Unterzeilen: kein Knopf.
  await ui.press({ key: 'ansicht-uebersicht' })

  const ueber = await stapel(ui)

  pruefeTeilung(ganzesBild(welt, { ansicht: 'uebersicht' }), ueber)
  expect(ueber).toHaveLength(9)
  expect(ueber[0]?.alt).toContain('Ziel-Graph, Ansicht Übersicht.')
  expect(ueber.every(one => one.knopf === null)).toBe(true)
  expect(await knoepfe(ui)).toEqual(KOPF_KNOEPFE)

  await ui.press({ key: 'ansicht-schritte' })
  expect(await stapel(ui)).toEqual(zu)

  await ui.unmount()
})

test('terminal: Die Liste zeigt dieselben Zeilen wie das Bild, das Bündel selbst ist der Knopf', async ($, on) => {
  const welt = ohneGoal(on)
  const ui = await $.ui.mount({ ...GRAPH, surface: 'terminal' })

  await leiteAb(ui, welt)

  const baum = (await ui.drawn()) as Knoten
  const liste = (offen: '' | 'erledigt-kat' | 'katalog-texte'): string[] => [
    // Oben die Chats, wie bisher.
    '1 Chat, 1 wartet auf dich',
    '● Warenkorb-Regeln',
    'gerade eben · t21-warenkorb',
    'Der Entwurf der Regeln steht.',
    'Weiter: Die Rundung der Beträge prüfen.',
    'Wartet auf dich: Sollen Gutscheine auch den Versand decken?',
    // Ein Chat des Shops ist seit Wochen still: Er steht nur als Zahl da.
    '1 fertiger oder stiller Chat ausgeblendet',
    '[ausgeblendete] Zeigen',
    '[laden] Neu laden',
    '[auf] Diesen Chat aufnehmen',
    // Darunter der Plan.
    '[neu] Neu ableiten',
    'GOAL.md fehlt: Ohne sie ist alles über Ziele nur vermutet.',
    '[goal-anlegen] GOAL.md mit dem Chat entwerfen',
    'Endziel (vermutet): der Shop im Betrieb',
    'Abgeleitet gerade eben in 23 s aus 5 Dateien, 1 Chat und 30 Commits · claude-sonnet-5-5',
    '4 Bündel jetzt möglich · 1 laufen · 1 warten auf dich',
    '[ansicht-schritte] Schritte',
    '[ansicht-uebersicht] Übersicht',
    '[alles] Alles aufklappen',
    'HINTER UNS',
    // „Ruhig“ gilt auch hier: je Bahn eine Zeile für das, was hinter uns liegt.
    `[auf-erledigt-kat] ● Katalog: 1 erledigt ${offen === 'erledigt-kat' ? '▾' : '▸'}`,
    '  Katalog · Grundstock: 13 Produktseiten fertig',
    ...(offen === 'erledigt-kat' ? ['      Grundstock: 13 Produktseiten fertig'] : []),
    '[auf-erledigt-kas] ● Kasse: 1 erledigt ▸',
    '  Kasse · Zahlarten geklärt und 5 Entwürfe',
    'JETZT MÖGLICH',
    `[auf-katalog-texte] ○ Katalog-Texte abnehmen ${offen === 'katalog-texte' ? '▾' : '▸'}`,
    '  Katalog · 3 von 5 Kategorien abgenommen',
    ...(offen === 'katalog-texte'
      ? [
          '      Schuhe: Größen als Variante oder Filter',
          '      Jacken: Farbgruppen',
          '      Taschen: Leder oder Stoff',
          '      Quelle: docs/katalog.md',
        ]
      : []),
    '[auf-warenkorb] ◉ Entwurf Warenkorb-Regeln [Chat · wartet auf dich] ▸',
    '  Kasse · ',
    '[auf-gutscheine] ○ Entwurf Gutschein-Einlösung ▸',
    '  Kasse · ',
    '[auf-suchfelder] ○ Suchfelder und Sortierung ▸',
    '  Suche · ',
    // Der Dauerläufer ruht: seine zwei offenen Bündel in einer Zeile.
    '[auf-ruht-btr] · Betrieb: ruht · 2 offen ▸',
    '  Betrieb · Ladezeit der Startseite senken · Umbau der Build-Skripte',
    'SPÄTER',
    '[auf-rueckfragen] · 10 Rückfragen an den Einkauf ▸',
    '  Katalog · wartet auf Auskunft',
    '[auf-rechnungen] · Block Rechnungen ▸',
    '  Kasse · wartet auf: Entwurf Warenkorb-Regeln (vermutet)',
    '[auf-umbau] ◆ Treffpunkt: Großer Umbau ▸',
    '  vermutet · sobald Katalog, Kasse und Suche fertig sind',
    '[auf-lasttest] ○ Lasttest ▸',
    '[auf-lager] ○ Lageranbindung ▸',
    '  noch nicht ausgearbeitet',
    '◎ Endziel (vermutet): der Shop im Betrieb',
  ]

  // Kein Bild, kein Streifen, kein Knopf über einem Bild: Zeile für Zeile die Liste.
  expect(zeilenVon(baum)).toEqual(liste(''))
  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
  expect(await stapel(ui)).toEqual([])
  expect(alleKnoten(baum).some(one => one.props?.position !== undefined)).toBe(false)
  // Jede Box der Liste ist eine schlichte Spalte.
  expect(
    alleKnoten(baum)
      .filter(one => one.type === 'Box' && kinder(one).some(kind => String(kind.props?.key).startsWith('auf-')))
      .map(one => one.props),
  ).toEqual(BUENDEL.map(() => ({ flexDirection: 'column' })))

  await ui.press({ key: 'auf-katalog-texte' })
  expect(zeilenVon((await ui.drawn()) as Knoten)).toEqual(liste('katalog-texte'))

  await ui.press({ key: 'auf-katalog-texte' })
  expect(zeilenVon((await ui.drawn()) as Knoten)).toEqual(liste(''))

  // Aufgeklappt nennt die Sammel-Zeile das erledigte Bündel in einer eigenen Zeile.
  await ui.press({ key: 'auf-erledigt-kat' })
  expect(zeilenVon((await ui.drawn()) as Knoten)).toEqual(liste('erledigt-kat'))

  await ui.unmount()
})

test('ein Bild über der Grenze der Engine wird zur Liste', async ($, on) => {
  // Anführungszeichen und spitze Klammern stehen im SVG als lange Ersatzfolgen.
  const lang = '"'.repeat(90)
  // Alle Bündel liegen in den drei Zielen: Der Dauerläufer hat keines und klappt nichts ein.
  const zeilen = Array.from({ length: 40 }, (_, n) => ({
    id: `z${n}`,
    bahn: OHNE_GOAL.bahnen[n % 3]?.id,
    zone: 'jetzt',
    stand: 'bereit',
    titel: `Bündel ${n} mit vielen Punkten`,
    punkte: Array.from({ length: 8 }, (_unused, p) => `${p}: ${lang}`),
    quelle: 'README.md',
  }))
  const welt = baue(on, { modell: { isAnswered: true, usage: VERBRAUCH, text: antwortOhneGoal({ zeilen, chats: [] }) } })

  legeDoku(welt)

  const ui = await $.ui.mount({ ...GRAPH, surface: 'desktop' })

  await leiteAb(ui, welt)

  // Zugeklappt passt das Bild: der Kopf und 44 Zeilen, jeder Streifen mit dem ganzen Bild.
  const zu = await stapel(ui)

  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(45)
  expect(zu).toHaveLength(45)
  expect(zu.every(one => one.source.length <= SVG_GRENZE)).toBe(true)
  expect(zu.filter(one => one.knopf !== null)).toHaveLength(43)

  // Mit allem aufgeklappt wäre es zu groß, und jeder Streifen trüge es ganz: Die Leiste
  // zeichnet die Liste und bleibt bedienbar.
  const offen = ganzesBild(welt, { chats: [] }).zeilen.map(one => one.id)

  expect(ganzesBild(welt, { chats: [], offen }).source.length > SVG_GRENZE).toBe(true)

  await ui.press({ key: 'alles' })
  expect(await ui.drawn()).toMatchObject({ type: 'Box' })
  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
  expect(await stapel(ui)).toEqual([])
  expect(await mitBildern(ui)).toContain('Bündel 39 mit vielen Punkten')
  expect(await mitBildern(ui)).toContain(`7: ${lang}`)
  // In der Liste ist das Bündel selbst der Knopf, wie im Terminal.
  expect((await ui.findAll({ key: 'auf-z39' })).map(one => one.text)).toEqual(['○ Bündel 39 mit vielen Punkten ▾'])

  // Auch dort klappt ein einzelnes Bündel zu; passt das Bild danach noch nicht, bleibt die Liste.
  await ui.press({ key: 'auf-z39' })
  expect((await ui.findAll({ key: 'auf-z39' })).map(one => one.text)).toEqual(['○ Bündel 39 mit vielen Punkten ▸'])
  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)

  await ui.press({ key: 'alles' })
  await ui.press({ key: 'alles' })
  expect(lage(await stapel(ui))).toEqual(lage(zu))

  await ui.unmount()
})

// ---------- GOAL.md in der schmalen Ansicht ----------

// Eine Session mit dem Shop und seiner GOAL.md, in der der Plan aus der schmalen Ansicht abgeleitet ist.
const mitGoal = async ($: Engine, on: On, surface: (typeof SURFACES)[number]) => {
  const welt = baue(on)

  legeShop(welt)
  await befehl($, 'graph')

  const ui = await $.ui.mount({ ...GRAPH, surface })

  await leiteAb(ui, welt)
  welt.toasts.length = 0

  return { welt, ui }
}

for (const surface of SURFACES) {
  test(`${surface}: mit GOAL.md stehen ihre Zwischenziele im Graphen, und ein Strang ohne Ziel hat oben seinen Knopf`, async ($, on) => {
    const { welt, ui } = await mitGoal($, on, surface)
    const { plan } = gelungen(antwort())
    const text = await mitBildern(ui)

    // Der Plan, wie GOAL.md ihn verankert: ihr Endziel wörtlich, ihre Zwischenziele auf dem Stamm.
    expect(text).toContain('Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.')
    expect(text).toContain('4 Bündel jetzt möglich · 1 laufen · 1 warten auf dich')
    expect(text).toContain('Katalog: 2 erledigt')
    expect(text).toContain('Grundstock steht')
    expect(text).toContain('erreicht')
    expect(text).toContain('Großer Umbau')
    expect(text).toContain('Lasttest bestanden')
    expect(text).not.toContain('GOAL.md fehlt')
    expect(text).not.toContain('In GOAL.md steht noch kein Endziel.')
    expect(await ui.findAll({ key: 'goal-anlegen' })).toHaveLength(0)
    expect(await ui.findAll({ key: 'endziel-festlegen' })).toHaveLength(0)

    // Kasse und Betrieb haben in GOAL.md kein Ziel: eine kurze Zeile, je Strang ein Knopf.
    expect(text).toContain('Ohne Ziel in GOAL.md: Kasse, Betrieb')
    expect((await knoepfe(ui)).slice(0, 6)).toEqual(['ausgeblendete', 'laden', 'auf', 'neu', 'ziel-kasse', 'ziel-betrieb'])
    expect((await ui.findAll({ key: 'ziel-kasse' }))[0]?.text).toBe('Ziel festlegen: Kasse')

    // Der Knopf legt denselben Auftrag ins Eingabefeld wie in der breiten Ansicht. Geschrieben wird nichts.
    await ui.press({ key: 'ziel-kasse' })

    const frage = strangFrage(plan, 'kasse')

    expect(welt.gefuellt).toEqual([{ text: frage === null ? '' : promptStrangZiel(frage), mode: 'replace' }])
    expect(welt.gefuellt[0]?.text).toContain('Für den Strang „Kasse“ ist in GOAL.md noch kein Ziel festgelegt.')
    expect(welt.toasts).toEqual(['Der Auftrag „Ziel festlegen“ liegt im Eingabefeld. Prüfen und abschicken.'])
    expect(welt.geschrieben.has(`${WURZEL}/GOAL.md`)).toBe(false)
    expect(welt.prompts).toHaveLength(0)

    // Der Chat hat das Ziel der Kasse eingetragen und das Endziel geöffnet: „Neu laden“ zeigt
    // es sofort, ohne Modell-Aufruf.
    welt.dateien.set(
      `${WURZEL}/GOAL.md`,
      GOAL.replace('Ziel:\n', 'Ziel: Bestellen ohne Umweg\n').replace('Der Shop ist im Betrieb und nimmt Bestellungen an.', 'noch offen'),
    )
    await ui.press({ key: 'laden' })

    const neu = await mitBildern(ui)

    expect(welt.fragen).toHaveLength(1)
    expect(neu).toContain('Ohne Ziel in GOAL.md: Betrieb')
    expect(await ui.findAll({ key: 'ziel-kasse' })).toHaveLength(0)
    expect(neu).toContain('GOAL.md hat sich seit dem Ableiten geändert: „Neu ableiten“ ordnet die Bündel neu zu.')
    expect(neu).toContain('In GOAL.md steht noch kein Endziel.')
    expect(neu).toContain('Endziel (vermutet): der Shop im Betrieb')

    await ui.press({ key: 'endziel-festlegen' })
    expect(welt.gefuellt[1]).toEqual({ text: promptEndziel(true, 'der Shop im Betrieb'), mode: 'replace' })
    expect(welt.toasts[1]).toBe('Der Auftrag „Endziel festlegen“ liegt im Eingabefeld. Prüfen und abschicken.')

    // Eine leere GOAL.md und eine, die fehlt: ein Hinweis statt vieler, mit dem Knopf zum Entwerfen.
    welt.dateien.set(`${WURZEL}/GOAL.md`, '# Ziel\n')
    await ui.press({ key: 'laden' })
    expect(await mitBildern(ui)).toContain('GOAL.md ist noch leer: Bis sie etwas festlegt, ist alles über Ziele nur vermutet.')
    expect(await ui.findAll({ key: 'endziel-festlegen' })).toHaveLength(0)
    expect((await knoepfe(ui)).filter(one => String(one).startsWith('ziel-'))).toEqual([])

    welt.dateien.delete(`${WURZEL}/GOAL.md`)
    await ui.press({ key: 'laden' })
    expect(await mitBildern(ui)).toContain('GOAL.md fehlt: Ohne sie ist alles über Ziele nur vermutet.')
    await ui.press({ key: 'goal-anlegen' })
    expect(welt.gefuellt[2]).toEqual({ text: promptGoalAnlegen(), mode: 'replace' })
    expect(welt.toasts[2]).toBe('Der Auftrag für GOAL.md liegt im Eingabefeld. Prüfen und abschicken.')
    // Der Plan bleibt dabei stehen, mit den Strängen, die das Modell genannt hat.
    expect(await mitBildern(ui)).toContain('Endziel (vermutet): der Shop im Betrieb')
    expect(await mitBildern(ui)).toContain('Katalog: 2 erledigt')

    await ui.unmount()
  })
}

test('desktop: mit GOAL.md mündet der Graph ins erste offene Zwischenziel, und ein Chat, der fertig ist, gibt seine Zeile frei', async ($, on) => {
  const { welt, ui } = await mitGoal($, on, 'desktop')
  const teile = await stapel(ui)

  // Der Kopf, je Bahn mit Erledigtem eine Zeile, sechs offene Bündel, der Dauerläufer, der
  // ruht, in einer Zeile, drei Zwischenziele, das Endziel.
  expect(teile.map(one => one.knopf)).toEqual([
    null,
    'auf-erledigt-katalog',
    'auf-erledigt-kasse',
    'auf-katalog-texte',
    'auf-warenkorb',
    'auf-gutscheine',
    'auf-suchfelder',
    'auf-ruht-betrieb',
    'auf-rueckfragen',
    'auf-rechnungen',
    'auf-grundstock-steht',
    'auf-grosser-umbau',
    'auf-lasttest-bestanden',
    null,
  ])
  pruefeTeilung(ganzesBild(welt), teile)
  expect(teile[4]?.alt).toBe('Entwurf Warenkorb-Regeln [Chat · wartet auf dich]')

  // Was laut GOAL.md zum Zwischenziel gehört, steht aufgeklappt unter ihm.
  await ui.press({ key: 'auf-grosser-umbau' })
  expect((await stapel(ui))[11]?.alt).toBe('Großer Umbau: Stränge: Katalog, Kasse; Quelle: GOAL.md')
  await ui.press({ key: 'auf-grosser-umbau' })

  // Ändert sich eine halbe Stunde lang nichts, laufen die Zeitangaben trotzdem weiter: Die
  // schmale Ansicht zählt ab dem letzten Lesen der Chats, alle 20 Sekunden.
  expect(await mitBildern(ui)).toContain('gerade eben · t21-warenkorb')
  expect(await mitBildern(ui)).toContain('Abgeleitet gerade eben in 23 s')
  await welt.uhr.advance(30 * 60_000)
  expect(await mitBildern(ui)).toContain('vor 31 Min · t21-warenkorb')
  expect(await mitBildern(ui)).toContain('Abgeleitet vor 30 Min in 23 s')
  expect(welt.toasts).toEqual([])

  // Der Chat hat seine Frage beantwortet bekommen: Nach spätestens 20 Sekunden ist die Marke ohne Punkt.
  legeChat(welt, 'sitzung-7', { name: 'Warenkorb-Regeln', stand: 'Die Regeln sind fertig.', frage: '' })
  await welt.uhr.advance(20_000)
  expect((await stapel(ui))[4]?.alt).toBe('Entwurf Warenkorb-Regeln [Chat]')
  expect(await mitBildern(ui)).toContain('4 Bündel jetzt möglich · 1 laufen · 0 warten auf dich')

  // Er wird herausgenommen: Die Zeile ist wieder frei, ohne neuen Modell-Aufruf.
  legeChat(welt, 'sitzung-7', { name: 'Warenkorb-Regeln', aktiv: false })
  await ui.press({ key: 'laden' })
  expect((await stapel(ui))[4]?.alt).toBe('Entwurf Warenkorb-Regeln')
  expect(await mitBildern(ui)).toContain('0 Chats, keiner wartet auf dich')
  expect(await mitBildern(ui)).toContain('4 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
  expect(welt.fragen).toHaveLength(1)

  await ui.unmount()
})

test('was beim Ableiten aufgefallen ist, zählt die schmale Ansicht nur und verweist auf die breite', async ($, on) => {
  const welt = ohneGoal(on, {
    modell: {
      isAnswered: true,
      usage: VERBRAUCH,
      text: `\`\`\`json\n${antwortOhneGoal({
        zeilen: [
          ...OHNE_GOAL.zeilen,
          { id: 'lager', bahn: 'lager', zone: 'jetzt', stand: 'bereit', titel: 'Lager anbinden', quelle: 'README.md' },
          { id: 'bilder', bahn: 'kat', zone: 'spaeter', stand: 'blockiert', titel: 'Bilder für alle Kategorien', wartetAuf: 'fotograf', quelle: 'docs/fotos.md' },
        ],
        chats: [],
      })}\n\`\`\``,
    },
  })
  const ui = await $.ui.mount({ ...GRAPH, surface: 'desktop' })

  await leiteAb(ui, welt)

  const text = await mitBildern(ui)

  expect(text).toContain('Endziel (vermutet): der Shop im Betrieb')
  expect(text).toContain('Bilder für alle Kategorien')
  expect(text).not.toContain('Lager anbinden')
  expect(text).toContain('Beim Ableiten aufgefallen: 4 Hinweise. Sie stehen in der Ansicht /orchestrator.')
  // Der Chat, den die Antwort nicht nennt, steht oben in der Liste, markiert aber keine Zeile.
  expect(text).toContain('● Warenkorb-Regeln')
  expect(text).toContain('4 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
  expect(welt.toasts).toEqual(['Ableiten fertig nach 23 s: 11 Bündel in 4 Strängen, 4 Hinweise'])
  expect(gespeichert(welt, `${ORDNER}/letzter.json`).warnungen).toEqual([
    'Bündel „Lager anbinden“ nennt den unbekannten Strang „lager“: weggelassen.',
    '„Bilder für alle Kategorien“ nennt die Quelle „docs/fotos.md“, die das Modell nicht bekommen hat: als vermutet markiert.',
    'Chat „Warenkorb-Regeln“ fehlt in der Antwort: Er steht ohne Karte da.',
    'Bündel „Bilder für alle Kategorien“ wartet auf etwas Unbekanntes („fotograf“): Der Verweis fällt weg.',
  ])

  await ui.unmount()
})
