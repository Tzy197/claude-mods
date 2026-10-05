import type { ModelCompleteResult } from 'claude-code'

import type {
  ZielGraphAenderungen,
  ZielGraphFakten,
  ZielGraphGeladen,
  ZielGraphPlan,
  ZielGraphTracker,
} from '../../types'

import { ordnerVon } from '../chats'
import type { ChatZugang } from '../chats'
import { istObjekt } from '../worte'

import { AUFTRAG, baueEingabe, normalisiere, quellenNamen } from './ableiten'
import type { Ableitung, UmfeldChat, Voriger } from './ableiten'
import { gleicheSaetze, legeFest, liesFestlegungen, nimmFestZurueck } from './festlegungen'
import type { FestAusgang } from './festlegungen'
import { frische, neueTickets } from './frisch'
import { KEINE_NAMEN, istLeer, leseGoal, leseTrackerNamen } from './goal'
import { liesGoal, sammle } from './quellen'
import type { QuellenZugang } from './quellen'
import { KEINE_TICKETS, TRACKER_NAME, leseGemerkte, liesTickets, merke } from './tickets'
import type { MerkTicket, TicketLage } from './tickets'
import { leseAenderungen, vergleiche } from './vergleich'

// Ein Lauf von Anfang bis Ende: Quellen, Tickets, Festlegungen und den vorigen Plan lesen,
// das Modell einmal fragen, die Antwort aufräumen, den Stand der Tickets darauf legen, mit
// dem vorigen Plan vergleichen und alles als JSON ablegen. Dazu das Laden des letzten Plans
// und das Aufnehmen einer Festlegung. Kein `$`: register.tsx reicht einen Zugang.

// Was das Laden braucht: lesen, und schreiben nur, um die lokale Kopie einer Festlegung
// fallen zu lassen, die inzwischen in GOAL.md steht.
export type LadeZugang = QuellenZugang & Pick<ChatZugang, 'schreibe'>

// `frage` ist hier der große Aufruf, der den Plan ableitet, nicht der kleine für den Stand
// eines Chats.
export type LaufZugang = LadeZugang & Pick<ChatZugang, 'frage'>

// Womit das Modell gefragt wird. Steht so in der Datei des Laufs.
export type Aufruf = { modell: string; maxTokens: number; timeoutMs: number }

export type LaufAusgang =
  // tickets: was der Lauf im Ticket-System gelesen hat
  | { ok: true; geladen: ZielGraphGeladen; tickets: TicketLage }
  // datei: wo der gescheiterte Lauf liegt; '' wenn er sich nicht schreiben ließ
  | { ok: false; grund: string; datei: string }

// Was plan.json hält: alles, woraus sich der Plan ohne Modell wieder aufbauen lässt.
export type Gespeichert = {
  version: number
  fakten: ZielGraphFakten
  // die Antwort des Modells, roh
  antwort: string
  // tickets: die Tickets, die der Lauf gelesen hat; leer in einer Datei der Versionen 1 und 2
  umfeld: { chats: UmfeldChat[]; quellen: string[]; tickets: MerkTicket[] }
  // der Text von GOAL.md beim Ableiten; null, wenn es keine gab
  goal: string | null
  // was beim Lesen der Quellen ausgelassen wurde
  hinweise: string[]
  // die Festlegungen, die das Modell bekommen hat; leer in einer Datei der Version 1
  festlegungen: string[]
  // was der Lauf am Plan davor geändert hat; null: Es gab keinen davor, oder die Datei ist
  // eine der Version 1
  aenderungen: ZielGraphAenderungen | null
}

// Version 2 kennt die Festlegungen und die Änderungen, Version 3 die Tickets. Dateien der
// Versionen 1 und 2 laden weiter.
const VERSION = 3
const VERSIONEN: readonly unknown[] = [1, 2, VERSION]
const PLAN = 'plan.json'
const TRACKER: readonly ZielGraphTracker[] = ['gitlab', 'github', 'markdown', 'keine']

// Wo Plan und Läufe dieses Repos liegen: in einem Unterordner des Ordners, in dem direkt
// die Chat-Stände liegen. So zählt keine Datei eines Laufs als Chat. Alle Worktrees teilen ihn.
export const planOrdnerVon = async (zugang: QuellenZugang): Promise<string> =>
  `${await ordnerVon(zugang)}/plan`

