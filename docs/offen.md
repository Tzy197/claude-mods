# Offen: Entscheidungen, Stand, Bau, Tests, Grilling

Stand: 2026-10-05, Ziel-Graph 0.6.0. Gilt für alle Mods in diesem Repo. Die 16 Entscheidungen aus dem Grilling stehen in `docs/ziel-graph-spec.md`, die Beschreibung des Mods in `docs/orchestrator.md`.

## 1 · Entschieden

Am 2026-10-04, wo kein anderes Datum steht.

- **Der Graph braucht keine Tickets.** Er nimmt, was ein Repo hat. Ein Ticket-System bleibt die Empfehlung, weil der Stand dann genauer ist.
- **Jedes Ticket-System zählt:** GitLab, GitHub oder Tickets als Markdown-Dateien, so wie die mattpocock-Skills es halten.
- **Ohne Plan** zeigt der Graph nur die laufenden Chats.
- **Karten kommen immer, wenn eine Entscheidung ansteht, die etwas verändert,** nicht nur im Grilling. Sie zeigen konkret und ohne Technik, was sich wirklich ändert: vorher, nachher, Empfehlung.
- **Jeder Modell-Aufruf läuft mit Sonnet 5.5.**
- **Lizenz: MIT.** Der Text steht in `LICENSE`.
- **Commits tragen die GitHub-Adresse ohne Postfach,** nicht die private Adresse. Das ist je Rechner im Repo einzustellen (`git config user.email`), bevor dort committet wird.
- **Nichts wandert zwischen Rechnern.** Der Nutzer arbeitet am zweiten Rechner immer zugeschaltet (Remote-Session). Der Rechner mit dem Repo führt die Session: Dort laufen die Hooks, dort liegen Chat-Stände und abgeleiteter Plan. Chats, die nur auf dem anderen Rechner leben, gibt es nicht. Entscheidung 9 der Spezifikation bleibt, ein Abgleich wird nicht gebaut.
- **Gebaut wird auf dem privaten Rechner,** in einer Session, direkt in diesem Repo. Ein zweiter Rechner holt nur ab und testet.
- **Kein Befehl `/pfad`, ein Chat kommt per Knopf in die Leiste.** Ein Chat ohne eigenen Branch und ohne Ticket kommt über den Knopf „Diesen Chat aufnehmen“ in die Leiste, „Diesen Chat herausnehmen“ nimmt ihn wieder heraus. Den Namen gibt das Modell nach der ersten Antwort; von Hand umbenennen geht nicht mehr. Von selbst meldet sich weiter nur ein Chat mit eigenem Branch oder Ticket an, damit nicht jeder kleine Chat einen Modell-Aufruf kostet. Entschieden als „Nur ein Befehl: `/graph`“. Seit dem 2026-10-05 gibt es daneben `/orchestrator` für die breite Ansicht.
- **„Wartet auf“ als Text, Linie nur zwischen zwei Bahnen.** Worauf ein Bündel wartet, steht in seiner zweiten Zeile. Eine Linie zeichnet der Graph nur, wenn das Ziel in einer anderen Bahn liegt, egal ob weiter oben oder unten. Anlass: Im Versuch zum Ableiten kreuzten sechs Linien die Bahnen, fünf davon zeigten nur auf den Schritt davor in derselben Bahn. Entscheidung 15 der Spezifikation ist angepasst. Seit dem 2026-10-05 trägt die Linie zwei Pfeilspitzen.
- **Aussehen des Graphen: Entwurf „Ruhig“** (gewählt am 2026-10-05 aus vier Entwürfen). Das Bild ist 500 statt 420 Pixel breit, die Bahnen stehen 26 statt 18 Pixel auseinander, Schrift und Punkte sind etwa ein Fünftel größer. Der Pfeil zum Aufklappen ist ein echter Knopf rechts am Ende der Zeile, in einem freien Platz im Bild. „Hinter uns“ zeigt je Bahn eine Zeile „<Bahn>: n erledigt“, aufgeklappt stehen die erledigten Bündel einzeln da. Grund für den freien Platz: Die App setzt Knöpfe nur auf ganze Zeichenbreiten (eine Zelle ist in der Desktop-App rund 7,8 Pixel breit), auf den Punkt genau vor einen Buchstaben geht es nicht.
- **`GOAL.md` hält das Ziel fest** (entschieden am 2026-10-05). Eine Datei `GOAL.md` in der Wurzel des Projekt-Repos nennt das Endziel, wenn es eines gibt, die Zwischenziele auf dem Weg, soweit bekannt, und je Strang das größere Ziel, das dieser Strang verfolgt. Ein Strang ist das, was die Spezifikation eine Bahn nennt; mehrere Aufgaben können demselben Strang-Ziel dienen, etwa einer neuen Basis, von der aus weitergearbeitet wird. Was noch nicht klar ist, bleibt offen und füllt sich mit der Zeit. Damit ist `GOAL.md` die Zielliste aus Entscheidung 1 der Spezifikation. Der Mod liest sie als wichtigste Quelle. Fehlt sie, sagt er das und bietet an, sie mit dem Chat zu entwerfen. Hat ein Strang kein Ziel, sagt er auch das und bietet an, es festzulegen. Der Mod schreibt die Datei nie selbst; das tut der Chat auf Zuruf des Nutzers.
- **Ein Mod, ein Plan, zwei Ansichten** (2026-10-05, beim Bau von Version 0.3.0). Der Mod `ziel-graph` hat einen Plan und zeigt ihn zweimal: `/graph` schmal als Graph in jedem Chat, `/orchestrator` breit als Prozesskarten, aus denen man arbeitet. Chats, `GOAL.md`, Ableiten und Plan gibt es genau einmal. Der Graph zeichnet den echten Plan im Aussehen „Ruhig“, die erfundenen Beispieldaten sind aus der Leiste verschwunden. Das ersetzt die Entscheidung vom selben Tag, den Orchestrator als zweiten Mod neben den Ziel-Graph zu stellen: in einem Worktree gebaut, mit den Chat-Ständen des Ziel-Graphen als Quelle. So war er als `plugins/orchestrator` 0.1.0 gebaut. Grund für den Wechsel: Zwei getrennt installierte Mods können keinen Code teilen, und zwei Ableitungen ergäben zwei verschiedene Pläne. Die Idee der großen Ansicht kam am 2026-10-05 vom Nutzer: Dort sollen auch Fragen aus anderen Chats landen und sich beantworten lassen, ohne den Chat zu wechseln.
- **Verworfen: Chat-Stände über den Git-Server teilen.** Im Grilling durchgespielt (eigene Spur `refs/ziel-graph/staende`, je Projekt einzuschalten) und als unnötig erkannt. Falls es doch einmal gebraucht wird: Mit einfachem Git lief die Technik in einem lokalen Versuch, GitLab nimmt solche Spuren laut Quellcode an, für GitHub fehlt ein Beleg. Wer das Projekt lesen darf, könnte die Stände dann holen.

