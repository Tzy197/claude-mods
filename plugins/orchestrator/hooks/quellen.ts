import type { FsEntry, ProcessRunResult, SessionRepo } from 'claude-code'

import type { OrchestratorChat, OrchestratorChats } from '../types'

// Die Quellen eines Laufs: was das Repo über sich weiß. GOAL.md steht an erster Stelle,
// danach kommen Doku, laufende Chats und Git-Verlauf. Ein Repo mit Tickets bekommt hier
// später eine weitere Quelle. Kein `$`: register.tsx baut aus `$` einen Zugang und reicht
// ihn hierher.

export type QuellenZugang = {
  sitzung: () => Promise<string>
  heim: () => Promise<string>
  repo: () => Promise<SessionRepo | null>
  wurzel: () => Promise<string>
  jetzt: () => Promise<number>
  gibtEs: (pfad: string) => Promise<boolean>
  liste: (pfad: string) => Promise<FsEntry[]>
  lies: (pfad: string) => Promise<string>
  laufe: (argv: readonly string[]) => Promise<ProcessRunResult>
}

// Eine Markdown-Datei des Repos, so wie das Modell sie bekommt.
export type QuellDoku = {
  // Pfad ab der Wurzel des Repos, mit '/'
  datei: string
  // der Text, der ans Modell geht: höchstens DOKU_GRENZE Zeichen
  text: string
  // wie lang die Datei wirklich ist
  zeichen: number
  gekuerzt: boolean
}

// Ein laufender Chat, so wie das Modell ihn bekommt.
export type QuellChat = {
  // die id der Session
  id: string
  // die kurze Kennung, unter der das Modell ihn nennt: c1, c2, …
  kennung: string
  name: string
  branch: string
  stand: string
  naechster: string
  // '' wenn der Chat auf nichts wartet
  frage: string
}

export type Quellen = {
  // wo gelesen wurde und unter welchem Schlüssel das Repo auf dem Rechner geführt wird
  wurzel: string
  schluessel: string
  // der Text von GOAL.md; null, wenn es keine gibt
  goal: string | null
  doku: QuellDoku[]
  chats: QuellChat[]
  // je Commit eine Zeile: Datum und Betreff, der neueste zuerst
  commits: string[]
  // was beim Lesen ausgelassen wurde oder nicht ging
  hinweise: string[]
}

export const GOAL_DATEI = 'GOAL.md'
export const DOKU_GRENZE = 12_000
export const GESAMT_GRENZE = 60_000
export const COMMITS = 30
const DOKU_DATEIEN = 40
const DOKU_TIEFE = 4
const CHATS = 12
const VERALTET_MS = 14 * 24 * 60 * 60_000

// ---------- Schlüssel eines Repos (wie in ziel-graph/hooks/chats.ts) ----------

// Host und Pfad aus der Adresse von origin. Die SSH- und die HTTPS-Form desselben Repos
// ergeben dasselbe; Zugangsdaten, Port und ".git" fallen weg. Ein lokaler Pfad hat keinen Host.
const zerlege = (remote: string): { host: string; pfad: string } => {
  const adresse = remote.trim().replace(/^([a-z][a-z0-9+.-]*:\/\/)?[^@/]*@/i, '$1')
  const url = /^[a-z][a-z0-9+.-]*:\/\/([^/]*)\/?(.*)$/i.exec(adresse)
  const scp = /^([^/:]{2,}):(.*)$/.exec(adresse)
  const [host, pfad] =
    url !== null ? [url[1], url[2]] : scp !== null ? [scp[1], scp[2]] : ['', adresse]

  return {
    host: (host ?? '').replace(/:\d+$/, '').toLowerCase(),
    pfad: (pfad ?? '').replace(/[\\/]+$/, '').replace(/\.git$/i, ''),
  }
}

// Die Stücke eines Pfads: klein geschrieben und nur aus Zeichen, die jeder Ordnername verträgt.
const stuecke = (pfad: string): string[] =>
  pfad
    .split(/[\\/]+/)
    .filter(one => one !== '')
    .map(one => one.toLowerCase().replace(/[^a-z0-9._-]/g, '_'))

// Der Schlüssel eines Repos, als Ordnername: "host+gruppe+projekt" aus der Adresse von
// origin, ohne origin "lokal+…" aus dem ganzen Pfad der Wurzel. Derselbe wie in ziel-graph:
// Unter ihm liegen dort die Chat-Stände, die dieser Mod liest.
export const schluessel = (remote: string | null, wurzel: string): string => {
  const { host, pfad } = zerlege(remote ?? '')
  const ausRemote = [...stuecke(host), ...stuecke(pfad)].join('+')
  const ausWurzel = ['lokal', ...stuecke(wurzel)].join('+')

  // Nur Punkte wären ein Weg aus dem Ordner hinaus.
  return (/^\.*$/.test(ausRemote) ? ausWurzel : ausRemote).slice(-200)
}

