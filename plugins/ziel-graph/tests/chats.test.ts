import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { FsEntry, On, RenderSurface, UiOpenResult } from 'claude-code'

import type { ZielGraphChat } from '../types'

import {
  istTicketDatei,
  nameVon,
  schluessel,
  ticketAus,
  ticketImPrompt,
  titelAusMarkdown,
  trackerAus,
  zaehler,
} from '../hooks/chats'

// Die laufenden Chats: der obere Teil der schmalen Ansicht `/graph`, die Selbst-Anmeldung
// und der Stand nach einer Antwort. Die Pane wird durch den Mod auf einer benannten Surface
// gezeichnet. Ein Baum, den die Surface nicht zeichnen kann, lässt schon `mount` scheitern.

const PLUGIN = 'ziel-graph'
const PANE = {
  title: 'Ziel-Graph',
  isFocused: false,
  bodyColumns: 66,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
} as const
const VIEWPORT = { columns: 66, rows: 40, isFullscreen: true }
const ZIEL = { plugin: PLUGIN, component: 'Pane', requestId: PLUGIN, props: PANE, viewport: VIEWPORT } as const

type Gefunden = { type: string; text: string; props: Record<string, unknown> }
type Zeichnung = {
  findAll: (query: { type?: string; key?: string; text?: string | RegExp }) => Promise<Gefunden[]>
}

// Alles, was die Zeichnung zeigt, als ein Text: Text-Zeilen, Knopf-Beschriftungen und,
// wo es einen Graphen gibt, sein Bild.
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

// ---------- Die Welt unter dem Mod ----------

// Dateien, Befehle, Modell, Uhr und Session kommen aus dem Speicher des Tests: kein echtes
// Heimverzeichnis, kein Netz. Was ein Test an der Welt ändert, gilt ab dem nächsten Aufruf.

const HEIM = '/heim/test'
const WURZEL = '/arbeit/shop'
const JETZT = 1_800_000_000_000
const MINUTE = 60_000
const TAG = 24 * 60 * MINUTE
const TAKT = 20_000
const GITHUB = 'git@github.com:beispiel/shop.git'
const ORDNER = `${HEIM}/.claude/ziel-graph/github.com+beispiel+shop`
const EIGENE = `${ORDNER}/sitzung-a.json`

type Vorgabe = {
  sitzung: string
  // was git als Branch nennt; null: git fehlt auf dem Rechner
  branch: string | null
  // die Adresse von origin; null: ein Repo ohne origin; undefined: gar kein Repo
  remote: string | null | undefined
  // der erste Auftrag des Nutzers in diesem Chat
  auftrag: string
  // was das Modell antwortet; null: es antwortet ohne Text
  modell: string | null
  // die Ausgabe der Befehle außer git, nach Namen; ein Befehl, der hier fehlt, startet nicht
  werkzeuge: Record<string, string>
  oberflaechen: RenderSurface[]
  platz: UiOpenResult
}

const STANDARD: Vorgabe = {
  sitzung: 'sitzung-a',
  branch: 'main',
  remote: GITHUB,
  auftrag: 'Wie ist die Suche aufgebaut?',
  modell: '{"name": "", "stand": "", "naechster": "", "frage": ""}',
  werkzeuge: {},
  oberflaechen: ['desktop'],
  platz: { isPlaced: true },
}
const KEIN_VERBRAUCH = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

