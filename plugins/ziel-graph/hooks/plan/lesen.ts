import type {
  ZielGraphAenderung,
  ZielGraphAenderungen,
  ZielGraphBuendel,
  ZielGraphChat,
  ZielGraphChats,
  ZielGraphFakten,
  ZielGraphFestlegung,
  ZielGraphLage,
  ZielGraphLauf,
  ZielGraphPlan,
  ZielGraphSchritt,
  ZielGraphStand,
  ZielGraphStrang,
} from '../../types'

import { alter } from '../chats'
import { kennung, mehrzahl, sekunden } from '../worte'

import { ZONEN_NAME } from './ableiten'
import { fortschritt } from './frisch'
import { promptDauerlaeufer, promptEndziel, promptFestlegungen, promptGoalAnlegen, promptStrangZiel } from './goal'
import type { StrangFrage } from './goal'
import { TRACKER_NAME, ticketName } from './tickets'

// Was beide Ansichten aus dem einen Plan lesen, in denselben Worten: das Endziel als Zeile,
// die Eckdaten des Laufs, die Chats und die Tickets an einem Bündel, welches Ziel alles
// erledigt hat, die Festlegungen, was der letzte Lauf geändert hat, und die Aufträge zu
// GOAL.md. Kein `$`.

// Das Endziel als eine Zeile, so wie es über dem Plan, im Graphen und auf seiner Karte steht.
export const endzielZeile = (plan: ZielGraphPlan): string =>
  plan.endziel.herkunft === 'goal'
    ? `Endziel: ${plan.endziel.text}`
    : plan.endziel.herkunft === 'vermutet'
      ? `Endziel (vermutet): ${plan.endziel.text}`
      : 'Endziel: nicht festgelegt'

// Die Eckdaten eines Laufs. Hat das Repo ein Ticket-System, nennt die Zeile es und die Zahl
// der Tickets, die der Lauf dort gelesen hat. Ein Plan von vor Version 0.5.0 kennt keines.
export const faktenZeile = (fakten: ZielGraphFakten, jetzt: number): string => {
  const tracker = fakten.tracker ?? 'keine'
  const quellen = [
    mehrzahl(fakten.dateien, 'Datei', 'Dateien'),
    mehrzahl(fakten.chats, 'Chat', 'Chats'),
    mehrzahl(fakten.commits, 'Commit', 'Commits'),
    ...(tracker === 'keine' ? [] : [`${mehrzahl(fakten.tickets ?? 0, 'Ticket', 'Tickets')} (${TRACKER_NAME[tracker]})`]),
  ]

  return (
    `Abgeleitet ${alter(jetzt, fakten.zeit)} in ${sekunden(fakten.dauerMs)} s aus ` +
    `${quellen.slice(0, -1).join(', ')} und ${quellen.at(-1) ?? ''} · ${fakten.modell}`
  )
}

// Wo der Lauf steht, als die eine Zeile, die beide Ansichten zuerst zeigen; '' wenn er ruht.
export const laufZeile = (lauf: ZielGraphLauf): string =>
  lauf.phase === 'laeuft'
    ? `Ableiten läuft …${lauf.sekunden === 0 ? '' : ` seit ${lauf.sekunden} s`}`
    : lauf.phase === 'fehler'
      ? `Ableiten fehlgeschlagen: ${lauf.grund}`
      : ''

// Der Titel dessen, worauf ein Bündel wartet; '' ohne.
export const zielTitel = (plan: ZielGraphPlan, id: string): string =>
  id === ''
    ? ''
    : (plan.buendel.find(one => one.id === id)?.titel ?? plan.stamm.find(one => one.id === id)?.titel ?? '')

// Die Chats eines Bündels, die gerade laufen: Zugeordnet hat sie das Modell beim Ableiten,
// ob sie noch da sind und ob sie warten, sagen die Dateien der Chats.
export const laufende = (eines: ZielGraphBuendel, chats: ZielGraphChats): ZielGraphChat[] =>
  chats.chats.filter(one => eines.chats.includes(one.id))

// ---------- Die Tickets eines Bündels ----------

