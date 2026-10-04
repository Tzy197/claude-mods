import type {
  OrchestratorBuendel,
  OrchestratorChat,
  OrchestratorChats,
  OrchestratorPlan,
  OrchestratorStrang,
  OrchestratorZone,
} from '../types'

import { ZONEN_FOLGE, ZONEN_NAME } from './ableiten'
import { ENDZIEL } from './daten'
import type { StrangFrage } from './goal'
import { mehrzahl } from './worte'

// Aus Plan und laufenden Chats werden Karten: was die Fläche zeigt, was die Detail-Fläche
// zu einer Karte sagt und welchen Auftrag ein Knopf ins Eingabefeld legt. Kein `$`, kein Bild.

export type KartenZeichen =
  | 'erledigt'
  | 'bereit'
  | 'laeuft'
  | 'teilweise'
  | 'blockiert'
  | 'zwischenziel'
  | 'erreicht'
  | 'schritt'
  | 'endziel'

export type Karte = {
  // der Schlüssel der Karte: an ihm hängen die Auswahl und der Knopf
  id: string
  art: 'buendel' | 'fertig' | 'stamm' | 'endziel'
  // id des Strangs; '' auf dem Stamm
  strang: string
  zone: OrchestratorZone | 'stamm'
  zeichen: KartenZeichen
  titel: string
  meta: string
  // ein Chat arbeitet an dieser Karte; 'wartet': er wartet auf den Nutzer
  chat: '' | 'laeuft' | 'wartet'
  // true: gedämpft gezeichnet
  leise: boolean
  gewaehlt: boolean
}

export type Spalte = {
  strang: OrchestratorStrang
  // true: Für den Strang ist kein Ziel festgelegt
  ohneZiel: boolean
  // die Zeilen unter dem Namen, höchstens zwei
  kopf: string[]
  // wohin die Spalte unten führt: „→ Großer Umbau“
  wohin: string
  karten: Record<OrchestratorZone, Karte[]>
}

export type Sicht = {
  spalten: Spalte[]
  // Zwischenziele oder Treffpunkt, die Schritte danach und zuletzt das Endziel
  stamm: Karte[]
  // laufende Chats, die an keiner Karte hängen
  ohneKarte: OrchestratorChat[]
  // der Schlüssel der gewählten Karte; '' wenn keine gewählt ist
  gewaehlt: string
  zaehler: string
}

// Zwei Bindestriche kommen in keiner Kennung vor: So stößt kein Schlüssel an ein Bündel.
export const fertigId = (strang: string): string => `fertig--${strang}`
export const chatId = (sitzung: string): string => `chat--${sitzung}`

const ZEICHEN_TEXT: Record<KartenZeichen, string> = {
  erledigt: '✓',
  bereit: '○',
  laeuft: '◉',
  teilweise: '◐',
  blockiert: '·',
  zwischenziel: '◆',
  erreicht: '✓',
  schritt: '○',
  endziel: '◎',
}

const STAND_WORT: Record<OrchestratorBuendel['stand'], string> = {
  erledigt: 'erledigt',
  bereit: 'bereit',
  teilweise: 'zum Teil möglich',
  blockiert: 'wartet',
}

export const zeichenText = (karte: Karte): string => ZEICHEN_TEXT[karte.zeichen]

export const chatMarke = (karte: Karte): string =>
  karte.chat === '' ? '' : karte.chat === 'wartet' ? 'Chat wartet auf dich' : 'Chat läuft'

// Die Chats eines Bündels, die gerade laufen: Zugeordnet hat sie das Modell, ob sie noch
// da sind und ob sie warten, sagen die Dateien von ziel-graph.
const laufende = (eines: OrchestratorBuendel, chats: OrchestratorChats): OrchestratorChat[] =>
  chats.chats.filter(one => eines.chats.includes(one.id))

// Der Titel dessen, worauf ein Bündel wartet; '' ohne.
const zielTitel = (plan: OrchestratorPlan, id: string): string =>
  id === ''
    ? ''
    : (plan.buendel.find(one => one.id === id)?.titel ?? plan.stamm.find(one => one.id === id)?.titel ?? '')

