# Ziel-Graph: Spezifikation

Stand: 2026-10-05, Version 0.6.0. Grundlage ist ein Grilling vom 2026-10-04 mit 16 Entscheidungen. Gebaut ist ein Mod mit einem Plan und zwei Ansichten. In der Desktop-App angesehen ist nur der Stand bis Version 0.2.1.
Diese Datei ist die Quelle für jeden Chat, der weiterbaut. Sie nennt bewusst keine Inhalte eines bestimmten Projekts. Wie der Mod im Einzelnen arbeitet, steht in `docs/orchestrator.md`. Was geprüft ist und was offen bleibt, steht in `docs/offen.md`.

## Zweck

Der Ziel-Graph zeigt, wo ein Projekt steht: welches Endziel verfolgt wird, welche Wege dorthin parallel laufen, wo sie zusammenfallen, was jetzt möglich ist und was noch wartet. Er hält dafür einen Plan je Repo und zeigt ihn in zwei Ansichten: `/graph` schmal als Graph, über dem die laufenden Chats stehen, und `/orchestrator` breit als Prozesskarten. Er hat das frühere Pfad-Board abgelöst, das nur die laufenden Chats zeigte, und dessen Wissen über die Chats übernommen.

## Begriffe

| Begriff | Bedeutung |
| --- | --- |
| Endziel | Das eine übergeordnete Ziel, in das alles mündet. |
| Zwischenziel | Ein Punkt auf dem Weg zum Endziel, den `GOAL.md` nennt. Dazugekommen am 2026-10-05. |
| Ziel | Etwas mit einem Ende. Es muss ins Hauptprodukt und mündet in einen Treffpunkt oder ins Endziel. |
| Dauerläufer | Etwas ohne Ende. Es läuft als Bahn neben den Zielen her und endet in einem Pfeil statt in einem Punkt. |
| Lieferung | Ein einzelnes Stück eines Dauerläufers mit einem Ende. Es zeigt auf den Punkt, den es beeinflusst. Nicht als eigene Sache gebaut: Auch ein Dauerläufer hat Bündel. |
| Bahn | Die farbige Linie eines Ziels oder Dauerläufers. Bahnen sind zugleich die festen Kategorien. |
| Strang | Dasselbe wie eine Bahn. So nennt `GOAL.md` sie, und so heißt die Spalte der Karten. |
| Bündel | Eine Zeile im Graphen und eine Karte: das, was ein Chat zusammen erledigen würde. Enthält ein oder mehrere Tickets, oder ohne Tickets mehrere kleine Aufgaben. |
| Treffpunkt | Ein Punkt, an dem mehrere Bahnen zusammenfallen. Er wird erst möglich, wenn alle Wege davor fertig sind. |
| Stamm | Der gemeinsame Weg bis zum Endziel. Auf ihm stehen die Zwischenziele oder der Treffpunkt, die Schritte danach und zuletzt das Endziel. |
| Zone | Einer von drei Abschnitten von oben nach unten: hinter uns, jetzt möglich, später. |
| Zielliste | Die feste Liste der Ziele und Dauerläufer. Vom Nutzer bestätigt. Seit dem 2026-10-05 ist das die Datei `GOAL.md`. |
| Festlegung | Ein Satz des Nutzers, der bei jedem Ableiten gewinnt. |
| Vorschlag | Eine Frage des ableitenden Agenten an den Nutzer, mit Ja oder Nein beantwortet. Nicht gebaut. |
| Plan | Was ein Ableiten ergibt: Stränge, Bündel in den drei Zonen, Stamm, Endziel und welcher Chat an welchem Bündel arbeitet. |
| Ableiten | Der Lauf, in dem ein Modell-Aufruf aus `GOAL.md`, Festlegungen, Tickets, Doku, Chat-Ständen, Commits und dem vorigen Plan den Plan baut. |

## Entscheidungen