Was der Bau am 2026-10-05 darüber hinaus gesetzt hat, steht unter „Gebaut“ und in der Spezifikation bei der jeweiligen Entscheidung.

### Woher der Plan seine Schritte nimmt

Entschieden am 2026-10-04. Die Tabelle zeigt es so, wie es seit 0.5.0 gebaut ist.

| Das Repo hat | Der Mod liest | Wie genau ist der Stand |
| --- | --- | --- |
| GitHub | die offenen und die zuletzt geschlossenen Tickets mit Labels über `gh` | genau: erledigt, bereit und blockiert kommen bei jedem Laden frisch. Was GitHub für „wartet auf“ bietet, liest der Mod nicht |
| GitLab | dasselbe über `glab` | gebaut wie bei GitHub, aber ungetestet. Die Verknüpfungen zu lesen war geplant und ist nicht gebaut |
| Tickets als Markdown | Dateien unter `.scratch/<vorhaben>/issues/` | genau, soweit die Dateien gepflegt sind. Die Karte in `.scratch/<vorhaben>/map.md` zu lesen war geplant und ist nicht gebaut |
| keine Tickets | `GOAL.md`, die Doku im Repo, die laufenden Chats und die Commits | grob: das Modell leitet die Schritte ab und markiert als vermutet, was es nur schließt |

