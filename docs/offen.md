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
- **„Wartet auf“ als Text, Linie nur zwischen zwei Bahnen.** Worauf ein Bündel wartet, steht in seiner zweiten Zeile. Eine Linie zeichnet der Graph nur, wenn das Ziel in einer anderen Bahn liegt, egal ob weiter oben oder unten. Anlass: Im Versuch zum Ableiten kreuzten sechs Linien die Bahnen, fünf davon zeigten nur auf den Schritt davor in derselben Bahn. Entscheidung 15 der Spezifikation ist angepasst.
- **Aussehen des Graphen: Entwurf „Ruhig“** (gewählt am 2026-10-05 aus vier Entwürfen). Das Bild ist 500 statt 420 Pixel breit, die Bahnen stehen 26 statt 18 Pixel auseinander, Schrift und Punkte sind etwa ein Fünftel größer. Der Pfeil zum Aufklappen ist ein echter Knopf rechts am Ende der Zeile, in einem freien Platz im Bild. „Hinter uns“ zeigt je Bahn eine Zeile „<Bahn>: n erledigt“, aufgeklappt stehen die erledigten Bündel einzeln da. Grund für den freien Platz: Die App setzt Knöpfe nur auf ganze Zeichenbreiten (eine Zelle ist in der Desktop-App rund 7,8 Pixel breit), auf den Punkt genau vor einen Buchstaben geht es nicht.
- **`GOAL.md` hält das Ziel fest** (entschieden am 2026-10-05). Eine Datei `GOAL.md` in der Wurzel des Projekt-Repos nennt das Endziel, wenn es eines gibt, die Zwischenziele auf dem Weg, soweit bekannt, und je Strang das größere Ziel, das dieser Strang verfolgt. Ein Strang ist das, was die Spezifikation eine Bahn nennt; mehrere Aufgaben können demselben Strang-Ziel dienen, etwa einer neuen Basis, von der aus weitergearbeitet wird. Was noch nicht klar ist, bleibt offen und füllt sich mit der Zeit. Damit ist `GOAL.md` die Zielliste aus Entscheidung 1 der Spezifikation. Der Mod liest sie als wichtigste Quelle. Fehlt sie, sagt er das und bietet an, sie mit dem Chat zu entwerfen. Hat ein Strang kein Ziel, sagt er auch das und bietet an, es festzulegen. Der Mod schreibt die Datei nie selbst; das tut der Chat auf Zuruf des Nutzers.
- **Ein Mod, ein Plan, zwei Ansichten** (2026-10-05, beim Bau von Punkt 1 und 2 der Liste unten; ändert die Entscheidung darunter). Der Orchestrator ist kein eigener Mod mehr, sondern die zweite Ansicht des Mods `ziel-graph`: `/graph` zeigt den Plan schmal als Graph, `/orchestrator` breit als Prozesskarten. Grund: Zwei getrennt installierte Mods können keinen Code teilen; zwei Ableitungen ergäben zwei verschiedene Pläne. Chats, `GOAL.md`, Ableiten und Plan gibt es jetzt genau einmal. Der Graph zeichnet den echten Plan im Aussehen „Ruhig“, die erfundenen Beispieldaten sind aus der Leiste verschwunden. Version 0.3.0.
- **Ziel-Graph und Orchestrator nebeneinander** (entschieden am 2026-10-05). Der Ziel-Graph bleibt die schmale Ansicht in jedem Chat. Der Orchestrator wird ein zweiter Mod mit der großen Karten-Ansicht, aus der man arbeitet. Er wird in einem Worktree gebaut und liest die Chat-Stände, die der Ziel-Graph schreibt.
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
| 6 · Chats in den Graphen | bauen, dann testen | Gebaut am 2026-10-04, Tests grün. In der App läuft es in einem Repo ohne Tickets: Leiste, Knöpfe und der Stand nach einer Antwort. Offen: ein Repo mit Tracker. |
| 7 · Drei Versuche | Wegwerf-Mods | Karte mitten im Chat; Werkzeug durchsetzen; Ableiten mit dem Modell. |
| 8 · Fertig bauen | bauen, dann testen | Graph mit Zielliste, Festlegungen, Ableiten und allen vier Quellen; die Karten. |