Der Wortlaut ist der vom 2026-10-04. Darunter steht, was seither gilt und wie es gebaut ist.

1. **Feste Zielliste.** Der Agent schlägt die Ziele einmal vor, der Nutzer bestätigt und benennt sie. Danach ordnet der Agent nur noch zu. Ein neues Ziel meldet er als Vorschlag. Ziele dürfen in der Liste stehen, auch wenn es noch keine Tickets für sie gibt.
   - Seit 2026-10-05: Die Zielliste ist `GOAL.md` in der Wurzel des Projekt-Repos. Der Mod schreibt sie nie, der Chat entwirft sie auf Zuruf. Vorschläge gibt es nicht: Einen Strang, den das Modell außerhalb von `GOAL.md` findet, hängt der Mod hinten an und nennt ihn „nicht in GOAL.md“.
2. **Endziel.** Es gibt genau ein Endziel. Der letzte fachliche Schritt davor ist ein eigenes Ziel. Auch Bahnen für Werkzeug und Tests münden ins Endziel.
   - Seit 2026-10-05: Das Endziel steht wörtlich aus `GOAL.md` da. Fehlt es dort, zeigt der Mod das des Modells als „vermutet“. Die Bahn eines Dauerläufers mündet nicht ins Endziel, sie endet in einem Pfeil.
3. **Festlegungen.** Korrekturen des Nutzers werden als eigene Sätze gespeichert, nicht durch Ändern der abgeleiteten Plan-Datei. Sie gewinnen bei jedem Ableiten. Nach jedem Ableiten zeigt die Leiste, was sich geändert hat.
   - Gebaut am 2026-10-05 (0.4.0): Die Sätze stehen in `GOAL.md` unter „Festlegungen“ oder, solange sie neu sind, lokal. Sie gehen allem vor außer den Strängen und dem Endziel aus `GOAL.md`. Beide Ansichten zeigen nach jedem Ableiten, was sich geändert hat.
4. **Chats im Graphen.** Hat ein Chat ein Ticket, bestimmt das Ticket seinen Platz. Sonst ordnet das Modell ihn einem Ziel zu. Ein Chat, der an mehreren Zielen arbeitet, steht als „übergreifend“ neben dem Graphen. Den Platz legt der Nutzer in der Leiste von Hand fest; einen Befehl `/pfad` gibt es seit dem 2026-10-04 nicht mehr.
   - So gebaut am 2026-10-05 (0.3.0), anders als entschieden: Den Platz eines Chats ordnet immer das Modell beim Ableiten zu, auch wenn der Chat ein Ticket hat. Ein Chat ohne Bündel steht in `/orchestrator` unter „Chats ohne Karte“; „übergreifend“ gibt es nicht. Von Hand lässt sich ein Chat nur aufnehmen und herausnehmen.
5. **Parallele Wege.** Eine Bahn ist keine Kette. Mehrere Wege dürfen nebeneinander laufen, auch wenn sie fachlich zusammengehören. Abhängigkeiten gelten zwischen einzelnen Zielen, und Wege fallen in Treffpunkten zusammen.
   - Seit 2026-10-05: Nennt `GOAL.md` Zwischenziele, fallen die Bahnen der Ziele im ersten offenen Zwischenziel zusammen. Sonst setzt das Modell genau einen Treffpunkt. Worauf etwas wartet, gilt zwischen einzelnen Bündeln.
6. **Lebenslauf.** Alles startet als Ziel. Hat es seine Basis erreicht, wird es zum Dauerläufer. Ohne Aktivität klappt ein Dauerläufer zu einer Zeile ein. Neue Aktivität klappt ihn wieder auf. Steht ein großer Umbau an, wird ein Dauerläufer wieder zum Ziel.
   - Gebaut am 2026-10-05 (0.6.0), mit Abweichungen: Die Art eines Strangs steht in `GOAL.md` (`Art: Dauerläufer` oder `Art: Ziel`). Steht dort nichts, entscheidet das Modell. Ein Dauerläufer ohne Aktivität ruht in einer Zeile oder Karte und öffnet sich von selbst wieder. Den Rückweg zum Ziel bietet der Mod nicht an.
