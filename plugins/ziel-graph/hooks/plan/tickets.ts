import type { FsEntry, ProcessRunResult } from 'claude-code'

import type { ZielGraphTracker } from '../../types'

import { leseTracker, titelAusMarkdown, wurzeln } from '../chats'
import type { ChatZugang } from '../chats'
import { istObjekt, sauber, text } from '../worte'

import type { TrackerNamen } from './goal'

// Die Tickets eines Repos als Quelle des Plans: aus GitHub über `gh`, aus GitLab über
// `glab`, oder als Markdown-Dateien unter .scratch. Welches Ticket-System gilt, entscheidet
// das Chat-Modul. Nichts hier lässt einen Lauf oder das Laden scheitern: Was sich nicht
// lesen lässt, heißt „keine Tickets“ und steht als Hinweis da. Kein `$`: register.tsx reicht
// einen Zugang.

export type TicketZugang = Pick<ChatZugang, 'repo' | 'wurzel' | 'gibtEs' | 'liste' | 'lies' | 'laufe'>

// Ein Ticket, so viel der Plan davon braucht.
export type Ticket = {
  // die Nummer ohne '#'; bei Tickets als Markdown Vorhaben und Nummer: 'kasse/03'. Dort
  // beginnt jedes Vorhaben wieder bei 01, die Nummer allein sagt also nichts.
  schluessel: string
  nummer: number
  titel: string
  // true: geschlossen
  zu: boolean
  labels: string[]
  // die Anmeldenamen derer, denen es zugewiesen ist
  zugewiesen: string[]
  // der Meilenstein; '' ohne
  meilenstein: string
  // ein kurzer Auszug aus dem Text eines offenen Tickets; '' ohne
  auszug: string
  // was der Text des Tickets selbst als Blockade nennt („Blocked by: #12“); '' ohne
  blockade: string
  // der Tag, an dem es geschlossen wurde ('2026-09-20'); '' wenn es offen ist oder der Tag fehlt
  geschlossen: string
}

// Ein Ticket, so viel sich der Plan davon merkt: genug, um ihn ohne das Ticket-System wieder
// so zu zeigen, wie er beim Ableiten dastand.
export type MerkTicket = Pick<Ticket, 'schluessel' | 'titel' | 'zu' | 'labels' | 'zugewiesen'>

// Was das Ticket-System gerade nennt.
export type TicketLage = {
  tracker: ZielGraphTracker
  // true: Die offenen Tickets ließen sich lesen. false: Die Liste ist leer, ein Hinweis sagt, warum.
  gelesen: boolean
  // erst die offenen, dann die zuletzt geschlossenen
  liste: Ticket[]
  // true: Die Liste nennt jedes offene Ticket. Was dort fehlt, ist dann nicht mehr offen.
  istVollstaendig: boolean
  // was beim Lesen nicht ging oder ausgelassen wurde
  hinweise: string[]
}

// So viele Tickets liest ein Aufruf höchstens: die offenen und die zuletzt geschlossenen.
export const OFFENE = 100
export const GESCHLOSSENE = 30
// So viele Zeichen gehen von den Tickets zusammen höchstens ans Modell.
export const TICKETS_GRENZE = 32_000
const MAX_TITEL = 120
const MAX_AUSZUG = 160
const MAX_BLOCKADE = 80
const MAX_LABELS = 8
const MAX_LABEL = 40
const MAX_ZUGEWIESEN = 4
// Mehr Dateien liest der Mod unter .scratch nicht.
const MAX_DATEIEN = 400

export const TRACKER_NAME: Record<ZielGraphTracker, string> = {
  gitlab: 'GitLab',
  github: 'GitHub',
  markdown: 'Markdown-Dateien',
  keine: 'kein Ticket-System',
}

export const KEINE_TICKETS: TicketLage = {
  tracker: 'keine',
  gelesen: true,
  liste: [],
  istVollstaendig: true,
  hinweise: [],
}

// ---------- Kleine Helfer ----------

// Wie ein Ticket in der Eingabe und in beiden Ansichten heißt: „#14“, bei Tickets als
// Markdown „kasse/03“.
export const ticketName = (schluessel: string): string =>
  /^\d+$/.test(schluessel) ? `#${schluessel}` : schluessel

