import type { ZielGraphBuendel, ZielGraphPlan, ZielGraphStand, ZielGraphTicket, ZielGraphZone } from '../../types'

import { mehrzahl, sauber } from '../worte'

import type { TrackerNamen } from './goal'
import { grundVon, ticketName } from './tickets'
import type { MerkTicket } from './tickets'

// Der frische Stand: Was erledigt, bereit und blockiert ist, kommt bei jedem Laden aus dem
// Ticket-System, ohne Modell-Aufruf. Eine reine Funktion von Plan und Tickets, die auf den
// Plan des Modells gelegt wird: Gespeichert bleibt, was das Modell gesagt hat, die Ansichten
// zeigen, was hier herauskommt. Ein Bündel, das keine Tickets nennt, bleibt, wie es ist.
// Kein `$`, kein Zustand.

// Die Tickets, auf die sich der frische Stand stützt.
export type TicketStand = {
  liste: readonly MerkTicket[]
  // true: Die Liste nennt jedes offene Ticket. Was dort fehlt, ist dann nicht mehr offen.
  istVollstaendig: boolean
}

const MAX_META = 90
// So viele Tickets nennt der Grund in der zweiten Zeile beim Namen.
const MAX_GENANNT = 3

const ZONE_VON: Record<ZielGraphStand, ZielGraphZone> = {
  erledigt: 'hinter',
  bereit: 'jetzt',
  teilweise: 'jetzt',
  blockiert: 'spaeter',
}

const ZONEN_FOLGE: readonly ZielGraphZone[] = ['hinter', 'jetzt', 'spaeter']

const GRUND_WORT: Record<Exclude<ZielGraphTicket['grund'], ''>, string> = {
  blockiert: 'blockiert',
  auskunft: 'wartet auf Auskunft',
}

// Wie viele Tickets eines Bündels erledigt sind: „3 von 8 erledigt“. '' ohne Tickets.
export const fortschritt = (eines: Pick<ZielGraphBuendel, 'tickets'>): string => {
  const tickets = eines.tickets ?? []

  return tickets.length === 0 ? '' : `${tickets.filter(one => one.zu).length} von ${tickets.length} erledigt`
}

// Ein Stück der zweiten Zeile, das schon vom Fortschritt oder von der Zuständigkeit spricht:
// Beides schreibt der frische Stand selbst.
const istEigenes = (stueck: string): boolean => /^\d+\s+von\s+\d+\b/i.test(stueck) || /^macht\s/i.test(stueck)

// „#16 blockiert“, „#16, #17 wartet auf Auskunft“: welche offenen Tickets gerade nicht gehen.
const grundZeile = (haengend: readonly ZielGraphTicket[]): string =>
  (['auskunft', 'blockiert'] as const)
    .flatMap(grund => {
      const namen = haengend.filter(one => one.grund === grund).map(one => ticketName(one.schluessel))
      const genannt = namen.length > MAX_GENANNT ? [...namen.slice(0, MAX_GENANNT), '…'] : namen

      return namen.length === 0 ? [] : [`${genannt.join(', ')} ${GRUND_WORT[grund]}`]
    })
    .join(', ')

// Wer das Bündel macht: nur, wenn jedes offene Ticket derselben einen Person zugewiesen ist.
const zustaendig = (offen: readonly ZielGraphTicket[], von: ReadonlyMap<string, MerkTicket>): string => {
  const personen = offen.map(one => von.get(one.schluessel)?.zugewiesen ?? [])
  const [erste = []] = personen
  const [name = ''] = erste

  return name !== '' && personen.every(one => one.length === 1 && one[0] === name) ? `macht ${name}` : ''
}

// Die Tickets eines Bündels, wie sie gerade stehen.
const ticketsVon = (
  eines: ZielGraphBuendel,
  stand: TicketStand,
  namen: TrackerNamen,
  jetzt: ReadonlyMap<string, MerkTicket>,
): ZielGraphTicket[] =>
  (eines.tickets ?? []).map((one): ZielGraphTicket => {
    const frisch = jetzt.get(one.schluessel)

    if (frisch === undefined) {
      // Das Ticket-System nennt es nicht mehr: Nennt es alle offenen, ist dieses nicht mehr offen.
      return stand.istVollstaendig ? { ...one, zu: true, grund: '' } : one
    }

    return {
      schluessel: one.schluessel,
      titel: frisch.titel === '' ? one.titel : frisch.titel,
      zu: frisch.zu,
      grund: grundVon(frisch, namen),
    }
  })

// Was der frische Stand über ein Bündel wissen muss, außer seinen Tickets.
type Umstand = {
  namen: TrackerNamen
  jetzt: ReadonlyMap<string, MerkTicket>
  // die Tickets, wie sie beim Ableiten standen: Daran ist zu sehen, ob ein Label das Bündel aufhielt
  davor: ReadonlyMap<string, MerkTicket>
  // die ids der Bündel, deren Tickets jetzt alle geschlossen sind
  erledigt: ReadonlySet<string>
}

