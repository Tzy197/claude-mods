import type {
  ZielGraphAenderungen,
  ZielGraphBuendel,
  ZielGraphChats,
  ZielGraphPlan,
  ZielGraphSchritt,
  ZielGraphStrang,
} from '../../types'

import { nameVon } from '../chats'
import { ENDZIEL } from '../fest'
import { QUELLE_CHATS, QUELLE_COMMITS, QUELLE_TICKETS, ZONEN_FOLGE } from '../plan/ableiten'
import {
  aenderungsMarke,
  endzielZeile,
  laufende,
  mitFortschritt,
  mitMarke,
  punkteOhneTickets,
  schrittMeta,
  ticketPunkte,
  zielTitel,
} from '../plan/lesen'
import { eindeutig, mehrzahl, sauber } from '../worte'

import { STAMM } from './daten'
import type { GraphBahn, GraphDaten, GraphKnoten, GraphZeile } from './daten'

// Aus dem einen Plan und den laufenden Chats werden die Zeilen des Graphen: je Strang eine
// Bahn, je Bündel eine Zeile, darunter der Stamm mit Zwischenzielen und Endziel. Der Plan
// selbst bleibt, wie er ist; die Karten lesen denselben. Kein `$`, kein Bild.

// Zum Ausblenden kennt der Graph Personen; der Plan füllt sie noch nicht: Alle Bahnen
// gehören dem Nutzer. Wer einen Strang laut GOAL.md macht, steht nur in der Legende.
const PERSON = 'ich'
const MAX_META = 90
// So viel vom Titel des Ziels passt hinter „wartet auf: “ in die zweite Zeile.
const MAX_WARTE_TITEL = 34

const quellenZeile = (quelle: string): string =>
  quelle === QUELLE_CHATS
    ? 'Quelle: laufende Chats'
    : quelle === QUELLE_COMMITS
      ? 'Quelle: Git-Verlauf'
      : quelle === QUELLE_TICKETS
        ? 'Quelle: Tickets'
        : `Quelle: ${quelle}`

// Was das Modell nur schließt, sagt die zweite Zeile, wenn sie es nicht schon tut.
const mitVermutung = (meta: string, vermutet: boolean): string =>
  vermutet && !/vermutet/i.test(meta)
    ? sauber(meta === '' ? 'vermutet' : `vermutet · ${meta}`, MAX_META)
    : meta

// Die Zeile eines Bündels. Ob ein Chat an ihm arbeitet und ob er wartet, sagen die Chats,
// die gerade laufen: Zugeordnet hat sie das Modell beim Ableiten. Hat der letzte Lauf das
// Bündel neu gebracht, verschoben oder umbenannt, steht das vorn in seiner zweiten Zeile.
// Nennt das Bündel Tickets, sagt die zweite Zeile den Fortschritt, und aufgeklappt stehen
// die Tickets da: Nummer, Titel und ob sie geschlossen sind.
const zeileAus = (
  plan: ZielGraphPlan,
  eines: ZielGraphBuendel,
  chats: ZielGraphChats,
  aenderungen: ZielGraphAenderungen | null,
): GraphZeile => {
  const offene = laufende(eines, chats)
  const ziel = zielTitel(plan, eines.wartetAuf)
  // Worauf ein Bündel wartet, steht als Text in seiner zweiten Zeile: Eine Linie zeichnet
  // der Graph nur zwischen zwei Bahnen. Ein teilweise mögliches Bündel behält seinen Fortschritt.
  const meta =
    ziel === '' || (eines.stand === 'teilweise' && eines.meta !== '')
      ? mitVermutung(eines.meta, eines.vermutet)
      : mitFortschritt(eines, `wartet auf: ${sauber(ziel, MAX_WARTE_TITEL)}${eines.vermutet ? ' (vermutet)' : ''}`)
  const unterzeilen = [
    ...offene.map(chat => `Chat: ${nameVon(chat)}${chat.frage === '' ? '' : ' · wartet auf dich'}`),
    ...ticketPunkte(eines),
    ...punkteOhneTickets(eines),
    ...(eines.quelle === '' ? [] : [quellenZeile(eines.quelle)]),
  ]

  return {
    id: eines.id,
    // Woran ein Chat arbeitet, das läuft.
    art: offene.length > 0 ? 'laeuft' : eines.stand,
    bahn: eines.strang,
    titel: eines.titel,
    meta: mitMarke(meta, aenderungsMarke(aenderungen, 'buendel', eines.id)),
    zone: eines.zone,
    ...(offene.length === 0
      ? {}
      : { chat: offene.some(chat => chat.frage !== '') ? ('wartet' as const) : ('laeuft' as const) }),
    ...(unterzeilen.length === 0 ? {} : { tickets: unterzeilen }),
    ...(eines.wartetAuf === '' ? {} : { wartetAuf: eines.wartetAuf }),
  }
}