// ---------- Kleine Helfer ----------

const text = (wert: unknown): string => (typeof wert === 'string' ? wert : '')

const kurz = (wert: string, laenge: number): string => {
  const glatt = wert.replace(/\s+/g, ' ').trim()

  return glatt.length > laenge ? `${glatt.slice(0, laenge)}…` : glatt
}

const liesText = async (zugang: QuellenZugang, pfad: string): Promise<string | null> => {
  try {
    return await zugang.lies(pfad)
  } catch {
    return null
  }
}

const listeOrdner = async (zugang: QuellenZugang, pfad: string): Promise<FsEntry[]> => {
  try {
    return (await zugang.gibtEs(pfad)) ? await zugang.liste(pfad) : []
  } catch {
    return []
  }
}

// Der Schlüssel des Repos, in dem die Session läuft. Alle Worktrees teilen ihn.
export const schluesselVon = async (zugang: QuellenZugang): Promise<string> => {
  const repo = await zugang.repo()

  return schluessel(repo?.remote ?? null, repo?.root ?? (await zugang.wurzel()))
}

// ---------- GOAL.md ----------

// GOAL.md liegt in der Wurzel des Repos. Läuft die Session in einem Worktree, zählt zuerst
// dessen Datei, sonst die der Haupt-Wurzel. null: Es gibt keine.
const liesGoalGanz = async (zugang: QuellenZugang): Promise<string | null> => {
  const repo = await zugang.repo()
  const wurzeln = [...new Set([await zugang.wurzel(), repo?.root ?? ''])].filter(one => one !== '')

  for (const wurzel of wurzeln) {
    const inhalt = await liesText(zugang, `${wurzel}/${GOAL_DATEI}`)

    if (inhalt !== null) {
      return inhalt
    }
  }

  return null
}

// Der Text von GOAL.md, so wie der Mod ihn liest und ans Modell gibt: gedeckelt wie jede
// Doku-Datei. null: Es gibt keine.
export const liesGoal = async (zugang: QuellenZugang): Promise<string | null> =>
  (await liesGoalGanz(zugang))?.slice(0, DOKU_GRENZE) ?? null

// ---------- Die Doku ----------

// Alle Markdown-Dateien unter einem Ordner, als Pfade ab der Wurzel, nach Namen sortiert.
const findeMarkdown = async (
  zugang: QuellenZugang,
  wurzel: string,
  ordner: string,
  tiefe: number,
): Promise<string[]> => {
  const eintraege = [...(await listeOrdner(zugang, `${wurzel}/${ordner}`))]
    .filter(one => !one.name.startsWith('.'))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const dateien = eintraege
    .filter(one => one.kind === 'file' && /\.md$/i.test(one.name))
    .map(one => `${ordner}/${one.name}`)

  if (tiefe > 1) {
    for (const unter of eintraege.filter(one => one.kind === 'dir')) {
      dateien.push(...(await findeMarkdown(zugang, wurzel, `${ordner}/${unter.name}`, tiefe - 1)))
    }
  }

  return dateien
}

// README.md, CLAUDE.md und jede .md unter docs/: jede Datei gedeckelt, alle zusammen auch.
// Was fehlt, fehlt einfach.
const liesDoku = async (
  zugang: QuellenZugang,
  wurzel: string,
  hinweise: string[],
): Promise<QuellDoku[]> => {
  const pfade = ['README.md', 'CLAUDE.md', ...(await findeMarkdown(zugang, wurzel, 'docs', DOKU_TIEFE))]
  const doku: QuellDoku[] = []
  let rest = GESAMT_GRENZE

  for (const datei of pfade) {
    const inhalt = await liesText(zugang, `${wurzel}/${datei}`)

    if (inhalt === null || inhalt.trim() === '') {
      continue
    }

    // Unter 500 Zeichen Platz lohnt eine Datei nicht mehr.
    if (doku.length >= DOKU_DATEIEN || rest < 500) {
      hinweise.push(`${datei} ausgelassen: Die Grenze für die Doku ist erreicht.`)
      continue
    }

    const platz = Math.min(DOKU_GRENZE, rest)
    const gesendet = inhalt.slice(0, platz)

    doku.push({ datei, text: gesendet, zeichen: inhalt.length, gekuerzt: inhalt.length > platz })
    rest -= gesendet.length

    if (inhalt.length > platz) {
      hinweise.push(`${datei} gekürzt: ${platz} von ${inhalt.length} Zeichen.`)
    }
  }

  return doku
}

// ---------- Die laufenden Chats ----------

