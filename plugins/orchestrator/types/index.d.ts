// Vertrag des Mods orchestrator: der abgeleitete Plan, die laufenden Chats und der
// Zustand der Fläche.

export type OrchestratorZone = 'hinter' | 'jetzt' | 'spaeter'

export type OrchestratorStand = 'erledigt' | 'bereit' | 'teilweise' | 'blockiert'

export type OrchestratorFarben = 'auto' | 'hell' | 'dunkel'

// Ein Strang: eine Spalte der Fläche. Die Spezifikation des Ziel-Graphen nennt ihn Bahn.
export type OrchestratorStrang = {
  id: string
  name: string
  // 'ziel' hat ein Ende, 'dauer' ist ein Dauerläufer und läuft weiter
  art: 'ziel' | 'dauer'
  // wohin der Strang führt, wörtlich aus GOAL.md; '' wenn dort keines festgelegt ist
  ziel: string
  // was das Modell als Ziel vermutet; nur von Belang, solange `ziel` leer ist
  vermutung: string
  // true: Der Strang steht in GOAL.md. false: Das Modell hat ihn in den anderen Quellen gefunden.
  inGoal: boolean
  // id des Zwischenziels, zu dem der Strang laut GOAL.md gehört; '' ohne
  gehoertZu: string
  farbe: { hell: string; dunkel: string }
}

// Ein Bündel: das, was ein Chat in einem Zug erledigen würde. Eine Karte der Fläche.
export type OrchestratorBuendel = {
  id: string
  // id eines Strangs
  strang: string
  zone: OrchestratorZone
  stand: OrchestratorStand
  titel: string
  meta: string
  // die einzelnen Aufgaben des Bündels
  punkte: string[]
  // woher das Bündel stammt: ein Dateiname, 'chats' oder 'commits'; '' wenn unbekannt
  quelle: string
  // true: Das Modell hat das Bündel, seinen Stand oder seinen Grund nur geschlossen
  vermutet: boolean
  // id des Bündels oder Stamm-Schritts, auf den dieses Bündel wartet; '' ohne
  wartetAuf: string
  // die Sessions der Chats, die das Modell diesem Bündel zugeordnet hat
  chats: string[]
}

// Ein Schritt auf dem Stamm: ein Zwischenziel aus GOAL.md, der Treffpunkt des Modells oder
// ein Schritt danach.
export type OrchestratorSchritt = {
  id: string
  art: 'zwischenziel' | 'treffpunkt' | 'schritt'
  titel: string
  meta: string
  quelle: string
  vermutet: boolean
  // true: steht als Zwischenziel in GOAL.md
  inGoal: boolean
  // true: in GOAL.md als erreicht abgehakt
  erreicht: boolean
}

// Welcher Chat an welchem Bündel arbeitet, so wie das Modell es zugeordnet hat.
export type OrchestratorZuordnung = {
  // die id der Session
  id: string
  // die Kennung, unter der das Modell den Chat kannte (c1, c2, …)
  kennung: string
  name: string
  // id des Bündels; '' wenn der Chat keinem zugeordnet ist
  buendel: string
}

export type OrchestratorEndziel = {
  // '' wenn keines festgelegt und keines vermutet ist
  text: string
  // 'goal': wörtlich aus GOAL.md. 'vermutet': vom Modell. 'offen': keines.
  herkunft: 'goal' | 'vermutet' | 'offen'
}

export type OrchestratorPlan = {
  // true: Beim Aufräumen lag eine GOAL.md vor
  mitGoal: boolean
  endziel: OrchestratorEndziel
  straenge: OrchestratorStrang[]
  // Abschnitt für Abschnitt, darin Strang für Strang
  buendel: OrchestratorBuendel[]
  stamm: OrchestratorSchritt[]
  chats: OrchestratorZuordnung[]
}

// Die Eckdaten eines Laufs.
export type OrchestratorFakten = {
  // wann der Lauf begonnen hat, in Millisekunden
  zeit: number
  dauerMs: number
  modellMs: number
  // wie viele Doku-Dateien, Chats und Commits das Modell bekommen hat
  dateien: number
  chats: number
  commits: number
  modell: string
  // wo der Plan liegt; '' wenn er sich nicht schreiben ließ
  datei: string
}

// Was die Fläche zeigt: der letzte gespeicherte Plan und wie GOAL.md gerade dasteht.
export type OrchestratorGeladen = {
  plan: OrchestratorPlan | null
  // was beim Aufräumen der Antwort und beim Lesen von GOAL.md aufgefallen ist
  warnungen: string[]
  fakten: OrchestratorFakten | null
  goal: {
    vorhanden: boolean
    // true: Die Datei ist da, nennt aber weder Endziel noch Zwischenziel noch Strang
    leer: boolean
    // true: GOAL.md sieht anders aus als beim letzten Ableiten
    geaendert: boolean
  }
  // wann zuletzt von der Platte gelesen wurde, in Millisekunden; 0: noch nie
  gelesen: number
}

// Ein laufender Chat, gelesen aus der Datei, die der Mod ziel-graph je Session schreibt.
export type OrchestratorChat = {
  // die id der Session
  id: string
  name: string
  branch: string
  stand: string
  naechster: string
  // die Frage, auf die der Chat vom Nutzer wartet; '' wenn er auf nichts wartet
  frage: string
  // wann der Stand zuletzt geschrieben wurde, in Millisekunden; 0: noch nie
  zeit: number
}

export type OrchestratorChats = {
  // die id der eigenen Session
  ich: string
  chats: OrchestratorChat[]
  // wann die Dateien gelesen wurden, in Millisekunden; 0: noch nie
  gelesen: number
}

// Wo der Lauf steht. 'nie': in dieser Session wurde noch nicht abgeleitet.
export type OrchestratorLauf = {
  phase: 'nie' | 'laeuft' | 'fertig' | 'fehler'
  // wann der Lauf begonnen hat, in Millisekunden; 0: noch nie
  seit: number
  // wie lange er schon läuft, in ganzen Sekunden
  sekunden: number
  // warum der letzte Lauf gescheitert ist; '' wenn er das nicht ist
  grund: string
}

// Was der Nutzer in der Fläche eingestellt hat.
export type OrchestratorSicht = {
  // der Schlüssel der gewählten Karte; '' wenn keine gewählt ist
  wahl: string
  farben: OrchestratorFarben
}

// Versuch: der letzte Versand einer Antwort an einen wartenden Chat.
export type OrchestratorAntwort = {
  // die Session, an die gesendet wurde; '' wenn noch nie
  chat: string
  phase: 'nie' | 'zugestellt' | 'nicht'
  // warum die Antwort nicht zugestellt wurde; '' sonst
  grund: string
  // wann gesendet wurde, in Millisekunden
  zeit: number
}

declare module 'claude-code' {
  interface PluginState {
    orchestrator: {
      geladen: OrchestratorGeladen
      chats: OrchestratorChats
      lauf: OrchestratorLauf
      sicht: OrchestratorSicht
      antwort: OrchestratorAntwort
    }
  }
}