Welches System ein Repo nutzt, steht bei den mattpocock-Skills in `docs/agents/issue-tracker.md` (erste Zeile: `# Issue tracker: GitLab`, `GitHub` oder `Local Markdown`). Der Mod liest diese Datei. Fehlt sie, schaut er auf den Git-Remote; passt nichts, gilt „keine Tickets“.

Bei Tickets als Markdown heißen die Dateien `.scratch/<vorhaben>/issues/<NN>-<name>.md` und sind je Vorhaben ab `01` nummeriert. Eine Nummer allein ist also nicht eindeutig: Für den Titel am Chat nimmt der Mod sie nur, wenn genau eine Datei passt. Im Plan heißt ein solches Ticket nach Vorhaben und Nummer, zum Beispiel `kasse/03`.

Welches Label blockiert oder wartet auf Auskunft heißt und womit Bereichs-Labels beginnen, kann `GOAL.md` im Abschnitt „Tracker“ sagen; sonst gilt eine Vorgabe. Ein Label für bereit und eines für Ziel-Karten, am 2026-10-04 mitgedacht, gibt es nicht. Die Daten eines Repos liegen unter einem eindeutigen Schlüssel aus der Adresse von `origin`, nicht unter dem Ordnernamen.

## 2 · Gebaut und wie geprüft

Je Zeile steht, wie geprüft wurde: mit `validate`, Tests und Typprüfung, mit echten Antworten von Sonnet 5.5 außerhalb der App, oder in der App. In der App angesehen ist nur der Stand bis 0.2.1.

