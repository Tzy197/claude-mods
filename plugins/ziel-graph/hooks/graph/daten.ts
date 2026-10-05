import type { ZielGraphAnsicht, ZielGraphFarben, ZielGraphZone } from '../../types'

// Die Form der Daten, aus denen der Graph gezeichnet wird. zeilen.ts füllt sie aus dem
// einen Plan des Mods; die Zeichenlogik kennt nur diese Form.

// Die Kennung der gemeinsamen Bahn ab dem Treffpunkt. Keine Bahn darf so heißen.
export const STAMM = 'stamm'

export type GraphPerson = { id: string; name: string }

export type GraphBahn = {
  id: string
  name: string
  // id der Person, der die Bahn gehört
  person: string
  // 'ziel' mündet in den Treffpunkt, 'dauer' ist ein Dauerläufer und endet im Pfeil
  art: 'ziel' | 'dauer'
  // true: es liegt schon etwas hinter uns, die Bahn ist oben durchgezogen
  begonnen: boolean
  farbe: { hell: string; dunkel: string }
}

export type GraphKnoten =
  | 'erledigt'
  | 'laeuft'
  | 'bereit'
  | 'teilweise'
  | 'blockiert'
  | 'treffpunkt'
  | 'stamm'
  | 'endziel'

// Eine Zeile des Graphen: ein Bündel (Ansicht Schritte) oder ein ganzes Ziel (Ansicht Übersicht).
export type GraphZeile = {
  id: string
  art: GraphKnoten
  // id einer Bahn, oder 'stamm' für die gemeinsame Bahn ab dem Treffpunkt
  bahn: string
  titel: string
  meta: string
  // nur in der Ansicht Schritte und nur für Bahn-Zeilen
  zone?: ZielGraphZone
  // ein Chat arbeitet an dieser Zeile; 'wartet': er wartet auf den Nutzer
  chat?: 'laeuft' | 'wartet'
  // die Zeilen unter dem Bündel; nur damit lässt es sich aufklappen
  tickets?: string[]
  // id der Zeile, auf die diese Zeile wartet (dünne gestrichelte Linie)
  wartetAuf?: string
}

export type GraphDaten = {
  endziel: string
  personen: GraphPerson[]
  bahnen: GraphBahn[]
  schritte: GraphZeile[]
  uebersicht: GraphZeile[]
}

// Was die Zeichenlogik als Einstellung erwartet. Die Leiste füllt davon `ansicht` und
// `offen` aus ihrem Zustand; Ziel-Auswahl und Filter stehen bis zu einem späteren Bauschritt fest.
export type GraphWahl = {
  ansicht: ZielGraphAnsicht
  // 'alle' oder die id einer Bahn
  ziel: string
  // ids der Bahnen, die ausgeblendet sind
  bahnenAus: string[]
  // ids der Personen, die ausgeblendet sind
  personenAus: string[]
  // ids der aufgeklappten Zeilen
  offen: string[]
  farben: ZielGraphFarben
}