7. **Basis erreicht.** Den Übergang vom Ziel zum Dauerläufer schlägt der Agent vor, der Nutzer bestätigt. Die Antwort ist eine Festlegung. Der Rückweg läuft genauso.
   - So gebaut am 2026-10-05 (0.6.0), anders als entschieden: Der Mod fragt selbst, sobald jedes Bündel eines Ziels erledigt ist. Die Antwort ist die Zeile `Art: Dauerläufer` in `GOAL.md`, die der Chat einträgt, keine Festlegung. Wer den Rückweg will, schreibt `Art: Ziel`.
8. **Aktiv.** Ein Dauerläufer ist aktiv, wenn ein Chat an ihm hängt oder in den letzten 7 Tagen ein Ticket geschlossen wurde. Offene Tickets allein und bloßes Anfassen (Label, Kommentar) zählen nicht.
   - Gebaut am 2026-10-05 (0.6.0) wie entschieden. Es zählt nur ein laufender Chat, kein fertiger und kein ausgeblendeter.
9. **Speicherort.** Zielliste und Festlegungen liegen im Repo des Projekts. Der abgeleitete Plan und die Chat-Stände liegen lokal, auf dem Rechner, der die Session führt. Am 2026-10-04 bestätigt: Zwischen Rechnern wandert nichts.
   - Seit 2026-10-05: Im Repo liegt `GOAL.md` mit Zielen und Festlegungen. Lokal unter `~/.claude/ziel-graph/<schlüssel>/` liegen die Chat-Stände und im Unterordner `plan/` der Plan, die Läufe und die Festlegungen, die noch nicht in `GOAL.md` stehen.
10. **Darstellung.** Hochkant und scrollbar wie ein Git-Graph: Bahnen links, je Zeile ein Bündel mit Namen rechts.
    - Seit 2026-10-05: Das gilt für `/graph`, im Aussehen „Ruhig“. Dazu gibt es die breite Ansicht `/orchestrator`: je Strang eine Spalte, je Zone ein Band, darunter die Ziele.
11. **Hauptansicht.** Die Hauptansicht „Schritte“ zeigt die Bündel über alle Ziele in den drei Zonen. Ein Dropdown filtert auf ein Ziel. Die zweite Ansicht „Übersicht“ zeigt je Zeile ein ganzes Ziel und wird per Umschalter gewählt.
    - So gebaut: `/graph` hat die Knöpfe „Schritte“ und „Übersicht“. Das Dropdown für ein Ziel gab es bis 0.2.1 am Beispiel-Graphen. Seit 0.3.0 (2026-10-05) bietet die Leiste es nicht an.
12. **Bündel.** Eine Zeile ist ein Bündel, nie ein einzelnes Ticket. Die Zeile zeigt den Fortschritt („3 von 8 bereit“), Aufklappen zeigt die Tickets. Falsche Bündel korrigiert eine Festlegung.
    - Gebaut am 2026-10-05 (0.5.0): Hat das Repo Tickets, nennt ein Bündel seine Tickets. Ein einzelnes Ticket steht nur allein, wenn es zu keinem anderen passt. Der Fortschritt heißt „3 von 8 erledigt“ und kommt bei jedem Laden frisch aus den Tickets. Ohne Tickets schneidet das Modell die Bündel aus Doku, Chats und Commits.
