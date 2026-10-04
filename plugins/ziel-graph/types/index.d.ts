// Vertrag des Mods ziel-graph: der Zustand der Leiste und die Form der Graph-Daten.

export type ZielGraphAnsicht = 'schritte' | 'uebersicht'

export type ZielGraphFarben = 'auto' | 'hell' | 'dunkel'

// Was der Nutzer in der Leiste eingestellt hat. Daraus und aus den Daten wird gezeichnet.
export type ZielGraphZustand = {
  ansicht: ZielGraphAnsicht
  // 'alle' oder die id einer Bahn
  ziel: string
  // ids der Bahnen, die der Nutzer ausgeblendet hat
  bahnenAus: string[]
  // ids der Personen, die der Nutzer ausgeblendet hat
  personenAus: string[]
  // ids der aufgeklappten Bündel
  offen: string[]
  farben: ZielGraphFarben
}

export type ZielGraphPerson = { id: string; name: string }

export type ZielGraphBahn = {
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

export type ZielGraphKnoten =
  | 'erledigt'
  | 'laeuft'
  | 'bereit'
  | 'teilweise'
  | 'blockiert'
  | 'treffpunkt'
  | 'stamm'
  | 'endziel'

export type ZielGraphZone = 'hinter' | 'jetzt' | 'spaeter'

// Eine Zeile des Graphen: ein Bündel (Ansicht Schritte) oder ein ganzes Ziel (Ansicht Übersicht).
export type ZielGraphZeile = {
  id: string
  art: ZielGraphKnoten
  // id einer Bahn, oder 'stamm' für die gemeinsame Bahn ab dem Treffpunkt
  bahn: string
  titel: string
  meta: string
  // nur in der Ansicht Schritte und nur für Bahn-Zeilen
  zone?: ZielGraphZone
  // ein Chat arbeitet an dieser Zeile; 'wartet': er wartet auf den Nutzer
  chat?: 'laeuft' | 'wartet'
  // die Tickets des Bündels; nur damit lässt es sich aufklappen
  tickets?: string[]
  // id der Zeile, auf die diese Zeile wartet (dünne gestrichelte Linie)
  wartetAuf?: string
}

export type ZielGraphDaten = {
  endziel: string
  personen: ZielGraphPerson[]
  bahnen: ZielGraphBahn[]
  schritte: ZielGraphZeile[]
  uebersicht: ZielGraphZeile[]
}

declare module 'claude-code' {
  interface PluginState {
    'ziel-graph': { zustand: ZielGraphZustand }
  }
}
