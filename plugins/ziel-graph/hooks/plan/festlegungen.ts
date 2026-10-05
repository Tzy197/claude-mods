import type { ZielGraphFestlegung } from '../../types'

import type { ChatZugang } from '../chats'
import { istObjekt, sauber } from '../worte'

import { istOffen, satzSchluessel } from './goal'

// Festlegungen: Sätze des Nutzers, die bei jedem Ableiten gewinnen. Fest stehen sie in
// GOAL.md unter „Festlegungen“. Eine neue gibt der Nutzer in der breiten Ansicht ein: Sie
// gilt ab dem nächsten Ableiten und liegt erst lokal, im Ordner des Plans, weil der Mod
// GOAL.md nie schreibt. Sobald ein Satz in GOAL.md steht, fällt seine lokale Kopie weg.
// Kein `$`: register.tsx reicht einen Zugang.

export const FEST_DATEI = 'festlegungen.json'
// So lang darf ein Satz sein, den der Nutzer in der Leiste eingibt.
export const MAX_SATZ = 300
const VERSION = 1

// Eine Festlegung, die erst lokal liegt, so wie sie in der Datei steht.
export type LokaleFestlegung = {
  satz: string
  // wann der Nutzer sie eingegeben hat, in Millisekunden
  zeit: number
}

export type FestZugang = Pick<ChatZugang, 'lies' | 'schreibe'>

export type FestAusgang = { ok: true } | { ok: false; grund: string }

// Die lokalen Festlegungen aus dem Text ihrer Datei. Eine fehlende, fremde oder kaputte
// Datei nennt keine.
export const leseLokale = (roh: string | null): LokaleFestlegung[] => {
  try {
    const wert: unknown = JSON.parse(roh ?? '')
    const liste = istObjekt(wert) && Array.isArray(wert.festlegungen) ? wert.festlegungen : []

    return liste.flatMap((one: unknown): LokaleFestlegung[] =>
      istObjekt(one) && typeof one.satz === 'string' && one.satz.trim() !== ''
        ? [{ satz: one.satz, zeit: typeof one.zeit === 'number' ? one.zeit : 0 }]
        : [],
    )
  } catch {
    return []
  }
}

// Die lokalen Festlegungen, die noch gelten: jede einmal, und keine, die GOAL.md schon nennt.
const nochLokal = (
  ausGoal: readonly string[],
  lokale: readonly LokaleFestlegung[],
): LokaleFestlegung[] => {
  const bekannt = new Set(ausGoal.map(satzSchluessel))

  return lokale.filter(one => {
    const schluessel = satzSchluessel(one.satz)
    const istNeu = schluessel !== '' && !bekannt.has(schluessel)

    bekannt.add(schluessel)

    return istNeu
  })
}

// Die Festlegungen, wie beide Ansichten sie zeigen und das Modell sie bekommt: erst die aus
// GOAL.md, dann die lokalen.
export const fuegeZusammen = (
  ausGoal: readonly string[],
  lokale: readonly LokaleFestlegung[],
): ZielGraphFestlegung[] => [
  ...ausGoal.map((satz): ZielGraphFestlegung => ({ satz, ort: 'goal' })),
  ...nochLokal(ausGoal, lokale).map((one): ZielGraphFestlegung => ({ satz: one.satz, ort: 'lokal' })),
]

// true: Zwei Listen nennen dieselben Sätze, in welcher Reihenfolge und Schreibweise auch immer.
export const gleicheSaetze = (a: readonly string[], b: readonly string[]): boolean => {
  const eins = new Set(a.map(satzSchluessel))
  const zwei = new Set(b.map(satzSchluessel))

  return eins.size === zwei.size && [...eins].every(one => zwei.has(one))
}

const liesLokale = async (zugang: Pick<ChatZugang, 'lies'>, ordner: string): Promise<LokaleFestlegung[]> => {
  try {
    return leseLokale(await zugang.lies(`${ordner}/${FEST_DATEI}`))
  } catch {
    // Noch nie eine eingegeben.
    return []
  }
}

const schreibeLokale = (
  zugang: Pick<ChatZugang, 'schreibe'>,
  ordner: string,
  lokale: readonly LokaleFestlegung[],
): Promise<void> =>
  zugang.schreibe(`${ordner}/${FEST_DATEI}`, JSON.stringify({ version: VERSION, festlegungen: lokale }, null, 2))

// Liest die Festlegungen des Repos. `ausGoal` sind die Sätze, die GOAL.md gerade nennt: Die
// lokale Kopie eines solchen Satzes fällt dabei aus der Datei. So kommt ein Satz, den der
// Nutzer später wieder aus GOAL.md streicht, nicht von selbst zurück.
export const liesFestlegungen = async (
  zugang: FestZugang,
  ordner: string,
  ausGoal: readonly string[],
): Promise<ZielGraphFestlegung[]> => {
  const lokale = await liesLokale(zugang, ordner)
  const bleiben = nochLokal(ausGoal, lokale)

  if (bleiben.length !== lokale.length) {
    try {
      await schreibeLokale(zugang, ordner, bleiben)
    } catch {
      // Nur das Aufräumen: Die Liste stimmt auch so.
    }
  }

  return fuegeZusammen(ausGoal, bleiben)
}

// Nimmt einen Satz des Nutzers als lokale Festlegung auf. Der Ausgang sagt, warum nicht.
export const legeFest = async (
  zugang: FestZugang,
  ordner: string,
  ausGoal: readonly string[],
  eingabe: string,
  jetzt: number,
): Promise<FestAusgang> => {
  // Ein Satz in einer Zeile: Umbrüche und Steuerzeichen werden zu einem Leerzeichen.
  const satz = sauber(eingabe, Number.MAX_SAFE_INTEGER)
  const schluessel = satzSchluessel(satz)

  if (schluessel === '' || istOffen(satz)) {
    return { ok: false, grund: 'Die Festlegung ist leer.' }
  }

  if (satz.length > MAX_SATZ) {
    return { ok: false, grund: `Die Festlegung ist zu lang: Sie ist ein Satz von höchstens ${MAX_SATZ} Zeichen.` }
  }

  if (ausGoal.some(one => satzSchluessel(one) === schluessel)) {
    return { ok: false, grund: 'Diese Festlegung steht schon in GOAL.md.' }
  }

  const lokale = nochLokal(ausGoal, await liesLokale(zugang, ordner))

  if (lokale.some(one => satzSchluessel(one.satz) === schluessel)) {
    return { ok: false, grund: 'Diese Festlegung gibt es schon.' }
  }

  await schreibeLokale(zugang, ordner, [...lokale, { satz, zeit: jetzt }])

  return { ok: true }
}

// Nimmt eine lokale Festlegung zurück. Was in GOAL.md steht, streicht nur der Chat.
export const nimmFestZurueck = async (
  zugang: FestZugang,
  ordner: string,
  ausGoal: readonly string[],
  satz: string,
): Promise<void> => {
  const schluessel = satzSchluessel(satz)
  const lokale = nochLokal(ausGoal, await liesLokale(zugang, ordner))

  await schreibeLokale(
    zugang,
    ordner,
    lokale.filter(one => satzSchluessel(one.satz) !== schluessel),
  )
}