- **0.1.0, 2026-10-04: Graph mit Beispieldaten.** `validate` und 13 Tests grün. In der Desktop-App angesehen, siehe Test 1.
- **Repo und Marketplace, 2026-10-04.** Das Repo ist öffentlich unter `Tzy197/claude-mods`. Der Mod lädt aus dem Marketplace, nach `/graph` erscheint die Leiste, siehe Test 3.
- **0.2.0 und 0.2.1, 2026-10-04: echte Chats in der Leiste.** Selbst-Anmeldung, Stand nach jeder Antwort, Hinweis bei neuer Frage; mit 0.2.1 fiel `/pfad` weg. Das Pfad-Board ist damit abgelöst und aus Repo und Marketplace entfernt. `validate`, 38 Tests und die Typprüfung grün. In der App läuft es in einem Repo ohne Tickets: Leiste, Knöpfe und der Stand nach einer Antwort, siehe Tests 1 und 2.
- **Orchestrator 0.1.0, 2026-10-05: die Karten-Ansicht als eigener Mod `plugins/orchestrator`.** `validate`, 43 Tests und die Typprüfung grün; in der echten App noch nicht angesehen. Mit 0.3.0 im Ziel-Graph aufgegangen.
- **0.3.0, 2026-10-05: ein Mod, ein Plan, zwei Ansichten** (Punkt 1 und 2 des Vorschlags vom 2026-10-05). Siehe „Entschieden“. `validate`, 127 Tests und die Typprüfung grün. Geprüft mit zwei echten Antworten von Sonnet 5.5 für dieses Repo, außerhalb der App durch den Code des Mods geschickt: gültiges JSON, keine Reparatur. Mit einer Probe-`GOAL.md` hat das Modell die drei Stränge und das Endziel wörtlich übernommen, die Zwischenziele auf den Stamm gesetzt und den Strang ohne Ziel als solchen stehen lassen. In der App noch nicht angesehen.
- **0.4.0, 2026-10-05: der Plan bleibt stehen** (Punkt 4). Festlegungen (Abschnitt `## Festlegungen` in `GOAL.md`, neue zuerst lokal unter `plan/festlegungen.json`, Eingabe in `/orchestrator`), der vorige Plan als Eingabe, und nach jedem Ableiten die Liste der Änderungen. `validate`, 149 Tests und die Typprüfung grün. Geprüft mit zwei weiteren echten Läufen: Beim Fortschreiben blieben alle 13 Bündel mit id und Titel Zeichen für Zeichen stehen; geändert hat sich nur, was sich in den Quellen geändert hatte (drei Bündel). Zwei Festlegungen („… gehört zum Strang Orchestrator“, „… kommt erst nach …“) wurden genau befolgt, sonst änderte sich nichts. Damit ist der Befund „jeder Lauf ein anderes Bild“ aus Test 8 behoben. Die Grenzen für die Doku sind auf 24 000 Zeichen je Datei und 96 000 insgesamt gestiegen, weil `docs/offen.md` dieses Repos schon abgeschnitten wurde.
- **0.5.0, 2026-10-05: Tickets als Quelle** (Punkt 5). GitHub über `gh issue list`, GitLab über `glab api`, Markdown-Dateien unter `.scratch/<vorhaben>/issues/`. Die Tickets gehen als eigener Block an das Modell; ein Bündel nennt seine Tickets und seinen Fortschritt. Beim Laden und bei „Neu laden“ liest der Mod die Tickets neu und rechnet den Stand je Bündel ohne Modell-Aufruf nach. Ein Abschnitt `## Tracker` in `GOAL.md` kann die Namen der Labels nennen. `validate`, 167 Tests und die Typprüfung grün. Geprüft: Die echte Ausgabe von `gh` (130 Tickets eines öffentlichen Repos, nur gelesen) liest der Mod richtig. Ein echter Lauf von Sonnet 5.5 mit einem erfundenen Shop und neun Markdown-Tickets ergab sechs Bündel; jedes Ticket lag in genau einem, Erledigtes stand hinter uns, „Blocked by“ wurde zu „wartet auf“ das richtige Bündel, das Ticket mit `needs-info` stand unter „später“ mit dem Grund. Nicht geprüft: GitLab, das gibt es auf diesem Rechner nicht; dieser Zweig ist nur gegen nachgestellte Ausgaben getestet. Die Verknüpfungen zwischen Tickets liest der Mod nur aus deren Text, nicht über die Schnittstelle des Trackers.
- **0.6.0, 2026-10-05: fertige Chats gehen von selbst, Dauerläufer ruhen** (Punkt 7 und 8). Fertige Chats: Die Zusammenfassung nach jeder Antwort sagt jetzt auch, ob der Chat fertig ist, im Zweifel nein. Ein fertiger Chat steht noch 24 Stunden blass unter den anderen, danach ist er ausgeblendet; ein Chat ohne neue Antwort ist nach 7 Tagen ausgeblendet (bisher 14). Ausgeblendet heißt nicht gelöscht: Eine Zeile nennt die Zahl, ein Knopf zeigt sie. Dauerläufer: `GOAL.md` kann je Strang `Art: Dauerläufer` und `Wer: <Name>` nennen. Ein Dauerläufer ohne laufenden Chat und ohne in den letzten 7 Tagen geschlossenes Ticket ruht und klappt zu einer Zeile oder Karte zusammen. Hat ein Ziel-Strang alles erledigt, bietet der Mod an, ihn mit dem Chat zum Dauerläufer zu machen. `validate`, 190 Tests und die Typprüfung grün. Geprüft mit Sonnet 5.5 an drei erfundenen Fällen: fertig nur dort, wo wirklich nichts mehr offen war; bei einer Frage an den Nutzer und mitten in der Arbeit nicht. Nicht gebaut: der Rückweg vom Dauerläufer zum Ziel und ein Filter nach Personen (Entscheidungen 6 und 13).
- **Aufgeräumt, 2026-10-05** (Punkt 9). Der Wegwerf-Versuch `versuche/ableiten-versuch` ist übernommen und gelöscht, `UEBERGABE.md` neu geschrieben, die Doku geordnet. `validate` und die 190 Tests liefen danach noch einmal grün.

