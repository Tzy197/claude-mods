# Ziel-Graph: Spezifikation

Stand: 2026-10-04. Ergebnis eines Grillings mit 16 Entscheidungen. Gebaut sind die Schritte 1 und 2 von 5; Schritt 2 ist in der echten App noch nicht angesehen.
Diese Datei ist die Quelle für jeden Chat, der weiterbaut. Sie nennt bewusst keine Inhalte eines bestimmten Projekts.

## Zweck

Der Ziel-Graph zeigt in der Seitenleiste, wo ein Projekt steht: welches Endziel verfolgt wird, welche Wege dorthin parallel laufen, wo sie zusammenfallen, was jetzt möglich ist und was noch wartet. Er hat das frühere Pfad-Board abgelöst, das nur die laufenden Chats zeigte, und dessen Wissen über die Chats übernommen.

## Begriffe

| Begriff | Bedeutung |
| --- | --- |
| Endziel | Das eine übergeordnete Ziel, in das alles mündet. |
| Ziel | Etwas mit einem Ende. Es muss ins Hauptprodukt und mündet in einen Treffpunkt oder ins Endziel. |
| Dauerläufer | Etwas ohne Ende. Es läuft als Bahn neben den Zielen her und endet in einem Pfeil statt in einem Punkt. |
| Lieferung | Ein einzelnes Stück eines Dauerläufers mit einem Ende. Es zeigt auf den Punkt, den es beeinflusst. |
| Bahn | Die farbige Linie eines Ziels oder Dauerläufers. Bahnen sind zugleich die festen Kategorien. |
| Bündel | Eine Zeile im Graphen: das, was ein Chat zusammen erledigen würde. Enthält ein oder mehrere Tickets. |
| Treffpunkt | Ein Punkt, an dem mehrere Bahnen zusammenfallen. Er wird erst möglich, wenn alle Wege davor fertig sind. |
| Zone | Einer von drei Abschnitten von oben nach unten: hinter uns, jetzt möglich, später. |
| Zielliste | Die feste Liste der Ziele und Dauerläufer. Vom Nutzer bestätigt. |
| Festlegung | Ein Satz des Nutzers, der bei jedem Ableiten gewinnt. |
| Vorschlag | Eine Frage des ableitenden Agenten an den Nutzer, mit Ja oder Nein beantwortet. |
| Ableiten | Der Lauf, in dem ein Agent aus Tickets, Verknüpfungen, Zielliste, Festlegungen und Chat-Ständen den Plan baut. |

## Entscheidungen