// Die Zeile eines Schritts auf dem Stamm. Ein erreichtes Zwischenziel liegt hinter uns und
// trägt den gefüllten Punkt; `istMuendung`: Hier fallen die Bahnen der Ziele zusammen.
const stammZeile = (
  plan: ZielGraphPlan,
  schritt: ZielGraphSchritt,
  istMuendung: boolean,
  mitUnterzeilen: boolean,
  aenderungen: ZielGraphAenderungen | null,
): GraphZeile => {
  const dabei = plan.straenge.filter(one => one.gehoertZu === schritt.id).map(one => one.name)
  const unterzeilen = [
    ...(dabei.length === 0 ? [] : [`Stränge: ${dabei.join(', ')}`]),
    ...(schritt.quelle === '' ? [] : [quellenZeile(schritt.quelle)]),
  ]

  return {
    id: schritt.id,
    art: schritt.erreicht ? 'erledigt' : istMuendung ? 'treffpunkt' : 'stamm',
    bahn: STAMM,
    titel: schritt.titel,
    // Ein abgehaktes Zwischenziel sagt „erreicht“ genau einmal, was auch immer das Modell dazu schreibt.
    meta: [
      aenderungsMarke(aenderungen, 'schritt', schritt.id),
      schritt.erreicht ? 'erreicht' : '',
      mitVermutung(schrittMeta(schritt), schritt.vermutet),
    ]
      .filter(one => one !== '')
      .join(' · '),
    ...(unterzeilen.length === 0 || !mitUnterzeilen ? {} : { tickets: unterzeilen }),
  }
}

// Die Zeile der Übersicht für einen Strang: Sie zählt seine Bündel zusammen.
const strangZeile = (
  bahn: ZielGraphStrang,
  eigene: readonly GraphZeile[],
  mitChat: number,
  vergeben: Set<string>,
): GraphZeile => {
  const offen = eigene.filter(one => one.art !== 'erledigt')
  const moeglich = eigene.filter(one => one.zone === 'jetzt').length
  const art: GraphKnoten = eigene.some(one => one.art === 'laeuft')
    ? 'laeuft'
    : eigene.some(one => one.art === 'bereit')
      ? 'bereit'
      : eigene.some(one => one.art === 'teilweise')
        ? 'teilweise'
        : eigene.length > 0 && offen.length === 0
          ? 'erledigt'
          : 'blockiert'
  const meta =
    eigene.length === 0
      ? 'noch keine Schritte'
      : offen.length === 0
        ? `${eigene.length} erledigt`
        : [
            `${offen.length} offen`,
            moeglich === 0 ? '' : `${moeglich} jetzt möglich`,
            mitChat === 0 ? '' : mehrzahl(mitChat, 'Chat', 'Chats'),
          ]
            .filter(one => one !== '')
            .join(' · ')

  return {
    id: eindeutig(`ziel-${bahn.id}`, vergeben),
    art,
    bahn: bahn.id,
    titel: bahn.art === 'dauer' ? `${bahn.name} · Dauerläufer` : bahn.name,
    meta,
  }
}

// Macht aus dem Plan, was der Graph zeichnet. `chats` sind die Chats, die gerade laufen,
// `aenderungen`, was der letzte Lauf geändert hat.
export const graphDaten = (
  plan: ZielGraphPlan,
  chats: ZielGraphChats,
  aenderungen: ZielGraphAenderungen | null = null,
): GraphDaten => {
  // Erst die Ziele, dann die Dauerläufer: So sitzt der Stamm in der Mitte der Ziele. Die
  // Farbe hängt am Strang, nicht an seinem Platz.
  const straenge = [
    ...plan.straenge.filter(one => one.art === 'ziel'),
    ...plan.straenge.filter(one => one.art === 'dauer'),
  ]
  const bahnen = straenge.map(
    (one): GraphBahn => ({
      id: one.id,
      name: one.name,
      person: PERSON,
      art: one.art,
      begonnen: plan.buendel.some(eines => eines.strang === one.id && eines.zone === 'hinter'),
      ...((one.wer ?? '') === '' ? {} : { wer: one.wer }),
      farbe: one.farbe,
    }),
  )
  // Zone für Zone und darin Bahn für Bahn, sonst in der Reihenfolge des Plans.
  const platz = (eines: ZielGraphBuendel): number =>
    ZONEN_FOLGE.indexOf(eines.zone) * (straenge.length + 1) + straenge.findIndex(one => one.id === eines.strang)
  const buendel = plan.buendel
    .map((eines, i) => ({ eines, i }))
    .sort((a, b) => platz(a.eines) - platz(b.eines) || a.i - b.i)
    .map(one => one.eines)
  const zeilen = buendel.map(eines => zeileAus(plan, eines, chats, aenderungen))
  // Die Bahnen der Ziele münden in das erste Zwischenziel, das noch offen ist, oder in den
  // Treffpunkt des Modells. Gibt es keines von beiden, münden sie ins Endziel.
  const muendung = plan.stamm.find(one => !one.erreicht && one.art !== 'schritt')
  const endziel = endzielZeile(plan)
  const amEnde: GraphZeile = { id: ENDZIEL, art: 'endziel', bahn: STAMM, titel: endziel, meta: '' }
  const vergeben = new Set([...plan.stamm.map(one => one.id), ENDZIEL])

  return {
    endziel,
    personen: [{ id: PERSON, name: 'Ich' }],
    bahnen,
    schritte: [
      ...zeilen,
      ...plan.stamm.map(one => stammZeile(plan, one, one === muendung, true, aenderungen)),
      amEnde,
    ],
    // In der Übersicht klappt nichts auf.
    uebersicht: [
      ...straenge.map(strang =>
        strangZeile(
          strang,
          zeilen.filter(one => one.bahn === strang.id),
          buendel
            .filter(one => one.strang === strang.id)
            .reduce((summe, one) => summe + laufende(one, chats).length, 0),
          vergeben,
        ),
      ),
      ...plan.stamm.map(one => stammZeile(plan, one, one === muendung, false, aenderungen)),
      amEnde,
    ],
  }
}