Ein Fahrplan vom 2026-10-04 hatte acht Schritte. Die Schritte 1, 2 und 6 sind erledigt und stehen oben, die Schritte 3 und 4 sind die Tests 13 und 4, den Rest hat der Vorschlag vom 2026-10-05 ersetzt.

## 3 · Noch zu bauen

Der Vorschlag vom 2026-10-05 hatte neun Punkte. Gebaut sind 1, 2, 4, 5, 7, 8 und 9. Offen sind zwei Punkte und das, was die Schritte ausgelassen haben.

- **Karten-Ansicht nach dem ersten Blick in der App nachbessern** (Punkt 3). Spalten, Breite und der Versuch „von hier antworten“ sind ungesehen. Größe: klein bis mittel.
- **Fragen eines Chats in der Karten-Ansicht** (Punkt 6). Die echte Rückfrage abfangen, als Bild aufbereiten, dort beantworten. Das sind die Entscheidungskarten; die Grilling-Themen D, E und F gelten dafür weiter. Größe: groß. Was die Typdatei der Engine dazu sagt:
  - Geht: Karten und Verbindungen als Bild, ein echter Knopf je Karte, Antwort-Knöpfe, ein Textfeld (`Input`, nicht im Terminal), ein Auftrag ins Eingabefeld (`$.prompt.fill`) oder gleich abgeschickt (`$.prompt.submit`).
  - Braucht einen Versuch: eine Antwort in einen anderen laufenden Chat schicken (`$.session.send`, dort `session.receive`), als Versuch gebaut, siehe Test 10; die Rückfrage eines Chats abfangen (`tool.call` auf `AskUserQuestion`) und in der Karten-Ansicht zeigen, nicht gebaut; wie groß sich die Leiste ziehen lässt.
  - Geht nicht: Karten verschieben, zoomen, auf die Karte selbst klicken, einen neuen Chat aus der Leiste öffnen, ein Vollbild erzwingen (`$.ui.open` kennt nur gewünschte Zeilen und Spalten).
- **Vorschläge des Modells mit Ja oder Nein** (Entscheidungen 1, 7 und 16). Was das Modell außerhalb von `GOAL.md` findet, markiert der Mod und bietet den Knopf zum Festlegen an.
- **Merge Request auf Knopfdruck** (Entscheidung 16). Den Eintrag in `GOAL.md` macht der Chat auf Zuruf.
- **Rückweg vom Dauerläufer zum Ziel** (Entscheidungen 6 und 7). Wer ihn will, schreibt `Art: Ziel` in `GOAL.md`.
- **Filter nach Bahnen und Personen und die Auswahl eines Ziels in `/graph`** (Entscheidungen 11 und 13). Bis 0.2.1 gab es sie am Beispiel-Graphen, dazu eine Farbwahl. Seit 0.3.0 bietet die Leiste nichts davon an; die Zeichenlogik kann Filter und Auswahl noch.
- **Ziel-Karten und Verknüpfungen zwischen Tickets** (Entscheidung 15). Der Mod liest nur Labels und die Zeile „Blocked by“ im Text.
- **Einen Chat von Hand einem Bündel zuordnen oder als „übergreifend“ zeigen** (Entscheidung 4). Den Platz ordnet das Modell beim Ableiten zu.