1. **Feste Zielliste.** Der Agent schlägt die Ziele einmal vor, der Nutzer bestätigt und benennt sie. Danach ordnet der Agent nur noch zu. Ein neues Ziel meldet er als Vorschlag. Ziele dürfen in der Liste stehen, auch wenn es noch keine Tickets für sie gibt.
2. **Endziel.** Es gibt genau ein Endziel. Der letzte fachliche Schritt davor ist ein eigenes Ziel. Auch Bahnen für Werkzeug und Tests münden ins Endziel.
3. **Festlegungen.** Korrekturen des Nutzers werden als eigene Sätze gespeichert, nicht durch Ändern der abgeleiteten Plan-Datei. Sie gewinnen bei jedem Ableiten. Nach jedem Ableiten zeigt die Leiste, was sich geändert hat.
4. **Chats im Graphen.** Hat ein Chat ein Ticket, bestimmt das Ticket seinen Platz. Sonst ordnet das Modell ihn einem Ziel zu. Ein Chat, der an mehreren Zielen arbeitet, steht als „übergreifend“ neben dem Graphen. Den Platz legt der Nutzer in der Leiste von Hand fest; einen Befehl `/pfad` gibt es seit dem 2026-10-04 nicht mehr.
5. **Parallele Wege.** Eine Bahn ist keine Kette. Mehrere Wege dürfen nebeneinander laufen, auch wenn sie fachlich zusammengehören. Abhängigkeiten gelten zwischen einzelnen Zielen, und Wege fallen in Treffpunkten zusammen.
6. **Lebenslauf.** Alles startet als Ziel. Hat es seine Basis erreicht, wird es zum Dauerläufer. Ohne Aktivität klappt ein Dauerläufer zu einer Zeile ein. Neue Aktivität klappt ihn wieder auf. Steht ein großer Umbau an, wird ein Dauerläufer wieder zum Ziel.
7. **Basis erreicht.** Den Übergang vom Ziel zum Dauerläufer schlägt der Agent vor, der Nutzer bestätigt. Die Antwort ist eine Festlegung. Der Rückweg läuft genauso.
8. **Aktiv.** Ein Dauerläufer ist aktiv, wenn ein Chat an ihm hängt oder in den letzten 7 Tagen ein Ticket geschlossen wurde. Offene Tickets allein und bloßes Anfassen (Label, Kommentar) zählen nicht.
9. **Speicherort.** Zielliste und Festlegungen liegen im Repo des Projekts. Der abgeleitete Plan und die Chat-Stände liegen lokal, auf dem Rechner, der die Session führt. Am 2026-10-04 bestätigt: Zwischen Rechnern wandert nichts.
10. **Darstellung.** Hochkant und scrollbar wie ein Git-Graph: Bahnen links, je Zeile ein Bündel mit Namen rechts.
11. **Hauptansicht.** Die Hauptansicht „Schritte“ zeigt die Bündel über alle Ziele in den drei Zonen. Ein Dropdown filtert auf ein Ziel. Die zweite Ansicht „Übersicht“ zeigt je Zeile ein ganzes Ziel und wird per Umschalter gewählt.
12. **Bündel.** Eine Zeile ist ein Bündel, nie ein einzelnes Ticket. Die Zeile zeigt den Fortschritt („3 von 8 bereit“), Aufklappen zeigt die Tickets. Falsche Bündel korrigiert eine Festlegung.
13. **Filter und Kategorien.** Bahnen und Personen lassen sich ausblenden. Ausgeblendetes steht als eine Zeile „Ausgeblendet: …“. Die Kategorien sind die Bahnen der Zielliste. Bereichs-Labels aus dem Tracker sind der stärkste Hinweis für die Zuordnung.
14. **Zuständigkeit.** Eine Festlegung je Bahn sagt, wer sie macht. Ein einzelnes Bündel darf abweichen. Ist ein Ticket im Tracker einer Person zugewiesen, gewinnt die Zuweisung.
15. **Wartet auf.** Eine Blockade-Verknüpfung im Tracker gilt zuerst. Fehlt sie, liest das Modell den Grund aus Ticket-Text und Chat-Ständen und markiert ihn als „vermutet“. Ein teilweise blockiertes Bündel zeigt einen halb gefüllten Punkt, den Grund und eine dünne Linie zu dem Schritt, auf den es wartet.
16. **Eingabe.** Vorschläge bestätigt der Nutzer in der Leiste mit Ja oder Nein, Festlegungen gibt er dort als Satz ein. Beides gilt sofort im Board und liegt erst lokal. Die Leiste zeigt, wie viele Festlegungen noch nicht im Repo sind. Auf Knopfdruck legt ein Chat einen Merge Request an. Den Merge beauftragt der Nutzer selbst.

## Bestätigte Annahmen

