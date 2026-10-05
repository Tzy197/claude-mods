import type {
  ZielGraphBuendel,
  ZielGraphChat,
  ZielGraphChats,
  ZielGraphFakten,
  ZielGraphLauf,
  ZielGraphPlan,
  ZielGraphStrang,
} from '../../types'

import { alter } from '../chats'
import { mehrzahl, sekunden } from '../worte'

import { promptEndziel, promptGoalAnlegen, promptStrangZiel } from './goal'
import type { StrangFrage } from './goal'

// Was beide Ansichten aus dem einen Plan lesen, in denselben Worten: das Endziel als Zeile,
// die Eckdaten des Laufs, die Chats an einem Bündel und die Aufträge zu GOAL.md. Kein `$`.

// Das Endziel als eine Zeile, so wie es über dem Plan, im Graphen und auf seiner Karte steht.
export const endzielZeile = (plan: ZielGraphPlan): string =>
  plan.endziel.herkunft === 'goal'
    ? `Endziel: ${plan.endziel.text}`
    : plan.endziel.herkunft === 'vermutet'
      ? `Endziel (vermutet): ${plan.endziel.text}`
      : 'Endziel: nicht festgelegt'

export const faktenZeile = (fakten: ZielGraphFakten, jetzt: number): string =>
  `Abgeleitet ${alter(jetzt, fakten.zeit)} in ${sekunden(fakten.dauerMs)} s aus ` +
  `${mehrzahl(fakten.dateien, 'Datei', 'Dateien')}, ${mehrzahl(fakten.chats, 'Chat', 'Chats')} und ` +
  `${mehrzahl(fakten.commits, 'Commit', 'Commits')} · ${fakten.modell}`

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

// Die Stränge, für die kein Ziel festgelegt ist.
export const ohneZiel = (plan: ZielGraphPlan): ZielGraphStrang[] => plan.straenge.filter(one => one.ziel === '')

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