const alsObjekt = (roh: string | null): Record<string, unknown> | null => {
  try {
    const wert: unknown = JSON.parse(roh ?? '')

    return typeof wert === 'object' && wert !== null ? (wert as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// Die Chats, die auch die Leiste von ziel-graph zeigt: angemeldet und in den letzten
// 14 Tagen angefasst. Gelesen werden die Dateien, die ziel-graph je Session schreibt; dieser
// Mod schreibt dort nie. Das Neueste steht zuerst; bei gleicher Zeit entscheidet die id.
const liesLaufende = async (zugang: QuellenZugang, name: string): Promise<OrchestratorChat[]> => {
  const ordner = `${await zugang.heim()}/.claude/ziel-graph/${name}`
  const jetzt = await zugang.jetzt()
  const dateien = (await listeOrdner(zugang, ordner)).filter(
    one => one.kind === 'file' && one.name.endsWith('.json'),
  )
  const chats: OrchestratorChat[] = []

  for (const datei of dateien) {
    const roh = alsObjekt(await liesText(zugang, `${ordner}/${datei.name}`))
    const zeit = typeof roh?.zeit === 'number' ? roh.zeit : 0
    const angefasst = zeit || datei.mtimeMs
    const istFrisch = angefasst === 0 || jetzt - angefasst < VERALTET_MS

    if (roh !== null && text(roh.id) !== '' && roh.aktiv === true && istFrisch) {
      chats.push({
        id: text(roh.id),
        name: kurz(text(roh.name), 60) || 'Chat ohne Namen',
        branch: kurz(text(roh.branch), 80),
        stand: kurz(text(roh.stand), 300),
        naechster: kurz(text(roh.naechster), 300),
        frage: kurz(text(roh.frage), 300),
        zeit,
      })
    }
  }

  return chats.sort((a, b) => b.zeit - a.zeit || (a.id < b.id ? -1 : 1))
}

// Die Chats des Repos, wie die Fläche sie zeigt. Ohne die Dateien von ziel-graph ist die
// Liste leer, und die Karten tragen keine Chat-Marke.
export const liesChats = async (zugang: QuellenZugang): Promise<OrchestratorChats> => ({
  ich: await zugang.sitzung(),
  chats: await liesLaufende(zugang, await schluesselVon(zugang)),
  gelesen: await zugang.jetzt(),
})

// ---------- Der Git-Verlauf ----------

// Datum und Betreff der letzten Commits. Ohne git oder ohne Repo ist die Liste leer.
const liesCommits = async (zugang: QuellenZugang, hinweise: string[]): Promise<string[]> => {
  try {
    const r = await zugang.laufe([
      'git',
      'log',
      '-n',
      String(COMMITS),
      '--date=short',
      '--pretty=format:%ad %s',
    ])

    if (r.exitCode !== 0) {
      hinweise.push('Kein Git-Verlauf: git log meldet einen Fehler.')

      return []
    }

    return r.stdout
      .split('\n')
      .map(one => kurz(one, 160))
      .filter(one => one !== '')
      .slice(0, COMMITS)
  } catch {
    hinweise.push('Kein Git-Verlauf: git ließ sich nicht starten.')

    return []
  }
}

// ---------- Alles zusammen ----------

// Liest alle Quellen eines Laufs. Nichts davon darf den Lauf scheitern lassen: Was nicht
// zu lesen ist, fehlt und steht als Hinweis da.
export const sammle = async (zugang: QuellenZugang): Promise<Quellen> => {
  const repo = await zugang.repo()
  const ordner = await zugang.wurzel()
  const name = await schluesselVon(zugang)
  const hinweise: string[] = []
  const goal = await liesGoalGanz(zugang)
  // Die Doku liegt im Ordner der Session. Läuft die Session in einem Unterordner, der
  // keine hat, gilt die Wurzel des Repos.
  let wurzel = ordner
  let doku = await liesDoku(zugang, ordner, hinweise)

  if (doku.length === 0 && repo !== null && repo.root !== ordner) {
    wurzel = repo.root
    doku = await liesDoku(zugang, repo.root, hinweise)
  }

  const laufende = await liesLaufende(zugang, name)

  if (laufende.length > CHATS) {
    hinweise.push(`${laufende.length - CHATS} Chats ausgelassen: Es gehen höchstens ${CHATS} ans Modell.`)
  }

  const chats = laufende.slice(0, CHATS).map(
    (one, i): QuellChat => ({
      id: one.id,
      kennung: `c${i + 1}`,
      name: one.name,
      branch: one.branch,
      stand: one.stand,
      naechster: one.naechster,
      frage: one.frage,
    }),
  )
  const commits = await liesCommits(zugang, hinweise)

  if (goal !== null && goal.length > DOKU_GRENZE) {
    hinweise.push(`${GOAL_DATEI} gekürzt: ${DOKU_GRENZE} von ${goal.length} Zeichen.`)
  }

  return {
    wurzel,
    schluessel: name,
    goal: goal === null ? null : goal.slice(0, DOKU_GRENZE),
    doku,
    chats,
    commits,
    hinweise,
  }
}