// Ein Text aus dem Ticket-System: Den kann jemand von außen geschrieben haben. Er steht in
// einer Zeile, ist gedeckelt und kann den Block, in dem er ans Modell geht, nicht schließen.
const rein = (wert: unknown, laenge: number): string =>
  sauber(wert, laenge).replace(/</g, '‹').replace(/>/g, '›')

const tag = (wert: unknown): string => /^\d{4}-\d{2}-\d{2}/.exec(text(wert))?.[0] ?? ''

const ganzeZahl = (wert: unknown): number => {
  const zahl = typeof wert === 'number' ? wert : Number.parseInt(text(wert), 10)

  return Number.isInteger(zahl) && zahl > 0 ? zahl : 0
}

// Eine Liste von Namen: als Texte, oder als Objekte mit dem Namen in einem der Felder.
const namenAus = (wert: unknown, felder: readonly string[], laenge: number, anzahl: number): string[] =>
  [
    ...new Set(
      (Array.isArray(wert) ? wert : [])
        .map((one: unknown) =>
          istObjekt(one) ? rein(felder.map(feld => one[feld]).find(feldWert => text(feldWert) !== ''), laenge) : rein(one, laenge),
        )
        .filter(one => one !== ''),
    ),
  ].slice(0, anzahl)

const alsListe = (roh: string): unknown[] | null => {
  try {
    const wert: unknown = JSON.parse(roh)

    return Array.isArray(wert) ? wert : null
  } catch {
    return null
  }
}

// ---------- Der Text eines Tickets ----------

