import type {
  FsEntry,
  ModelCompleteResult,
  ProcessRunResult,
  SessionMessage,
  SessionRepo,
} from 'claude-code'

import type { ZielGraphChat, ZielGraphChats, ZielGraphTracker } from '../types'

// Was der Graph über die laufenden Chats weiß: wo ihre Stände liegen, wer sich anmeldet
// und wie der Stand nach einer Antwort entsteht. Kein `$`: `validate` folgt `$` nur in
// Funktionen derselben Datei, nie über einen Import. register.tsx baut deshalb aus `$`
// einen Zugang und reicht ihn hierher.

export type ChatZugang = {
  sitzung: () => Promise<string>
  heim: () => Promise<string>
  repo: () => Promise<SessionRepo | null>
  wurzel: () => Promise<string>
  nachrichten: () => Promise<SessionMessage[]>
  jetzt: () => Promise<number>
  gibtEs: (pfad: string) => Promise<boolean>
  liste: (pfad: string) => Promise<FsEntry[]>
  lies: (pfad: string) => Promise<string>
  schreibe: (pfad: string, text: string) => Promise<void>
  laufe: (argv: readonly string[]) => Promise<ProcessRunResult>
  frage: (system: string, prompt: string) => Promise<ModelCompleteResult>
  melde: (text: string) => void
}

const VERALTET_MS = 14 * 24 * 60 * 60_000
const HAUPTZWEIGE = ['', 'main', 'master', 'HEAD']
const TRACKER_DATEI = 'docs/agents/issue-tracker.md'
const NOCH_NICHTS = 'Noch kein Stand. Er kommt nach der nächsten Antwort.'

// ---------- Schlüssel eines Repos ----------

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
// origin, ohne origin "lokal+…" aus dem ganzen Pfad der Wurzel. Der Ordnername allein
// reicht nicht: zwei Repos dürfen gleich heißen.
export const schluessel = (remote: string | null, wurzel: string): string => {
  const { host, pfad } = zerlege(remote ?? '')
  const ausRemote = [...stuecke(host), ...stuecke(pfad)].join('+')
  const ausWurzel = ['lokal', ...stuecke(wurzel)].join('+')

  // Nur Punkte wären ein Weg aus dem Ordner hinaus.
  return (/^\.*$/.test(ausRemote) ? ausWurzel : ausRemote).slice(-200)
}

// ---------- Ticket-System und Ticketnummer ----------

// Welches Ticket-System ein Repo nutzt: aus der ersten Zeile von
// docs/agents/issue-tracker.md ("# Issue tracker: GitLab", "GitHub" oder "Local Markdown").
// Fehlt die Datei (null) oder ihre Kopfzeile, aus dem Host von origin. Passt nichts, gilt
// 'keine': lieber kein Ticket-Titel als einer aus dem falschen System.
export const trackerAus = (ersteZeile: string | null, remote: string | null): ZielGraphTracker => {
  const name = /^#\s*Issue tracker:\s*(.*?)\s*$/i.exec(ersteZeile ?? '')?.[1]?.toLowerCase()
  const quelle = name ?? zerlege(remote ?? '').host

  if (quelle.includes('gitlab')) {
    return 'gitlab'
  }

  if (quelle.includes('github')) {
    return 'github'
  }

  return name?.includes('markdown') === true ? 'markdown' : 'keine'
}

// Ticketnummer aus dem Branch: 2 bis 4 Ziffern ohne führende Null, auch als t218.
export const ticketAus = (branch: string): string =>
  /(?<![a-z0-9])t?([1-9]\d{1,3})(?![a-z0-9])/i.exec(branch)?.[1] ?? ''

// Ticketnummer aus dem ersten Auftrag: '#' und 1 bis 5 Ziffern ohne führende Null.
export const ticketImPrompt = (auftrag: string): string =>
  /#([1-9]\d{0,4})\b/.exec(auftrag)?.[1] ?? ''