// Warum das Modell keinen Text geliefert hat, in einem Satz.
const grundAus = (r: ModelCompleteResult | null, fehler: string, aufruf: Aufruf): string => {
  if (r === null) {
    return `Der Modell-Aufruf wurde nicht angenommen: ${fehler}`
  }

  if (r.isAnswered) {
    return ''
  }

  if (r.reason === 'api-error') {
    return `Das Modell hat nicht geantwortet: API-Fehler ${r.status ?? 'ohne Status'} (${r.error}).`
  }

  return r.reason === 'aborted'
    ? `Der Modell-Aufruf wurde abgebrochen, spätestens nach ${Math.round(aufruf.timeoutMs / 1000)} s.`
    : 'Das Modell hat ohne Text geantwortet.'
}

// "2026-10-04T15-40-00-000Z": die Zeit als Teil eines Dateinamens.
const stempel = (zeit: number): string => new Date(zeit).toISOString().replace(/[:.]/g, '-')

const goalStand = (jetzt: string | null, beimAbleiten: string | null): ZielGraphGeladen['goal'] => ({
  vorhanden: jetzt !== null,
  leer: istLeer(leseGoal(jetzt)),
  geaendert: jetzt !== beimAbleiten,
})

// Der Plan vor einem Lauf: der gespeicherte, aufgeräumt gegen die GOAL.md von jetzt und mit
// dem Stand der Tickets von jetzt, also so, wie beide Ansichten ihn gerade zeigen. null: Es
// gibt keinen brauchbaren.
const liesVorigen = async (
  zugang: Pick<ChatZugang, 'lies'>,
  ordner: string,
  goal: string | null,
  tickets: TicketLage,
): Promise<Voriger | null> => {
  let roh: string | null = null

  try {
    roh = await zugang.lies(`${ordner}/${PLAN}`)
  } catch {
    // Noch nie abgeleitet.
  }

  const gespeichert = leseGespeichert(roh)
  const ableitung = gespeichert === null ? null : zeige(gespeichert, goal, tickets).ableitung

  return gespeichert !== null && ableitung?.ok === true
    ? { plan: ableitung.plan, zeit: gespeichert.fakten.zeit }
    : null
}