13. **Filter und Kategorien.** Bahnen und Personen lassen sich ausblenden. Ausgeblendetes steht als eine Zeile „Ausgeblendet: …“. Die Kategorien sind die Bahnen der Zielliste. Bereichs-Labels aus dem Tracker sind der stärkste Hinweis für die Zuordnung.
    - So gebaut: Die Kategorien sind die Stränge aus `GOAL.md`. Bereichs-Labels gehen seit 0.5.0 (2026-10-05) als stärkster Hinweis ans Modell; womit sie beginnen, sagt `GOAL.md` im Abschnitt „Tracker“. Das Ausblenden von Bahnen und Personen bietet die Leiste seit 0.3.0 nicht an.
14. **Zuständigkeit.** Eine Festlegung je Bahn sagt, wer sie macht. Ein einzelnes Bündel darf abweichen. Ist ein Ticket im Tracker einer Person zugewiesen, gewinnt die Zuweisung.
    - So gebaut am 2026-10-05 (0.6.0), anders als entschieden: Wer einen Strang macht, steht in `GOAL.md` in der Zeile `Wer:`, nicht in einer Festlegung. Ein Bündel weicht nur über die Zuweisung im Ticket-System ab: Sind alle seine offenen Tickets derselben Person zugewiesen, sagt es „macht <Name>“.
15. **Wartet auf.** Eine Blockade-Verknüpfung im Tracker gilt zuerst. Fehlt sie, liest das Modell den Grund aus Ticket-Text und Chat-Ständen und markiert ihn als „vermutet“. Ein teilweise blockiertes Bündel zeigt einen halb gefüllten Punkt und den Grund. Worauf ein Bündel wartet, steht als Text in seiner zweiten Zeile („wartet auf: …“). Eine dünne Linie gibt es nur, wenn es auf einen Schritt in einer anderen Bahn wartet (geändert am 2026-10-04): In derselben Bahn sagt es schon die Reihenfolge, und Linien dorthin kreuzten in einem echten Plan die Bahnen.
    - Seit 2026-10-05: Die Linie trägt zwei Pfeilspitzen, vom Schritt, der zuerst fertig sein muss, zu dem, der wartet. Die Verknüpfungen des Trackers liest der Mod nicht (0.5.0): Als Blockade gelten ein Label und die Zeile „Blocked by“ im Text eines Tickets.
16. **Eingabe.** Vorschläge bestätigt der Nutzer in der Leiste mit Ja oder Nein, Festlegungen gibt er dort als Satz ein. Beides gilt sofort im Board und liegt erst lokal. Die Leiste zeigt, wie viele Festlegungen noch nicht im Repo sind. Auf Knopfdruck legt ein Chat einen Merge Request an. Den Merge beauftragt der Nutzer selbst.
    - So gebaut am 2026-10-05 (0.4.0): Eine Festlegung gibt der Nutzer in `/orchestrator` ein. Sie steht sofort in der Liste, gilt ab dem nächsten Ableiten und liegt erst lokal. Beide Ansichten sagen, wie viele noch nicht in `GOAL.md` stehen. Der Knopf „In GOAL.md eintragen lassen“ legt dem Chat den Auftrag ins Eingabefeld. Einen Merge Request legt der Mod nicht an, und Vorschläge mit Ja oder Nein sind nicht gebaut.

Ob die Abweichungen bei 4, 7, 14 und 16 so bleiben, hat der Nutzer noch nicht bestätigt, siehe `docs/offen.md`.

## Bestätigte Annahmen

Vom 2026-10-04, mit dem Stand vom 2026-10-05.