// Gehört die Datei "03-warenkorb.md" zum Ticket 3? Tickets als Markdown sind ab 01 nummeriert.
export const istTicketDatei = (name: string, nummer: string): boolean =>
  name.endsWith('.md') && Number.parseInt(name, 10) === Number(nummer)

// Der Titel einer Ticket-Datei: die erste Überschrift ohne die Nummer davor ("# 03 — Titel").
export const titelAusMarkdown = (inhalt: string): string =>
  (/^#[ \t]+(.+?)[ \t]*$/m.exec(inhalt)?.[1] ?? '').replace(/^\d+\s*[—–:-]\s+/, '')

// ---------- Kleine Helfer ----------

const text = (wert: unknown): string => (typeof wert === 'string' ? wert : '')

export const kurz = (wert: string, laenge: number): string =>
  wert.length > laenge ? `${wert.slice(0, laenge)}…` : wert

const alsObjekt = (roh: string | null): Record<string, unknown> | null => {
  try {
    const wert: unknown = JSON.parse(roh ?? '')

    return typeof wert === 'object' && wert !== null ? (wert as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const alsChat = (roh: Record<string, unknown> | null): ZielGraphChat | null =>
  roh === null || text(roh.id) === ''
    ? null
    : {
        id: text(roh.id),
        name: text(roh.name),
        aktiv: roh.aktiv === true,
        branch: text(roh.branch),
        stand: text(roh.stand),
        naechster: text(roh.naechster),
        frage: text(roh.frage),
        zeit: typeof roh.zeit === 'number' ? roh.zeit : 0,
        ...(typeof roh.ticket === 'string' ? { ticket: roh.ticket } : {}),
        ...(typeof roh.ticketTitel === 'string' ? { ticketTitel: roh.ticketTitel } : {}),
      }

const neuerChat = (id: string, branch: string): ZielGraphChat => ({
  id,
  name: '',
  aktiv: true,
  branch,
  stand: NOCH_NICHTS,
  naechster: '',
  frage: '',
  zeit: 0,
})

export const alter = (jetzt: number, zeit: number): string => {
  const minuten = Math.round((jetzt - zeit) / 60_000)

  if (zeit === 0) {
    return 'noch nie'
  }

  if (minuten < 2) {
    return 'gerade eben'
  }

  if (minuten < 90) {
    return `vor ${minuten} Min`
  }

  if (minuten < 36 * 60) {
    return `vor ${Math.round(minuten / 60)} Std`
  }

  return `vor ${Math.round(minuten / 1440)} Tagen`
}

// Die Kopfzeile über den Chats: "3 Chats, 1 wartet auf dich".
export const zaehler = (chats: readonly ZielGraphChat[]): string => {
  const wartend = chats.filter(one => one.frage !== '').length
  const warten = wartend === 0 ? 'keiner wartet' : wartend === 1 ? '1 wartet' : `${wartend} warten`

  return `${chats.length} ${chats.length === 1 ? 'Chat' : 'Chats'}, ${warten} auf dich`
}

// Die Chats, deren Frage dieses Fenster noch nicht kennt. Der eigene Chat zählt nicht, und
// beim ersten Laden (bekannt ist null) gilt nichts als neu.
export const neueFragen = (
  bekannt: ReadonlyMap<string, string> | null,
  stand: ZielGraphChats,
): ZielGraphChat[] =>
  bekannt === null
    ? []
    : stand.chats.filter(
        one => one.frage !== '' && one.id !== stand.ich && bekannt.get(one.id) !== one.frage,
      )

// ---------- Lesen und Schreiben ----------

const liesText = async (zugang: ChatZugang, pfad: string): Promise<string | null> => {
  try {
    return await zugang.lies(pfad)
  } catch {
    return null
  }
}

// Ein Ordner je Repo, außerhalb der Arbeitskopie: alle Worktrees teilen ihn.
const ordner = async (zugang: ChatZugang): Promise<string> => {
  const repo = await zugang.repo()
  const wurzel = repo?.root ?? (await zugang.wurzel())

  return `${await zugang.heim()}/.claude/ziel-graph/${schluessel(repo?.remote ?? null, wurzel)}`
}

// Die Chats des Repos, die die Leiste zeigt: angemeldet und in den letzten 14 Tagen angefasst.
export const liesChats = async (zugang: ChatZugang): Promise<ZielGraphChats> => {
  const dir = await ordner(zugang)
  const ich = await zugang.sitzung()
  const gelesen = await zugang.jetzt()
  const chats: ZielGraphChat[] = []

  if (!(await zugang.gibtEs(dir))) {
    return { ich, chats, gelesen }
  }

  const dateien = (await zugang.liste(dir)).filter(
    one => one.kind === 'file' && one.name.endsWith('.json'),
  )

  for (const datei of dateien) {
    const chat = alsChat(alsObjekt(await liesText(zugang, `${dir}/${datei.name}`)))
    // Ohne Stand zählt, wann die Datei zuletzt geschrieben wurde.
    const angefasst = chat === null ? 0 : chat.zeit || datei.mtimeMs
    const istFrisch = angefasst === 0 || gelesen - angefasst < VERALTET_MS

    if (chat?.aktiv === true && istFrisch) {
      chats.push(chat)
    }
  }

  // Wer auf den Nutzer wartet, steht oben; darunter das Neueste zuerst.
  chats.sort((a, b) => Number(b.frage !== '') - Number(a.frage !== '') || b.zeit - a.zeit)

  return { ich, chats, gelesen }
}

// Die eigene Datei, auch wenn der Chat abgemeldet ist: wer sich abgemeldet hat, bleibt draußen.
const liesEigene = async (zugang: ChatZugang, dir: string): Promise<ZielGraphChat | null> =>
  alsChat(alsObjekt(await liesText(zugang, `${dir}/${await zugang.sitzung()}.json`)))

const schreibe = (zugang: ChatZugang, dir: string, chat: ZielGraphChat): Promise<void> =>
  zugang.schreibe(`${dir}/${chat.id}.json`, JSON.stringify(chat, null, 2))

// Ein Befehl auf dem Rechner. Fehlt das Werkzeug oder scheitert der Aufruf, ist die Antwort leer.
const laufe = async (zugang: ChatZugang, argv: readonly string[]): Promise<string> => {
  try {
    const r = await zugang.laufe(argv)

    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

const zweig = (zugang: ChatZugang): Promise<string> =>
  laufe(zugang, ['git', 'rev-parse', '--abbrev-ref', 'HEAD'])

const ersterPrompt = async (zugang: ChatZugang): Promise<string> =>
  (await zugang.nachrichten()).find(one => one.role === 'user' && one.text.trim() !== '')?.text ??
  ''

// ---------- Ticket-Titel ----------

// Die Arbeitskopie des Chats und, wenn er in einem Worktree läuft, die Wurzel des Repos.
const wurzeln = async (zugang: ChatZugang): Promise<string[]> => {
  const repo = await zugang.repo()

  return [...new Set([await zugang.wurzel(), repo?.root ?? ''])].filter(one => one !== '')
}

// Das Ticket-System steht nach dem ersten Nachsehen für die Session fest.
let tracker: ZielGraphTracker | null = null

const findeTracker = async (zugang: ChatZugang): Promise<ZielGraphTracker> => {
  if (tracker === null) {
    let datei: string | null = null

    for (const wurzel of await wurzeln(zugang)) {
      datei ??= await liesText(zugang, `${wurzel}/${TRACKER_DATEI}`)
    }

    tracker = trackerAus(datei?.split('\n')[0] ?? null, (await zugang.repo())?.remote ?? null)
  }

  return tracker
}

// Tickets als Markdown liegen unter .scratch/<vorhaben>/issues/<NN>-<name>.md und sind je
// Vorhaben ab 01 nummeriert. Die Nummer allein trifft nur, wenn genau eine Datei passt.
const titelAusDateien = async (zugang: ChatZugang, nummer: string): Promise<string> => {
  for (const wurzel of await wurzeln(zugang)) {
    const scratch = `${wurzel}/.scratch`
    const vorhaben = (await zugang.gibtEs(scratch)) ? await zugang.liste(scratch) : []
    const treffer: string[] = []

    for (const eines of vorhaben.filter(one => one.kind === 'dir')) {
      const issues = `${scratch}/${eines.name}/issues`
      const dateien = (await zugang.gibtEs(issues)) ? await zugang.liste(issues) : []

      treffer.push(
        ...dateien
          .filter(one => one.kind === 'file' && istTicketDatei(one.name, nummer))
          .map(one => `${issues}/${one.name}`),
      )
    }

    if (treffer.length === 1) {
      return titelAusMarkdown((await liesText(zugang, treffer[0] ?? '')) ?? '')
    }
  }

  return ''
}

// Der Aufruf, der ein Ticket als JSON mit dem Feld "title" liefert.
const TITEL_BEFEHL: Partial<Record<ZielGraphTracker, (nummer: string) => string[]>> = {
  gitlab: nummer => ['glab', 'api', `projects/:id/issues/${nummer}`],
  github: nummer => ['gh', 'issue', 'view', nummer, '--json', 'title'],
}

// Der Titel eines Tickets aus dem Ticket-System des Repos. Ein fehlendes Werkzeug, ein
// gescheiterter Aufruf oder ein unbekannter Aufbau heißt nur: kein Titel.
const ticketTitel = async (zugang: ChatZugang, nummer: string): Promise<string> => {
  try {
    const system = await findeTracker(zugang)
    const befehl = TITEL_BEFEHL[system]
    const titel =
      system === 'markdown'
        ? await titelAusDateien(zugang, nummer)
        : befehl === undefined
          ? ''
          : text(alsObjekt(await laufe(zugang, befehl(nummer)))?.title)

    return kurz(titel.trim(), 120)
  } catch {
    return ''
  }
}

// ---------- Stand nach einer Antwort ----------

const AUFTRAG = `Du füllst eine Zeile in einer Übersicht über parallele Arbeits-Chats.
Antworte NUR mit einem JSON-Objekt, ohne Markdown-Zaun und ohne Text davor oder danach:
{"name": "...", "stand": "...", "naechster": "...", "frage": "..."}

- name: nur wenn "Name des Chats" leer ist, sonst leerer Text. Dann 2 bis 4 Worte, die sagen, woran dieser Chat arbeitet. Passt das genannte Ticket klar zum ersten Auftrag, beginne mit "#Nummer ".
- stand: ein kurzer Satz in einfachen Worten: was ist in diesem Chat jetzt erreicht.
- naechster: ein kurzer Satz: der nächste konkrete Schritt.
- frage: die Frage oder Freigabe, auf die der Chat gerade vom Nutzer wartet, als ein kurzer Satz. Leerer Text, wenn er auf nichts wartet.

Schreibe auf Deutsch mit Umlauten. Erfinde nichts: was nicht in den Angaben steht, lässt du weg. Ändert die letzte Antwort nichts am bisherigen Stand, übernimm ihn.`

// Die Felder aus der Antwort des Modells; null, wenn kein JSON-Objekt darin steht.
const felderAus = (antwort: string): Record<string, unknown> | null =>
  alsObjekt(antwort.slice(antwort.indexOf('{'), antwort.lastIndexOf('}') + 1))

// Fasst nach einer eigenen Antwort den Stand dieses Chats neu und schreibt ihn. Die Antwort
// sagt, ob geschrieben wurde. Ein Fehler kostet nur den Stand, nie die Runde.
export const fasseZusammen = async (
  zugang: ChatZugang,
  antwort: string,
  letzterPrompt: string,
): Promise<boolean> => {
  try {
    const dir = await ordner(zugang)
    const eigene = await liesEigene(zugang, dir)

    if (eigene !== null && !eigene.aktiv) {
      return false
    }

    const branch = await zweig(zugang)
    const auftrag = await ersterPrompt(zugang)
    const erkannt = ticketAus(branch) || ticketImPrompt(auftrag)
    // Von selbst kommt nur in den Graphen, wer an etwas Eigenem arbeitet: Branch oder Ticket.
    const istEigenes = !HAUPTZWEIGE.includes(branch) || erkannt !== ''

    if (eigene === null && !istEigenes) {
      return false
    }

    const ich = eigene ?? neuerChat(await zugang.sitzung(), branch)
    const ticket = erkannt || (ich.ticket ?? '')
    // Der Titel wird je Ticket einmal nachgeschlagen, auch wenn nichts zu finden war.
    const titel =
      ticket === ''
        ? ''
        : ticket === ich.ticket && ich.ticketTitel !== undefined
          ? ich.ticketTitel
          : await ticketTitel(zugang, ticket)
    const brauchtNamen = ich.name === ''
    const angaben = [
      `Name des Chats: ${ich.name}`,
      brauchtNamen ? `Branch: ${branch}` : '',
      brauchtNamen && ticket !== '' ? `Ticket #${ticket}${titel === '' ? '' : `: ${titel}`}` : '',
      brauchtNamen ? `Erster Auftrag des Nutzers:\n${kurz(auftrag, 1500)}` : '',
      `Bisheriger Stand: ${ich.stand}`,
      `Bisheriger nächster Schritt: ${ich.naechster}`,
      `Letzte Nachricht des Nutzers:\n${kurz(letzterPrompt, 1500)}`,
      `Letzte Antwort des Chats:\n${kurz(antwort, 6000)}`,
    ]
      .filter(one => one !== '')
      .join('\n\n')
    const r = await zugang.frage(AUFTRAG, angaben)
    const felder = r.isAnswered ? felderAus(r.text) : null

    if (felder === null) {
      const grund = r.isAnswered ? 'kein JSON in der Antwort' : r.reason

      zugang.melde(`Zusammenfassung blieb aus (${grund}); Stand unverändert.`)
    }

    // /pfad kann während des Modell-Aufrufs gelaufen sein: Abmeldung und Name von dort gelten.
    const inzwischen = (await liesEigene(zugang, dir)) ?? ich

    if (!inzwischen.aktiv) {
      return false
    }

    await schreibe(zugang, dir, {
      ...ich,
      name: inzwischen.name || kurz(text(felder?.name), 40) || branch || `#${ticket}`,
      branch,
      stand: text(felder?.stand) || ich.stand,
      naechster: felder === null ? ich.naechster : text(felder.naechster),
      frage: felder === null ? ich.frage : text(felder.frage),
      zeit: await zugang.jetzt(),
      ...(ticket === '' ? {} : { ticket, ticketTitel: titel }),
    })

    return true
  } catch (fehler) {
    zugang.melde(`Zusammenfassung fehlgeschlagen: ${String(fehler)}`)

    return false
  }
}

// ---------- Der Befehl /pfad ----------

// Ohne Eingabe sagt /pfad, welcher Chat das ist; mit einem Namen meldet er den Chat an
// oder benennt ihn um; mit "aus" meldet er ihn ab. Die Antwort ist der Text für den Nutzer.
export const pfadBefehl = async (zugang: ChatZugang, eingabe: string): Promise<string> => {
  const dir = await ordner(zugang)
  const eigene = await liesEigene(zugang, dir)

  if (eingabe === '') {
    return eigene === null
      ? 'Dieser Chat steht nicht im Ziel-Graphen. Anmelden mit: /pfad <Name>'
      : eigene.aktiv
        ? `Dieser Chat steht als „${eigene.name}“ im Ziel-Graphen.`
        : 'Dieser Chat ist abgemeldet. Wieder anmelden mit: /pfad <Name>'
  }

  const ich = eigene ?? neuerChat(await zugang.sitzung(), await zweig(zugang))

  if (eingabe.toLowerCase() === 'aus') {
    await schreibe(zugang, dir, { ...ich, aktiv: false })

    return 'Dieser Chat ist abgemeldet und bleibt draußen.'
  }

  await schreibe(zugang, dir, { ...ich, name: eingabe, aktiv: true })

  return `Dieser Chat steht jetzt als „${eingabe}“ im Ziel-Graphen.`
}
