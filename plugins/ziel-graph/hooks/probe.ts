import type {
  ZielGraphAenderungen,
  ZielGraphAnsicht,
  ZielGraphChats,
  ZielGraphFarben,
  ZielGraphPlan,
} from '../types'

import type { GraphDaten } from './graph/daten'
import { fasseErledigtes } from './graph/ruhig'
import { ALLE, sicht, zeichneSvg } from './graph/zeichnen'
import type { Bild as GraphBild, Sicht as GraphSicht } from './graph/zeichnen'
import { graphDaten } from './graph/zeilen'
import { sicht as kartenSicht } from './karten/karten'
import { baueFlaeche, vorschau, wunschZellen } from './karten/zeichnen'
import type { Bild as KartenBild } from './karten/zeichnen'
import { leseGespeichert, zeige } from './plan/lauf'

// Zum Prüfen ohne die App: aus dem Text einer gespeicherten Plan-Datei (plan.json) dieselben
// Bilder, die die zwei Ansichten daraus bauen, als reine Funktionen. Der Mod selbst braucht
// diese Datei nicht.

// Ein Chat, der für die Probe als laufend gilt.
export type ProbeChat = {
  // die id der Session, so wie sie in der Plan-Datei unter `umfeld.chats` steht
  id: string
  name?: string
  // die Frage, mit der er auf den Nutzer wartet; ohne Angabe wartet er nicht
  frage?: string
}

export type ProbeWahl = {
  // der Text von GOAL.md, gegen den die Antwort aufgeräumt wird; null: Es gibt keine. Ohne
  // Angabe gilt der Text, der beim Ableiten galt und in der Plan-Datei steht.
  goal?: string | null
  // die Chats, die gerade laufen. Ohne Angabe laufen die, die das Modell beim Ableiten
  // kannte, und keiner wartet. Mit [] trägt keine Zeile und keine Karte eine Chat-Marke.
  chats?: readonly ProbeChat[]
}

export type ProbePlan = {
  plan: ZielGraphPlan
  chats: ZielGraphChats
  // was beim Aufräumen aufgefallen ist
  warnungen: string[]
  // was der Lauf am Plan davor geändert hat, so wie es in der Plan-Datei steht; null ohne
  aenderungen: ZielGraphAenderungen | null
}

// Der Plan aus dem Text einer Plan-Datei, so wie ihn beide Ansichten nach „Neu laden“
// zeigen, wenn sich das Ticket-System nicht fragen lässt: mit dem Stand der Tickets, den die
// Datei sich beim Ableiten gemerkt hat. null: Die Datei ist keine Plan-Datei oder ergibt
// keinen Plan.
export const lesePlan = (json: string, wahl: ProbeWahl = {}): ProbePlan | null => {
  const gespeichert = leseGespeichert(json)

  if (gespeichert === null) {
    return null
  }

  const { ableitung } = zeige(gespeichert, wahl.goal === undefined ? gespeichert.goal : wahl.goal, null)
  const laufende: readonly ProbeChat[] = wahl.chats ?? gespeichert.umfeld.chats

  return ableitung.ok
    ? {
        plan: ableitung.plan,
        chats: {
          ich: '',
          chats: laufende.map(one => ({
            id: one.id,
            name: one.name ?? gespeichert.umfeld.chats.find(chat => chat.id === one.id)?.name ?? '',
            aktiv: true,
            branch: '',
            stand: '',
            naechster: '',
            frage: one.frage ?? '',
            zeit: 0,
          })),
          gelesen: 0,
        },
        warnungen: ableitung.warnungen,
        aenderungen: gespeichert.aenderungen,
      }
    : null
}

export type GraphWunsch = ProbeWahl & {
  ansicht?: ZielGraphAnsicht
  // ids der aufgeklappten Zeilen
  offen?: string[]
  // die Leiste zeichnet mit 'auto'; zum Rendern außerhalb der App 'hell' oder 'dunkel'
  farben?: ZielGraphFarben
}

export type GraphProbe = {
  // die Daten nach „Ruhig“: so, wie Bild und Liste sie zeigen
  daten: GraphDaten
  sicht: GraphSicht
  // das ganze Bild der Ansicht `/graph`: `source` ist das SVG, `zeilen` die Oberkante jeder
  // Zeile. Die Leiste zeigt genau dieses Bild, in Streifen geschnitten.
  bild: GraphBild
}

// Der Graph der schmalen Ansicht aus dem Text einer Plan-Datei, im Aussehen „Ruhig“.
export const zeichneGraph = (json: string, wahl: GraphWunsch = {}): GraphProbe | null => {
  const gelesen = lesePlan(json, wahl)

  if (gelesen === null) {
    return null
  }

  const daten = fasseErledigtes(graphDaten(gelesen.plan, gelesen.chats, gelesen.aenderungen))
  const farben = wahl.farben ?? 'auto'
  const bild = sicht(daten, {
    ansicht: wahl.ansicht ?? 'schritte',
    ziel: ALLE,
    bahnenAus: [],
    personenAus: [],
    offen: wahl.offen ?? [],
    farben,
  })

  return { daten, sicht: bild, bild: zeichneSvg(daten, bild, farben) }
}

export type KartenWunsch = ProbeWahl & {
  // ein Bild außerhalb der App hat ein festes Farbschema; ohne Angabe 'hell'
  farben?: 'hell' | 'dunkel'
  // die Breite der Leiste in Zeichenzellen; ohne Angabe die, die sich `/orchestrator` wünscht
  zellen?: number
  // der Schlüssel der gewählten Karte; ohne Angabe wählt die Ansicht selbst
  karte?: string
}

// Die Karten der breiten Ansicht aus dem Text einer Plan-Datei, als ein einziges Bild. Die
// Leiste selbst setzt viele kleine Bilder nebeneinander; die Knöpfe sind hier nur angedeutet,
// und die Detail-Fläche, die aus Text besteht, fehlt.
export const zeichneKarten = (json: string, wahl: KartenWunsch = {}): KartenBild | null => {
  const gelesen = lesePlan(json, wahl)

  if (gelesen === null) {
    return null
  }

  const farben = wahl.farben ?? 'hell'
  const flaeche = baueFlaeche(kartenSicht(gelesen.plan, gelesen.chats, wahl.karte ?? '', gelesen.aenderungen), {
    zellen: wahl.zellen ?? wunschZellen(gelesen.plan.straenge.length),
    farben,
  })

  return vorschau(flaeche, farben)
}