- Abgeleitet wird nur per Knopf, nie von selbst.
- Jeder Modell-Aufruf läuft mit Sonnet 5.5: das Ableiten, der Platz eines Chats und die Zusammenfassung des Chat-Stands. Haiku wird nicht verwendet.
- Beim Ableiten liest der Agent alle offenen und die zuletzt geschlossenen Tickets, die Ziel-Karten, die Verknüpfungen, die Zielliste, die Festlegungen und die Chat-Stände. Die Projekt-Doku liest er nur beim ersten Vorschlag der Zielliste.
- Erledigt, bereit und blockiert kommen bei jedem Öffnen frisch aus dem Tracker, ohne Modell-Aufruf.
- Tickets, die auf eine Auskunft von außen warten, stehen in der Zone „später“ mit diesem Grund.
- Wo Zielliste und Festlegungen im Projekt-Repo liegen, wird beim Bauen vorgeschlagen und vor dem ersten Merge Request gezeigt.

## Zeichen im Graphen

| Zeichen | Bedeutung |
| --- | --- |
| gefüllter Punkt, durchgezogene Bahn | liegt hinter uns |
| Ring mit Kern | läuft in einem Chat |
| leerer Ring | bereit und frei |
| halb gefüllter Punkt | teilweise blockiert |
| kleiner blasser Punkt | blockiert |
| größerer Punkt in eigener Farbe | Treffpunkt |
| Doppelring | Endziel |
| gepunktete Bahn | muss noch gemacht werden |
| Pfeil am Ende der Bahn | Dauerläufer, kein Ende |
| dünne gestrichelte Linie | „wartet auf“ |
| Marke „Chat“, mit auffälligem Punkt | ein Chat arbeitet hier; er wartet auf den Nutzer |

## Bauschritte

Der Ziel-Graph hat das Pfad-Board abgelöst (Entscheidung vom 2026-10-04). Was das Board über Chats wusste, steckt seit Schritt 2 im Graphen.

| Schritt | Inhalt | Stand |
| --- | --- | --- |
| 1 · Nur zeichnen | Graph in der Leiste mit festen Beispieldaten, zwei Ansichten, Aufklappen, Filter, Ziel-Auswahl | gebaut; `validate` und 13 Tests grün; am 2026-10-04 in der Desktop-App angesehen, die Leiste erscheint |
| 2 · Chats übernehmen | Aus dem Pfad-Board: Selbst-Anmeldung eines Chats, Stand nach jeder Antwort (Stand, nächster Schritt, offene Frage), Hinweis bei neuer Frage. Ohne Plan zeigt der Graph nur die laufenden Chats. | gebaut am 2026-10-04 (Version 0.2.1); `validate`, 38 Tests und die Typprüfung grün; in der echten App noch nicht angesehen. Die Chat-Logik liegt in `plugins/ziel-graph/hooks/chats.ts`. Anders als das Pfad-Board öffnet der Mod die Leiste nicht von selbst; sie kommt mit `/graph`. Aufnehmen und Herausnehmen eines Chats geht per Knopf in der Leiste. |
| 3 · Zielliste und Festlegungen | Dateien, unterer Teil der Leiste (Vorschläge, Festlegungen, Eingabe), Sammeln bis zum Merge Request | offen |
| 4 · Ableiten | Knopf „Neu ableiten“: Bündel, Bahnen, „wartet auf“, Vorschläge | offen |
| 5 · Lebendig machen | Zustand live aus dem Tracker, eingeklappte Dauerläufer, Merge Request auf Zuruf | offen |

Aus dem Pfad-Board sind weggefallen: die eigene Leiste, `/board`, `/ziel`, `/pfad` und das Ziel aus der Karte (die Zielliste ersetzt es). Am 2026-10-04 wurde `plugins/pfad-board` aus dem Repo entfernt. Sein Code steht noch im ersten Commit (`cdb2fab`).

In Schritt 1 ist die Stelle für Schritt 3 vorbereitet: `const DATEN = BEISPIEL` in `plugins/ziel-graph/hooks/register.tsx`. Die Form der Daten steht in `plugins/ziel-graph/types/index.d.ts`, die Zeichenlogik ohne Engine-Zugriff in `hooks/zeichnen.ts`.

## Offene Punkte