// Leitet den Plan einmal ab. Der Ausgang sagt, ob es einen Plan gibt; die Datei des Laufs
// entsteht in beiden Fällen, plan.json nur bei einem gelungenen Lauf. `gilt` sagt am Ende,
// ob dieser Lauf noch der jüngste ist: Einer, der als verloren galt und sich doch noch
// meldet, überschreibt den Plan des neueren nicht.
export const leiteAb = async (
  zugang: LaufZugang,
  aufruf: Aufruf,
  gilt: () => boolean = () => true,
): Promise<LaufAusgang> => {
  const beginn = await zugang.jetzt()
  const quellen = await sammle(zugang)
  const goal = leseGoal(quellen.goal)
  const ordner = await planOrdnerVon(zugang)
  // Was das Ticket-System gerade nennt: Der Lauf fragt es einmal, für die Eingabe, für den
  // vorigen Plan und für den Stand des neuen.
  const tickets = quellen.tickets?.lage ?? KEINE_TICKETS
  const namen = quellen.tickets?.namen ?? KEINE_NAMEN
  // Die Festlegungen aus GOAL.md und die lokalen, und der Plan, den der Nutzer gerade sieht.
  const festlegungen = await liesFestlegungen(zugang, ordner, goal.festlegungen)
  const voriger = await liesVorigen(zugang, ordner, quellen.goal, tickets)
  const eingabe = baueEingabe(quellen, goal, new Date(beginn).toISOString().slice(0, 10), {
    festlegungen: festlegungen.map(one => one.satz),
    voriger,
  })
  const vorModell = await zugang.jetzt()
  let antwort: ModelCompleteResult | null = null
  let fehler = ''

  try {
    antwort = await zugang.frage(AUFTRAG, eingabe)
  } catch (wurf) {
    // Nur ein Aufruf, den die Engine gar nicht erst sendet, wirft: ein gesperrtes Modell etwa.
    fehler = String(wurf)
  }

  const nachModell = await zugang.jetzt()
  const roh = antwort?.isAnswered === true ? antwort.text : null
  const umfeld = {
    chats: quellen.chats.map(one => ({ id: one.id, kennung: one.kennung, name: one.name })),
    quellen: quellenNamen(quellen),
    tickets: merke(tickets.liste),
  }
  const gelesen =
    roh === null
      ? { ok: false as const, grund: grundAus(antwort, fehler, aufruf), warnungen: [] }
      : normalisiere(roh, { ...umfeld, goal })
  // Eine Antwort, die an der Token-Grenze endet, ist abgeschnitten: Das erklärt kaputtes JSON.
  const istVoll = (antwort?.usage.output_tokens ?? 0) >= aufruf.maxTokens
  const ableitung =
    gelesen.ok || !istVoll
      ? gelesen
      : {
          ...gelesen,
          grund: `${gelesen.grund} Sie endet an der Grenze von ${aufruf.maxTokens} Tokens und ist wohl abgeschnitten.`,
        }
  // Was beide Ansichten zeigen: der Plan des Modells mit dem Stand der Tickets darauf.
  // Gespeichert wird, was das Modell gesagt hat.
  const gezeigt: ZielGraphPlan | null = ableitung.ok ? frische(ableitung.plan, tickets, namen) : null
  // Was sich gegenüber dem vorigen Plan geändert hat. Ob das Modell die Festlegungen
  // befolgt hat, prüft hier niemand nach: Das sieht der Nutzer am Plan.
  const aenderungen = gezeigt !== null && voriger !== null ? vergleiche(voriger.plan, gezeigt) : null
  const ende = await zugang.jetzt()
  const fakten = {
    zeit: beginn,
    dauerMs: ende - beginn,
    modellMs: nachModell - vorModell,
    dateien: quellen.doku.length,
    chats: quellen.chats.length,
    commits: quellen.commits.length,
    modell: aufruf.modell,
    tracker: tickets.tracker,
    tickets: tickets.liste.length,
  }
  const warnungen = [...ableitung.warnungen, ...quellen.hinweise]
  // Alles, womit sich der Lauf später beurteilen lässt.
  const protokoll = {
    zeit: new Date(beginn).toISOString(),
    dauerMs: fakten.dauerMs,
    modellMs: fakten.modellMs,
    modell: aufruf.modell,
    maxTokens: aufruf.maxTokens,
    timeoutMs: aufruf.timeoutMs,
    ergebnis: ableitung.ok ? 'abgeleitet' : 'gescheitert',
    grund: ableitung.ok ? '' : ableitung.grund,
    usage: antwort?.usage ?? null,
    quellen: {
      wurzel: quellen.wurzel,
      schluessel: quellen.schluessel,
      goal: quellen.goal === null ? null : { zeichen: quellen.goal.length },
      doku: quellen.doku.map(one => ({
        datei: one.datei,
        zeichen: one.zeichen,
        gesendet: one.text.length,
        gekuerzt: one.gekuerzt,
      })),
      chats: quellen.chats.map(one => ({
        kennung: one.kennung,
        id: one.id,
        name: one.name,
        zeichen: [one.name, one.branch, one.stand, one.naechster, one.frage].join('').length,
        wartet: one.frage !== '',
      })),
      commits: { anzahl: quellen.commits.length, zeichen: quellen.commits.join('\n').length },
      tickets: {
        tracker: tickets.tracker,
        gelesen: tickets.liste.length,
        offen: tickets.liste.filter(one => !one.zu).length,
        gesendet: quellen.tickets?.gesendet.length ?? 0,
        namen,
      },
      festlegungen,
      voriger:
        voriger === null
          ? null
          : {
              zeit: new Date(voriger.zeit).toISOString(),
              buendel: voriger.plan.buendel.length,
              stamm: voriger.plan.stamm.length,
            },
      hinweise: quellen.hinweise,
    },
    prompt: { systemZeichen: AUFTRAG.length, eingabeZeichen: eingabe.length },
    antwort: roh,
    warnungen,
    aenderungen,
    plan: ableitung.ok ? ableitung.plan : null,
  }
  let datei = `${ordner}/letzter.json`
  let planDatei = ableitung.ok ? `${ordner}/${PLAN}` : ''

  try {
    const json = JSON.stringify(protokoll, null, 2)

    await zugang.schreibe(datei, json)
    await zugang.schreibe(`${ordner}/lauf-${stempel(beginn)}.json`, json)
    // Die Eingabe steht daneben, nicht im JSON: Sie ist lang und für sich besser zu lesen.
    await zugang.schreibe(`${ordner}/letzte-eingabe.txt`, eingabe)
  } catch {
    datei = ''
  }

  if (!ableitung.ok || roh === null || gezeigt === null) {
    return { ok: false, grund: ableitung.ok ? '' : ableitung.grund, datei }
  }

  if (!gilt()) {
    return { ok: false, grund: 'Ein neuerer Lauf hat diesen überholt.', datei }
  }

  try {
    const gespeichert: Gespeichert & { plan: unknown; warnungen: string[] } = {
      version: VERSION,
      fakten: { ...fakten, datei: planDatei },
      antwort: roh,
      umfeld,
      goal: quellen.goal,
      hinweise: quellen.hinweise,
      festlegungen: festlegungen.map(one => one.satz),
      aenderungen,
      // Nur zum Nachlesen: Beim Laden entsteht der Plan neu aus Antwort und GOAL.md.
      warnungen,
      plan: ableitung.plan,
    }

    await zugang.schreibe(planDatei, JSON.stringify(gespeichert, null, 2))
  } catch {
    planDatei = ''
  }

  // Hat der Nutzer während des Laufs eine Festlegung eingegeben, kennt dieser Plan sie noch
  // nicht: Sie steht schon in der Liste, und die Fläche sagt, dass erst der nächste Lauf sie anwendet.
  const danach = await liesFestlegungen(zugang, ordner, goal.festlegungen)

  return {
    ok: true,
    tickets,
    geladen: {
      plan: gezeigt,
      warnungen: [
        ...warnungen,
        ...(planDatei === '' ? ['Der Plan ließ sich nicht speichern: Er gilt nur in dieser Session.'] : []),
      ],
      fakten: { ...fakten, datei: planDatei },
      goal: goalStand(quellen.goal, quellen.goal),
      festlegungen: {
        liste: danach,
        geaendert: !gleicheSaetze(
          danach.map(one => one.satz),
          festlegungen.map(one => one.satz),
        ),
      },
      aenderungen,
      neueTickets: 0,
      gelesen: ende,
    },
  }
}