Gebaut wird in einer Session auf dem privaten Rechner, direkt in diesem Repo. Ein zweiter Rechner holt nur ab und testet.

## Was noch zu bauen ist

Vorschlag vom 2026-10-05, die Reihenfolge ist noch nicht entschieden. Er ersetzt die Schritte 5 bis 8 des Fahrplans oben. Stand: Der installierte Ziel-Graph (0.2.1) zeigt echte Chats, aber als Graph nur Beispieldaten. Ableiten, das Aussehen „Ruhig“, die Streifen mit Pfeil-Knopf und die Pfeilspitzen stecken nur im lokalen Versuch `versuche/ableiten-versuch`. Der Orchestrator (0.1.0) ist installiert und in der App noch nicht angesehen.

| Nr. | Was | Warum | Größe |
| --- | --- | --- | --- |
| 1 | Ziel-Graph auf den echten Plan umstellen: Ableiten, „Ruhig“, Streifen, Pfeil-Knopf und Pfeilspitzen aus dem Versuch übernehmen; Chats an ihre Zeile hängen | Der installierte Graph zeigt sonst weiter erfundene Daten | groß |
| 2 | Ein Plan für beide Mods: eine Ableitung, ein Speicherort, `GOAL.md` als Anker auch im Graphen | Heute leiten Graph und Orchestrator getrennt ab und können zwei verschiedene Pläne zeigen | mittel |
| 3 | Orchestrator nach dem ersten Test in der App nachbessern | Spalten, Breite und der Versuch „von hier antworten“ sind ungesehen | klein bis mittel |
| 4 | Festlegungen, der vorige Plan als Eingabe, und nach jedem Ableiten zeigen, was sich geändert hat | Zwei Läufe ergaben zwei verschiedene Bilder; `GOAL.md` hält nur die Stränge fest, nicht die Schritte | mittel |
| 5 | Tickets als Quelle: GitLab, GitHub, Markdown; Stand live aus dem Tracker ohne Modell-Aufruf | Getestet ist nur ein Repo mit guter Doku; mit Tickets wird der Stand genau | groß |
| 6 | Fragen eines Chats im Orchestrator: die echte Rückfrage abfangen, als Bild aufbereiten, dort beantworten | Das sind die Entscheidungskarten; sie gehören eher in den Orchestrator als in einen dritten Mod. Die Grilling-Themen D, E und F gelten dafür weiter | groß |
| 7 | Chats aufräumen: fertige Chats erkennen und herausnehmen | Ein fertiger Chat bleibt mit seiner letzten Frage stehen, bis zu 14 Tage | klein |
| 8 | Dauerläufer ein- und ausklappen, Zuständigkeit je Bahn | Entscheidungen 6 bis 8 und 14 der Spezifikation, noch nicht gebaut | mittel |
| 9 | Aufräumen: den Versuch nach dem Übernehmen löschen, `UEBERGABE.md` ablösen | Beides ist dann überholt | klein |

Kein Bau, aber offen: Test 4 am zweiten Rechner (zeichnet ein zugeschaltetes Gerät die Leiste?) und Test 5 in einem Repo mit Tracker.

## Noch zu testen

1. **Graph in der echten Leiste.** Erscheint er nach `/graph`, passt die Breite, scrollt er, gehen Knöpfe und Farbwahl?
   - 2026-10-04, privater Rechner, Desktop-App: bestanden. `/graph` wird als Befehl erkannt und meldet „Ziel-Graph geöffnet“. Die Leiste erscheint mit farbigen Bahnen und grün hinterlegter Zone, sie bleibt nicht leer. Breite, Scrollen, Knöpfe und Farbwahl nennt der Nutzer „fürs Erste“ in Ordnung; im Einzelnen durchgeprüft ist das nicht. Gezeigt werden wie geplant die Beispieldaten.
   - 2026-10-04, Version 0.2.1, Desktop-App: `/graph` antwortet „Ziel-Graph geöffnet. (Oberflächen: desktop)“. Die Leiste zeigt die Zeile mit der Zahl der Chats, den Hinweis „Noch kein Plan“ und die Knöpfe. „Diesen Chat aufnehmen“ und „Diesen Chat herausnehmen“ funktionieren. Die Datei des Chats liegt unter `~/.claude/ziel-graph/github.com+tzy197+claude-mods/`; der Schlüssel aus der Adresse von `origin` stimmt also. Der Stand nach einer Antwort kam ebenfalls, siehe Test 2. Auch der Knopf „Beispiel-Graph zeigen“ funktioniert. Test bestanden.