const BLOCKADE =
  /^[\s>*_#-]*(?:blocked\s+by|blockiert\s+(?:von|durch)|depends\s+on|h(?:ä|ae)ngt\s+ab\s+von)\b[\s*_]*[:：]?[\s*_]*(.*)$/i
const KEINE_BLOCKADE = /^(none|keine?[rs]?|nichts|niemand|n\/a|nein|no|-+|–|—)\b|can start immediately/i

// Was der Text eines Tickets selbst als Blockade nennt: die Zeile „Blocked by: #12, #13“
// oder die Liste unter der Überschrift „Blocked by“. '' wenn dort nichts oder „None“ steht.
export const blockadeAus = (inhalt: string): string => {
  const zeilen = inhalt.split(/\r\n|\r|\n/)

  for (const [i, zeile] of zeilen.entries()) {
    const treffer = BLOCKADE.exec(zeile)

    if (treffer === null) {
      continue
    }

    let genannt = (treffer[1] ?? '').trim()

    // Als Überschrift: Die Blockaden stehen in den Zeilen darunter.
    if (genannt === '') {
      const darunter: string[] = []

      for (const naechste of zeilen.slice(i + 1)) {
        if (/^\s*#/.test(naechste) || (naechste.trim() === '' && darunter.length > 0) || darunter.length >= 4) {
          break
        }

        if (naechste.trim() !== '') {
          darunter.push(naechste.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim())
        }
      }

      genannt = darunter.join(', ')
    }

    const kurz = rein(genannt.replace(/\*\*|__|`/g, ''), MAX_BLOCKADE)

    return KEINE_BLOCKADE.test(kurz) ? '' : kurz
  }

  return ''
}

// Der Anfang des Textes, in einer Zeile: ohne Kommentare und ohne die Zeichen, mit denen
// Markdown auszeichnet.
const auszugAus = (inhalt: string): string =>
  rein(
    inhalt
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/\*\*|__|`/g, ''),
    MAX_AUSZUG,
  )

type Roh = {
  schluessel: string
  nummer: number
  titel: unknown
  zu: boolean
  labels: string[]
  zugewiesen: string[]
  meilenstein: unknown
  inhalt: string
  // woraus der Auszug kommt, wenn nicht aus dem ganzen Text
  anfang?: string
  geschlossen: string
}

const ticketAus = (roh: Roh): Ticket => ({
  schluessel: roh.schluessel,
  nummer: roh.nummer,
  titel: rein(roh.titel, MAX_TITEL) || `Ticket ${ticketName(roh.schluessel)}`,
  zu: roh.zu,
  labels: roh.labels,
  zugewiesen: roh.zugewiesen,
  meilenstein: rein(roh.meilenstein, 60),
  // Ein geschlossenes Ticket braucht keinen Text mehr.
  auszug: roh.zu ? '' : auszugAus(roh.anfang ?? roh.inhalt),
  blockade: roh.zu ? '' : blockadeAus(roh.inhalt),
  geschlossen: roh.zu ? roh.geschlossen : '',
})

// ---------- GitHub ----------

// Die Tickets aus der Ausgabe von `gh issue list --json …`; null, wenn dort keine Liste steht.
export const ausGithub = (roh: string): Ticket[] | null =>
  alsListe(roh)?.flatMap((one: unknown): Ticket[] => {
    const nummer = istObjekt(one) ? ganzeZahl(one.number) : 0

    if (!istObjekt(one) || nummer === 0) {
      return []
    }

    return [
      ticketAus({
        schluessel: String(nummer),
        nummer,
        titel: one.title,
        zu: /^closed$/i.test(text(one.state)) || one.closed === true,
        labels: namenAus(one.labels, ['name'], MAX_LABEL, MAX_LABELS),
        zugewiesen: namenAus(one.assignees, ['login', 'name'], MAX_LABEL, MAX_ZUGEWIESEN),
        meilenstein: istObjekt(one.milestone) ? one.milestone.title : '',
        inhalt: text(one.body),
        geschlossen: tag(one.closedAt),
      }),
    ]
  }) ?? null

// ---------- GitLab ----------

// Die Tickets aus der Ausgabe von `glab api projects/:id/issues?…`; null, wenn dort keine
// Liste steht.
export const ausGitlab = (roh: string): Ticket[] | null =>
  alsListe(roh)?.flatMap((one: unknown): Ticket[] => {
    const nummer = istObjekt(one) ? ganzeZahl(one.iid) : 0

    if (!istObjekt(one) || nummer === 0) {
      return []
    }

    return [
      ticketAus({
        schluessel: String(nummer),
        nummer,
        titel: one.title,
        zu: /^closed$/i.test(text(one.state)),
        labels: namenAus(one.labels, ['name', 'title'], MAX_LABEL, MAX_LABELS),
        // Ältere Antworten nennen nur einen: unter "assignee".
        zugewiesen: namenAus(
          Array.isArray(one.assignees) && one.assignees.length > 0 ? one.assignees : [one.assignee],
          ['username', 'name'],
          MAX_LABEL,
          MAX_ZUGEWIESEN,
        ),
        meilenstein: istObjekt(one.milestone) ? one.milestone.title : '',
        inhalt: text(one.description),
        geschlossen: tag(one.closed_at),
      }),
    ]
  }) ?? null

// ---------- Tickets als Markdown ----------

// Die Zeilen im Kopf einer Ticket-Datei: „Status: resolved“, auch fett („**Status:** …“)
// und als Listenpunkt.
const KOPF_FELD = /^[\s>*_-]*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß -]{1,24}?)[\s*_]*[:：][\s*_]*(.*)$/
// Mit diesem Status ist ein Ticket als Markdown geschlossen. Die Vorlage kennt „resolved“
// und „wontfix“; die übrigen Worte sind die, die sonst dafür üblich sind.
const ZU_STATUS = /^(resolved|done|closed|complete[d]?|merged|shipped|wontfix|won't fix|erledigt|geschlossen|fertig|abgeschlossen|verworfen)\b/i
const FELD_STATUS = /^(status|stand|state)$/i
const FELD_ART = /^(type|typ|art)$/i
const FELD_LABELS = /^(labels?)$/i
const FELD_WER = /^(assignee|assignees|assigned to|owner|claimed by|zugewiesen|zugewiesen an|wer)$/i
const FELD_ZU = /^(closed|closed at|resolved|geschlossen|geschlossen am|erledigt am)$/i
// Die Zeilen des Kopfs, die für sich gelesen werden: Im Auszug des Textes stehen sie nicht noch einmal.
const KOPF_FELDER = [FELD_STATUS, FELD_ART, FELD_LABELS, FELD_WER, FELD_ZU]

const werte = (wert: string): string[] =>
  wert
    .split(/[,;]/)
    .map(one => rein(one.replace(/\*\*|__|`/g, '').replace(/^@/, ''), MAX_LABEL))
    .filter(one => one !== '' && !/^(none|keine?[rs]?|niemand|-+|–|—)$/i.test(one))

// Gehört die Datei zu einem Ticket: „03-warenkorb.md“.
export const istTicketName = (name: string): boolean => /^\d+.*\.md$/i.test(name)

// Ein Ticket aus seiner Datei .scratch/<vorhaben>/issues/<NN>-<name>.md, so wie die
// mattpocock-Skills sie schreiben: die Überschrift „# <NN> — <Titel>“, darunter Zeilen wie
// „Status: …“, „Type: …“ und „Blocked by: …“. `geaendert` ist, wann die Datei zuletzt
// geschrieben wurde: Eine geschlossene nennt sonst keinen Tag.
export const ausMarkdown = (vorhaben: string, datei: string, inhalt: string, geaendert = 0): Ticket | null => {
  const ziffern = /^\d+/.exec(datei)?.[0] ?? ''
  const nummer = ganzeZahl(ziffern)

  if (nummer === 0 || vorhaben.trim() === '') {
    return null
  }

  const zeilen = inhalt.replace(/^\ufeff/, '').split(/\r\n|\r|\n/)
  const felder = new Map<string, string>()
  const rumpf: string[] = []
  let istImKopf = true

  for (const zeile of zeilen) {
    const ueberschrift = /^\s{0,3}(#{1,6})\s+/.exec(zeile)
    const feld = KOPF_FELD.exec(zeile)

    // Der Kopf endet an der ersten Überschrift unter dem Titel.
    if (ueberschrift !== null) {
      istImKopf = istImKopf && (ueberschrift[1] ?? '').length === 1 && rumpf.length === 0
    }

    if (ueberschrift === null && istImKopf && feld !== null) {
      const name = (feld[1] ?? '').trim().toLowerCase()

      if (!felder.has(name)) {
        felder.set(name, (feld[2] ?? '').trim())
      }

      if (KOPF_FELDER.some(one => one.test(name))) {
        continue
      }
    }

    // Der Titel steht für sich; alles andere ist der Text des Tickets.
    if (ueberschrift === null || (ueberschrift[1] ?? '').length > 1) {
      rumpf.push(zeile)
    }
  }

  // Der Auszug kommt aus dem, was vor der ersten Überschrift im Text steht: Kommentare und
  // Antworten weiter unten gehören nicht hinein.
  const ende = rumpf.findIndex(zeile => /^\s{0,3}#{2,6}\s+/.test(zeile))
  const vorn = (ende === -1 ? rumpf : rumpf.slice(0, ende)).join('\n')
  const lies = (muster: RegExp): string => [...felder].find(([name]) => muster.test(name))?.[1] ?? ''
  const status = lies(FELD_STATUS).replace(/\*\*|__|`/g, '').trim()
  const zu = ZU_STATUS.test(status)
  const genannt = tag(lies(FELD_ZU))
  const name = datei.replace(/\.md$/i, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ')

  return ticketAus({
    schluessel: `${vorhaben}/${ziffern}`,
    nummer,
    titel: titelAusMarkdown(inhalt) || name,
    zu,
    // Ohne echte Labels sagt der Status, wie es um das Ticket steht: „needs-info“, „claimed“.
    labels: [...new Set([...(zu ? [] : werte(status)), ...werte(lies(FELD_ART)), ...werte(lies(FELD_LABELS))])].slice(0, MAX_LABELS),
    zugewiesen: werte(lies(FELD_WER)).slice(0, MAX_ZUGEWIESEN),
    meilenstein: '',
    inhalt: rumpf.join('\n'),
    ...(vorn.trim() === '' ? {} : { anfang: vorn }),
    geschlossen: genannt || (geaendert > 0 ? new Date(geaendert).toISOString().slice(0, 10) : ''),
  })
}

// ---------- Was die Labels bedeuten ----------

// Die Vorgaben, die ohne Einstellung gelten: Ein Label zählt, wenn sein Name eines dieser
// Stücke enthält.
export const BLOCKIERT_VORGABE = ['block']
export const AUSKUNFT_VORGABE = ['wartet', 'waiting', 'needs-info', 'question']

const traegt = (labels: readonly string[], genannt: readonly string[], vorgabe: readonly string[]): boolean =>
  labels
    .map(one => one.trim().toLowerCase())
    .some(label =>
      genannt.length > 0
        ? genannt.some(one => one.trim().toLowerCase() === label)
        : vorgabe.some(one => label.includes(one)),
    )

// Warum an einem offenen Ticket gerade nicht gearbeitet werden kann, laut seinen Labels:
// Es wartet auf eine Auskunft von außen, oder es ist blockiert. Nennt GOAL.md die Labels,
// zählen genau die; sonst gilt die Vorgabe.
export const grundVon = (
  ticket: Pick<Ticket, 'zu' | 'labels'>,
  namen: TrackerNamen,
): '' | 'blockiert' | 'auskunft' => {
  if (ticket.zu) {
    return ''
  }

  if (traegt(ticket.labels, namen.auskunft, AUSKUNFT_VORGABE)) {
    return 'auskunft'
  }

  return traegt(ticket.labels, namen.blockiert, BLOCKIERT_VORGABE) ? 'blockiert' : ''
}

// Die Bereiche, die die Labels eines Tickets nennen: nur, wenn GOAL.md sagt, womit solche
// Labels beginnen. „bereich:kasse“ nennt dann „kasse“.
export const bereicheVon = (ticket: Pick<Ticket, 'labels'>, namen: TrackerNamen): string[] =>
  ticket.labels.flatMap(label => {
    const anfang = namen.bereich.find(one => one !== '' && label.toLowerCase().startsWith(one.toLowerCase()))
    const bereich = anfang === undefined ? '' : label.slice(anfang.length).replace(/^[\s:/_-]+/, '')

    return bereich === '' ? [] : [bereich]
  })

// ---------- Die Zeile fürs Modell ----------

// Ein Ticket als eine Zeile der Eingabe: vorn die Kennung, dann ob es offen ist, der Titel
// und was das Ticket-System sonst dazu sagt.
export const ticketZeile = (ticket: Ticket, namen: TrackerNamen): string => {
  const grund = grundVon(ticket, namen)
  const bereiche = bereicheVon(ticket, namen)

  return [
    ticketName(ticket.schluessel),
    ticket.zu ? `geschlossen${ticket.geschlossen === '' ? '' : ` am ${ticket.geschlossen}`}` : 'offen',
    ticket.titel,
    ticket.labels.length === 0 ? '' : `Labels: ${ticket.labels.join(', ')}`,
    bereiche.length === 0 ? '' : `Bereich: ${bereiche.join(', ')}`,
    grund === 'blockiert' ? 'blockiert laut Label' : grund === 'auskunft' ? 'wartet auf Auskunft laut Label' : '',
    ticket.zu || ticket.zugewiesen.length === 0 ? '' : `zugewiesen: ${ticket.zugewiesen.join(', ')}`,
    ticket.meilenstein === '' ? '' : `Meilenstein: ${ticket.meilenstein}`,
    ticket.blockade === '' ? '' : `blockiert laut Ticket von: ${ticket.blockade}`,
    ticket.auszug === '' ? '' : `Text: ${ticket.auszug}`,
  ]
    .filter(one => one !== '')
    .join(' · ')
}

// Die Tickets, die ans Modell gehen: in ihrer Reihenfolge, bis die Grenze erreicht ist.
export const waehle = (
  liste: readonly Ticket[],
  namen: TrackerNamen,
  grenze = TICKETS_GRENZE,
): { gesendet: Ticket[]; ausgelassen: number } => {
  const gesendet: Ticket[] = []
  let rest = grenze

  for (const ticket of liste) {
    const laenge = ticketZeile(ticket, namen).length + 1

    if (laenge > rest) {
      break
    }

    gesendet.push(ticket)
    rest -= laenge
  }

  return { gesendet, ausgelassen: liste.length - gesendet.length }
}

// ---------- Was sich der Plan merkt ----------

export const merke = (liste: readonly Ticket[]): MerkTicket[] =>
  liste.map(one => ({
    schluessel: one.schluessel,
    titel: one.titel,
    zu: one.zu,
    labels: one.labels,
    zugewiesen: one.zugewiesen,
  }))

const texte = (wert: unknown): string[] =>
  (Array.isArray(wert) ? wert : []).filter((one): one is string => typeof one === 'string')

// Die gemerkten Tickets aus einer Plan-Datei, so weit sie brauchbar sind. Eine Datei von vor
// Version 0.5.0 nennt keine.
export const leseGemerkte = (wert: unknown): MerkTicket[] =>
  (Array.isArray(wert) ? wert : []).flatMap((one: unknown): MerkTicket[] =>
    istObjekt(one) && typeof one.schluessel === 'string' && one.schluessel !== ''
      ? [
          {
            schluessel: one.schluessel,
            titel: text(one.titel),
            zu: one.zu === true,
            labels: texte(one.labels),
            zugewiesen: texte(one.zugewiesen),
          },
        ]
      : [],
  )

// ---------- Lesen ----------

const liesText = async (zugang: TicketZugang, pfad: string): Promise<string | null> => {
  try {
    return await zugang.lies(pfad)
  } catch {
    return null
  }
}

const listeOrdner = async (zugang: TicketZugang, pfad: string): Promise<FsEntry[]> => {
  try {
    return (await zugang.gibtEs(pfad)) ? await zugang.liste(pfad) : []
  } catch {
    return []
  }
}

const nachName = (a: FsEntry, b: FsEntry): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

// Die Ticket-Dateien einer Wurzel, Vorhaben für Vorhaben. `rest` ist, wie viele Dateien
// noch gelesen werden dürfen.
const liesDateien = async (
  zugang: TicketZugang,
  wurzel: string,
  rest: number,
): Promise<{ tickets: { ticket: Ticket; geaendert: number }[]; uebrig: number }> => {
  const scratch = `${wurzel}/.scratch`
  const vorhaben = [...(await listeOrdner(zugang, scratch))].filter(one => one.kind === 'dir').sort(nachName)
  const tickets: { ticket: Ticket; geaendert: number }[] = []
  let uebrig = 0

  for (const eines of vorhaben) {
    const issues = `${scratch}/${eines.name}/issues`
    const dateien = [...(await listeOrdner(zugang, issues))]
      .filter(one => one.kind === 'file' && istTicketName(one.name))
      .sort(nachName)

    for (const datei of dateien) {
      if (tickets.length >= rest) {
        uebrig += 1
        continue
      }

      const inhalt = await liesText(zugang, `${issues}/${datei.name}`)
      const ticket = inhalt === null ? null : ausMarkdown(eines.name, datei.name, inhalt, datei.mtimeMs)

      if (ticket !== null) {
        tickets.push({ ticket, geaendert: datei.mtimeMs })
      }
    }
  }

  return { tickets, uebrig }
}

// Tickets als Markdown: aus der Arbeitskopie der Session, sonst aus der Wurzel des Repos.
const liesMarkdown = async (zugang: TicketZugang): Promise<TicketLage> => {
  const hinweise: string[] = []

  for (const wurzel of await wurzeln(zugang)) {
    const { tickets, uebrig } = await liesDateien(zugang, wurzel, MAX_DATEIEN)

    if (tickets.length === 0) {
      continue
    }

    const offene = tickets.filter(one => !one.ticket.zu).map(one => one.ticket)
    // Von den geschlossenen zählen die, die zuletzt angefasst wurden.
    const geschlossene = tickets
      .filter(one => one.ticket.zu)
      .sort((a, b) => b.geaendert - a.geaendert)
      .map(one => one.ticket)

    if (uebrig > 0) {
      hinweise.push(`${uebrig} Ticket-Dateien unter .scratch ausgelassen: Mehr als ${MAX_DATEIEN} liest der Mod nicht.`)
    }

    if (offene.length > OFFENE) {
      hinweise.push(`${offene.length - OFFENE} offene Tickets ausgelassen: Mehr als ${OFFENE} liest der Mod nicht.`)
    }

    return {
      tracker: 'markdown',
      gelesen: true,
      liste: [...offene.slice(0, OFFENE), ...geschlossene.slice(0, GESCHLOSSENE)],
      istVollstaendig: uebrig === 0 && offene.length <= OFFENE,
      hinweise,
    }
  }

  return { tracker: 'markdown', gelesen: true, liste: [], istVollstaendig: true, hinweise }
}

type Werkzeug = {
  // die Aufrufe, je ohne Shell: erst die offenen Tickets, dann die zuletzt geschlossenen
  offen: readonly string[]
  zu: readonly string[]
  lies: (roh: string) => Ticket[] | null
}

// Was der Mod je Ticket-System aufruft. Beide Aufrufe lesen nur.
export const AUFRUFE: Record<'github' | 'gitlab', Werkzeug> = {
  github: {
    offen: ['gh', 'issue', 'list', '--state', 'open', '--limit', String(OFFENE), '--json', 'number,title,state,labels,assignees,milestone,updatedAt,body'],
    zu: ['gh', 'issue', 'list', '--state', 'closed', '--limit', String(GESCHLOSSENE), '--json', 'number,title,state,closedAt,labels'],
    lies: ausGithub,
  },
  gitlab: {
    offen: ['glab', 'api', `projects/:id/issues?state=opened&per_page=${OFFENE}`],
    zu: ['glab', 'api', `projects/:id/issues?state=closed&order_by=updated_at&per_page=${GESCHLOSSENE}`],
    lies: ausGitlab,
  },
}

// Ein Aufruf des Werkzeugs. Die Antwort sind die Tickets, oder in einem Satz, warum nicht.
const rufe = async (
  zugang: TicketZugang,
  argv: readonly string[],
  lies: Werkzeug['lies'],
): Promise<Ticket[] | string> => {
  const [werkzeug = ''] = argv
  let r: ProcessRunResult

  try {
    r = await zugang.laufe(argv)
  } catch {
    return `${werkzeug} ließ sich nicht starten oder hat nicht geantwortet.`
  }

  if (r.exitCode !== 0) {
    const grund = sauber(r.stderr.trim().split('\n')[0] ?? '', 120)

    return `${werkzeug} meldet einen Fehler${grund === '' ? '' : ` (${grund.replace(/[.:]$/, '')})`}.`
  }

  return (
    lies(r.stdout) ??
    (r.isStdoutTruncated
      ? `Die Antwort von ${werkzeug} ist zu lang und abgeschnitten.`
      : `Die Antwort von ${werkzeug} ist keine Liste von Tickets.`)
  )
}

const liesWerkzeug = async (zugang: TicketZugang, tracker: 'github' | 'gitlab'): Promise<TicketLage> => {
  const { offen, zu, lies } = AUFRUFE[tracker]
  const name = TRACKER_NAME[tracker]
  const offene = await rufe(zugang, offen, lies)

  // Ohne die offenen Tickets lohnt der zweite Aufruf nicht.
  if (typeof offene === 'string') {
    return { tracker, gelesen: false, liste: [], istVollstaendig: false, hinweise: [`Keine Tickets aus ${name}: ${offene}`] }
  }

  const geschlossene = await rufe(zugang, zu, lies)
  const hinweise: string[] = []

  if (typeof geschlossene === 'string') {
    hinweise.push(`Die zuletzt geschlossenen Tickets aus ${name} fehlen: ${geschlossene}`)
  }

  if (offene.length >= OFFENE) {
    hinweise.push(`${name} nennt ${OFFENE} offene Tickets oder mehr: Gelesen sind die ersten ${OFFENE}.`)
  }

  // Was zwischen den zwei Aufrufen geschlossen wurde, steht in beiden Listen: Es ist zu.
  const zuListe = (typeof geschlossene === 'string' ? [] : geschlossene).filter(one => one.zu)
  const istZu = new Set(zuListe.map(one => one.schluessel))

  return {
    tracker,
    gelesen: true,
    liste: [...offene.filter(one => !one.zu && !istZu.has(one.schluessel)), ...zuListe],
    istVollstaendig: offene.length < OFFENE,
    hinweise,
  }
}

// Liest die Tickets des Repos: die offenen und die zuletzt geschlossenen. Ein Repo ohne
// Ticket-System hat keine, und dafür wird nichts aufgerufen. Was nicht geht, ist ein Hinweis.
export const liesTickets = async (zugang: TicketZugang): Promise<TicketLage> => {
  let tracker: ZielGraphTracker = 'keine'

  try {
    tracker = await leseTracker(zugang)

    if (tracker === 'keine') {
      return KEINE_TICKETS
    }

    return tracker === 'markdown' ? await liesMarkdown(zugang) : await liesWerkzeug(zugang, tracker)
  } catch (fehler) {
    return {
      tracker,
      gelesen: false,
      liste: [],
      istVollstaendig: false,
      hinweise: [`Keine Tickets aus ${TRACKER_NAME[tracker]}: ${sauber(String(fehler), 120)}`],
    }
  }
}