const zahl = (wert: unknown): number => (typeof wert === 'number' ? wert : 0)

const wort = (wert: unknown): string => (typeof wert === 'string' ? wert : '')

// plan.json, so weit sie brauchbar ist; null bei einer fremden oder kaputten Datei.
export const leseGespeichert = (roh: string | null): Gespeichert | null => {
  try {
    const wert: unknown = JSON.parse(roh ?? '')

    if (!istObjekt(wert) || !VERSIONEN.includes(wert.version) || typeof wert.antwort !== 'string') {
      return null
    }

    const fakten = istObjekt(wert.fakten) ? wert.fakten : {}
    const umfeld = istObjekt(wert.umfeld) ? wert.umfeld : {}

    return {
      version: VERSION,
      fakten: {
        zeit: zahl(fakten.zeit),
        dauerMs: zahl(fakten.dauerMs),
        modellMs: zahl(fakten.modellMs),
        dateien: zahl(fakten.dateien),
        chats: zahl(fakten.chats),
        commits: zahl(fakten.commits),
        modell: wort(fakten.modell),
        datei: wort(fakten.datei),
        tracker: TRACKER.find(one => one === fakten.tracker) ?? 'keine',
        tickets: zahl(fakten.tickets),
      },
      antwort: wert.antwort,
      umfeld: {
        chats: (Array.isArray(umfeld.chats) ? umfeld.chats : [])
          .filter(istObjekt)
          .map(one => ({ id: wort(one.id), kennung: wort(one.kennung), name: wort(one.name) }))
          .filter(one => one.id !== ''),
        quellen: (Array.isArray(umfeld.quellen) ? umfeld.quellen : []).filter(
          (one): one is string => typeof one === 'string',
        ),
        tickets: leseGemerkte(umfeld.tickets),
      },
      goal: typeof wert.goal === 'string' ? wert.goal : null,
      hinweise: (Array.isArray(wert.hinweise) ? wert.hinweise : []).filter(
        (one): one is string => typeof one === 'string',
      ),
      festlegungen: (Array.isArray(wert.festlegungen) ? wert.festlegungen : []).filter(
        (one): one is string => typeof one === 'string',
      ),
      aenderungen: leseAenderungen(wert.aenderungen),
    }
  } catch {
    return null
  }
}