- Abgeleitet wird nur per Knopf, nie von selbst. So gebaut.
- Jeder Modell-Aufruf läuft mit Sonnet 5.5 (`claude-sonnet-5-5`). Haiku wird nicht verwendet. Gebaut sind zwei Aufrufe: das Ableiten des Plans und die Zusammenfassung des Chat-Stands nach einer Antwort. Den Platz eines Chats bestimmt das Ableiten mit, kein eigener Aufruf.
- Beim Ableiten liest der Agent alle offenen und die zuletzt geschlossenen Tickets, die Ziel-Karten, die Verknüpfungen, die Zielliste, die Festlegungen und die Chat-Stände. Die Projekt-Doku liest er nur beim ersten Vorschlag der Zielliste. Anders gebaut: Der Mod liest die Doku bei jedem Ableiten, dazu die letzten Commits und den vorigen Plan. Ziel-Karten und Verknüpfungen liest er nicht.
- Erledigt, bereit und blockiert kommen bei jedem Öffnen frisch aus dem Tracker, ohne Modell-Aufruf. Gebaut in 0.5.0 für jedes Bündel, das Tickets nennt.
- Tickets, die auf eine Auskunft von außen warten, stehen in der Zone „später“ mit diesem Grund. Gebaut in 0.5.0.
- Wo Zielliste und Festlegungen im Projekt-Repo liegen, wird beim Bauen vorgeschlagen und vor dem ersten Merge Request gezeigt. Entschieden am 2026-10-05: in `GOAL.md` in der Wurzel. Einen Merge Request gibt es nicht.

## Zeichen im Graphen

So zeichnet `/graph`. Die Karten in `/orchestrator` haben eigene Zeichen, siehe `docs/orchestrator.md`.

| Zeichen | Bedeutung |
| --- | --- |
| gefüllter Punkt, durchgezogene Bahn | liegt hinter uns; auch ein Zwischenziel, das in `GOAL.md` abgehakt ist |
| Ring mit Kern | läuft in einem Chat |
| leerer Ring | bereit und frei; auch ein späterer Schritt auf dem Stamm |
| halb gefüllter Punkt | teilweise blockiert |
| kleiner blasser Punkt | blockiert; seit 0.6.0 auch die eine Zeile eines Dauerläufers, der ruht |
| größerer Punkt in eigener Farbe | Treffpunkt; mit Zwischenzielen aus `GOAL.md` das erste, das noch offen ist |
| Doppelring | Endziel |
| gepunktete Bahn | muss noch gemacht werden |
| Pfeil am Ende der Bahn | Dauerläufer, kein Ende |
| grün hinterlegter Bereich | die Zone „Jetzt möglich“ |
| dünne gestrichelte Linie mit zwei Pfeilspitzen | „wartet auf“ einen Schritt in einer anderen Bahn. Die Spitzen zeigen vom Schritt, der zuerst fertig sein muss, zu dem, der wartet: eine auf dem Bogen, eine vor dem wartenden Bündel (seit 2026-10-05). |
| Marke „Chat“, mit auffälligem Punkt | ein Chat arbeitet hier; er wartet auf den Nutzer |

## Bauschritte: was daraus wurde

Am 2026-10-04 waren fünf Schritte geplant. Die Tabelle sagt, was aus jedem wurde. Was je Version geprüft ist, steht in `docs/offen.md`.