const baue = (on: On, vorgabe: Partial<Vorgabe> = {}) => {
  const uhr = mock.clock(on, { now: JETZT })
  const welt = {
    ...STANDARD,
    ...vorgabe,
    uhr,
    dateien: new Map<string, string>(),
    geschrieben: new Map<string, number>(),
    toasts: [] as string[],
    meldungen: [] as string[],
    fragen: [] as { model: string; system?: string; prompt: string }[],
    laeufe: [] as string[],
    geoeffnet: [] as { id: string; title?: string }[],
    // läuft, während das Modell zusammenfasst
    beimModell: null as (() => void) | null,
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
  on('fs.list', (_$, e) => ({ value: eintraege(e.path) }))
  on('fs.read', (_$, e) => {
    const text = welt.dateien.get(e.path)

    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.write', (_$, e) => {
    welt.dateien.set(e.path, e.text)
    welt.geschrieben.set(e.path, uhr.now())

    return { value: undefined }
  })
  on('process.run', (_$, e) => {
    const [name = ''] = e.argv
    const stdout = name === 'git' ? (welt.branch ?? undefined) : welt.werkzeuge[name]

    welt.laeufe.push(e.argv.join(' '))

    return stdout === undefined
      ? { deny: `${name}: Befehl nicht gefunden` }
      : {
          value: {
            exitCode: 0,
            stdout: `${stdout}\n`,
            stderr: '',
            isStdoutTruncated: false,
            isStderrTruncated: false,
          },
        }
  })
  on('model.complete', (_$, e) => {
    welt.fragen.push(e)
    welt.beimModell?.()

    return {
      value:
        welt.modell === null
          ? { isAnswered: false, reason: 'empty-reply', usage: KEIN_VERBRAUCH }
          : { isAnswered: true, text: welt.modell, usage: KEIN_VERBRAUCH },
    }
  })
  on('session.id', () => ({ value: welt.sitzung }))
  on('session.root', () => ({ value: WURZEL }))
  on('session.repo', () => ({
    value:
      welt.remote === undefined
        ? null
        : { root: WURZEL, remote: welt.remote, internal: false, name: null },
  }))
  on('session.messages', () => ({
    value: [{ role: 'user' as const, text: welt.auftrag, toolUses: [] }],
  }))
  on('session.surfaces', () => ({ value: welt.oberflaechen }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', (_$, e) => {
    welt.geoeffnet.push({ id: e.id, title: e.title })

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

type Welt = ReturnType<typeof baue>

const starte = ($: Engine): Promise<unknown> =>
  $.session.start({ cwd: WURZEL, surface: 'desktop', isInteractive: true })

const frage = ($: Engine, text: string): Promise<unknown> =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

// Eine eigene Antwort des Chats. Die Zusammenfassung läuft erst nach der Runde: sobald
// die Uhr sie lässt.
const antworte = async ($: Engine, welt: Welt, answer: string): Promise<void> => {
  await $.turn.complete({ answer, durationMs: 1000, isAborted: false, turnId: 'runde', reason: 'answer' })
  await welt.uhr.settle()
}

const befehl = async ($: Engine, command: string, args = ''): Promise<string> => {
  const antwort = await $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })

  return antwort.text ?? ''
}

// Die Datei eines Chats, so wie eine andere Session sie geschrieben hätte.
const lege = (welt: Welt, chat: Partial<ZielGraphChat> & { id: string }): void => {
  welt.dateien.set(
    `${ORDNER}/${chat.id}.json`,
    JSON.stringify({
      name: chat.id,
      aktiv: true,
      branch: '',
      stand: '',
      naechster: '',
      frage: '',
      zeit: JETZT,
      ...chat,
    }),
  )
}

const gespeichert = (welt: Welt, pfad: string): unknown => JSON.parse(welt.dateien.get(pfad) ?? 'null')

// ---------- Die Chats ----------

for (const surface of ['desktop', 'terminal', 'vscode', 'mobile'] as const) {
  test(`${surface}: ohne Plan stehen oben die Chats, darunter ein Satz und der Knopf zum Ableiten`, async $ => {
    const ui = await $.ui.mount({ ...ZIEL, surface })

    expect(await ui.drawn()).toMatchObject({ type: 'Box' })

    const ohne = await inhalt(ui)

    expect(ohne).toContain('0 Chats, keiner wartet auf dich')
    expect(ohne).toContain('meldet sich nach seiner nächsten Antwort selbst an')
    expect(ohne).toContain('Diesen Chat aufnehmen')
    expect(await ui.findAll({ key: 'auf' })).toHaveLength(1)
    expect(await ui.findAll({ key: 'heraus' })).toHaveLength(0)
    expect(await ui.findAll({ key: 'laden' })).toHaveLength(1)
    expect(ohne).toContain('Noch kein Plan für dieses Repo: „Neu ableiten“ leitet ihn aus GOAL.md, Doku, Chats und Commits ab.')
    expect(await ui.findAll({ key: 'neu' })).toHaveLength(1)
    // Den Beispiel-Graphen mit erfundenen Daten gibt es nicht mehr, und ohne Plan kein Bild.
    expect(ohne).not.toContain('Beispiel')
    expect(await ui.findAll({ key: 'beispiel' })).toHaveLength(0)
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
    expect(await ui.findAll({ key: 'ansicht-schritte' })).toHaveLength(0)
    // Die Knöpfe der Leiste, von oben nach unten.
    expect((await ui.findAll({ type: 'Button' })).map(one => one.props.key)).toEqual(['laden', 'auf', 'neu'])

    await ui.unmount()
  })
}

for (const surface of ['desktop', 'terminal', 'vscode', 'mobile'] as const) {
  test(`${surface}: ein Chat auf eigenem Branch meldet sich nach seiner Antwort selbst an`, async ($, on) => {
    const welt = baue(on, {
      branch: 't218-versandkosten',
      auftrag: 'Bitte die Versandkosten im Warenkorb anzeigen.',
      werkzeuge: { gh: '{"title": "Versandkosten im Warenkorb zeigen"}' },
      modell: `Hier ist die Zeile:
{"name": "#218 Versandkosten", "stand": "Die Versandkosten stehen im Warenkorb.", "naechster": "Die Rundung der Beträge prüfen.", "frage": "Sollen die Versandkosten ab 50 Euro entfallen?"}`,
    })

    await starte($)
    await frage($, 'Zeig die Versandkosten unter der Zwischensumme.')
    await antworte($, welt, 'Die Versandkosten stehen jetzt im Warenkorb. Sollen sie ab 50 Euro entfallen?')

    expect(gespeichert(welt, EIGENE)).toEqual({
      id: 'sitzung-a',
      name: '#218 Versandkosten',
      aktiv: true,
      branch: 't218-versandkosten',
      stand: 'Die Versandkosten stehen im Warenkorb.',
      naechster: 'Die Rundung der Beträge prüfen.',
      frage: 'Sollen die Versandkosten ab 50 Euro entfallen?',
      zeit: JETZT,
      ticket: '218',
      ticketTitel: 'Versandkosten im Warenkorb zeigen',
    })

    // Ein Modell-Aufruf, mit Sonnet 5.5, und er kennt Branch, Ticket, Auftrag und Antwort.
    expect(welt.fragen).toHaveLength(1)
    expect(welt.fragen[0]?.model).toBe('claude-sonnet-5-5')
    expect(welt.fragen[0]?.prompt).toContain('Branch: t218-versandkosten')
    expect(welt.fragen[0]?.prompt).toContain('Ticket #218: Versandkosten im Warenkorb zeigen')
    expect(welt.fragen[0]?.prompt).toContain('Bitte die Versandkosten im Warenkorb anzeigen.')
    expect(welt.fragen[0]?.prompt).toContain('Zeig die Versandkosten unter der Zwischensumme.')
    expect(welt.fragen[0]?.prompt).toContain('Sollen sie ab 50 Euro entfallen?')
    expect(welt.laeufe).toContain('gh issue view 218 --json title')

    const ui = await $.ui.mount({ ...ZIEL, surface })
    const text = await inhalt(ui)

    expect(text).toContain('1 Chat, 1 wartet auf dich')
    expect(text).toContain('● #218 Versandkosten (dieser Chat)')
    expect(text).toContain('gerade eben · t218-versandkosten')
    expect(text).toContain('Die Versandkosten stehen im Warenkorb.')
    expect(text).toContain('Weiter: Die Rundung der Beträge prüfen.')
    expect(text).toContain('Wartet auf dich: Sollen die Versandkosten ab 50 Euro entfallen?')
    expect(text).not.toContain('meldet sich nach seiner nächsten Antwort selbst an')
    // Die eigene Frage ist kein Hinweis wert: der Nutzer sitzt in diesem Chat.
    expect(welt.toasts).toHaveLength(0)
    expect(welt.meldungen).toHaveLength(0)

    // Die nächste Antwort behält den Namen und fragt das Ticket nicht noch einmal ab.
    welt.modell =
      '{"name": "Anderer Name", "stand": "Ab 50 Euro entfallen die Versandkosten.", "naechster": "", "frage": ""}'
    await antworte($, welt, 'Erledigt: Ab 50 Euro entfallen die Versandkosten.')

    const danach = await inhalt(ui)

    expect(danach).toContain('1 Chat, keiner wartet auf dich')
    expect(danach).toContain('○ #218 Versandkosten (dieser Chat)')
    expect(danach).toContain('Ab 50 Euro entfallen die Versandkosten.')
    expect(danach).not.toContain('Weiter:')
    expect(danach).not.toContain('Wartet auf dich')
    expect(welt.fragen[1]?.prompt).not.toContain('Branch:')
    expect(welt.laeufe.filter(one => one.startsWith('gh '))).toHaveLength(1)

    await ui.unmount()
  })
}

test('ein Chat auf main ohne Ticket meldet sich nicht selbst an', async ($, on) => {
  const welt = baue(on, { branch: 'main', auftrag: 'Wie ist die Suche aufgebaut?' })

  await starte($)
  await frage($, 'Wie ist die Suche aufgebaut?')
  await antworte($, welt, 'Die Suche besteht aus drei Teilen.')

  expect(welt.fragen).toHaveLength(0)
  expect(welt.dateien.size).toBe(0)

  const ui = await $.ui.mount({ ...ZIEL, surface: 'desktop' })

  expect(await inhalt(ui)).toContain('0 Chats, keiner wartet auf dich')
  await ui.unmount()
})

test('nur die eigene, fertige Antwort wird zusammengefasst', async ($, on) => {
  const welt = baue(on, { branch: 'katalog-umbau' })
  const runde = { durationMs: 1000, turnId: 'runde' }

  await starte($)
  // Die Antwort eines Subagenten, eine abgebrochene Runde und eine leere Antwort zählen nicht.
  await $.turn.complete({ ...runde, answer: 'Fertig.', isAborted: false, reason: 'answer', agentId: 'agent-1' })
  await $.turn.complete({ ...runde, answer: 'Halb fer', isAborted: true, reason: 'aborted' })
  await $.turn.complete({ ...runde, answer: '', isAborted: false, reason: 'answer' })
  await welt.uhr.settle()

  expect(welt.fragen).toHaveLength(0)
  expect(welt.dateien.size).toBe(0)

  await antworte($, welt, 'Der Katalog ist umgebaut.')

  expect(welt.fragen).toHaveLength(1)
  // Nennt das Modell keinen Namen, heißt der Chat wie sein Branch.
  expect(gespeichert(welt, EIGENE)).toMatchObject({ name: 'katalog-umbau', aktiv: true })
})

test('ein Ticket im ersten Auftrag meldet auch einen Chat auf main an (GitLab)', async ($, on) => {
  const welt = baue(on, {
    branch: 'main',
    remote: 'https://gitlab.example.org/beispiel/shop.git',
    auftrag: 'Schau dir bitte #12 an: Die Suche findet keine Umlaute.',
    werkzeuge: { glab: '{"iid": 12, "title": "Suche findet keine Umlaute"}' },
    modell: '{"name": "#12 Umlaute in der Suche", "stand": "Die Ursache ist gefunden.", "naechster": "", "frage": ""}',
  })
  const datei = `${HEIM}/.claude/ziel-graph/gitlab.example.org+beispiel+shop/sitzung-a.json`

  await starte($)
  await antworte($, welt, 'Die Ursache ist gefunden: Der Index kennt keine Umlaute.')

  expect(welt.laeufe).toContain('glab api projects/:id/issues/12')
  expect(welt.fragen[0]?.prompt).toContain('Ticket #12: Suche findet keine Umlaute')
  expect(gespeichert(welt, datei)).toMatchObject({
    name: '#12 Umlaute in der Suche',
    branch: 'main',
    ticket: '12',
    ticketTitel: 'Suche findet keine Umlaute',
  })
})

test('der Knopf nimmt einen Chat auf main auf, das Modell benennt ihn, der zweite Knopf nimmt ihn heraus', async ($, on) => {
  const welt = baue(on, {
    branch: 'main',
    modell: '{"name": "Katalog aufräumen", "stand": "Zwei Kategorien sind aufgeräumt.", "naechster": "Die dritte Kategorie.", "frage": ""}',
  })

  await starte($)

  const ui = await $.ui.mount({ ...ZIEL, surface: 'desktop' })

  expect(await ui.findAll({ key: 'auf' })).toHaveLength(1)
  expect(await ui.findAll({ key: 'heraus' })).toHaveLength(0)

  await ui.press({ key: 'auf' })
  expect(gespeichert(welt, EIGENE)).toMatchObject({ id: 'sitzung-a', name: '', aktiv: true, branch: 'main' })

  const aufgenommen = await inhalt(ui)

  expect(aufgenommen).toContain('1 Chat, keiner wartet auf dich')
  expect(aufgenommen).toContain('○ Neuer Chat (dieser Chat)')
  expect(aufgenommen).toContain('noch nie · main')
  expect(aufgenommen).toContain('Noch kein Stand. Er kommt nach der nächsten Antwort.')
  expect(await ui.findAll({ key: 'auf' })).toHaveLength(0)
  expect(await ui.findAll({ key: 'heraus' })).toHaveLength(1)

  // Wer von Hand aufgenommen ist, bekommt seinen Stand auch auf main; den Namen gibt das Modell.
  await antworte($, welt, 'Zwei Kategorien sind aufgeräumt.')

  const mitStand = await inhalt(ui)

  expect(mitStand).toContain('○ Katalog aufräumen (dieser Chat)')
  expect(mitStand).toContain('Zwei Kategorien sind aufgeräumt.')
  expect(mitStand).toContain('Weiter: Die dritte Kategorie.')

  await ui.press({ key: 'heraus' })
  expect(gespeichert(welt, EIGENE)).toMatchObject({ name: 'Katalog aufräumen', aktiv: false })
  expect(await inhalt(ui)).toContain('0 Chats, keiner wartet auf dich')
  expect(await ui.findAll({ key: 'auf' })).toHaveLength(1)

  // Auch nach der nächsten Antwort bleibt er draußen: kein Modell-Aufruf, keine neue Datei.
  await antworte($, welt, 'Die dritte Kategorie ist aufgeräumt.')

  expect(welt.fragen).toHaveLength(1)
  expect(gespeichert(welt, EIGENE)).toMatchObject({ aktiv: false, stand: 'Zwei Kategorien sind aufgeräumt.' })
  expect(await inhalt(ui)).toContain('0 Chats, keiner wartet auf dich')

  // Wieder aufgenommen behält er Namen und Stand.
  await ui.press({ key: 'auf' })
  expect(await inhalt(ui)).toContain('○ Katalog aufräumen (dieser Chat)')
  expect(await inhalt(ui)).toContain('Zwei Kategorien sind aufgeräumt.')

  await ui.unmount()
})

test('was sich während der Zusammenfassung an der eigenen Datei ändert, gilt: Name und Abmeldung', async ($, on) => {
  const welt = baue(on, {
    branch: 'kasse-entwurf',
    modell: '{"name": "Vom Modell", "stand": "Der Entwurf steht.", "naechster": "", "frage": ""}',
  })

  await starte($)
  welt.beimModell = () => lege(welt, { id: 'sitzung-a', name: 'Kasse', zeit: 0 })
  await antworte($, welt, 'Der Entwurf steht.')
  expect(gespeichert(welt, EIGENE)).toMatchObject({ name: 'Kasse', aktiv: true, stand: 'Der Entwurf steht.' })

  welt.beimModell = () => lege(welt, { id: 'sitzung-a', name: 'Kasse', aktiv: false, stand: 'Der Entwurf steht.' })
  await antworte($, welt, 'Der Entwurf ist abgestimmt.')
  expect(welt.fragen).toHaveLength(2)
  expect(gespeichert(welt, EIGENE)).toMatchObject({ name: 'Kasse', aktiv: false, stand: 'Der Entwurf steht.' })
})

test('der Chat einer anderen Session mit Frage steht oben, nur eine neue Frage löst einen Hinweis aus', async ($, on) => {
  const welt = baue(on, { branch: 'main' })

  lege(welt, { id: 'sitzung-a', name: 'Katalog', stand: 'Die Texte sind abgenommen.', zeit: JETZT - MINUTE })
  lege(welt, { id: 'sitzung-b', name: 'Suche', branch: 't31-suche', stand: 'Der Index ist gebaut.', zeit: JETZT - 3 * 60 * MINUTE })
  lege(welt, { id: 'sitzung-c', name: 'Uralt', frage: 'Noch da?', zeit: JETZT - 15 * TAG })
  lege(welt, { id: 'sitzung-d', name: 'Abgemeldet', aktiv: false, frage: 'Darf ich?' })
  // Von Hand angemeldet und nie gelaufen: es zählt, wann die Datei geschrieben wurde.
  lege(welt, { id: 'sitzung-e', name: 'Nie gelaufen', zeit: 0 })
  welt.geschrieben.set(`${ORDNER}/sitzung-e.json`, JETZT - 15 * TAG)
  welt.dateien.set(`${ORDNER}/kaputt.json`, 'kein JSON')

  await starte($)

  const ui = await $.ui.mount({ ...ZIEL, surface: 'desktop' })
  const vorher = await inhalt(ui)

  expect(vorher).toContain('2 Chats, keiner wartet auf dich')
  expect(vorher).toContain('○ Katalog (dieser Chat)')
  expect(vorher).toContain('vor 3 Std · t31-suche')
  expect(vorher).not.toContain('Uralt')
  expect(vorher).not.toContain('Abgemeldet')
  expect(vorher).not.toContain('Nie gelaufen')
  // Ohne Frage steht das Neueste oben.
  expect(vorher.indexOf('○ Katalog') < vorher.indexOf('○ Suche')).toBe(true)
  // Beim ersten Laden ist keine Frage neu.
  expect(welt.toasts).toHaveLength(0)

  // Die andere Session schreibt ihren Stand; nach spätestens 20 Sekunden sieht ihn diese hier.
  lege(welt, {
    id: 'sitzung-b',
    name: 'Suche',
    branch: 't31-suche',
    stand: 'Der Index ist gebaut.',
    frage: 'Soll die Suche auch Tippfehler verzeihen?',
    zeit: JETZT - 2 * 60 * MINUTE,
  })
  await welt.uhr.advance(TAKT)

  const nachher = await inhalt(ui)

  expect(nachher).toContain('2 Chats, 1 wartet auf dich')
  expect(nachher).toContain('● Suche')
  expect(nachher).not.toContain('● Suche (dieser Chat)')
  expect(nachher).toContain('Wartet auf dich: Soll die Suche auch Tippfehler verzeihen?')
  expect(nachher.indexOf('● Suche') < nachher.indexOf('○ Katalog')).toBe(true)
  expect(welt.toasts).toEqual(['Suche wartet auf dich: Soll die Suche auch Tippfehler verzeihen?'])

  // Dieselbe Frage meldet sich nicht noch einmal, auch nicht über „Neu laden“.
  await welt.uhr.advance(TAKT)
  await ui.press({ key: 'laden' })
  expect(welt.toasts).toHaveLength(1)

  // Eine Frage des eigenen Chats löst keinen Hinweis aus, eine neue Frage der anderen schon.
  lege(welt, { id: 'sitzung-a', name: 'Katalog', frage: 'Passt der Text so?', zeit: JETZT })
  lege(welt, { id: 'sitzung-b', name: 'Suche', frage: 'Reicht eine Liste mit 20 Treffern?', zeit: JETZT })
  await ui.press({ key: 'laden' })

  expect(welt.toasts).toHaveLength(2)
  expect(welt.toasts[1]).toBe('Suche wartet auf dich: Reicht eine Liste mit 20 Treffern?')
  expect(await inhalt(ui)).toContain('2 Chats, 2 warten auf dich')

  await ui.unmount()
})

test('ein Repo ohne Ticket-System, ohne origin und ohne glab und gh läuft', async ($, on) => {
  const welt = baue(on, {
    branch: 'umbau-404-seite',
    remote: null,
    auftrag: 'Die Seite für nicht gefundene Produkte soll freundlicher werden.',
    modell: '{"name": "Freundliche 404-Seite", "stand": "Der neue Text steht.", "naechster": "", "frage": ""}',
  })
  // Ohne origin kommt der Schlüssel aus dem ganzen Pfad der Wurzel.
  const datei = `${HEIM}/.claude/ziel-graph/lokal+arbeit+shop/sitzung-a.json`

  await starte($)
  await antworte($, welt, 'Der neue Text steht.')

  // Kein Ticket-System: niemand ruft glab oder gh, und der Chat hat keinen Ticket-Titel.
  expect(welt.laeufe.every(one => one.startsWith('git '))).toBe(true)
  expect(welt.meldungen).toHaveLength(0)
  expect(gespeichert(welt, datei)).toMatchObject({
    name: 'Freundliche 404-Seite',
    stand: 'Der neue Text steht.',
    ticket: '404',
    ticketTitel: '',
  })
  expect(welt.fragen[0]?.prompt).toContain('Ticket #404\n')

  const ui = await $.ui.mount({ ...ZIEL, surface: 'terminal' })

  expect(await inhalt(ui)).toContain('○ Freundliche 404-Seite (dieser Chat)')
  expect(await befehl($, 'graph')).toBe('Ziel-Graph geöffnet. (Oberflächen: desktop)')
  await ui.unmount()
})

test('fehlt glab, bleibt nur der Ticket-Titel leer', async ($, on) => {
  const welt = baue(on, {
    branch: 't77-gutscheine',
    remote: 'git@gitlab.example.org:beispiel/shop.git',
    modell: '{"name": "Gutscheine", "stand": "Der Entwurf steht.", "naechster": "", "frage": ""}',
  })
  const datei = `${HEIM}/.claude/ziel-graph/gitlab.example.org+beispiel+shop/sitzung-a.json`

  await starte($)
  await antworte($, welt, 'Der Entwurf steht.')

  expect(welt.laeufe).toContain('glab api projects/:id/issues/77')
  expect(welt.meldungen).toHaveLength(0)
  expect(gespeichert(welt, datei)).toMatchObject({ name: 'Gutscheine', ticket: '77', ticketTitel: '' })

  // Nach dem einen Versuch fragt die nächste Antwort nicht wieder nach dem Titel.
  await antworte($, welt, 'Der Entwurf ist abgestimmt.')
  expect(welt.laeufe.filter(one => one.startsWith('glab '))).toHaveLength(1)
  expect(welt.fragen).toHaveLength(2)
})

test('ganz ohne Repo und ohne git gilt der Ordner der Session, und der Knopf nimmt den Chat auf', async ($, on) => {
  // git fehlt: der Branch bleibt leer, und von selbst meldet sich niemand an.
  const welt = baue(on, { remote: undefined, branch: null })

  await starte($)
  await antworte($, welt, 'Fertig.')
  expect(welt.dateien.size).toBe(0)

  const ui = await $.ui.mount({ ...ZIEL, surface: 'terminal' })

  await ui.press({ key: 'auf' })
  expect(gespeichert(welt, `${HEIM}/.claude/ziel-graph/lokal+arbeit+shop/sitzung-a.json`)).toMatchObject({
    aktiv: true,
    branch: '',
  })
  await ui.unmount()
})

// Tickets als Markdown, so wie die Skills sie anlegen: je Vorhaben ab 01 nummeriert.
const legeMarkdown = (welt: Welt): void => {
  const scratch = `${WURZEL}/.scratch`

  welt.dateien.set(
    `${WURZEL}/docs/agents/issue-tracker.md`,
    '# Issue tracker: Local Markdown\n\nTickets liegen in .scratch.\n',
  )
  welt.dateien.set(`${scratch}/kasse/map.md`, '# Kasse\n')
  welt.dateien.set(`${scratch}/kasse/issues/02-warenkorb.md`, '# 02 — Warenkorb merken\n')
  welt.dateien.set(
    `${scratch}/kasse/issues/03-gutscheine.md`,
    'Status: claimed\n\n# 03 — Gutscheine an der Kasse einlösen\n\n## What to build\n',
  )
  welt.dateien.set(`${scratch}/suche/issues/02-treffer.md`, '# 02 — Treffer sortieren\n')
}

test('Tickets als Markdown: der Titel kommt aus der Datei unter .scratch', async ($, on) => {
  const welt = baue(on, {
    branch: 'main',
    auftrag: 'Bitte setz #3 um.',
    modell: '{"name": "#3 Gutscheine", "stand": "Der Gutschein wird geprüft.", "naechster": "", "frage": ""}',
  })

  legeMarkdown(welt)
  await starte($)
  await antworte($, welt, 'Der Gutschein wird jetzt geprüft.')

  // Die Datei sagt „Local Markdown“, obwohl origin bei GitHub liegt: gh wird nicht gerufen.
  expect(welt.laeufe.every(one => one.startsWith('git '))).toBe(true)
  expect(welt.fragen[0]?.prompt).toContain('Ticket #3: Gutscheine an der Kasse einlösen')
  expect(gespeichert(welt, EIGENE)).toMatchObject({
    name: '#3 Gutscheine',
    ticket: '3',
    ticketTitel: 'Gutscheine an der Kasse einlösen',
  })
})

test('Tickets als Markdown: gibt es die Nummer in zwei Vorhaben, bleibt der Titel leer', async ($, on) => {
  const welt = baue(on, { branch: 'main', auftrag: 'Bitte setz #2 um.' })

  legeMarkdown(welt)
  await starte($)
  await antworte($, welt, 'Erledigt.')

  expect(welt.fragen[0]?.prompt).toContain('Ticket #2\n')
  expect(gespeichert(welt, EIGENE)).toMatchObject({ ticket: '2', ticketTitel: '' })
})

test('antwortet das Modell nicht, steht der Chat trotzdem da, mit dem alten Stand', async ($, on) => {
  const welt = baue(on, { branch: 'kasse-entwurf', modell: null })

  await starte($)
  await antworte($, welt, 'Der Entwurf steht.')

  expect(gespeichert(welt, EIGENE)).toMatchObject({
    name: 'kasse-entwurf',
    stand: 'Noch kein Stand. Er kommt nach der nächsten Antwort.',
    zeit: JETZT,
  })
  expect(welt.meldungen).toEqual(['Zusammenfassung blieb aus (empty-reply); Stand unverändert.'])

  // Auch eine Antwort ohne JSON kostet nur den Stand.
  welt.modell = 'Dazu kann ich nichts sagen.'
  await antworte($, welt, 'Der Entwurf ist abgestimmt.')
  expect(gespeichert(welt, EIGENE)).toMatchObject({ name: 'kasse-entwurf', aktiv: true })
})

test('/graph öffnet die Pane und sagt, ob sie gezeichnet wird', async ($, on) => {
  const welt = baue(on, { oberflaechen: ['terminal', 'mobile'] })

  expect(await befehl($, 'graph')).toBe('Ziel-Graph geöffnet. (Oberflächen: terminal, mobile)')
  expect(welt.geoeffnet).toEqual([{ id: 'ziel-graph', title: 'Ziel-Graph' }])

  welt.platz = { isPlaced: false, reason: 'keine verbundene Oberfläche zeichnet Leisten' }
  expect(await befehl($, 'graph')).toBe(
    'Ziel-Graph wartet und wird nicht gezeichnet: keine verbundene Oberfläche zeichnet Leisten (Oberflächen: terminal, mobile)',
  )

  welt.oberflaechen = []
  expect(await befehl($, 'graph')).toContain('(Oberflächen: keine)')
  expect(welt.geoeffnet).toHaveLength(3)
})

// ---------- Die reinen Helfer ----------

test('der Schlüssel eines Repos ist für SSH und HTTPS derselbe und taugt als Ordnername', () => {
  const ssh = schluessel('git@github.com:nutzer/projekt.git', '/arbeit/projekt')

  expect(ssh).toBe('github.com+nutzer+projekt')
  expect(schluessel('https://github.com/nutzer/projekt', '/anderswo/kopie')).toBe(ssh)
  expect(schluessel('https://github.com/nutzer/projekt.git/', '/arbeit/projekt')).toBe(ssh)
  expect(schluessel('ssh://git@github.com/nutzer/projekt.git', '/arbeit/projekt')).toBe(ssh)
  // Zugangsdaten und Groß-/Kleinschreibung fallen weg.
  expect(schluessel('https://nutzer:geheim@GitHub.com/Nutzer/Projekt.git', '/arbeit/projekt')).toBe(ssh)
  // Der Port fällt weg, Untergruppen bleiben.
  expect(schluessel('ssh://git@gitlab.example.org:2222/gruppe/unter/projekt.git', '/x')).toBe(
    schluessel('https://gitlab.example.org/gruppe/unter/projekt', '/y'),
  )
  expect(schluessel('https://gitlab.example.org/gruppe/unter/projekt', '/y')).toBe(
    'gitlab.example.org+gruppe+unter+projekt',
  )

  // Gleicher Ordnername, anderes Repo: anderer Schlüssel.
  expect(schluessel('git@github.com:andere/projekt.git', '/arbeit/projekt')).not.toBe(ssh)
  expect(schluessel('git@gitlab.example.org:nutzer/projekt.git', '/arbeit/projekt')).not.toBe(ssh)
  // "a-b/c" und "a/b-c" fallen nicht zusammen.
  expect(schluessel('git@github.com:a-b/c.git', '/x')).not.toBe(schluessel('git@github.com:a/b-c.git', '/x'))

  // Ohne origin zählt der ganze Pfad der Wurzel, nicht nur der Ordnername.
  expect(schluessel(null, '/arbeit/shop')).toBe('lokal+arbeit+shop')
  expect(schluessel('', '/privat/shop')).toBe('lokal+privat+shop')
  expect(schluessel(null, 'C:\\Arbeit\\Mein Shop')).toBe('lokal+c_+arbeit+mein_shop')
  // Ein origin als lokaler Pfad gilt für jede Kopie gleich.
  expect(schluessel('/srv/git/shop.git', '/arbeit/shop')).toBe('srv+git+shop')
  expect(schluessel('file:///srv/git/shop.git', '/privat/shop')).toBe('srv+git+shop')
  // Nichts führt aus dem Ordner hinaus.
  expect(schluessel('..', '/arbeit/shop')).toBe('lokal+arbeit+shop')

  for (const einer of [ssh, schluessel(null, 'C:\\Arbeit\\Mein Shop'), schluessel('../../x y', '/z')]) {
    expect(einer).toMatch(/^[a-z0-9._+-]+$/)
  }
})

test('das Ticket-System kommt aus der Datei der Skills, sonst aus dem Host von origin', () => {
  expect(trackerAus('# Issue tracker: GitLab', null)).toBe('gitlab')
  expect(trackerAus('# Issue tracker: GitHub\r', 'git@gitlab.example.org:beispiel/shop.git')).toBe('github')
  expect(trackerAus('# Issue tracker: Local Markdown', GITHUB)).toBe('markdown')
  expect(trackerAus('# Issue tracker: GitLab (selbst betrieben)', GITHUB)).toBe('gitlab')
  // Ein System, das der Mod nicht kennt: lieber kein Titel als der falsche.
  expect(trackerAus('# Issue tracker: Karteikasten', GITHUB)).toBe('keine')

  expect(trackerAus(null, GITHUB)).toBe('github')
  expect(trackerAus(null, 'https://gitlab.example.org/beispiel/shop.git')).toBe('gitlab')
  expect(trackerAus('Notizen ohne Kopfzeile', 'ssh://git@gitlab.example.org:2222/beispiel/shop.git')).toBe('gitlab')
  // Der Host zählt, nicht der Pfad.
  expect(trackerAus(null, 'https://git.example.org/github-spiegel/shop.git')).toBe('keine')
  expect(trackerAus(null, null)).toBe('keine')
})

test('Ticketnummern: im Branch 2 bis 4 Ziffern, im Auftrag # und 1 bis 5 Ziffern', () => {
  expect(ticketAus('t218-versandkosten')).toBe('218')
  expect(ticketAus('feature/42-suche')).toBe('42')
  expect(ticketAus('umbau-7')).toBe('')
  expect(ticketAus('v2-katalog')).toBe('')
  expect(ticketAus('main')).toBe('')

  expect(ticketImPrompt('Bitte setz #3 um.')).toBe('3')
  expect(ticketImPrompt('Siehe #12345, das ist dringend')).toBe('12345')
  expect(ticketImPrompt('Siehe #123456')).toBe('')
  expect(ticketImPrompt('Siehe #012')).toBe('')
  expect(ticketImPrompt('Die Farbe #1f2e3d passt nicht')).toBe('')
  expect(ticketImPrompt('Ohne Nummer')).toBe('')
})

test('Tickets als Markdown: Dateiname und Überschrift', () => {
  expect(istTicketDatei('03-gutscheine.md', '3')).toBe(true)
  expect(istTicketDatei('3-gutscheine.md', '3')).toBe(true)
  expect(istTicketDatei('30-versand.md', '3')).toBe(false)
  expect(istTicketDatei('03-gutscheine.txt', '3')).toBe(false)
  expect(istTicketDatei('map.md', '3')).toBe(false)

  expect(titelAusMarkdown('# 03 — Gutscheine an der Kasse einlösen\n\nText')).toBe('Gutscheine an der Kasse einlösen')
  expect(titelAusMarkdown('Status: claimed\r\n\r\n# Warenkorb merken  \r\n## Parent')).toBe('Warenkorb merken')
  // Nur die Nummer vor dem Trennzeichen fällt weg, keine Zahl, die zum Titel gehört.
  expect(titelAusMarkdown('# 7 Tage Rückgabe')).toBe('7 Tage Rückgabe')
  expect(titelAusMarkdown('# 3.5 Prozent Rabatt')).toBe('3.5 Prozent Rabatt')
  expect(titelAusMarkdown('## Nur eine Unterüberschrift')).toBe('')
  expect(titelAusMarkdown('')).toBe('')
})

test('die Kopfzeile zählt Chats und Wartende', () => {
  const chat = (frage: string): ZielGraphChat => ({
    id: 'x',
    name: 'x',
    aktiv: true,
    branch: '',
    stand: '',
    naechster: '',
    frage,
    zeit: 0,
  })

  expect(zaehler([])).toBe('0 Chats, keiner wartet auf dich')
  expect(zaehler([chat('')])).toBe('1 Chat, keiner wartet auf dich')
  expect(zaehler([chat('Ja?'), chat(''), chat('')])).toBe('3 Chats, 1 wartet auf dich')
  expect(zaehler([chat('Ja?'), chat('Nein?')])).toBe('2 Chats, 2 warten auf dich')

  // Solange das Modell ihm keinen Namen gegeben hat, heißt ein Chat überall „Neuer Chat“.
  expect(nameVon({ name: '' })).toBe('Neuer Chat')
  expect(nameVon({ name: 'Kasse' })).toBe('Kasse')
})