// Die Tickets eines Bündels, je eines als Zeile mit Nummer, Titel und davor, ob es
// geschlossen ist: „✓ #14 Gutschein an der Kasse prüfen“, „○ #15 Restbetrag merken“,
// „· #16 Rechnung als PDF (blockiert)“.
export const ticketPunkte = (eines: Pick<ZielGraphBuendel, 'tickets'>): string[] =>
  (eines.tickets ?? []).map(one => {
    const zeichen = one.zu ? '✓' : one.grund === '' ? '○' : '·'
    const grund = one.zu || one.grund === '' ? '' : one.grund === 'blockiert' ? ' (blockiert)' : ' (wartet auf Auskunft)'

    return `${zeichen} ${ticketName(one.schluessel)} ${one.titel}${grund}`
  })

// Die Punkte eines Bündels, die kein Ticket wiederholen: Mit Tickets nennt das Modell sie
// dort mit Nummer und Titel, und die Liste der Tickets sagt dasselbe frischer.
export const punkteOhneTickets = (eines: Pick<ZielGraphBuendel, 'punkte' | 'tickets'>): string[] => {
  const namen = (eines.tickets ?? []).map(one => ticketName(one.schluessel).toLowerCase())

  return eines.punkte.filter(punkt => {
    const anfang = punkt.trim().toLowerCase()

    return !namen.some(name => anfang.startsWith(name) && !/^\d/.test(anfang.slice(name.length)))
  })
}

// Die zweite Zeile eines Bündels, das auf etwas wartet: Mit Tickets steht der Fortschritt davor.
export const mitFortschritt = (eines: Pick<ZielGraphBuendel, 'tickets'>, grund: string): string =>
  [fortschritt(eines), grund].filter(one => one !== '').join(' · ')

// Die Stränge, für die kein Ziel festgelegt ist.
export const ohneZiel = (plan: ZielGraphPlan): ZielGraphStrang[] => plan.straenge.filter(one => one.ziel === '')

// ---------- Ziele, die alles erledigt haben ----------

// Die Ziele, in denen jedes Bündel erledigt ist: Sie haben ihre Basis erreicht und können
// zum Dauerläufer werden. Ein Strang ohne Bündel hat noch nichts erledigt.
export const fertigeZiele = (plan: ZielGraphPlan): ZielGraphStrang[] =>
  plan.straenge.filter(strang => {
    const eigene = plan.buendel.filter(one => one.strang === strang.id)

    return strang.art === 'ziel' && eigene.length > 0 && eigene.every(one => one.stand === 'erledigt')
  })

// Die eine Zeile dazu, in beiden Ansichten dieselbe.
export const fertigZeile = (strang: Pick<ZielGraphStrang, 'name'>): string =>
  `${strang.name} hat alles erledigt. Zum Dauerläufer machen?`

// Der Stand eines Bündels in Worten.
export const STAND_WORT: Record<ZielGraphStand, string> = {
  erledigt: 'erledigt',
  bereit: 'bereit',
  teilweise: 'zum Teil möglich',
  blockiert: 'wartet',
}

// Was das Modell zu einem Schritt des Stamms sagt. Bei einem abgehakten Zwischenziel fällt
// eine Zeile weg, die selbst nur von „erreicht“ spricht: Dieses Wort setzen beide Ansichten
// schon davor, und es soll dort genau einmal stehen.
export const schrittMeta = (schritt: ZielGraphSchritt): string =>
  schritt.erreicht && /erreicht/i.test(schritt.meta) ? '' : schritt.meta

// ---------- Festlegungen ----------

// Wie viele Festlegungen es gibt und wie viele davon noch nicht in GOAL.md stehen.
export const festZeile = (liste: readonly ZielGraphFestlegung[]): string => {
  const lokal = liste.filter(one => one.ort === 'lokal').length

  if (liste.length === 0) {
    return 'Keine Festlegungen'
  }

  return (
    `${mehrzahl(liste.length, 'Festlegung', 'Festlegungen')}, ` +
    (lokal > 0 ? `${lokal} noch nicht in GOAL.md` : liste.length === 1 ? 'sie steht in GOAL.md' : 'alle in GOAL.md')
  )
}

// ---------- Was der letzte Lauf geändert hat ----------

// In einem Wort, was mit einem Bündel oder einem Schritt des Stamms geschehen ist. Wer in
// eine andere Zone, einen anderen Stand oder einen anderen Strang kam, ist verschoben, auch
// wenn er dabei anders heißt; 'umbenannt' ist, wer nur anders heißt.
export type AenderungsArt = 'neu' | 'erledigt' | 'erreicht' | 'verschoben' | 'umbenannt' | 'weg'