// Der Plan aus einer gespeicherten Antwort, aufgeräumt gegen den Text von GOAL.md, der
// jetzt gilt (null: Es gibt keine).
export const planAus = (gespeichert: Gespeichert, goal: string | null): Ableitung =>
  normalisiere(gespeichert.antwort, { ...gespeichert.umfeld, goal: leseGoal(goal) })

// Der Plan, so wie beide Ansichten ihn zeigen: die gespeicherte Antwort, aufgeräumt gegen
// die GOAL.md von jetzt, und darauf der Stand der Tickets. `tickets` ist, was das
// Ticket-System gerade nennt; mit null, oder wenn es sich nicht lesen ließ, gilt der Stand
// vom Ableiten, den die Plan-Datei sich gemerkt hat.
export type Gezeigt = {
  ableitung: Ableitung
  // offene Tickets, die es beim Ableiten noch nicht gab
  neueTickets: number
  // was beim Lesen der Tickets nicht ging
  hinweise: string[]
}

export const zeige = (gespeichert: Gespeichert, goal: string | null, tickets: TicketLage | null): Gezeigt => {
  const ableitung = planAus(gespeichert, goal)
  const gemerkt = gespeichert.umfeld.tickets
  const istGelesen = tickets !== null && tickets.gelesen
  const bekannt = new Set(gemerkt.map(one => one.schluessel))
  // Ein anderes Ticket-System als beim Ableiten: Seine Nummern meinen andere Tickets.
  const istAnderes = istGelesen && gemerkt.length > 0 && tickets.tracker !== gespeichert.fakten.tracker
  // Es nennt keines der Tickets von damals mehr: ein anderes Repo, oder der Ordner mit den
  // Dateien ist weg. Daraus zu schließen, alle seien geschlossen, wäre falsch.
  const istFremd = istGelesen && !istAnderes && gemerkt.length > 0 && !tickets.liste.some(one => bekannt.has(one.schluessel))
  const stand = istGelesen && !istAnderes && !istFremd ? tickets : { liste: gemerkt, istVollstaendig: false }

  return {
    ableitung: ableitung.ok
      ? { ...ableitung, plan: frische(ableitung.plan, stand, leseTrackerNamen(goal), gemerkt) }
      : ableitung,
    neueTickets: ableitung.ok && istGelesen ? neueTickets(tickets.liste, gemerkt) : 0,
    hinweise: [
      ...(tickets?.hinweise ?? []),
      ...(istAnderes
        ? [`Das Ticket-System ist jetzt ${TRACKER_NAME[tickets.tracker]}, beim Ableiten war es ein anderes: Die Bündel zeigen den Stand von damals.`]
        : []),
      ...(istFremd
        ? ['Das Ticket-System nennt keines der Tickets vom letzten Ableiten: Die Bündel zeigen den Stand von damals.']
        : []),
      ...(tickets !== null && !tickets.gelesen && gemerkt.length > 0
        ? ['Die Bündel zeigen den Stand der Tickets vom letzten Ableiten.']
        : []),
    ],
  }
}

// Was das Laden ergibt: der Zustand für beide Ansichten und, was dabei im Ticket-System
// gelesen wurde. null: Es wurde nicht gefragt.
export type Geladen = { geladen: ZielGraphGeladen; tickets: TicketLage | null }