| Früherer Schritt | Was daraus wurde | Version |
| --- | --- | --- |
| 1 · Nur zeichnen | Graph in der Leiste mit festen Beispieldaten, zwei Ansichten, Aufklappen, Filter, Ziel-Auswahl. `validate` und 13 Tests grün; am 2026-10-04 in der Desktop-App angesehen, die Leiste erscheint. Seit 0.3.0 zeichnet der Graph den echten Plan. Die Beispieldaten liegen nur noch bei den Tests (`tests/beispiel.ts`). | 0.1.0 |
| 2 · Chats übernehmen | Aus dem Pfad-Board: Selbst-Anmeldung eines Chats, Stand nach jeder Antwort (Stand, nächster Schritt, offene Frage), Hinweis bei neuer Frage. Ohne Plan zeigt der Graph nur die laufenden Chats. Gebaut am 2026-10-04; `validate`, 38 Tests und die Typprüfung grün; am 2026-10-04 in der Desktop-App angesehen: Aufnehmen, Herausnehmen und der Stand nach einer Antwort laufen. Anders als das Pfad-Board öffnet der Mod die Leiste nicht von selbst; sie kommt mit `/graph`. Aufnehmen und Herausnehmen geht per Knopf. Seit 0.6.0 gehen fertige und stille Chats von selbst aus der Liste. | 0.2.0, 0.2.1, 0.6.0 |
| 3 · Zielliste und Festlegungen | Die Zielliste ist `GOAL.md`: zuerst im eigenen Mod `orchestrator` 0.1.0, seit 0.3.0 im Ziel-Graph. Festlegungen mit Eingabe und Liste kamen in 0.4.0, in der breiten Ansicht. Nicht gebaut: Vorschläge und das Sammeln bis zum Merge Request. | 0.3.0, 0.4.0 |
| 4 · Ableiten | Knopf „Neu ableiten“ in beiden Ansichten: ein Modell-Aufruf liefert Stränge, Bündel, „wartet auf“ und den Platz der Chats. Zuerst im Wegwerf-Mod `ableiten-versuch` (Test 8 in `docs/offen.md`), dann im Mod `orchestrator` 0.1.0, seit 0.3.0 genau einmal im Ziel-Graph. Seit 0.4.0 schreibt ein Lauf den vorigen Plan fort. Nicht gebaut: Vorschläge. | 0.3.0, 0.4.0 |
| 5 · Lebendig machen | Der Stand kommt bei jedem Laden aus den Tickets, ohne Modell-Aufruf (0.5.0). Ein Dauerläufer ohne Aktivität ruht in einer Zeile (0.6.0). Nicht gebaut: der Merge Request auf Zuruf. | 0.5.0, 0.6.0 |
| nicht geplant | Die breite Ansicht mit Prozesskarten: am 2026-10-05 als eigener Mod `orchestrator` 0.1.0 gebaut, seit 0.3.0 die zweite Ansicht des Ziel-Graphen. Darin als Versuch: einem wartenden Chat von dort antworten. | 0.3.0 |

Der Ziel-Graph hat das Pfad-Board abgelöst (Entscheidung vom 2026-10-04). Aus dem Pfad-Board sind weggefallen: die eigene Leiste, `/board`, `/ziel`, `/pfad` und das Ziel aus der Karte (die Zielliste ersetzt es). Am 2026-10-04 wurde `plugins/pfad-board` aus dem Repo entfernt. Sein Code steht noch im ersten Commit (`cdb2fab`). Der Mod `plugins/orchestrator` ist seit 0.3.0 aus dem Repo entfernt. Der Wegwerf-Mod `ableiten-versuch` lag nur lokal und ist nach dem Übernehmen gelöscht.

Der Code liegt unter `plugins/ziel-graph/`. Die Form des Plans und des Zustands steht in `types/index.d.ts`. Die Engine fassen nur `hooks/register.tsx` und, für den Versuch, `hooks/karten/antwort.tsx` an. Alles andere rechnet und zeichnet ohne Engine: `hooks/plan/` den Plan, `hooks/graph/` die schmale Ansicht, `hooks/karten/` die breite, `hooks/chats.ts` die Chats. Die Liste der Dateien steht in `docs/orchestrator.md`.

## Offene Punkte

Hier steht nur, was die Entscheidungen und die Schnittstelle berührt. Die ganze Liste steht in `docs/offen.md`.