// Beim Strang zählt der Name, wie im Vergleich selbst.
const strangName = (lage: ZielGraphLage): string => kennung(lage.strang)

export const aenderungsArt = (eine: ZielGraphAenderung): AenderungsArt => {
  const { vorher, nachher } = eine

  if (vorher === null) {
    return 'neu'
  }

  if (nachher === null) {
    return 'weg'
  }

  if (vorher.stand !== nachher.stand && (nachher.stand === 'erledigt' || nachher.stand === 'erreicht')) {
    return nachher.stand
  }

  return vorher.zone !== nachher.zone || vorher.stand !== nachher.stand || strangName(vorher) !== strangName(nachher)
    ? 'verschoben'
    : 'umbenannt'
}

const ART_FOLGE: readonly AenderungsArt[] = ['neu', 'erledigt', 'erreicht', 'verschoben', 'umbenannt', 'weg']

const ART_WORT: Record<AenderungsArt, string> = {
  neu: 'neu',
  erledigt: 'erledigt',
  erreicht: 'erreicht',
  verschoben: 'verschoben',
  umbenannt: 'umbenannt',
  weg: 'weggefallen',
}

const ANFANG: Record<AenderungsArt, string> = {
  neu: 'Neu',
  erledigt: 'Erledigt',
  erreicht: 'Erreicht',
  verschoben: 'Verschoben',
  umbenannt: 'Umbenannt',
  weg: 'Weggefallen',
}

// Was der letzte Lauf geändert hat, in einer kurzen Zeile: „Seit dem letzten Ableiten:
// 2 neu, 1 erledigt, 1 verschoben“. '' wenn es keinen Plan davor gab.
export const aenderungsZeile = (aenderungen: ZielGraphAenderungen | null): string => {
  if (aenderungen === null) {
    return ''
  }

  const arten = aenderungen.eintraege.map(aenderungsArt)
  const teile = [
    ...ART_FOLGE.map(art => ({ art, anzahl: arten.filter(one => one === art).length }))
      .filter(one => one.anzahl > 0)
      .map(one => `${one.anzahl} ${ART_WORT[one.art]}`),
    ...(aenderungen.endziel === null ? [] : ['Endziel geändert']),
  ]

  return `Seit dem letzten Ableiten: ${teile.length === 0 ? 'nichts geändert' : teile.join(', ')}`
}

const zonenWort = (lage: ZielGraphLage): string => (lage.zone === 'stamm' ? 'Stamm' : ZONEN_NAME[lage.zone])

const standWort = (lage: ZielGraphLage): string =>
  lage.stand === 'erreicht' || lage.stand === 'offen' ? lage.stand : STAND_WORT[lage.stand]

// Wo ein Eintrag steht: „Kasse, Jetzt möglich“, auf dem Stamm „auf dem Stamm“.
const ort = (lage: ZielGraphLage): string =>
  lage.zone === 'stamm' ? 'auf dem Stamm' : `${lage.strang}, ${ZONEN_NAME[lage.zone]}`

const eintragZeile = (eine: ZielGraphAenderung): string => {
  const { vorher, nachher } = eine
  const kopf = ANFANG[aenderungsArt(eine)]

  if (vorher === null || nachher === null) {
    const lage = nachher ?? vorher

    return lage === null ? '' : `${kopf}: ${lage.titel} (${nachher === null ? 'zuletzt ' : ''}${ort(lage)})`
  }

  const istAndererStrang = strangName(vorher) !== strangName(nachher)
  const istAndereZone = vorher.zone !== nachher.zone
  const wo = nachher.zone === 'stamm' ? 'auf dem Stamm' : nachher.strang

  return [
    `${kopf}: ${nachher.titel}${istAndererStrang ? '' : ` (${wo})`}`,
    vorher.titel === nachher.titel ? '' : `hieß „${vorher.titel}“`,
    istAndererStrang ? `Strang ${vorher.strang} → ${nachher.strang}` : '',
    istAndereZone ? `${zonenWort(vorher)} → ${zonenWort(nachher)}` : '',
    // Der Stand folgt aus der Zone: Für sich steht er nur da, wo die Zone dieselbe blieb.
    istAndereZone || vorher.stand === nachher.stand ? '' : `${standWort(vorher)} → ${standWort(nachher)}`,
  ]
    .filter(one => one !== '')
    .join(' · ')
}

