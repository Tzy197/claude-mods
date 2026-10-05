import type { ModelCompleteResult } from 'claude-code'

import type { ZielGraphFakten, ZielGraphGeladen } from '../../types'

import { ordnerVon } from '../chats'
import type { ChatZugang } from '../chats'

import { AUFTRAG, baueEingabe, normalisiere, quellenNamen } from './ableiten'
import type { Ableitung, UmfeldChat } from './ableiten'
import { istLeer, leseGoal } from './goal'
import { liesGoal, sammle } from './quellen'
import type { QuellenZugang } from './quellen'

// Ein Lauf von Anfang bis Ende: Quellen lesen, das Modell einmal fragen, die Antwort
// aufräumen und alles als JSON ablegen. Dazu das Laden des letzten Plans. Kein `$`:
// register.tsx reicht einen Zugang.

// `frage` ist hier der große Aufruf, der den Plan ableitet, nicht der kleine für den Stand
// eines Chats.
export type LaufZugang = QuellenZugang & Pick<ChatZugang, 'schreibe' | 'frage'>

// Womit das Modell gefragt wird. Steht so in der Datei des Laufs.
export type Aufruf = { modell: string; maxTokens: number; timeoutMs: number }

export type LaufAusgang =
  | { ok: true; geladen: ZielGraphGeladen }
  // datei: wo der gescheiterte Lauf liegt; '' wenn er sich nicht schreiben ließ
  | { ok: false; grund: string; datei: string }

// Was plan.json hält: alles, woraus sich der Plan ohne Modell wieder aufbauen lässt.
export type Gespeichert = {
  version: number
  fakten: ZielGraphFakten
  // die Antwort des Modells, roh
  antwort: string
  umfeld: { chats: UmfeldChat[]; quellen: string[] }
  // der Text von GOAL.md beim Ableiten; null, wenn es keine gab
  goal: string | null
  // was beim Lesen der Quellen ausgelassen wurde
  hinweise: string[]
}

const VERSION = 1
const PLAN = 'plan.json'

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
  const eingabe = baueEingabe(quellen, goal, new Date(beginn).toISOString().slice(0, 10))
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
  const ende = await zugang.jetzt()
  const ordner = await planOrdnerVon(zugang)
  const fakten = {
    zeit: beginn,
    dauerMs: ende - beginn,
    modellMs: nachModell - vorModell,
    dateien: quellen.doku.length,
    chats: quellen.chats.length,
    commits: quellen.commits.length,
    modell: aufruf.modell,
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
      hinweise: quellen.hinweise,
    },
    prompt: { systemZeichen: AUFTRAG.length, eingabeZeichen: eingabe.length },
    antwort: roh,
    warnungen,
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

  if (!ableitung.ok || roh === null) {
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
      // Nur zum Nachlesen: Beim Laden entsteht der Plan neu aus Antwort und GOAL.md.
      warnungen,
      plan: ableitung.plan,
    }

    await zugang.schreibe(planDatei, JSON.stringify(gespeichert, null, 2))
  } catch {
    planDatei = ''
  }

  return {
    ok: true,
    geladen: {
      plan: ableitung.plan,
      warnungen: [
        ...warnungen,
        ...(planDatei === '' ? ['Der Plan ließ sich nicht speichern: Er gilt nur in dieser Session.'] : []),
      ],
      fakten: { ...fakten, datei: planDatei },
      goal: goalStand(quellen.goal, quellen.goal),
      gelesen: ende,
    },
  }
}

const istObjekt = (wert: unknown): wert is Record<string, unknown> =>
  typeof wert === 'object' && wert !== null && !Array.isArray(wert)

const zahl = (wert: unknown): number => (typeof wert === 'number' ? wert : 0)

const wort = (wert: unknown): string => (typeof wert === 'string' ? wert : '')

// plan.json, so weit sie brauchbar ist; null bei einer fremden oder kaputten Datei.
export const leseGespeichert = (roh: string | null): Gespeichert | null => {
  try {
    const wert: unknown = JSON.parse(roh ?? '')

    if (!istObjekt(wert) || wert.version !== VERSION || typeof wert.antwort !== 'string') {
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
      },
      goal: typeof wert.goal === 'string' ? wert.goal : null,
      hinweise: (Array.isArray(wert.hinweise) ? wert.hinweise : []).filter(
        (one): one is string => typeof one === 'string',
      ),
    }
  } catch {
    return null
  }
}

// Der Plan aus einer gespeicherten Antwort, aufgeräumt gegen den Text von GOAL.md, der
// jetzt gilt (null: Es gibt keine).
export const planAus = (gespeichert: Gespeichert, goal: string | null): Ableitung =>
  normalisiere(gespeichert.antwort, { ...gespeichert.umfeld, goal: leseGoal(goal) })

// Lädt den letzten gespeicherten Plan dieses Repos. GOAL.md wird dabei frisch gelesen und
// geht vor: Ein Ziel, das seit dem Ableiten in GOAL.md steht, zeigen beide Ansichten sofort,
// ohne neuen Modell-Aufruf. Ohne gespeicherten Plan sagt das Ergebnis nur, wie GOAL.md dasteht.
export const ladePlan = async (zugang: QuellenZugang): Promise<ZielGraphGeladen> => {
  const gelesen = await zugang.jetzt()
  const jetzt = await liesGoal(zugang)
  const datei = `${await planOrdnerVon(zugang)}/${PLAN}`
  let roh: string | null = null

  try {
    roh = await zugang.lies(datei)
  } catch {
    // Noch nie abgeleitet.
  }

  const gespeichert = leseGespeichert(roh)

  if (gespeichert === null) {
    return {
      plan: null,
      warnungen: roh === null ? [] : ['Der gespeicherte Plan ist nicht lesbar: „Neu ableiten“ schreibt ihn neu.'],
      fakten: null,
      goal: goalStand(jetzt, jetzt),
      gelesen,
    }
  }

  const ableitung = planAus(gespeichert, jetzt)

  return {
    plan: ableitung.ok ? ableitung.plan : null,
    warnungen: ableitung.ok
      ? [...ableitung.warnungen, ...gespeichert.hinweise]
      : [`Der gespeicherte Plan ist nicht lesbar: ${ableitung.grund}`, ...ableitung.warnungen],
    // Wo der Plan liegt, sagt der Ort, von dem er gelesen wurde, nicht die Datei selbst.
    fakten: { ...gespeichert.fakten, datei },
    goal: goalStand(jetzt, gespeichert.goal),
    gelesen,
  }
}