- **Zwei Rechner.** Geklärt am 2026-10-04: Der Nutzer arbeitet am zweiten Rechner immer zugeschaltet. Der Rechner mit dem Repo führt die Session und hat alle Daten. Ein Abgleich ist nicht nötig, Entscheidung 9 bleibt.
- **Zugeschaltetes Gerät.** Beobachtet: Auf einem Gerät, das einer Session auf einem anderen Rechner zugeschaltet ist, laufen die Slash-Befehle, die Seitenleiste erscheint dort aber nicht. Ursache ungeklärt. `/graph` und `/orchestrator` melden, ob die Leiste gezeichnet wird; `/graph` nennt dazu die verbundenen Oberflächen. Laut Typdatei zeichnet ein zugeschaltetes Gerät eine Leiste nur, wenn seine Oberfläche Leisten unterstützt; die Handy-App tut das nicht.
- **Aufklappen bei vielen Bündeln.** Erledigt mit 0.3.0. Schritt 1 nutzte je aufklappbarem Bündel einen Knopf über dem Bild. Jetzt sitzt der Pfeil-Knopf am rechten Ende seiner Zeile, und ein Knopf klappt alles auf oder zu.
- **Hell und Dunkel.** Der Render-Aufruf verrät das Farbschema nicht. `/orchestrator` bietet eine Auswahl Auto, Hell, Dunkel; `/graph` zeichnet seit 0.3.0 immer mit „Auto“. Ob „Auto“ in der Desktop-App dem Thema folgt, ist ungeprüft.
- **Laden über einen Marketplace.** Geprüft am 2026-10-04: Ein Mod mit Function Hooks lädt aus dem Marketplace, sobald die App neu gestartet ist.
- **Filter und Ziel-Auswahl in `/graph`.** Seit 0.3.0 bietet die Leiste sie nicht an (Entscheidungen 11 und 13). Die Zeichenlogik in `hooks/graph/zeichnen.ts` kann sie noch, die Tests prüfen sie mit den Beispieldaten. Der Plan kennt aber noch keine Person je Bahn zum Ausblenden: Alle Bahnen gehören dem Nutzer.

## Was über die Mod-Schnittstelle gelernt wurde

- `claude plugin validate` verlangt, dass `$` nur an Funktionen gereicht wird, die auf Dateiebene deklariert sind, und zwar in derselben Datei: Über einen Import hinweg folgt `validate` dem `$` nie. Logik in einer zweiten Datei bekommt deshalb ein Objekt aus einfachen Funktionen (`ChatZugang` in `hooks/chats.ts`), das `register.tsx` aus `$` baut.
- `validate` prüft nicht, ob es eine Methode auf `$` gibt. Das fängt nur die Typprüfung mit `tsc` gegen die Typdatei der Engine; die `tsconfig.json` dafür steht im Kopf der Typdatei.
- `Svg` gibt es auf Desktop, VS Code und Handy, nicht im Terminal. Es ist ein Bild: höchstens 131072 Zeichen, `alt` ist Pflicht, Klicks nimmt es nicht an. Bedienung geht nur über native `Button` und `Select`.
- Ein Baum, der nicht validiert, wird stillschweigend nicht gezeichnet. `claude plugin test` mit `mount` auf den Surfaces `desktop` und `terminal` fängt das.
- Ein Mod darf an mehreren Stellen zeichnen: Seitenleiste (`Pane`), Band über dem Eingabefeld (`AbovePrompt`), mitten im Chat (`ToolUse`, `ToolResult`, `CommandOutput`, `AskUserQuestion`).
- Ein Mod aus `~/.claude/skills/<name>` lädt beim Start der App. Eine Änderung greift erst nach dem Neustart.
- Der Mods-Ordner einer Session lädt nur, nachdem die Person „Enable hot reloading for this session“ bestätigt hat.
- Ein Bild lässt sich in Streifen zerlegen: jeder Streifen dasselbe `Svg` mit eigenem Ausschnitt (`viewBox`). Gestapelt stoßen sie in der Desktop-App ohne Spalt aneinander, und neben oder über einem Streifen kann ein echter Knopf sitzen. Zwei Fallen: Ein Ausschnitt schneidet nichts ab. Ist die Leiste schmaler als das Bild und der Streifen hat eine feste Höhe, zeigt die App am Rand, was über und unter dem Ausschnitt liegt; der Titel der nächsten Zeile steht dann doppelt da. Deshalb bekommt ein Streifen keine feste Höhe und wird mit einem `clipPath` auf seinen Ausschnitt beschnitten.
- Abstände für `position: "absolute"` gelten in ganzen Zeichenzellen (in der Desktop-App rund 7,8 Pixel breit). Ein Knopf über einem Bild braucht deshalb einen eigenen freien Platz und hängt am besten am Rand seines Bildes (`right`), nicht an einer gerechneten Stelle von links.
- Die Hooks laufen auf dem Rechner, der die Session führt. Ein zugeschaltetes Gerät fragt den gezeichneten Baum nur ab und zeichnet ihn dort, wo es einen Platz dafür hat.
- `$.session.repo()` liefert neben dem Ordner auch `remote`, die Adresse von `origin`. Sie taugt als eindeutiger Schlüssel für ein Repo, anders als der Ordnername.
- `$.state` gilt je Session und übersteht ein Neuladen des Mod-Codes. `$.store` ist eine Datei je Mod und je Rechner.
- `$.process.run` startet `git`, `gh` und `glab` ohne Shell. `$.model.complete` macht einen einzelnen Modell-Aufruf ohne Verlauf. `$.store` und Dateien unter `~/.claude` sind je Rechner.