const endzielWort = (text: string): string => (text === '' ? 'nicht festgelegt' : `„${text}“`)

// Dasselbe als Liste, je Eintrag eine Zeile: zuerst das Endziel, dann die Einträge in der
// Reihenfolge des neuen Plans.
export const aenderungsListe = (aenderungen: ZielGraphAenderungen | null): string[] => {
  const endziel = aenderungen?.endziel ?? null

  return aenderungen === null
    ? []
    : [
        ...(endziel === null ? [] : [`Endziel geändert: ${endzielWort(endziel.vorher)} → ${endzielWort(endziel.nachher)}`]),
        ...aenderungen.eintraege.map(eintragZeile).filter(one => one !== ''),
      ]
}

// Die kleine Marke in der zweiten Zeile einer Karte oder Zeile, die der letzte Lauf neu
// gebracht, verschoben oder umbenannt hat; '' sonst. Was erledigt ist, fassen beide
// Ansichten ohnehin zusammen.
export const aenderungsMarke = (
  aenderungen: ZielGraphAenderungen | null,
  was: ZielGraphAenderung['was'],
  id: string,
): string => {
  const eine = aenderungen?.eintraege.find(one => one.was === was && one.id === id && one.nachher !== null)
  const art = eine === undefined ? null : aenderungsArt(eine)

  return art === 'neu' || art === 'verschoben' || art === 'umbenannt' ? art : ''
}

// Setzt die Marke vor die zweite Zeile.
export const mitMarke = (meta: string, marke: string): string =>
  marke === '' ? meta : meta === '' ? marke : `${marke} · ${meta}`

// ---------- Die Aufträge zu GOAL.md ----------

// Ein Text fürs Eingabefeld des Chats und wie der Hinweis ihn nennt. null: Es gibt nichts
// zu legen.
export type Auftrag = { text: string | null; was: string }

export const goalAuftrag = (): Auftrag => ({ text: promptGoalAnlegen(), was: 'Der Auftrag für GOAL.md' })

export const endzielAuftrag = (plan: ZielGraphPlan): Auftrag => ({
  text: promptEndziel(plan.mitGoal, plan.endziel.herkunft === 'vermutet' ? plan.endziel.text : ''),
  was: 'Der Auftrag „Endziel festlegen“',
})

// Was der Auftrag „Ziel festlegen“ über einen Strang sagt; null, wenn es den Strang nicht gibt.
export const strangFrage = (plan: ZielGraphPlan, id: string): StrangFrage | null => {
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

export const strangAuftrag = (plan: ZielGraphPlan, id: string): Auftrag => {
  const frage = strangFrage(plan, id)

  return { text: frage === null ? null : promptStrangZiel(frage), was: 'Der Auftrag „Ziel festlegen“' }
}

// Der Auftrag, einen Strang, der alles erledigt hat, in GOAL.md zum Dauerläufer zu machen.
// Schreiben tut der Chat, wenn der Nutzer zustimmt: Der Mod schreibt GOAL.md nie.
export const dauerAuftrag = (plan: ZielGraphPlan, id: string): Auftrag => {
  const strang = plan.straenge.find(one => one.id === id)

  return {
    text:
      strang === undefined
        ? null
        : promptDauerlaeufer({
            name: strang.name,
            inGoal: strang.inGoal,
            erledigt: plan.buendel.filter(one => one.strang === strang.id && one.stand === 'erledigt').map(one => one.titel),
          }),
    was: 'Der Auftrag „Zum Dauerläufer machen“',
  }
}

// Der Auftrag, die Festlegungen in GOAL.md einzutragen, die erst lokal liegen.
export const festAuftrag = (liste: readonly ZielGraphFestlegung[], mitGoal: boolean): Auftrag => {
  const lokale = liste.filter(one => one.ort === 'lokal').map(one => one.satz)

  return {
    text: lokale.length === 0 ? null : promptFestlegungen(lokale, mitGoal),
    was: 'Der Auftrag „Festlegungen eintragen“',
  }
}
