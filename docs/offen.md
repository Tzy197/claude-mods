# Offen: Entscheidungen, Fahrplan, Tests, Grilling

Stand: 2026-10-04. Gilt für alle Mods in diesem Repo. Das Pfad-Board ist im Ziel-Graph aufgegangen und am 2026-10-04 aus dem Repo entfernt worden.

## Entschieden am 2026-10-04

- **Der Graph braucht keine Tickets.** Er nimmt, was ein Repo hat. Ein Ticket-System bleibt die Empfehlung, weil der Stand dann genauer ist.
- **Jedes Ticket-System zählt:** GitLab, GitHub oder Tickets als Markdown-Dateien, so wie die mattpocock-Skills es halten.
- **Ohne Plan** zeigt der Graph nur die laufenden Chats.
- **Karten kommen immer, wenn eine Entscheidung ansteht, die etwas verändert,** nicht nur im Grilling. Sie zeigen konkret und ohne Technik, was sich wirklich ändert: vorher, nachher, Empfehlung.
- **Jeder Modell-Aufruf läuft mit Sonnet 5.5.**
- **Lizenz: MIT.** Der Text steht in `LICENSE`.
- **Commits tragen die GitHub-Adresse ohne Postfach,** nicht die private Adresse. Das ist je Rechner im Repo einzustellen (`git config user.email`), bevor dort committet wird.
- **Nichts wandert zwischen Rechnern.** Der Nutzer arbeitet am zweiten Rechner immer zugeschaltet (Remote-Session). Der Rechner mit dem Repo führt die Session: Dort laufen die Hooks, dort liegen Chat-Stände und abgeleiteter Plan. Chats, die nur auf dem anderen Rechner leben, gibt es nicht. Entscheidung 9 der Spezifikation bleibt, ein Abgleich wird nicht gebaut.
- **Nur ein Befehl: `/graph`.** Den Befehl `/pfad` gibt es nicht mehr. Ein Chat ohne eigenen Branch und ohne Ticket kommt über den Knopf „Diesen Chat aufnehmen“ in die Leiste, „Diesen Chat herausnehmen“ nimmt ihn wieder heraus. Den Namen gibt das Modell nach der ersten Antwort; von Hand umbenennen geht nicht mehr. Von selbst meldet sich weiter nur ein Chat mit eigenem Branch oder Ticket an, damit nicht jeder kleine Chat einen Modell-Aufruf kostet.
- **Verworfen: Chat-Stände über den Git-Server teilen.** Im Grilling durchgespielt (eigene Spur `refs/ziel-graph/staende`, je Projekt einzuschalten) und als unnötig erkannt. Falls es doch einmal gebraucht wird: Mit einfachem Git lief die Technik in einem lokalen Versuch, GitLab nimmt solche Spuren laut Quellcode an, für GitHub fehlt ein Beleg. Wer das Projekt lesen darf, könnte die Stände dann holen.

## Woher der Graph seine Schritte nimmt

| Das Repo hat | Der Graph liest | Wie genau ist der Stand |
| --- | --- | --- |
| GitLab | Tickets, Labels, Verknüpfungen über `glab` | genau: bereit, blockiert und erledigt kommen live |
| GitHub | Tickets und Labels über `gh` | genau; was GitHub für „wartet auf“ bietet, ist nachzulesen |
| Tickets als Markdown | Dateien unter `.scratch/<vorhaben>/issues/`, Karte in `.scratch/<vorhaben>/map.md` | genau, soweit die Dateien gepflegt sind |
| keine Tickets | die laufenden Chats und die Doku im Repo | grob: das Modell leitet die Schritte ab und markiert sie als vermutet |

Welches System ein Repo nutzt, steht bei den mattpocock-Skills in `docs/agents/issue-tracker.md` (erste Zeile: `# Issue tracker: GitLab`, `GitHub` oder `Local Markdown`). Der Mod liest diese Datei. Fehlt sie, schaut er auf den Git-Remote; passt nichts, gilt „keine Tickets“.

Bei Tickets als Markdown heißen die Dateien `.scratch/<vorhaben>/issues/<NN>-<name>.md` und sind je Vorhaben ab `01` nummeriert. Eine Nummer allein ist also nicht eindeutig: Der Mod nimmt den Titel nur, wenn genau eine Datei passt. Für spätere Bauschritte heißt das: Ein Ticket braucht dort Vorhaben und Nummer.

Dazu je Repo eine kleine Einstellung mit Vorgabe: Welches Label heißt bereit, blockiert, wartet auf Auskunft, Ziel-Karte? Die Daten eines Repos brauchen einen eindeutigen Schlüssel, nicht nur den Ordnernamen.

## Fahrplan

