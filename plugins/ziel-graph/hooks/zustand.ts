import type {
  ZielGraphAntwort,
  ZielGraphChats,
  ZielGraphGeladen,
  ZielGraphGraphSicht,
  ZielGraphKartenSicht,
  ZielGraphLauf,
  ZielGraphPlan,
} from '../types'

// Die Anfangswerte des Zustands. Der Zustand gilt je Session und übersteht ein Neuladen des
// Mod-Codes. Plan, Chats und Lauf teilen sich beide Ansichten; was der Nutzer einstellt, hat
// jede Ansicht für sich. Die Verweise darauf (atom) stehen in jeder Datei, die den Zustand
// liest oder schreibt: `validate` liest sie nur dort, wo sie benutzt werden.

export const NICHTS_GELADEN: ZielGraphGeladen = {
  plan: null,
  warnungen: [],
  fakten: null,
  goal: { vorhanden: true, leer: false, geaendert: false },
  gelesen: 0,
}

export const KEINE_CHATS: ZielGraphChats = { ich: '', chats: [], gelesen: 0 }

export const RUHE: ZielGraphLauf = { phase: 'nie', seit: 0, sekunden: 0, grund: '' }

export const GRAPH_START: ZielGraphGraphSicht = { ansicht: 'schritte', offen: [] }

export const KARTEN_START: ZielGraphKartenSicht = { wahl: '', farben: 'auto' }

export const NIE_GESENDET: ZielGraphAntwort = { chat: '', phase: 'nie', grund: '', zeit: 0 }

// Ohne abgeleiteten Plan gibt es keine Karten, aber die laufenden Chats lassen sich
// trotzdem wählen: Dafür steht dieser leere Plan.
export const LEERER_PLAN: ZielGraphPlan = {
  mitGoal: false,
  endziel: { text: '', herkunft: 'offen' },
  straenge: [],
  buendel: [],
  stamm: [],
  chats: [],
}