// Die zweite Zeile einer Karte: worauf sie wartet, sonst ihr Fortschritt.
const metaVon = (plan: OrchestratorPlan, eines: OrchestratorBuendel): string => {
  const ziel = zielTitel(plan, eines.wartetAuf)
  const grund =
    ziel === '' || (eines.stand === 'teilweise' && eines.meta !== '') ? eines.meta : `wartet auf: ${ziel}`

  return eines.vermutet && !/vermutet/i.test(grund)
    ? grund === ''
      ? 'vermutet'
      : `vermutet · ${grund}`
    : grund
}

// Was im Kopf einer Spalte unter dem Namen steht.
const kopfVon = (plan: OrchestratorPlan, strang: OrchestratorStrang): string[] => {
  const fremd = plan.mitGoal && !strang.inGoal ? 'nicht in GOAL.md' : ''

  if (strang.ziel !== '') {
    return [strang.ziel]
  }

  return [
    'kein Ziel festgelegt',
    [fremd, strang.vermutung === '' ? '' : `vermutet: ${strang.vermutung}`].filter(one => one !== '').join(' · '),
  ].filter(one => one !== '')
}

// Wohin ein Strang führt: zu seinem Zwischenziel aus GOAL.md, sonst zum Treffpunkt, sonst
// zum Endziel. Ein Dauerläufer ohne Zwischenziel läuft weiter.
const wohinVon = (plan: OrchestratorPlan, strang: OrchestratorStrang): string => {
  const zwischenziel = plan.stamm.find(one => one.id === strang.gehoertZu)
  const treffpunkt = plan.stamm.find(one => one.art === 'treffpunkt')

  return zwischenziel === undefined && strang.art === 'dauer'
    ? 'Dauerläufer: läuft weiter'
    : `→ ${(zwischenziel ?? treffpunkt)?.titel ?? 'Endziel'}`
}