Ein Entwurf der Karten-Ansicht liegt lokal unter `versuche/entwuerfe/orchestrator-idee.html`.

## 4 · Noch zu testen

1. **Graph in der echten Leiste.** Erscheint er nach `/graph`, passt die Breite, scrollt er, gehen Knöpfe und Farbwahl?
   - 2026-10-04, privater Rechner, Desktop-App: bestanden. `/graph` wird als Befehl erkannt und meldet „Ziel-Graph geöffnet“. Die Leiste erscheint mit farbigen Bahnen und grün hinterlegter Zone, sie bleibt nicht leer. Breite, Scrollen, Knöpfe und Farbwahl nennt der Nutzer „fürs Erste“ in Ordnung; im Einzelnen durchgeprüft ist das nicht. Gezeigt werden wie geplant die Beispieldaten.
   - 2026-10-04, Version 0.2.1, Desktop-App: `/graph` antwortet „Ziel-Graph geöffnet. (Oberflächen: desktop)“. Die Leiste zeigt die Zeile mit der Zahl der Chats, den Hinweis „Noch kein Plan“ und die Knöpfe. „Diesen Chat aufnehmen“ und „Diesen Chat herausnehmen“ funktionieren. Die Datei des Chats liegt unter `~/.claude/ziel-graph/github.com+tzy197+claude-mods/`; der Schlüssel aus der Adresse von `origin` stimmt also. Der Stand nach einer Antwort kam ebenfalls, siehe Test 2. Auch der Knopf „Beispiel-Graph zeigen“ funktioniert. Test bestanden.
   - Seit 0.3.0 zeigt die Leiste den echten Plan, den Beispiel-Graphen gibt es nicht mehr. Das ist Test 9.
2. **Sonnet 5.5 für den Chat-Stand.** Wird die Modell-Kennung `claude-sonnet-5-5` angenommen?
   - 2026-10-04, Version 0.2.1, Desktop-App: bestanden. Nach der nächsten Antwort stand der Chat mit einem vom Modell vergebenen Namen, mit Stand, „Weiter: …“ und „Wartet auf dich: …“ in der Leiste, und die Kopfzeile zählte „1 Chat, 1 wartet auf dich“. Die Leiste hat sich dabei von selbst erneuert, ohne „Neu laden“.
3. **Installation aus dem Repo.** Laden Mods mit Function Hooks über den Marketplace genauso wie aus einem lokalen Ordner?
   - 2026-10-04, privater Rechner: `claude plugin marketplace add Tzy197/claude-mods` und `claude plugin install ziel-graph@claude-mods` liefen ohne Fehler, der Mod steht als „enabled“ in der Liste (Version 0.1.0). Ohne SSH-Schlüssel holt die Engine das Repo von selbst über HTTPS. Nach dem Neustart der App laden die Hooks: `/graph` ist da und die Leiste wird gezeichnet. Test bestanden.
4. **Zugeschaltetes Gerät.** Offen. Beobachtet: Slash-Befehle laufen, die Leiste erscheint nicht. Ursache ungeklärt. Das ist der einzige Test zu zwei Rechnern über Kreuz, denn der Nutzer arbeitet dort immer zugeschaltet.
   - Hinweis aus der Typdatei der Engine: Die Hooks laufen auf dem Rechner, der die Session führt; ein zugeschaltetes Gerät zeichnet nur. Eine Leiste zeichnet es nur, wenn seine Oberfläche Leisten unterstützt. Die Handy-App tut das nicht. `$.ui.open` meldet dann `isPlaced: false` mit Grund. Zu prüfen ist also, welche Oberfläche und welche App-Fassung am zugeschalteten Rechner läuft.
5. **Repo ohne GitLab.** Läuft der Graph dort, ohne zu stören?
   - 2026-10-04, Version 0.2.1: In der App läuft es in einem Repo ohne Tickets: Leiste, Knöpfe und der Stand nach einer Antwort. Offen: ein Repo mit Tracker, siehe Test 11.
