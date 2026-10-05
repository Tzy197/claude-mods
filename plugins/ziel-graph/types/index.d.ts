// Vertrag des Mods ziel-graph: der eine Plan des Repos, die laufenden Chats, der Lauf, der
// den Plan ableitet, und was der Nutzer in den zwei Ansichten eingestellt hat.

export type ZielGraphZone = 'hinter' | 'jetzt' | 'spaeter'

export type ZielGraphStand = 'erledigt' | 'bereit' | 'teilweise' | 'blockiert'

export type ZielGraphAnsicht = 'schritte' | 'uebersicht'

export type ZielGraphFarben = 'auto' | 'hell' | 'dunkel'

// ---------- Der Plan ----------

// Ein Strang: eine Bahn des Graphen und eine Spalte der Karten. GOAL.md nennt ihn Strang,
// die Spezifikation Bahn.
export type ZielGraphStrang = {
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

// Ein Ticket, das ein Bündel nennt, so wie es zuletzt im Ticket-System stand.
export type ZielGraphTicket = {
  // die Nummer ohne '#'; bei Tickets als Markdown Vorhaben und Nummer: 'kasse/03'
  schluessel: string
  titel: string
  // true: geschlossen
  zu: boolean
  // warum an einem offenen Ticket gerade nicht gearbeitet werden kann: Ein Label nennt es
  // blockiert, oder es wartet auf eine Auskunft von außen. '' wenn nichts dagegen spricht.
  grund: '' | 'blockiert' | 'auskunft'
}

// Ein Bündel: das, was ein Chat in einem Zug erledigen würde. Eine Zeile des Graphen und
// eine Karte.
export type ZielGraphBuendel = {
  id: string
  // id eines Strangs
  strang: string
  zone: ZielGraphZone
  stand: ZielGraphStand
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
  // die Tickets des Bündels; fehlt, wenn es keine nennt. Ein Bündel mit Tickets bekommt
  // Fortschritt und Stand bei jedem Laden frisch aus dem Ticket-System.
  tickets?: ZielGraphTicket[]
}

// Ein Schritt auf dem Stamm: ein Zwischenziel aus GOAL.md, der Treffpunkt des Modells oder
// ein Schritt danach.
export type ZielGraphSchritt = {
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
export type ZielGraphZuordnung = {
  // die id der Session
  id: string
  // die Kennung, unter der das Modell den Chat kannte (c1, c2, …)
  kennung: string
  name: string
  // id des Bündels; '' wenn der Chat keinem zugeordnet ist
  buendel: string
}

export type ZielGraphEndziel = {
  // '' wenn keines festgelegt und keines vermutet ist
  text: string
  // 'goal': wörtlich aus GOAL.md. 'vermutet': vom Modell. 'offen': keines.
  herkunft: 'goal' | 'vermutet' | 'offen'
}

// Der eine Plan des Mods. Beide Ansichten zeichnen ihn: `/graph` als Graph, `/orchestrator`
// als Karten. Was sie zeigen, ist der Plan des Modells mit dem frischen Stand der Tickets
// darauf; gespeichert bleibt, was das Modell gesagt hat.
export type ZielGraphPlan = {
  // true: Beim Aufräumen lag eine GOAL.md vor
  mitGoal: boolean
  endziel: ZielGraphEndziel
  straenge: ZielGraphStrang[]
  // Abschnitt für Abschnitt, darin Strang für Strang
  buendel: ZielGraphBuendel[]
  stamm: ZielGraphSchritt[]
  chats: ZielGraphZuordnung[]
}

// ---------- Festlegungen und was sich geändert hat ----------

// Eine Festlegung: ein Satz des Nutzers, der bei jedem Ableiten gewinnt.
export type ZielGraphFestlegung = {
  satz: string
  // 'goal': steht in GOAL.md unter „Festlegungen“. 'lokal': liegt erst auf diesem Rechner,
  // im Ordner des Plans, und noch nicht in GOAL.md.
  ort: 'goal' | 'lokal'
}

// Wie ein Bündel oder ein Schritt des Stamms in einem Plan dasteht, so weit der Vergleich
// zweier Pläne es braucht.
export type ZielGraphLage = {
  titel: string
  // der Name des Strangs; '' auf dem Stamm
  strang: string
  // die Zone eines Bündels; 'stamm' für einen Schritt des Stamms
  zone: ZielGraphZone | 'stamm'
  // der Stand eines Bündels; auf dem Stamm 'erreicht' oder 'offen'
  stand: ZielGraphStand | 'erreicht' | 'offen'
}

// Ein Bündel oder ein Schritt des Stamms, der nach einem Lauf neu, weg oder anders ist.
export type ZielGraphAenderung = {
  was: 'buendel' | 'schritt'
  // die id im neuen Plan; ist der Eintrag weg, die im vorigen
  id: string
  // wie er im vorigen Plan dastand; null: Er ist neu
  vorher: ZielGraphLage | null
  // wie er im neuen Plan dasteht; null: Er ist weg
  nachher: ZielGraphLage | null
}

// Was ein Lauf am Plan davor geändert hat, verglichen nach der id.
export type ZielGraphAenderungen = {
  // in der Reihenfolge des neuen Plans: erst die Bündel, dann der Stamm; was weg ist, zuletzt
  eintraege: ZielGraphAenderung[]
  // der Wortlaut des Endziels vorher und jetzt, '' für „nicht festgelegt“; null: Es blieb gleich
  endziel: { vorher: string; nachher: string } | null
}

// Die Eckdaten eines Laufs.
export type ZielGraphFakten = {
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
  // das Ticket-System des Repos beim Ableiten; fehlt bei einem Plan von vor Version 0.5.0
  tracker?: ZielGraphTracker
  // wie viele Tickets der Lauf dort gelesen hat: offene und zuletzt geschlossene
  tickets?: number
}

// Was beide Ansichten zeigen: der letzte gespeicherte Plan und wie GOAL.md gerade dasteht.
export type ZielGraphGeladen = {
  plan: ZielGraphPlan | null
  // was beim Aufräumen der Antwort und beim Lesen von GOAL.md aufgefallen ist
  warnungen: string[]
  fakten: ZielGraphFakten | null
  goal: {
    vorhanden: boolean
    // true: Die Datei ist da, nennt aber weder Endziel noch Zwischenziel noch Strang
    leer: boolean
    // true: GOAL.md sieht anders aus als beim letzten Ableiten
    geaendert: boolean
  }
  festlegungen: {
    // die Festlegungen, die beim nächsten Ableiten gelten: erst die aus GOAL.md, dann die lokalen
    liste: ZielGraphFestlegung[]
    // true: Es sind andere Sätze als die, die das Modell beim letzten Ableiten bekommen hat
    geaendert: boolean
  }
  // was der letzte Lauf am Plan davor geändert hat; null: Es gab keinen Plan davor
  aenderungen: ZielGraphAenderungen | null
  // wie viele offene Tickets das Ticket-System nennt, die es beim letzten Ableiten noch
  // nicht gab: Sie gehören zu keinem Bündel
  neueTickets: number
  // wann zuletzt von der Platte gelesen wurde, in Millisekunden; 0: noch nie
  gelesen: number
}

// Wo der Lauf steht. 'nie': in dieser Session wurde noch nicht abgeleitet.
export type ZielGraphLauf = {
  phase: 'nie' | 'laeuft' | 'fertig' | 'fehler'
  // wann der Lauf begonnen hat, in Millisekunden; 0: noch nie
  seit: number
  // wie lange er schon läuft, in ganzen Sekunden
  sekunden: number
  // warum der letzte Lauf gescheitert ist; '' wenn er das nicht ist
  grund: string
}

// ---------- Die laufenden Chats ----------

// Welches Ticket-System ein Repo nutzt. 'keine': der Mod läuft ohne Tickets.
export type ZielGraphTracker = 'gitlab' | 'github' | 'markdown' | 'keine'

// Ein laufender Chat, so wie er als Datei je Session auf dem Rechner liegt.
export type ZielGraphChat = {
  // die id der Session
  id: string
  name: string
  // false: per Knopf herausgenommen, der Chat bleibt draußen
  aktiv: boolean
  branch: string
  stand: string
  naechster: string
  // die Frage, auf die der Chat vom Nutzer wartet; '' wenn er auf nichts wartet
  frage: string
  // wann der Stand zuletzt geschrieben wurde, in Millisekunden; 0: noch nie
  zeit: number
  // Ticketnummer ohne '#', wenn Branch oder erster Auftrag eine nennen
  ticket?: string
  // Titel des Tickets aus dem Ticket-System; '' wenn dort keiner zu finden war
  ticketTitel?: string
}

// Die Chats eines Repos, wie beide Ansichten sie zeigen: wer wartet, steht oben.
export type ZielGraphChats = {
  // die id der eigenen Session
  ich: string
  chats: ZielGraphChat[]
  // wann die Dateien gelesen wurden, in Millisekunden; 0: noch nie
  gelesen: number
}

// ---------- Die zwei Ansichten ----------

// Was der Nutzer in der schmalen Ansicht `/graph` eingestellt hat.
export type ZielGraphGraphSicht = {
  ansicht: ZielGraphAnsicht
  // ids der aufgeklappten Zeilen
  offen: string[]
}

// Was der Nutzer in der breiten Ansicht `/orchestrator` eingestellt hat.
export type ZielGraphKartenSicht = {
  // der Schlüssel der gewählten Karte; '' wenn keine gewählt ist
  wahl: string
  farben: ZielGraphFarben
}

// Versuch: der letzte Versand einer Antwort an einen wartenden Chat.
export type ZielGraphAntwort = {
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
    'ziel-graph': {
      geladen: ZielGraphGeladen
      chats: ZielGraphChats
      // wann die Chats zuletzt gelesen wurden, in Millisekunden, auch wenn sich dabei nichts
      // geändert hat. Nur die schmale Ansicht liest es: So laufen ihre Zeitangaben weiter.
      uhr: number
      lauf: ZielGraphLauf
      graph: ZielGraphGraphSicht
      karten: ZielGraphKartenSicht
      antwort: ZielGraphAntwort
    }
  }
}