// Macht aus dem Plan und den laufenden Chats, was die Fläche zeigt. `wahl` ist die Karte,
// die der Nutzer gewählt hat; ohne Wahl gilt die erste, an der ein Chat auf ihn wartet.
export const sicht = (plan: OrchestratorPlan, chats: OrchestratorChats, wahl: string): Sicht => {
  const alle: Karte[] = []
  const spalten = plan.straenge.map((strang): Spalte => {
    const eigene = plan.buendel.filter(one => one.strang === strang.id)
    const fertig = eigene.filter(one => one.zone === 'hinter')
    const karten: Record<OrchestratorZone, Karte[]> = { hinter: [], jetzt: [], spaeter: [] }

    if (fertig.length > 0) {
      karten.hinter.push({
        id: fertigId(strang.id),
        art: 'fertig',
        strang: strang.id,
        zone: 'hinter',
        zeichen: 'erledigt',
        titel: `${fertig.length} erledigt`,
        meta: fertig.map(one => one.titel).join(' · '),
        chat: '',
        leise: true,
        gewaehlt: false,
      })
    }

    for (const eines of eigene.filter(one => one.zone !== 'hinter')) {
      const offene = laufende(eines, chats)
      const chat = offene.some(one => one.frage !== '') ? 'wartet' : offene.length > 0 ? 'laeuft' : ''

      karten[eines.zone].push({
        id: eines.id,
        art: 'buendel',
        strang: strang.id,
        zone: eines.zone,
        zeichen: chat === '' ? eines.stand : 'laeuft',
        titel: eines.titel,
        meta: metaVon(plan, eines),
        chat,
        leise: eines.zone === 'spaeter',
        gewaehlt: false,
      })
    }

    alle.push(...ZONEN_FOLGE.flatMap(zone => karten[zone]))

    return {
      strang,
      ohneZiel: strang.ziel === '',
      kopf: kopfVon(plan, strang),
      wohin: wohinVon(plan, strang),
      karten,
    }
  })

  const stamm: Karte[] = plan.stamm.map(schritt => {
    const dabei = plan.straenge.filter(one => one.gehoertZu === schritt.id).map(one => one.name)
    const marke = schritt.vermutet ? 'vermutet' : plan.mitGoal && !schritt.inGoal ? 'nicht in GOAL.md' : ''
    const meta = [
      schritt.erreicht ? 'erreicht' : '',
      /vermutet/i.test(schritt.meta) ? '' : marke,
      schritt.meta,
      schritt.meta === '' && dabei.length > 0 ? `Stränge: ${dabei.join(', ')}` : '',
    ]
      .filter(one => one !== '')
      .join(' · ')

    return {
      id: schritt.id,
      art: 'stamm',
      strang: '',
      zone: 'stamm',
      zeichen: schritt.erreicht ? 'erreicht' : schritt.art === 'schritt' ? 'schritt' : 'zwischenziel',
      titel: schritt.titel,
      meta,
      chat: '',
      leise: schritt.erreicht,
      gewaehlt: false,
    }
  })

  stamm.push({
    id: ENDZIEL,
    art: 'endziel',
    strang: '',
    zone: 'stamm',
    zeichen: 'endziel',
    titel: endzielZeile(plan),
    meta:
      plan.endziel.herkunft === 'goal'
        ? 'aus GOAL.md'
        : plan.endziel.herkunft === 'vermutet'
          ? 'vermutet · in GOAL.md nicht festgelegt'
          : 'in GOAL.md nicht festgelegt',
    chat: '',
    leise: false,
    gewaehlt: false,
  })
  alle.push(...stamm)

  // Ein Chat ohne Karte: nach dem Ableiten dazugekommen oder vom Modell keinem Bündel zugeordnet.
  const mitKarte = new Set(plan.buendel.flatMap(one => one.chats))
  const ohneKarte = chats.chats.filter(one => !mitKarte.has(one.id))
  // Ohne Wahl gilt der erste andere Chat, der auf den Nutzer wartet: zuerst der mit Karte.
  const wartender = [
    ...chats.chats.filter(one => mitKarte.has(one.id)),
    ...ohneKarte,
  ].find(one => one.frage !== '' && one.id !== chats.ich)
  const ersatz =
    wartender === undefined
      ? ''
      : (plan.buendel.find(one => one.chats.includes(wartender.id))?.id ?? chatId(wartender.id))
  const gibtEs = alle.some(one => one.id === wahl) || ohneKarte.some(one => chatId(one.id) === wahl)
  const gewaehlt = gibtEs ? wahl : ersatz

  for (const karte of alle) {
    karte.gewaehlt = karte.id === gewaehlt
  }

  const jetzt = plan.buendel.filter(one => one.zone === 'jetzt').length
  const warten = chats.chats.filter(one => one.frage !== '').length

  return {
    spalten,
    stamm,
    ohneKarte,
    gewaehlt,
    zaehler: [
      `${mehrzahl(jetzt, 'Bündel', 'Bündel')} jetzt möglich`,
      mehrzahl(chats.chats.length, 'Chat', 'Chats'),
      warten === 0 ? 'keiner wartet auf dich' : warten === 1 ? '1 wartet auf dich' : `${warten} warten auf dich`,
    ].join(' · '),
  }
}

// Das Endziel als eine Zeile, so wie es über der Fläche und auf seiner Karte steht.
export const endzielZeile = (plan: OrchestratorPlan): string =>
  plan.endziel.herkunft === 'goal'
    ? `Endziel: ${plan.endziel.text}`
    : plan.endziel.herkunft === 'vermutet'
      ? `Endziel (vermutet): ${plan.endziel.text}`
      : 'Endziel: nicht festgelegt'

// ---------- Die Detail-Fläche ----------

export type DetailZeile = {
  // 'punkt': ein Punkt des Bündels. 'leise': Nebensache. 'stark': worauf es ankommt.
  art: 'text' | 'punkt' | 'leise' | 'stark'
  text: string
}

export type DetailChat = OrchestratorChat & {
  // true: Das ist der Chat, in dem die Fläche gerade offen ist
  istDieser: boolean
}

export type Detail = {
  id: string
  // wo die Karte steht: „Jetzt möglich · Strang Kasse“
  kopf: string
  titel: string
  zeilen: DetailZeile[]
  chats: DetailChat[]
  // welche Knöpfe die Karte hat
  knoepfe: readonly ('auftrag' | 'erklaeren' | 'endziel')[]
}

const quellenZeile = (quelle: string): string =>
  quelle === 'chats'
    ? 'Quelle: laufende Chats'
    : quelle === 'commits'
      ? 'Quelle: Git-Verlauf'
      : quelle === ''
        ? 'Quelle: nicht genannt'
        : `Quelle: ${quelle}`

