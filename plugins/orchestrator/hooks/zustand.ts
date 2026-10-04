import type {
  OrchestratorAntwort,
  OrchestratorChats,
  OrchestratorGeladen,
  OrchestratorLauf,
  OrchestratorPlan,
  OrchestratorSicht,
} from '../types'

// Die Anfangswerte des Zustands der Fläche. Der Zustand gilt je Session und übersteht ein
// Neuladen des Mod-Codes. Die Verweise darauf (atom) stehen in jeder Datei, die ihn liest
// oder schreibt: `validate` liest sie nur dort, wo sie benutzt werden.

export const NICHTS_GELADEN: OrchestratorGeladen = {
  plan: null,
  warnungen: [],
  fakten: null,
  goal: { vorhanden: true, leer: false, geaendert: false },
  gelesen: 0,
}

export const KEINE_CHATS: OrchestratorChats = { ich: '', chats: [], gelesen: 0 }

export const RUHE: OrchestratorLauf = { phase: 'nie', seit: 0, sekunden: 0, grund: '' }

export const START: OrchestratorSicht = { wahl: '', farben: 'auto' }

export const NIE_GESENDET: OrchestratorAntwort = { chat: '', phase: 'nie', grund: '', zeit: 0 }

// Ohne abgeleiteten Plan gibt es keine Karten, aber die laufenden Chats lassen sich
// trotzdem wählen: Dafür steht dieser leere Plan.
export const LEERER_PLAN: OrchestratorPlan = {
  mitGoal: false,
  endziel: { text: '', herkunft: 'offen' },
  straenge: [],
  buendel: [],
  stamm: [],
  chats: [],
}
