import { mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { FsEntry, ModelCompleteResult, On, RenderSurface, SessionSendResult, UiOpenResult } from 'claude-code'

import { AUFTRAG } from '../hooks/plan/ableiten'

import { GOAL, antwort } from './shop'

// Die Welt unter dem Mod: Dateien, Befehle, Modell, Uhr und Session kommen aus dem Speicher
// des Tests. Kein echtes Heimverzeichnis, kein Netz. Was ein Test an der Welt ändert, gilt
// ab dem nächsten Aufruf.

export const PLUGIN = 'ziel-graph'
export const SURFACES = ['desktop', 'terminal', 'vscode', 'mobile'] as const

// Die zwei Leisten des Mods, so breit, wie der Test sie will.
const pane = (requestId: string, title: string, bodyColumns: number) =>
  ({
    plugin: PLUGIN,
    component: 'Pane',
    requestId,
    props: { title, isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    viewport: { columns: bodyColumns, rows: 40, isFullscreen: true },
  }) as const

// Die schmale Ansicht: Das Bild ist 500 px breit, eine Zelle in der App etwa 7,8 px. 66
// Zellen sind das Bild und ein wenig Rand.
export const GRAPH_SPALTEN = 66
export const graphPane = (bodyColumns: number = GRAPH_SPALTEN) => pane('ziel-graph', 'Ziel-Graph', bodyColumns)
export const GRAPH = graphPane()
export const kartenPane = (bodyColumns: number) => pane('orchestrator', 'Orchestrator', bodyColumns)
export const BREIT = kartenPane(200)

export const HEIM = '/heim/test'
export const WURZEL = '/arbeit/shop'
// 2026-10-04 12:00:00 UTC
export const JETZT = 1_791_115_200_000
export const TAG = 24 * 60 * 60_000
export const GITHUB = 'git@github.com:beispiel/shop.git'
// Direkt im Ordner des Repos liegen die Stände der Chats, darunter Plan und Läufe.
export const CHATS = `${HEIM}/.claude/ziel-graph/github.com+beispiel+shop`
export const ORDNER = `${CHATS}/plan`
export const VERBRAUCH = { input_tokens: 9000, output_tokens: 1800, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
export const COMMITS = Array.from({ length: 30 }, (_, n) => `2026-09-${String(30 - n).padStart(2, '0')} Katalog: Schritt ${30 - n}`)

export type Vorgabe = {
  // die Adresse von origin; null: ein Repo ohne origin; undefined: gar kein Repo
  remote: string | null | undefined
  // was git log ausgibt; null: git fehlt auf dem Rechner
  commits: string[] | null
  // der Branch, den git nennt
  branch: string
  // was das Modell beim Ableiten antwortet
  modell: ModelCompleteResult
  // wie lange es dafür braucht, in Millisekunden
  dauer: number
  // true: Die Engine lehnt den Aufruf ab, bevor sie ihn sendet
  istGesperrt: boolean
  // was das Modell über den Stand eines Chats antwortet
  stand: string
  // der Ordner, in dem die Session läuft
  ordner: string
  oberflaechen: RenderSurface[]
  platz: UiOpenResult
  // was im Eingabefeld des Chats schon steht
  entwurf: string
  // was `$.session.send` antwortet
  zustellung: SessionSendResult
  // true: Der Rechner lässt keine Datei schreiben
  istNurLesbar: boolean
}

export const baue = (on: On, vorgabe: Partial<Vorgabe> = {}) => {
  const uhr = mock.clock(on, { now: JETZT })
  const welt = {
    remote: GITHUB as string | null | undefined,
    commits: COMMITS as string[] | null,
    branch: 'main',
    modell: { isAnswered: true, text: antwort(), usage: VERBRAUCH } as ModelCompleteResult,
    dauer: 23_000,
    istGesperrt: false,
    stand: '{"name": "", "stand": "", "naechster": "", "frage": ""}',
    ordner: WURZEL,
    oberflaechen: ['desktop'] as RenderSurface[],
    platz: { isPlaced: true } as UiOpenResult,
    entwurf: '',
    zustellung: { isDelivered: true } as SessionSendResult,
    istNurLesbar: false,
    ...vorgabe,
    uhr,
    dateien: new Map<string, string>(),
    geschrieben: new Map<string, number>(),
    toasts: [] as string[],
    meldungen: [] as string[],
    // die Aufrufe, die den Plan ableiten; die kleinen für den Stand eines Chats stehen in `staende`
    fragen: [] as { model: string; system?: string; prompt: string; maxTokens?: number; timeoutMs?: number }[],
    staende: [] as { model: string; prompt: string }[],
    laeufe: [] as string[],
    geoeffnet: [] as { id: string; title?: string; columns?: number }[],
    gefuellt: [] as { text: string; mode: string }[],
    gesendet: [] as { to: string; text: string; origin: unknown }[],
    prompts: [] as { text: string; origin: unknown }[],
    // was unten ankommt, weil der Mod es durchlässt
    empfangen: [] as string[],
  }
  const eintraege = (ordner: string): FsEntry[] => {
    const namen = new Map<string, FsEntry>()

    for (const [pfad, inhaltDerDatei] of welt.dateien) {
      const rest = pfad.startsWith(`${ordner}/`) ? pfad.slice(ordner.length + 1).split('/') : []
      const [name = ''] = rest

      if (name !== '') {
        namen.set(name, {
          name,
          kind: rest.length > 1 ? 'dir' : 'file',
          size: rest.length > 1 ? 0 : inhaltDerDatei.length,
          mtimeMs: rest.length > 1 ? 0 : (welt.geschrieben.get(pfad) ?? JETZT),
          isLink: false,
        })
      }
    }

    return [...namen.values()]
  }

  mock.env(on, { HOME: HEIM })

  on('fs.exists', (_$, e) => ({
    value: [...welt.dateien.keys()].some(one => one === e.path || one.startsWith(`${e.path}/`)),
  }))
  on('fs.list', (_$, e) => ({ value: eintraege(e.path ?? WURZEL) }))
  on('fs.read', (_$, e) => {
    const text = welt.dateien.get(e.path)

    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.write', (_$, e) => {
    if (welt.istNurLesbar) {
      return { deny: `EROFS: ${e.path}` }
    }

    welt.dateien.set(e.path, e.text)
    welt.geschrieben.set(e.path, uhr.now())

    return { value: undefined }
  })
  on('process.run', (_$, e) => {
    const [name = '', befehl = ''] = e.argv

    welt.laeufe.push(e.argv.join(' '))

    return name !== 'git' || welt.commits === null
      ? { deny: `${name}: Befehl nicht gefunden` }
      : {
          value: {
            exitCode: 0,
            stdout: `${befehl === 'log' ? welt.commits.join('\n') : welt.branch}\n`,
            stderr: '',
            isStdoutTruncated: false,
            isStderrTruncated: false,
          },
        }
  })
  on('model.complete', async (_$, e) => {
    // Der kleine Aufruf fasst den Stand eines Chats; er antwortet sofort.
    if (e.system !== AUFTRAG) {
      welt.staende.push({ model: e.model, prompt: e.prompt })

      return { value: { isAnswered: true, text: welt.stand, usage: VERBRAUCH } }
    }

    welt.fragen.push(e)

    if (welt.istGesperrt) {
      return { deny: 'Das Modell ist in dieser Umgebung gesperrt.' }
    }

    // Das Ableiten braucht seine Zeit: Sie vergeht nur, wenn der Test die Uhr vorstellt.
    // Das Modell antwortet mit dem, was beim Aufruf galt.
    const { modell } = welt

    await uhr.sleep(welt.dauer)

    return { value: modell }
  })
  on('session.id', () => ({ value: 'sitzung-1' }))
  on('session.root', () => ({ value: welt.ordner }))
  on('session.repo', () => ({
    value: welt.remote === undefined ? null : { root: WURZEL, remote: welt.remote, internal: false, name: null },
  }))
  on('session.messages', () => ({ value: [{ role: 'user' as const, text: 'Wie steht es um den Shop?', toolUses: [] }] }))
  on('session.surfaces', () => ({ value: welt.oberflaechen }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.send', (_$, e) => {
    welt.gesendet.push({ to: e.to, text: e.text, origin: e.origin })

    return welt.zustellung
  })
  on('session.receive', (_$, e) => {
    welt.empfangen.push(e.text)

    return { text: e.text }
  })
  on('prompt.read', () => ({ value: { text: welt.entwurf, cursor: welt.entwurf.length } }))
  on('prompt.fill', (_$, e) => {
    welt.gefuellt.push({ text: e.text, mode: e.mode })

    return { isFilled: true }
  })
  on('prompt.submit', (_$, e) => {
    welt.prompts.push({ text: e.text, origin: e.origin })

    return { text: e.text }
  })
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', (_$, e) => {
    welt.geoeffnet.push({ id: e.id, title: e.title, columns: e.columns })

    return { value: welt.platz }
  })
  on('ui.toast', (_$, e) => {
    welt.toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.log', (_$, e) => {
    welt.meldungen.push(e.text)

    return { value: undefined }
  })

  return welt
}

export type Welt = ReturnType<typeof baue>

// Das Repo des erfundenen Shops: fünf Markdown-Dateien, davon eine in einem Unterordner,
// und daneben Dateien, die nicht zur Doku zählen.
export const legeDoku = (welt: Welt): void => {
  welt.dateien.set(`${WURZEL}/README.md`, '# Shop\n\nEin Web-Shop für Schuhe, Jacken und Taschen.\n')
  welt.dateien.set(`${WURZEL}/CLAUDE.md`, '# Regeln\n\nSichtbare Texte auf Deutsch.\n')
  welt.dateien.set(`${WURZEL}/docs/katalog.md`, '# Katalog\n\n13 Produktseiten stehen. Offen: die Texte abnehmen.\n')
  welt.dateien.set(`${WURZEL}/docs/kasse.md`, '# Kasse\n\nZahlarten sind geklärt. Offen: Warenkorb-Regeln, Gutscheine.\n')
  welt.dateien.set(`${WURZEL}/docs/plan/suche.md`, '# Suche\n\nSuchfelder und Sortierung.\n')
  welt.dateien.set(`${WURZEL}/docs/bild.png`, 'kein Markdown')
  welt.dateien.set(`${WURZEL}/docs/.entwurf/geheim.md`, '# Versteckt\n')
  welt.dateien.set(`${WURZEL}/docs/leer.md`, '  \n')
  welt.dateien.set(`${WURZEL}/src/NOTIZEN.md`, '# Nicht unter docs\n')
}

// Die Datei eines Chats, so wie der Mod sie je Session schreibt.
export const legeChat = (welt: Welt, id: string, mehr: Record<string, unknown> = {}): void => {
  welt.dateien.set(
    `${CHATS}/${id}.json`,
    JSON.stringify({ id, name: id, aktiv: true, branch: '', stand: '', naechster: '', frage: '', zeit: JETZT - 60_000, ...mehr }),
  )
}

// Der Shop mit seiner Doku, seiner GOAL.md (null: ohne) und einem Chat, der auf den Nutzer wartet.
export const legeShop = (welt: Welt, goal: string | null = GOAL): void => {
  legeDoku(welt)

  if (goal !== null) {
    welt.dateien.set(`${WURZEL}/GOAL.md`, goal)
  }

  legeChat(welt, 'sitzung-7', {
    name: 'Warenkorb-Regeln',
    branch: 't21-warenkorb',
    stand: 'Der Entwurf der Regeln steht.',
    naechster: 'Die Rundung der Beträge prüfen.',
    frage: 'Sollen Gutscheine auch den Versand decken?',
  })
  // Wer herausgenommen ist oder seit Wochen ruht, zählt nicht.
  legeChat(welt, 'sitzung-8', { name: 'Herausgenommen', aktiv: false })
  legeChat(welt, 'sitzung-9', { name: 'Uralt', zeit: JETZT - 15 * TAG })
  welt.dateien.set(`${CHATS}/kaputt.json`, 'kein JSON')
}

// Einer der zwei Befehle des Mods.
export const befehl = async ($: Engine, command: 'graph' | 'orchestrator'): Promise<string> => {
  const ergebnis = await $.command.run({
    command,
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 240 },
  })

  return ergebnis.text ?? ''
}