// Lädt den letzten gespeicherten Plan dieses Repos. GOAL.md wird dabei frisch gelesen und
// geht vor: Ein Ziel, das seit dem Ableiten in GOAL.md steht, zeigen beide Ansichten sofort,
// ohne neuen Modell-Aufruf. Auch die Festlegungen kommen frisch: aus GOAL.md und aus der
// lokalen Datei. Und der Stand der Tickets: Ohne Angabe fragt das Laden das Ticket-System;
// mit `tickets` gilt, was dort steht (null: der Stand vom Ableiten), und es wird nicht
// gefragt. Ohne gespeicherten Plan sagt das Ergebnis nur, wie GOAL.md dasteht und welche
// Festlegungen gelten: Dann wird auch kein Ticket gelesen.
export const ladeMitTickets = async (zugang: LadeZugang, tickets?: TicketLage | null): Promise<Geladen> => {
  const gelesen = await zugang.jetzt()
  const jetzt = await liesGoal(zugang)
  const ordner = await planOrdnerVon(zugang)
  const liste = await liesFestlegungen(zugang, ordner, leseGoal(jetzt).festlegungen)
  const datei = `${ordner}/${PLAN}`
  let roh: string | null = null

  try {
    roh = await zugang.lies(datei)
  } catch {
    // Noch nie abgeleitet.
  }

  const gespeichert = leseGespeichert(roh)

  if (gespeichert === null) {
    return {
      geladen: {
        plan: null,
        warnungen: roh === null ? [] : ['Der gespeicherte Plan ist nicht lesbar: „Neu ableiten“ schreibt ihn neu.'],
        fakten: null,
        goal: goalStand(jetzt, jetzt),
        festlegungen: { liste, geaendert: false },
        aenderungen: null,
        neueTickets: 0,
        gelesen,
      },
      tickets: null,
    }
  }

  const lage = tickets === undefined ? await liesTickets(zugang) : tickets
  const { ableitung, neueTickets: neue, hinweise } = zeige(gespeichert, jetzt, lage)
  const bekannt = [...ableitung.warnungen, ...gespeichert.hinweise]

  return {
    geladen: {
      plan: ableitung.ok ? ableitung.plan : null,
      warnungen: ableitung.ok
        ? // Was schon beim Ableiten nicht ging, steht nur einmal da.
          [...bekannt, ...hinweise.filter(one => !bekannt.includes(one))]
        : [`Der gespeicherte Plan ist nicht lesbar: ${ableitung.grund}`, ...ableitung.warnungen],
      // Wo der Plan liegt, sagt der Ort, von dem er gelesen wurde, nicht die Datei selbst.
      fakten: { ...gespeichert.fakten, datei },
      goal: goalStand(jetzt, gespeichert.goal),
      festlegungen: {
        liste,
        geaendert: !gleicheSaetze(
          liste.map(one => one.satz),
          gespeichert.festlegungen,
        ),
      },
      aenderungen: ableitung.ok ? gespeichert.aenderungen : null,
      neueTickets: neue,
      gelesen,
    },
    tickets: lage,
  }
}

// Dasselbe, wenn nur der Zustand gefragt ist: Das Ticket-System wird dabei gefragt.
export const ladePlan = async (zugang: LadeZugang): Promise<ZielGraphGeladen> =>
  (await ladeMitTickets(zugang)).geladen

// ---------- Festlegungen aufnehmen und zurücknehmen ----------

// Nimmt einen Satz des Nutzers als Festlegung auf. Er gilt ab dem nächsten Ableiten und
// liegt erst lokal, im Ordner des Plans: GOAL.md schreibt der Mod nie.
export const legeFestlegung = async (zugang: LadeZugang, satz: string): Promise<FestAusgang> =>
  legeFest(
    zugang,
    await planOrdnerVon(zugang),
    leseGoal(await liesGoal(zugang)).festlegungen,
    satz,
    await zugang.jetzt(),
  )

// Nimmt eine Festlegung zurück, die erst lokal liegt.
export const entferneFestlegung = async (zugang: LadeZugang, satz: string): Promise<void> =>
  nimmFestZurueck(zugang, await planOrdnerVon(zugang), leseGoal(await liesGoal(zugang)).festlegungen, satz)