const zielZeile = (strang: OrchestratorStrang | undefined): string =>
  strang === undefined || strang.ziel === ''
    ? 'Ziel des Strangs: kein Ziel festgelegt'
    : `Ziel des Strangs: ${strang.ziel}`

const mitDiesem = (chats: readonly OrchestratorChat[], ich: string): DetailChat[] =>
  chats.map(one => ({ ...one, istDieser: one.id === ich }))

// Was die Detail-Fläche zur gewählten Karte zeigt; null, wenn keine gewählt ist.
export const detail = (plan: OrchestratorPlan, chats: OrchestratorChats, wahl: string): Detail | null => {
  const eines = plan.buendel.find(one => one.id === wahl)
  const strang = plan.straenge.find(one => one.id === eines?.strang || fertigId(one.id) === wahl)
  const schritt = plan.stamm.find(one => one.id === wahl)
  const chat = chats.chats.find(one => chatId(one.id) === wahl)

  if (eines !== undefined) {
    const ziel = zielTitel(plan, eines.wartetAuf)

    return {
      id: eines.id,
      kopf: `${ZONEN_NAME[eines.zone]} · Strang ${strang?.name ?? eines.strang}`,
      titel: eines.titel,
      zeilen: [
        { art: 'leise' as const, text: [STAND_WORT[eines.stand], eines.meta].filter(one => one !== '').join(' · ') },
        { art: 'leise' as const, text: zielZeile(strang) },
        ...eines.punkte.map(one => ({ art: 'punkt' as const, text: one })),
        { art: 'leise' as const, text: quellenZeile(eines.quelle) },
        { art: 'text' as const, text: ziel === '' ? '' : `Wartet auf: ${ziel}` },
        {
          art: 'leise' as const,
          text: eines.vermutet ? 'Vermutet: Das Modell hat dieses Bündel oder seinen Stand nur geschlossen.' : '',
        },
      ].filter(one => one.text !== ''),
      chats: mitDiesem(laufende(eines, chats), chats.ich),
      knoepfe: eines.zone === 'jetzt' ? ['auftrag', 'erklaeren'] : [],
    }
  }

  if (strang !== undefined) {
    const fertig = plan.buendel.filter(one => one.strang === strang.id && one.zone === 'hinter')

    return {
      id: wahl,
      kopf: `${ZONEN_NAME.hinter} · Strang ${strang.name}`,
      titel: `${fertig.length} erledigt`,
      zeilen: [
        { art: 'leise', text: zielZeile(strang) },
        ...fertig.map(one => ({
          art: 'punkt' as const,
          text: one.meta === '' ? one.titel : `${one.titel} (${one.meta})`,
        })),
      ],
      chats: [],
      knoepfe: [],
    }
  }

  if (schritt !== undefined) {
    const dabei = plan.straenge.filter(one => one.gehoertZu === schritt.id).map(one => one.name)

    return {
      id: schritt.id,
      kopf: schritt.art === 'schritt' ? 'Schritt auf dem Stamm' : schritt.art === 'treffpunkt' ? 'Treffpunkt' : 'Zwischenziel',
      titel: schritt.titel,
      zeilen: [
        { art: 'leise' as const, text: schritt.erreicht ? 'In GOAL.md als erreicht abgehakt.' : schritt.meta },
        { art: 'text' as const, text: dabei.length === 0 ? '' : `Dazu gehören die Stränge: ${dabei.join(', ')}` },
        { art: 'leise' as const, text: quellenZeile(schritt.quelle) },
        {
          art: 'leise' as const,
          text: schritt.inGoal
            ? ''
            : schritt.vermutet
              ? 'Vermutet: Das steht so nicht in GOAL.md.'
              : plan.mitGoal
                ? 'Steht nicht in GOAL.md.'
                : '',
        },
      ].filter(one => one.text !== ''),
      chats: [],
      knoepfe: [],
    }
  }

  if (wahl === ENDZIEL) {
    return {
      id: ENDZIEL,
      kopf: 'Endziel',
      titel: plan.endziel.text === '' ? 'Nicht festgelegt' : plan.endziel.text,
      zeilen: [
        {
          art: 'leise',
          text:
            plan.endziel.herkunft === 'goal'
              ? 'Wörtlich aus GOAL.md. Hier mündet alles.'
              : plan.endziel.herkunft === 'vermutet'
                ? 'Vermutet: In GOAL.md ist kein Endziel festgelegt. Das hier hat das Modell aus den anderen Quellen gelesen.'
                : 'In GOAL.md ist kein Endziel festgelegt.',
        },
      ],
      chats: [],
      knoepfe: plan.endziel.herkunft === 'goal' ? [] : ['endziel'],
    }
  }

  if (chat !== undefined) {
    return {
      id: wahl,
      kopf: 'Chat ohne Karte',
      titel: chat.name,
      zeilen: [{ art: 'leise', text: 'Dieser Chat hängt im Plan an keinem Bündel.' }],
      chats: mitDiesem([chat], chats.ich),
      knoepfe: [],
    }
  }

  return null
}