// ---------- Die Zeichnung lesen ----------

export type Gefunden = { type: string; text: string; props: Record<string, unknown> }
export type Zeichnung = {
  findAll: (query: { type?: string; key?: string; text?: string | RegExp }) => Promise<Gefunden[]>
  press: (target: { key: string }) => Promise<unknown>
  drawn: () => Promise<unknown>
}

// Der gezeichnete Baum als schlichte Daten.
export type Knoten = { type: string; props?: Record<string, unknown>; children?: (Knoten | string)[] }

export const kinder = (knoten: Knoten): Knoten[] =>
  (knoten.children ?? []).filter((one): one is Knoten => typeof one !== 'string')

export const alleKnoten = (knoten: Knoten): Knoten[] => [knoten, ...kinder(knoten).flatMap(alleKnoten)]

// Text und Knöpfe in der Reihenfolge, in der sie gezeichnet sind.
export const zeilenVon = (knoten: Knoten): string[] => {
  if (knoten.type === 'Text') {
    return [(knoten.children ?? []).filter(one => typeof one === 'string').join('')]
  }

  if (knoten.type === 'Button') {
    return [`[${String(knoten.props?.key)}] ${String(knoten.props?.label)}`]
  }

  return kinder(knoten).flatMap(zeilenVon)
}