Dazugekommen beim Bau am 2026-10-05. Das steht so im Code des Mods und in seinen Tests; in der App ist nicht alles davon gesehen.

- Zwei getrennt installierte Mods können keinen Code teilen. Deshalb ist der Orchestrator eine Ansicht des Ziel-Graphen geworden.
- Eine zweite Datei darf eigene Hooks anmelden, wenn `register.tsx` ihr `on` reicht (`registriereAntwort(on)` in `hooks/karten/antwort.tsx`). Ihr `$` bleibt dann in ihren eigenen Funktionen auf Dateiebene. `validate` führt ihre Hooks und Aufrufe unter `./register.tsx` auf.
- Den Namen einer Leiste im Matcher (`requestId`) und die Verweise auf den Zustand (`atom`) liest `validate` nur in der Datei, in der sie benutzt werden. Sie stehen deshalb in jeder solchen Datei noch einmal.
- Ein zweiter `ui.render`-Hook auf dieselbe Leiste, der früher angemeldet wird, liegt über dem ersten: Er bekommt dessen Baum von `next(e)` und kann etwas einhängen. So setzt der Versuch sein Eingabefeld in die Detail-Fläche.
- Der Zustand übersteht ein Neuladen des Mod-Codes, ein laufender Modell-Aufruf nicht. Einem Zustand aus einer älteren Fassung fehlen Felder: Beim Lesen füllen die Anfangswerte sie. Ein Lauf, der laut Zustand noch läuft, wird beim Start der Session als unterbrochen markiert.
- Was länger dauert, startet der Mod mit `$.clock.after(0, …)`: den Modell-Aufruf nach dem Knopfdruck, die Zusammenfassung nach dem Ende der Runde. So hält es weder den Knopf noch die Runde auf.
- Was jemand in ein `Input` tippt, gehört nicht in den Zustand: Jeder Tastendruck würde die Leiste neu zeichnen. Der Entwurf liegt in einer Variablen der Datei.
- `$.ui.open` nimmt die Breite nur als Wunsch (`columns`). Wie breit die Leiste wirklich ist, sagt beim Zeichnen `e.props.bodyColumns`, in Zeichenzellen.
- Die Handy-App hat weder `Select` noch `Input`, das Terminal kein `Svg`. Jede Ansicht zeichnet dafür einen Ersatz.
- `$.session.send` schickt Text an eine andere Session, `session.receive` nimmt ihn dort an. Der Empfänger sieht unter `e.origin`, ob ein Mod gesendet hat und welcher. Das ist eine Angabe des Absenders, kein Beweis, und bisher nur gegen die Test-Engine geprüft.
- `claude plugin test` läuft ohne Dateisystem, Netz und Prozesse: Die Tests stellen Dateien, Befehle, Modell und Uhr aus dem Speicher (`tests/welt.ts`).