// ---------- Die Aufträge an den Chat ----------

// Was der Chat über ein Bündel wissen muss: Strang und dessen Ziel, Titel, Punkte, Quelle.
const steckbrief = (plan: OrchestratorPlan, eines: OrchestratorBuendel): string => {
  const strang = plan.straenge.find(one => one.id === eines.strang)
  const ziel = zielTitel(plan, eines.wartetAuf)

  return [
    `Strang: ${strang?.name ?? eines.strang}`,
    strang === undefined || strang.ziel === ''
      ? 'Ziel des Strangs: noch nicht festgelegt'
      : `Ziel des Strangs: ${strang.ziel}`,
    plan.endziel.herkunft === 'goal' ? `Endziel: ${plan.endziel.text}` : '',
    `Schritt: ${eines.titel}`,
    `Stand: ${[STAND_WORT[eines.stand], eines.meta].filter(one => one !== '').join(' · ')}`,
    eines.punkte.length === 0 ? '' : `Dazu gehört:\n${eines.punkte.map(one => `- ${one}`).join('\n')}`,
    ziel === '' ? '' : `Wartet zum Teil auf: ${ziel}`,
    eines.quelle === '' || eines.quelle === 'chats' || eines.quelle === 'commits'
      ? quellenZeile(eines.quelle)
      : `Quelle: ${eines.quelle} (dort steht, was gemeint ist)`,
  ]
    .filter(one => one !== '')
    .join('\n')
}

// Der Arbeitsauftrag zu einem Bündel; null, wenn es das Bündel nicht gibt.
export const auftragFuer = (plan: OrchestratorPlan, id: string): string | null => {
  const eines = plan.buendel.find(one => one.id === id)

  return eines === undefined
    ? null
    : [
        'Arbeite an diesem Schritt aus dem Plan des Repos.',
        steckbrief(plan, eines),
        'Lies zuerst die Quelle und was im Repo dazu schon steht. Sag mir dann in wenigen Sätzen, wie du vorgehst, und fang an. Bleib bei diesem einen Schritt. Wenn etwas unklar ist, frag mich, eine Frage auf einmal und mit einer Empfehlung.',
      ].join('\n\n')
}

// Die Bitte, ein Bündel zu erklären; null, wenn es das Bündel nicht gibt.
export const erklaerungFuer = (plan: OrchestratorPlan, id: string): string | null => {
  const eines = plan.buendel.find(one => one.id === id)

  return eines === undefined
    ? null
    : [
        'Erkläre mir diesen Schritt aus dem Plan des Repos, bevor jemand daran arbeitet: was er bedeutet, warum er jetzt dran ist und was danach anders ist.',
        steckbrief(plan, eines),
        'Zeig es mit einem kleinen Bild: ein echtes Beispiel, vorher und nachher. Kurz und in einfachen Worten. Ändere dabei nichts im Repo.',
      ].join('\n\n')
}

// Was der Auftrag „Ziel festlegen“ über einen Strang sagt; null, wenn es den Strang nicht gibt.
export const strangFrage = (plan: OrchestratorPlan, id: string): StrangFrage | null => {
  const strang = plan.straenge.find(one => one.id === id)

  return strang === undefined
    ? null
    : {
        name: strang.name,
        inGoal: strang.inGoal,
        mitGoal: plan.mitGoal,
        vermutung: strang.vermutung,
        buendel: plan.buendel.filter(one => one.strang === strang.id).map(one => one.titel),
      }
}