// Alles, was die Zeichnung sagt, als ein Text: Texte, Knöpfe und zu jedem Bild sein `alt`.
export const inhalt = async (ui: Zeichnung): Promise<string> => {
  const svg = await ui.findAll({ type: 'Svg' })
  const texte = await ui.findAll({ type: 'Text' })
  const knoepfe = await ui.findAll({ type: 'Button' })

  return [...texte.map(one => one.text), ...knoepfe.map(one => one.text), ...svg.map(one => String(one.props.alt))].join('\n')
}

// Dasselbe mit dem Markup der Bilder statt ihrem `alt`: In der schmalen Ansicht steckt der
// Graph im Bild.
export const mitBildern = async (ui: Zeichnung): Promise<string> => {
  const svg = await ui.findAll({ type: 'Svg' })
  const texte = await ui.findAll({ type: 'Text' })
  const knoepfe = await ui.findAll({ type: 'Button' })

  return [...svg.map(one => String(one.props.source)), ...texte.map(one => one.text), ...knoepfe.map(one => one.text)].join('\n')
}

export const schluesselVon = async (ui: Zeichnung, anfang: string): Promise<string[]> =>
  (await ui.findAll({ type: 'Button' })).map(one => String(one.props.key)).filter(one => one.startsWith(anfang))

export const gespeichert = (welt: Welt, pfad: string): Record<string, unknown> =>
  JSON.parse(welt.dateien.get(pfad) ?? 'null') as Record<string, unknown>

// Ein ganzer Lauf: der Knopf „Neu ableiten“ der Leiste, dann vergeht die Zeit des Modells.
export const leiteAb = async (ui: Zeichnung, welt: Welt): Promise<void> => {
  await ui.press({ key: 'neu' })
  await welt.uhr.advance(welt.dauer)
}

// Eine Session, in der der Plan des Shops schon abgeleitet ist: mit GOAL.md, oder ohne (null).
export const mitPlan = async ($: Engine, on: On, vorgabe: Partial<Vorgabe> = {}, goal: string | null = GOAL) => {
  const welt = baue(on, vorgabe)

  legeShop(welt, goal)
  await befehl($, 'orchestrator')

  const anfang = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(anfang, welt)
  await anfang.unmount()
  welt.toasts.length = 0
  welt.geoeffnet.length = 0

  return welt
}