2. **Sonnet 5.5 für den Chat-Stand.** Wird die Modell-Kennung `claude-sonnet-5-5` angenommen?
   - 2026-10-04, Version 0.2.1, Desktop-App: bestanden. Nach der nächsten Antwort stand der Chat mit einem vom Modell vergebenen Namen, mit Stand, „Weiter: …“ und „Wartet auf dich: …“ in der Leiste, und die Kopfzeile zählte „1 Chat, 1 wartet auf dich“. Die Leiste hat sich dabei von selbst erneuert, ohne „Neu laden“.
3. **Installation aus dem Repo.** Laden Mods mit Function Hooks über den Marketplace genauso wie aus einem lokalen Ordner?
   - 2026-10-04, privater Rechner: `claude plugin marketplace add Tzy197/claude-mods` und `claude plugin install ziel-graph@claude-mods` liefen ohne Fehler, der Mod steht als „enabled“ in der Liste (Version 0.1.0). Ohne SSH-Schlüssel holt die Engine das Repo von selbst über HTTPS. Nach dem Neustart der App laden die Hooks: `/graph` ist da und die Leiste wird gezeichnet. Test bestanden.
4. **Zugeschaltetes Gerät.** Beobachtet: Slash-Befehle laufen, die Leiste erscheint nicht. Ursache ungeklärt. Das ist jetzt der einzige Test zu zwei Rechnern, denn der Nutzer arbeitet dort immer zugeschaltet.
   - Hinweis aus der Typdatei der Engine: Die Hooks laufen auf dem Rechner, der die Session führt; ein zugeschaltetes Gerät zeichnet nur. Eine Leiste zeichnet es nur, wenn seine Oberfläche Leisten unterstützt. Die Handy-App tut das nicht. `$.ui.open` meldet dann `isPlaced: false` mit Grund. Zu prüfen ist also, welche Oberfläche und welche App-Fassung am zugeschalteten Rechner läuft.
5. **Repo ohne GitLab.** Läuft der Graph dort, ohne zu stören?
6. **Karte mitten im Chat.** Erscheint eine gezeichnete Karte im Verlauf, und schickt ein Knopf die Antwort ab?
7. **Werkzeug durchsetzen.** Benutzt ein Chat das Werkzeug „Entscheidung zeigen“ verlässlich, wenn der Mod es vorgibt?
8. **Ableiten.** Wie gut trifft das Modell Bündel und Bahnen in einem echten Repo, und wie lange dauert ein Lauf?
   - 2026-10-04, Wegwerf-Mod `ableiten-versuch` in diesem Repo (keine Tickets; Quellen: 5 Markdown-Dateien, 1 Chat, 3 Commits): bestanden für den Teil des Modells. Ein einziger Aufruf von `claude-sonnet-5-5` brauchte 30 s (18 648 Tokens hinein, 4 942 heraus) und lieferte gültiges JSON nach Vorschrift, ohne eine einzige Reparatur. Ergebnis: 3 Bahnen (Ziel-Graph, Entscheidungskarten, Zwei Rechner), 14 Bündel in den drei Zonen, ein Treffpunkt. Jede Zeile nennt ihre Quelle; beim Nachlesen fand sich nichts Erfundenes. Was das Modell nur schließt, hat es als „vermutet“ markiert, vor allem die Reihenfolge innerhalb einer Bahn. Der laufende Chat landete auf dem richtigen Bündel.
   - Schwächen: Endziel und Treffpunkt sind Worte des Modells, weil es noch keine Zielliste gibt. Fast jedes „wartet auf“ zeigt auf das Bündel davor in derselben Bahn.
   - Befund zur Zeichnung: Die dünnen Linien für „wartet auf“ sind für ein Ziel weiter unten gebaut. In einem echten Plan liegt das Ziel meist weiter oben; dann kreuzen die Linien die Bahnen und der Graph wird unruhig.
   - Behoben am 2026-10-04 in `plugins/ziel-graph/hooks/zeichnen.ts`: Derselbe Lauf, neu gezeichnet, hat noch eine Linie statt sechs.
   - Zweiter Lauf am selben Abend (34 s, wieder ohne Reparatur, nichts erfunden): dieselben 3 Bahnen, aber ein anders formuliertes Endziel, 15 statt 14 Bündel, mehrere Bündel anders benannt oder anders geschnitten, und ein Bündel wanderte von „später“ nach „jetzt möglich“. Befund: Ohne feste Zielliste, Festlegungen und den vorigen Plan als Eingabe ist das Ergebnis jedes Mal ein etwas anderes Bild. Für die Übersicht ist das zu unruhig; die Bauschritte 3 und 4 müssen das lösen.
   - Aufklappen an der Zeile, in der Desktop-App gesehen: Der Graph lässt sich in Streifen je Zeile zerlegen (jeder Streifen dasselbe Bild mit eigenem Ausschnitt); die Streifen stoßen ohne Spalt aneinander. Ein echter Knopf lässt sich mit `position: "absolute"` je Zeile setzen. Offen: den Knopf über das Bild an die Stelle des Dreiecks legen.
   - Der Versuch liegt lokal unter `versuche/ableiten-versuch/` und wird nicht hochgeladen. Jeder Lauf steht mit Eingabe und roher Antwort unter `~/.claude/ziel-graph-versuch/<schlüssel>/`.