- **Zwei Rechner.** Geklärt am 2026-10-04: Der Nutzer arbeitet am zweiten Rechner immer zugeschaltet. Der Rechner mit dem Repo führt die Session und hat alle Daten. Ein Abgleich ist nicht nötig, Entscheidung 9 bleibt.
- **Zugeschaltetes Gerät.** Beobachtet: Auf einem Gerät, das einer Session auf einem anderen Rechner zugeschaltet ist, laufen die Slash-Befehle, die Seitenleiste erscheint dort aber nicht. Ursache ungeklärt. `/graph` meldet, ob die Leiste gezeichnet wird, und nennt die verbundenen Oberflächen. Laut Typdatei zeichnet ein zugeschaltetes Gerät eine Leiste nur, wenn seine Oberfläche Leisten unterstützt; die Handy-App tut das nicht.
- **Aufklappen bei vielen Bündeln.** Schritt 1 nutzt je aufklappbarem Bündel einen Knopf über dem Bild. Mit vielen Bündeln wird das lang; eine Auswahl-Liste wäre die Alternative.
- **Hell und Dunkel.** Der Render-Aufruf verrät das Farbschema nicht. Schritt 1 bietet eine Auswahl Auto, Hell, Dunkel. Ob „Auto“ in der Desktop-App dem Thema folgt, ist ungeprüft.
- **Laden über einen Marketplace.** Geprüft am 2026-10-04: Ein Mod mit Function Hooks lädt aus dem Marketplace, sobald die App neu gestartet ist.

## Was über die Mod-Schnittstelle gelernt wurde

- `claude plugin validate` verlangt, dass `$` nur an Funktionen gereicht wird, die auf Dateiebene deklariert sind, und zwar in derselben Datei: Über einen Import hinweg folgt `validate` dem `$` nie. Logik in einer zweiten Datei bekommt deshalb ein Objekt aus einfachen Funktionen (`ChatZugang` in `hooks/chats.ts`), das `register.tsx` aus `$` baut.
- `validate` prüft nicht, ob es eine Methode auf `$` gibt. Das fängt nur die Typprüfung mit `tsc` gegen die Typdatei der Engine; die `tsconfig.json` dafür steht im Kopf der Typdatei.
- `Svg` gibt es auf Desktop, VS Code und Handy, nicht im Terminal. Es ist ein Bild: höchstens 131072 Zeichen, `alt` ist Pflicht, Klicks nimmt es nicht an. Bedienung geht nur über native `Button` und `Select`.
- Ein Baum, der nicht validiert, wird stillschweigend nicht gezeichnet. `claude plugin test` mit `mount` auf den Surfaces `desktop` und `terminal` fängt das.
- Ein Mod darf an mehreren Stellen zeichnen: Seitenleiste (`Pane`), Band über dem Eingabefeld (`AbovePrompt`), mitten im Chat (`ToolUse`, `ToolResult`, `CommandOutput`, `AskUserQuestion`).
- Ein Mod aus `~/.claude/skills/<name>` lädt beim Start der App. Eine Änderung greift erst nach dem Neustart.
- Der Mods-Ordner einer Session lädt nur, nachdem die Person „Enable hot reloading for this session“ bestätigt hat.
- Die Hooks laufen auf dem Rechner, der die Session führt. Ein zugeschaltetes Gerät fragt den gezeichneten Baum nur ab und zeichnet ihn dort, wo es einen Platz dafür hat.
- `$.session.repo()` liefert neben dem Ordner auch `remote`, die Adresse von `origin`. Sie taugt als eindeutiger Schlüssel für ein Repo, anders als der Ordnername.
- `$.state` gilt je Session und übersteht ein Neuladen des Mod-Codes. `$.store` ist eine Datei je Mod und je Rechner.
- `$.process.run` startet `git` und `glab` ohne Shell. `$.model.complete` macht einen einzelnen Modell-Aufruf ohne Verlauf. `$.store` und Dateien unter `~/.claude` sind je Rechner.