| Schritt | Wer, wo | Was wir danach wissen |
| --- | --- | --- |
| 1 · Repo auf GitHub | Nutzer, privater Rechner | Erledigt am 2026-10-04: öffentlich unter `Tzy197/claude-mods`. |
| 2 · Am privaten Rechner installieren | Nutzer | Erledigt am 2026-10-04: Der Mod lädt aus dem Marketplace, nach `/graph` erscheint die Leiste. |
| 3 · Am zweiten Rechner installieren | Nutzer | Dasselbe dort: Breite, Scrollen, Knöpfe, Farben. |
| 4 · Über Kreuz schauen | Nutzer, beide | Zeichnet ein Rechner die Leiste einer Session, die auf dem anderen läuft? |
| 5 · Rest grillen | gemeinsam | Zwei Rechner: erledigt. Offen sind die Karten: feste Formen, Antworten per Knopf, Verhältnis zur eingebauten Rückfrage. |
| 6 · Chats in den Graphen | bauen, dann testen | Gebaut am 2026-10-04, Tests grün. Offen: in der App ansehen, in einem Repo mit Tracker und in einem ohne Tickets. |
| 7 · Drei Versuche | Wegwerf-Mods | Karte mitten im Chat; Werkzeug durchsetzen; Ableiten mit dem Modell. |
| 8 · Fertig bauen | bauen, dann testen | Graph mit Zielliste, Festlegungen, Ableiten und allen vier Quellen; die Karten. |

Gebaut wird in einer Session auf dem privaten Rechner, direkt in diesem Repo. Ein zweiter Rechner holt nur ab und testet.

## Noch zu testen

1. **Graph in der echten Leiste.** Erscheint er nach `/graph`, passt die Breite, scrollt er, gehen Knöpfe und Farbwahl?
   - 2026-10-04, privater Rechner, Desktop-App: bestanden. `/graph` wird als Befehl erkannt und meldet „Ziel-Graph geöffnet“. Die Leiste erscheint mit farbigen Bahnen und grün hinterlegter Zone, sie bleibt nicht leer. Breite, Scrollen, Knöpfe und Farbwahl nennt der Nutzer „fürs Erste“ in Ordnung; im Einzelnen durchgeprüft ist das nicht. Gezeigt werden wie geplant die Beispieldaten.
2. **Sonnet 5.5 für den Chat-Stand.** Wird die Modell-Kennung `claude-sonnet-5-5` angenommen?
3. **Installation aus dem Repo.** Laden Mods mit Function Hooks über den Marketplace genauso wie aus einem lokalen Ordner?
   - 2026-10-04, privater Rechner: `claude plugin marketplace add Tzy197/claude-mods` und `claude plugin install ziel-graph@claude-mods` liefen ohne Fehler, der Mod steht als „enabled“ in der Liste (Version 0.1.0). Ohne SSH-Schlüssel holt die Engine das Repo von selbst über HTTPS. Nach dem Neustart der App laden die Hooks: `/graph` ist da und die Leiste wird gezeichnet. Test bestanden.
4. **Zugeschaltetes Gerät.** Beobachtet: Slash-Befehle laufen, die Leiste erscheint nicht. Ursache ungeklärt. Das ist jetzt der einzige Test zu zwei Rechnern, denn der Nutzer arbeitet dort immer zugeschaltet.
   - Hinweis aus der Typdatei der Engine: Die Hooks laufen auf dem Rechner, der die Session führt; ein zugeschaltetes Gerät zeichnet nur. Eine Leiste zeichnet es nur, wenn seine Oberfläche Leisten unterstützt. Die Handy-App tut das nicht. `$.ui.open` meldet dann `isPlaced: false` mit Grund. Zu prüfen ist also, welche Oberfläche und welche App-Fassung am zugeschalteten Rechner läuft.
5. **Repo ohne GitLab.** Läuft der Graph dort, ohne zu stören?
6. **Karte mitten im Chat.** Erscheint eine gezeichnete Karte im Verlauf, und schickt ein Knopf die Antwort ab?
7. **Werkzeug durchsetzen.** Benutzt ein Chat das Werkzeug „Entscheidung zeigen“ verlässlich, wenn der Mod es vorgibt?
8. **Ableiten.** Wie gut trifft das Modell Bündel und Bahnen in einem echten Repo, und wie lange dauert ein Lauf?

## Noch zu grillen

- **B · Zwei Rechner.** Erledigt am 2026-10-04: Nichts wandert, siehe oben. Offen bleibt nur Test 4.
- **C · Zugeschaltetes Gerät bei Karten.** Zurückgestellt; beantwortet sich nach Fahrplan-Schritt 4 und Test 6 weitgehend.
- **D · Feste Formen der Karte.** Reicht Vorher/Nachher, oder braucht es auch Ablauf und Tabelle? Wohin mit markierten Bildausschnitten?
- **E · Antworten per Knopf.** Was schickt der Knopf, gibt es eine freie Antwort, eine Frage auf einmal oder mehrere?
- **F · Karte und eingebaute Rückfrage.** Ersetzt die Karte die Rückfrage der App, oder zeichnet der Mod sie nur reicher?
