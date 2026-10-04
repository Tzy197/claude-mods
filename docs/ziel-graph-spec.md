# Ziel-Graph: Spezifikation

Stand: 2026-10-04. Ergebnis eines Grillings mit 16 Entscheidungen. Gebaut ist Schritt 1 von 5.
Diese Datei ist die Quelle für jeden Chat, der weiterbaut. Sie nennt bewusst keine Inhalte eines bestimmten Projekts.

## Zweck

Der Ziel-Graph zeigt in der Seitenleiste, wo ein Projekt steht: welches Endziel verfolgt wird, welche Wege dorthin parallel laufen, wo sie zusammenfallen, was jetzt möglich ist und was noch wartet. Er löst das Pfad-Board ab, das nur die laufenden Chats zeigt, und übernimmt dessen Wissen über die Chats.

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
4. **Chats im Graphen.** Hat ein Chat ein Ticket, bestimmt das Ticket seinen Platz. Sonst ordnet das Modell ihn einem Ziel zu. Ein Chat, der an mehreren Zielen arbeitet, steht als „übergreifend“ neben dem Graphen. Der Befehl `/pfad` legt den Platz von Hand fest.
5. **Parallele Wege.** Eine Bahn ist keine Kette. Mehrere Wege dürfen nebeneinander laufen, auch wenn sie fachlich zusammengehören. Abhängigkeiten gelten zwischen einzelnen Zielen, und Wege fallen in Treffpunkten zusammen.
6. **Lebenslauf.** Alles startet als Ziel. Hat es seine Basis erreicht, wird es zum Dauerläufer. Ohne Aktivität klappt ein Dauerläufer zu einer Zeile ein. Neue Aktivität klappt ihn wieder auf. Steht ein großer Umbau an, wird ein Dauerläufer wieder zum Ziel.
7. **Basis erreicht.** Den Übergang vom Ziel zum Dauerläufer schlägt der Agent vor, der Nutzer bestätigt. Die Antwort ist eine Festlegung. Der Rückweg läuft genauso.
8. **Aktiv.** Ein Dauerläufer ist aktiv, wenn ein Chat an ihm hängt oder in den letzten 7 Tagen ein Ticket geschlossen wurde. Offene Tickets allein und bloßes Anfassen (Label, Kommentar) zählen nicht.
9. **Speicherort.** Zielliste und Festlegungen liegen im Repo des Projekts. Der abgeleitete Plan und die Chat-Stände liegen lokal. Siehe „Offene Punkte“ zu zwei Rechnern.
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

Der Ziel-Graph löst das Pfad-Board ab (Entscheidung vom 2026-10-04). Was das Board über Chats weiß, wandert in den Graphen.

| Schritt | Inhalt | Stand |
| --- | --- | --- |
| 1 · Nur zeichnen | Graph in der Leiste mit festen Beispieldaten, zwei Ansichten, Aufklappen, Filter, Ziel-Auswahl | gebaut; `validate` und 13 Tests grün; in der echten App noch nicht angesehen |
| 2 · Chats übernehmen | Aus dem Pfad-Board: Selbst-Anmeldung eines Chats, Stand nach jeder Antwort (Stand, nächster Schritt, offene Frage), Hinweis bei neuer Frage. Ohne Plan zeigt der Graph nur die laufenden Chats. | offen; der Code liegt in `plugins/pfad-board/hooks/register.tsx` |
| 3 · Zielliste und Festlegungen | Dateien, unterer Teil der Leiste (Vorschläge, Festlegungen, Eingabe), Sammeln bis zum Merge Request | offen |
| 4 · Ableiten | Knopf „Neu ableiten“: Bündel, Bahnen, „wartet auf“, Vorschläge | offen |
| 5 · Lebendig machen | Zustand live aus dem Tracker, eingeklappte Dauerläufer, Merge Request auf Zuruf | offen |

Aus dem Pfad-Board fallen weg: die eigene Leiste, `/board`, `/ziel` und das Ziel aus der Karte (die Zielliste ersetzt es). `/pfad` bleibt, um den Platz eines Chats von Hand festzulegen. Ist Schritt 2 fertig, wird `plugins/pfad-board` aus dem Repo entfernt.

In Schritt 1 ist die Stelle für Schritt 3 vorbereitet: `const DATEN = BEISPIEL` in `plugins/ziel-graph/hooks/register.tsx`. Die Form der Daten steht in `plugins/ziel-graph/types/index.d.ts`, die Zeichenlogik ohne Engine-Zugriff in `hooks/zeichnen.ts`.

## Offene Punkte

- **Zwei Rechner.** Chat-Stände und abgeleiteter Plan liegen je Rechner lokal. Wandert eine Session zwischen Rechnern, hat jeder Rechner ein eigenes Board. Entscheidung 9 muss dafür noch einmal angesehen werden.
- **Zugeschaltetes Gerät.** Beobachtet: Auf einem Gerät, das einer Session auf einem anderen Rechner zugeschaltet ist, laufen die Slash-Befehle, die Seitenleiste erscheint dort aber nicht. Ursache ungeklärt. `/board` meldet seit dieser Fassung, ob die Leiste gezeichnet wird, und nennt die verbundenen Oberflächen.
- **Aufklappen bei vielen Bündeln.** Schritt 1 nutzt je aufklappbarem Bündel einen Knopf über dem Bild. Mit vielen Bündeln wird das lang; eine Auswahl-Liste wäre die Alternative.
- **Hell und Dunkel.** Der Render-Aufruf verrät das Farbschema nicht. Schritt 1 bietet eine Auswahl Auto, Hell, Dunkel. Ob „Auto“ in der Desktop-App dem Thema folgt, ist ungeprüft.
- **Laden über einen Marketplace.** Ob Mods mit Function Hooks aus einem Marketplace genauso laden wie aus einem lokalen Ordner, ist ungeprüft.

## Was über die Mod-Schnittstelle gelernt wurde

- `claude plugin validate` verlangt, dass `$` nur an Funktionen gereicht wird, die auf Dateiebene deklariert sind.
- `Svg` gibt es auf Desktop, VS Code und Handy, nicht im Terminal. Es ist ein Bild: höchstens 131072 Zeichen, `alt` ist Pflicht, Klicks nimmt es nicht an. Bedienung geht nur über native `Button` und `Select`.
- Ein Baum, der nicht validiert, wird stillschweigend nicht gezeichnet. `claude plugin test` mit `mount` auf den Surfaces `desktop` und `terminal` fängt das.
- Ein Mod darf an mehreren Stellen zeichnen: Seitenleiste (`Pane`), Band über dem Eingabefeld (`AbovePrompt`), mitten im Chat (`ToolUse`, `ToolResult`, `CommandOutput`, `AskUserQuestion`).
- Ein Mod aus `~/.claude/skills/<name>` lädt beim Start der App. Eine Änderung greift erst nach dem Neustart.
- Der Mods-Ordner einer Session lädt nur, nachdem die Person „Enable hot reloading for this session“ bestätigt hat.
- `$.process.run` startet `git` und `glab` ohne Shell. `$.model.complete` macht einen einzelnen Modell-Aufruf ohne Verlauf. `$.store` und Dateien unter `~/.claude` sind je Rechner.