// Ein Bündel mit dem Stand, den seine Tickets gerade haben. Ohne Tickets bleibt es, wie es ist.
const frischesBuendel = (eines: ZielGraphBuendel, tickets: ZielGraphTicket[], um: Umstand): ZielGraphBuendel => {
  if (tickets.length === 0) {
    return eines
  }

  const offen = tickets.filter(one => !one.zu)
  const haengend = offen.filter(one => one.grund !== '')
  // Es wartet auf ein Bündel, das noch nicht erledigt ist.
  const wartetNoch = eines.wartetAuf !== '' && !um.erledigt.has(eines.wartetAuf)
  // Beim Ableiten trug eines seiner offenen Tickets ein Label, das es aufhielt.
  const warGehemmt = (eines.tickets ?? []).some(one => {
    const damals = um.davor.get(one.schluessel)

    return damals !== undefined && grundVon(damals, um.namen) !== ''
  })
  // Der Grund, den der Plan für das Warten kannte, ist weg: Das Bündel, auf das es wartete,
  // ist erledigt, oder das Label, das es aufhielt, ist fort. Wartet es aus einem Grund, den
  // nur das Modell kennt, bleibt es stehen.
  const istGrundWeg = eines.wartetAuf === '' ? warGehemmt : !wartetNoch
  // Die Tickets machen ein Bündel erledigt oder halten es auf. Bereit machen sie es nur,
  // wenn der Grund weg ist, aus dem es laut Plan wartete.
  const neuerStand: ZielGraphStand =
    offen.length === 0
      ? 'erledigt'
      : haengend.length === offen.length
        ? 'blockiert'
        : eines.stand === 'blockiert' && !istGrundWeg
          ? 'blockiert'
          : haengend.length > 0
            ? 'teilweise'
            : eines.stand === 'teilweise' && !istGrundWeg
              ? 'teilweise'
              : // Nichts hält es mehr auf; oder es galt als erledigt, und ein Ticket ist wieder offen.
                'bereit'
  const istAnders = neuerStand !== eines.stand
  // Was das Modell sonst zur zweiten Zeile sagt, gilt weiter, solange der Stand derselbe ist.
  const rest = istAnders ? [] : eines.meta.split(' · ').filter(one => one.trim() !== '' && !istEigenes(one.trim()))
  const meta = sauber(
    [fortschritt({ tickets }), ...(rest.length > 0 ? rest : [grundZeile(haengend)]), zustaendig(offen, um.jetzt)]
      .filter(one => one !== '')
      .join(' · '),
    MAX_META,
  )

  return {
    ...eines,
    stand: neuerStand,
    zone: istAnders ? ZONE_VON[neuerStand] : eines.zone,
    meta,
    // Was erledigt ist, wartet auf nichts mehr, und auf Erledigtes wartet niemand.
    wartetAuf: neuerStand === 'erledigt' || !wartetNoch ? '' : eines.wartetAuf,
    tickets,
  }
}

// Legt den Stand der Tickets auf den Plan. Für jedes Bündel, das Tickets nennt: wie viele
// geschlossen sind, ob es damit erledigt ist, ob ein Label es aufhält und ob das, worauf es
// wartete, inzwischen erledigt ist. `davor` sind die Tickets, wie sie beim Ableiten standen.
export const frische = (
  plan: ZielGraphPlan,
  stand: TicketStand,
  namen: TrackerNamen,
  davor: readonly MerkTicket[] = stand.liste,
): ZielGraphPlan => {
  if (!plan.buendel.some(one => (one.tickets ?? []).length > 0)) {
    return plan
  }

  const jetzt = new Map(stand.liste.map(one => [one.schluessel, one]))
  const gelesen = plan.buendel.map(eines => ({ eines, tickets: ticketsVon(eines, stand, namen, jetzt) }))
  const um: Umstand = {
    namen,
    jetzt,
    davor: new Map(davor.map(one => [one.schluessel, one])),
    erledigt: new Set(
      gelesen.filter(one => one.tickets.length > 0 && one.tickets.every(ticket => ticket.zu)).map(one => one.eines.id),
    ),
  }
  // Zone für Zone und darin Strang für Strang, wie der Plan selbst geordnet ist.
  const platz = (eines: ZielGraphBuendel): number =>
    ZONEN_FOLGE.indexOf(eines.zone) * (plan.straenge.length + 1) + plan.straenge.findIndex(one => one.id === eines.strang)

  return {
    ...plan,
    buendel: gelesen
      .map((one, i) => ({ eines: frischesBuendel(one.eines, one.tickets, um), i }))
      .sort((a, b) => platz(a.eines) - platz(b.eines) || a.i - b.i)
      .map(one => one.eines),
  }
}

// Wie viele offene Tickets das Ticket-System nennt, die es beim Ableiten noch nicht gab: Sie
// gehören zu keinem Bündel.
export const neueTickets = (liste: readonly MerkTicket[], davor: readonly MerkTicket[]): number => {
  const bekannt = new Set(davor.map(one => one.schluessel))

  return liste.filter(one => !one.zu && !bekannt.has(one.schluessel)).length
}

// Die Zeile dazu: „3 neue Tickets seit dem letzten Ableiten“. '' ohne.
export const neueTicketsZeile = (anzahl: number): string =>
  anzahl <= 0 ? '' : `${mehrzahl(anzahl, 'neues Ticket', 'neue Tickets')} seit dem letzten Ableiten`
