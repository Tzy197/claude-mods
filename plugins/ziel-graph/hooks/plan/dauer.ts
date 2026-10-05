import type { ZielGraphChats, ZielGraphPlan, ZielGraphStrang } from '../../types'

import { laufende } from './lesen'

// Dauerläufer: Stränge ohne Ende, die neben den Zielen herlaufen. Ein Dauerläufer, an dem
// gerade niemand arbeitet, ruht: Beide Ansichten zeigen ihn dann in einer Zeile oder einer
// Karte. Hier steht, wann er aktiv ist. Eine reine Rechnung aus Plan, Chats und Uhr.
// Kein `$`, kein Zustand.

const TAG_MS = 24 * 60 * 60_000
// So viele Tage zählt ein geschlossenes Ticket als Aktivität.
export const AKTIV_TAGE = 7

// Liegt der Tag, an dem ein Ticket geschlossen wurde ('2026-09-28'), in den letzten 7 Tagen?
// Gezählt wird in ganzen Tagen: Das Ticket-System nennt den Tag, nicht die Stunde. Ein Tag,
// der fehlt, sich nicht lesen lässt oder in der Zukunft liegt, zählt nicht.
export const istFrischGeschlossen = (tag: string | undefined, jetzt: number): boolean => {
  const zeit = /^\d{4}-\d{2}-\d{2}$/.test(tag ?? '') ? Date.parse(`${tag}T00:00:00Z`) : Number.NaN
  const tage = Math.floor(jetzt / TAG_MS) - Math.floor(zeit / TAG_MS)

  return tage >= 0 && tage <= AKTIV_TAGE
}

// Ein Strang ist aktiv, wenn ein laufender Chat an einem seiner Bündel hängt oder in den
// letzten 7 Tagen ein Ticket eines seiner Bündel geschlossen wurde. Offene Tickets allein,
// ein Label oder ein Kommentar zählen nicht; ein fertiger oder ausgeblendeter Chat auch
// nicht. Ohne Tickets zählt nur der Chat.
export const istAktiv = (
  plan: ZielGraphPlan,
  strang: Pick<ZielGraphStrang, 'id'>,
  chats: ZielGraphChats,
  jetzt: number,
): boolean =>
  plan.buendel
    .filter(one => one.strang === strang.id)
    .some(
      eines =>
        laufende(eines, chats).length > 0 ||
        (eines.tickets ?? []).some(ticket => ticket.zu && istFrischGeschlossen(ticket.geschlossen, jetzt)),
    )

// Die ids der Dauerläufer, die gerade ruhen: an denen kein Chat arbeitet und kein Ticket
// frisch geschlossen ist. Ein Ziel ruht nie.
export const ruhende = (plan: ZielGraphPlan, chats: ZielGraphChats, jetzt: number): Set<string> =>
  new Set(plan.straenge.filter(one => one.art === 'dauer' && !istAktiv(plan, one, chats, jetzt)).map(one => one.id))

// Keiner ruht: für Stellen, die den Plan ohne Chats und ohne Uhr zeigen.
export const KEINER_RUHT: ReadonlySet<string> = new Set<string>()