6. **Karte mitten im Chat.** Offen. Erscheint eine gezeichnete Karte im Verlauf, und schickt ein Knopf die Antwort ab?
7. **Werkzeug durchsetzen.** Offen. Benutzt ein Chat das Werkzeug „Entscheidung zeigen“ verlässlich, wenn der Mod es vorgibt?
8. **Ableiten.** Wie gut trifft das Modell Bündel und Bahnen in einem echten Repo, und wie lange dauert ein Lauf?
   - 2026-10-04, Wegwerf-Mod `ableiten-versuch` in diesem Repo (keine Tickets; Quellen: 5 Markdown-Dateien, 1 Chat, 3 Commits): bestanden für den Teil des Modells. Ein einziger Aufruf von `claude-sonnet-5-5` brauchte 30 s (18 648 Tokens hinein, 4 942 heraus) und lieferte gültiges JSON nach Vorschrift, ohne eine einzige Reparatur. Ergebnis: 3 Bahnen (Ziel-Graph, Entscheidungskarten, Zwei Rechner), 14 Bündel in den drei Zonen, ein Treffpunkt. Jede Zeile nennt ihre Quelle; beim Nachlesen fand sich nichts Erfundenes. Was das Modell nur schließt, hat es als „vermutet“ markiert, vor allem die Reihenfolge innerhalb einer Bahn. Der laufende Chat landete auf dem richtigen Bündel.
   - Schwächen: Endziel und Treffpunkt sind Worte des Modells, weil es noch keine Zielliste gibt. Fast jedes „wartet auf“ zeigt auf das Bündel davor in derselben Bahn.
   - Befund zur Zeichnung: Die dünnen Linien für „wartet auf“ sind für ein Ziel weiter unten gebaut. In einem echten Plan liegt das Ziel meist weiter oben; dann kreuzen die Linien die Bahnen und der Graph wird unruhig.
   - Behoben am 2026-10-04 in `plugins/ziel-graph/hooks/zeichnen.ts` (heute `hooks/graph/zeichnen.ts`): Derselbe Lauf, neu gezeichnet, hat noch eine Linie statt sechs.
   - Zweiter Lauf am selben Abend (34 s, wieder ohne Reparatur, nichts erfunden): dieselben 3 Bahnen, aber ein anders formuliertes Endziel, 15 statt 14 Bündel, mehrere Bündel anders benannt oder anders geschnitten, und ein Bündel wanderte von „später“ nach „jetzt möglich“. Befund: Ohne feste Zielliste, Festlegungen und den vorigen Plan als Eingabe ist das Ergebnis jedes Mal ein etwas anderes Bild. Für die Übersicht ist das zu unruhig; die Bauschritte 3 und 4 müssen das lösen. Gelöst mit `GOAL.md` und Version 0.4.0, siehe „Gebaut“.
   - Aufklappen an der Zeile, in der Desktop-App gesehen: Der Graph lässt sich in Streifen je Zeile zerlegen (jeder Streifen dasselbe Bild mit eigenem Ausschnitt); die Streifen stoßen ohne Spalt aneinander. Ein echter Knopf lässt sich mit `position: "absolute"` je Zeile setzen. Offen war: den Knopf über das Bild an die Stelle des Dreiecks legen. Entschieden mit dem Aussehen „Ruhig“: Der Knopf sitzt rechts am Ende der Zeile.
   - Der Versuch lag lokal unter `versuche/ableiten-versuch/` und wurde nicht hochgeladen. Er ist in Version 0.3.0 übernommen und gelöscht. Jeder seiner Läufe steht mit Eingabe und roher Antwort unter `~/.claude/ziel-graph-versuch/<schlüssel>/`.