## Idee: Orchestrator-Ansicht mit Prozesskarten

Vom Nutzer am 2026-10-05 eingebracht; der Bau als eigener Mod ist am selben Tag entschieden, siehe oben. Gebaut am 2026-10-05 als `plugins/orchestrator` (0.1.0): `validate`, 43 Tests und die Typprüfung grün; in der echten App noch nicht angesehen. Was er tut und wie `GOAL.md` aussieht, steht in `docs/orchestrator.md`. Beim Versuch „von hier antworten“ nimmt der empfangende Chat nur an, was die Engine als vom Orchestrator verschickt ausweist: So kann sich das Modell eines anderen Chats nicht als Nutzer ausgeben. Ein Chat ist der Orchestrator; seine Leiste wird groß gezogen und zeigt den Plan als Karten: je Bahn eine Spalte, je Zone ein Band, Verbindungen dazwischen. Fragen aus anderen Chats landen dort und lassen sich dort beantworten, ohne den Chat zu wechseln. Damit fielen Ziel-Graph, Entscheidungskarten und das Antworten an einem Ort zusammen. Ein Entwurf liegt lokal unter `versuche/entwuerfe/orchestrator-idee.html`.

Was die Typdatei der Engine dazu sagt:

- Geht: Karten und Verbindungen als Bild, ein echter Knopf je Karte, Antwort-Knöpfe, ein Textfeld (`Input`, nicht im Terminal), ein Auftrag ins Eingabefeld (`$.prompt.fill`) oder gleich abgeschickt (`$.prompt.submit`).
- Braucht einen Versuch: eine Antwort in einen anderen laufenden Chat schicken (`$.session.send`, dort `session.receive`); die Rückfrage eines Chats abfangen (`tool.call` auf `AskUserQuestion`) und im Orchestrator zeigen; wie groß sich die Leiste ziehen lässt.
- Geht nicht: Karten verschieben, zoomen, auf die Karte selbst klicken, einen neuen Chat aus der Leiste öffnen, ein Vollbild erzwingen (`$.ui.open` kennt nur gewünschte Zeilen und Spalten).

## Noch zu grillen

- **B · Zwei Rechner.** Erledigt am 2026-10-04: Nichts wandert, siehe oben. Offen bleibt nur Test 4.
- **C · Zugeschaltetes Gerät bei Karten.** Zurückgestellt; beantwortet sich nach Fahrplan-Schritt 4 und Test 6 weitgehend.
- **D · Feste Formen der Karte.** Reicht Vorher/Nachher, oder braucht es auch Ablauf und Tabelle? Wohin mit markierten Bildausschnitten?
- **E · Antworten per Knopf.** Was schickt der Knopf, gibt es eine freie Antwort, eine Frage auf einmal oder mehrere?
- **F · Karte und eingebaute Rückfrage.** Ersetzt die Karte die Rückfrage der App, oder zeichnet der Mod sie nur reicher?