9. **Beide Ansichten in der App, ab Version 0.3.0.** Offen: In der App ist davon noch nichts angesehen. Zu sehen sind in `/graph` der echte Plan in Streifen, der Pfeil-Knopf am rechten Rand, die Pfeilspitzen und die Zeile „ruht“. In `/orchestrator`: ob die Spalten bündig stehen, wie breit der Knopf „›“ ist, ob „Auto“ dem Farbschema folgt, wie breit sich die Leiste ziehen lässt, ob das Feld für eine Festlegung nach „Festlegen“ leer dasteht und wie die Karte „ruht“ aussieht.
10. **Versuch „von hier antworten“.** Offen: nur gegen die Test-Engine geprüft. Ob `$.session.send` eine andere Session der Desktop-App erreicht, ob die Engine vor dem Senden nachfragt, ob sie den Versand dort mit dem Mod-Namen `ziel-graph` ausweist und wie die andere Session den Prompt des Mods aufnimmt, zeigt erst die App.
11. **Tickets in einem echten Repo.** Offen für die App und für GitLab. Was außerhalb der App geprüft ist, steht bei 0.5.0.
    - GitHub: Offen ist ein Lauf in einem Repo mit eigenen Tickets. `gh issue list --state closed --limit 30` ordnet wohl nach dem Anlegen, nicht nach dem Schließen; nachgeprüft ist das nicht.
    - GitLab: ganz ungeprüft. `glab` war beim Bauen nicht installiert, die Felder stammen aus der Beschreibung der Schnittstelle. Offen ist auch, ob `glab api` `:id` in jedem Repo ersetzt und was es ohne Anmeldung ausgibt.
12. **Fertige Chats und Dauerläufer im Alltag.** Offen. Ob das Modell „fertig“ vorsichtig genug setzt, zeigt erst die App; geprüft sind drei erfundene Fälle, siehe 0.6.0. Dauerläufer sind nur gegen die Test-Engine geprüft.
13. **Am zweiten Rechner installieren.** Offen. Dasselbe wie Test 1 dort: Breite, Scrollen, Knöpfe, Farben.

## 5 · Noch zu entscheiden

Grilling zu den Entscheidungskarten, siehe `docs/entscheidungskarten-stand.md`:

- **B · Zwei Rechner.** Erledigt am 2026-10-04: Nichts wandert, siehe oben. Offen bleibt nur Test 4.
- **C · Zugeschaltetes Gerät bei Karten.** Zurückgestellt; beantwortet sich nach Test 4 und Test 6 weitgehend.
- **D · Feste Formen der Karte.** Reicht Vorher/Nachher, oder braucht es auch Ablauf und Tabelle? Wohin mit markierten Bildausschnitten?
- **E · Antworten per Knopf.** Was schickt der Knopf, gibt es eine freie Antwort, eine Frage auf einmal oder mehrere?
- **F · Karte und eingebaute Rückfrage.** Ersetzt die Karte die Rückfrage der App, oder zeichnet der Mod sie nur reicher?

Was der Bau offen gelassen hat:

- **Wohin die Entscheidungskarten gehören.** `docs/entscheidungskarten-stand.md` nennt sie einen eigenen Mod. Der Vorschlag vom 2026-10-05 sagt: eher in die Karten-Ansicht als in einen dritten Mod. Entschieden ist das nicht.
- **Reihenfolge der offenen Bauarbeiten.** Nicht entschieden.
- **Abweichungen von den Entscheidungen 4, 7, 14 und 16.** Der Bau hat sie gesetzt, siehe Spezifikation. Ob sie so bleiben, hat der Nutzer noch nicht bestätigt.
- **Wann Erledigtes aus dem Plan fällt.** Beim Fortschreiben bleibt jedes erledigte Bündel im Plan; bei 40 Bündeln ist Schluss.
- **Ob und wann Dateien alter Chats gelöscht werden.** Der Mod löscht keine; die Zahl der ausgeblendeten Chats wächst.
