# Orchestrator

Stand: 2026-10-05. Seit Version 0.3.0 ist der Orchestrator kein eigener Mod mehr, sondern die breite Ansicht des Mods `ziel-graph`. Gebaut und mit `validate`, den Tests des Mods und der Typprüfung geprüft. In der echten App noch nicht angesehen.

## Zweck

Der Mod `ziel-graph` hat einen Plan und zwei Ansichten davon:

- **`/graph`**, die schmale Leiste in jedem Chat: oben die laufenden Chats, darunter der Plan als Graph.
- **`/orchestrator`**, die große Ansicht neben einem Chat, von dem aus man arbeitet: derselbe Plan als Prozesskarten. Von ihr handelt diese Datei.

Beide Ansichten teilen sich alles, was zählt: eine Ableitung, einen gespeicherten Plan, dieselben Chats und dieselbe GOAL.md. Wer in der einen „Neu ableiten“ drückt, sieht den neuen Plan auch in der anderen. Nur was man einstellt, hat jede für sich: Eine gewählte Karte ändert den Graphen nicht, ein aufgeklapptes Bündel die Karten nicht. Warum ein Mod statt zwei: Zwei getrennt installierte Mods können keinen Code teilen, und zwei Ableitungen ergäben zwei verschiedene Pläne.

Die Fläche zeigt den Plan des Repos als Prozesskarten:

- **Je Strang eine Spalte.** Ein Strang ist das, was die Spezifikation des Ziel-Graphen eine Bahn nennt. Im Kopf der Spalte steht das Ziel des Strangs.
- **Drei Bänder von oben nach unten:** „Hinter uns“ (je Strang eine Karte „n erledigt“), „Jetzt möglich“ und „Später“.
- **Darunter die Ziele:** die Zwischenziele und zuletzt das Endziel.
- **Eine Karte** hat ein Zeichen in der Farbe ihres Strangs, den Titel auf bis zu zwei Zeilen und eine Meta-Zeile. Arbeitet ein Chat an ihr, steht dort „Chat läuft“ oder „Chat wartet auf dich“; die wartende Karte ist warm umrandet.
- **Die Detail-Fläche** zeigt zur gewählten Karte ihre Punkte, ihre Quelle, worauf sie wartet und den Chat daran mit Stand, „Weiter“ und offener Frage.

## Bedienung

| Was | Wie |
| --- | --- |
| Fläche öffnen | `/orchestrator`. Die Leiste wünscht sich eine große Breite; breiter ziehen kann sie nur der Nutzer. Der letzte gespeicherte Plan des Repos wird geladen. |
| Plan ableiten | Knopf „Neu ableiten“, hier oder in `/graph`. Ein Modell-Aufruf mit `claude-sonnet-5-5`, etwa 30 Sekunden. Beide Leisten zählen mit, das Ende kommt als Hinweis. Läuft schon ein Lauf, startet kein zweiter. Abgeleitet wird nur per Knopf. |
| Neu lesen | Knopf „Neu laden“: der gespeicherte Plan, GOAL.md und die Chats. Kein Modell-Aufruf. |
| Karte wählen | Knopf „›“ an der Karte. Ohne Wahl gilt die erste Karte, an der ein anderer Chat auf den Nutzer wartet. |
| Arbeit beginnen | In der Detail-Fläche einer Karte aus „Jetzt möglich“: „Auftrag ins Eingabefeld legen“. Der Auftrag nennt Strang und dessen Ziel, Titel, Punkte und Quelle. Abschicken tut ihn der Nutzer. |
| Schritt verstehen | „Erklären lassen“ legt die Bitte ins Eingabefeld, den Schritt mit einem kleinen Bild zu erklären. |
| Ziel festlegen | Knopf „Ziel festlegen“ unter dem Kopf eines Strangs ohne Ziel, „Endziel festlegen“ neben einem offenen Endziel. Beide legen einen Auftrag ins Eingabefeld. Die schmale Ansicht hat dieselben Knöpfe mit denselben Aufträgen. |

Steht im Eingabefeld schon ein Entwurf, bleibt er stehen, und der Auftrag kommt dahinter.

Im Terminal gibt es keine Bilder. Dort stehen die Karten als Liste, je Karte eine Zeile, die sich drücken lässt.

## GOAL.md

GOAL.md ist der Anker des Plans (Entscheidung des Nutzers vom 2026-10-05). Die Datei liegt in der Wurzel des Repos und nennt das Endziel, die Zwischenziele auf dem Weg dorthin und je Strang das größere Ziel, das er verfolgt. Was noch nicht klar ist, bleibt offen und wird mit der Zeit gefüllt.

**Der Mod schreibt GOAL.md nie.** Er liest sie nur. Schreiben tut sie der Chat, auf Zuruf des Nutzers; die Knöpfe der Fläche legen dafür nur den Auftrag ins Eingabefeld.

### Format

```
# Ziel

## Endziel
<ein Satz, oder „noch offen“>

## Zwischenziele
- <ein Zwischenziel auf dem Weg zum Endziel>
- [x] <ein Zwischenziel, das schon erreicht ist>

## Stränge
### <Name des Strangs>
Ziel: <wohin dieser Strang führt, oder leer>
Gehört zu: <eines der Zwischenziele, wenn es passt>
```

### Beispiel (erfunden)

```
# Ziel

## Endziel
Der Shop ist im Betrieb und nimmt Bestellungen an.

## Zwischenziele
- [x] Grundstock steht
- Großer Umbau
- Lasttest bestanden

## Stränge
### Katalog
Ziel: Alle Produkte mit Text und Bild im Shop
Gehört zu: Großer Umbau

### Kasse
Ziel:
Gehört zu: Großer Umbau

### Suche
Ziel: Jedes Produkt in zwei Klicks finden

### Betrieb
```

Hier haben Kasse und Betrieb noch kein Ziel. Ihre Spalten sagen „kein Ziel festgelegt“ und haben den Knopf „Ziel festlegen“. In der schmalen Ansicht steht dafür über dem Graphen die Zeile „Ohne Ziel in GOAL.md: Kasse, Betrieb“ mit je einem Knopf.

### Wie die Datei gelesen wird

Die Datei darf unvollständig und eigenwillig geschrieben sein.

- **Abschnitte** erkennt der Mod an ihrer Überschrift, in jeder Tiefe und in jeder Reihenfolge: „Endziel“; „Zwischenziele“ oder „Meilensteine“; „Stränge“, „Straenge“ oder „Bahnen“. Die erste Überschrift („# Ziel“) ist frei. Andere Abschnitte übergeht er.
- **Endziel:** der erste Absatz, wörtlich. Auch „## Endziel: der Satz“ gilt.
- **Zwischenziele:** je Listenpunkt eines, in der Reihenfolge der Datei. `- [x]` heißt erreicht. Eingerückte Zeilen darunter sind Erläuterung und zählen nicht.
- **Stränge:** jede Überschrift unter „Stränge“ ist ein Strang. Die Reihenfolge der Datei ist die Reihenfolge der Spalten. Eine Liste statt Überschriften geht auch: `- Kasse: Bestellen ohne Umweg`.
- **Felder eines Strangs:** `Ziel:` und `Gehört zu:`, auch als Listenpunkt oder fett. „Gehört zu“ muss eines der Zwischenziele nennen; sonst steht ein Hinweis in der Fläche.
- **Offen** heißt: leer, „noch offen“, „offen“, „unklar“, „?“, „–“, „tbd“ oder ein stehen gebliebener Platzhalter in spitzen Klammern.
- Kommentare (`<!-- … -->`) und Code-Blöcke zählen nicht.
- **Im Worktree** zählt zuerst die GOAL.md des Worktrees, sonst die der Haupt-Wurzel.

### Was aus GOAL.md folgt

- GOAL.md geht als erste und maßgebliche Quelle ans Modell.
- **Ihre Stränge sind die Spalten** und im Graphen die Bahnen. Das Modell ordnet ihnen nur Bündel zu. Benennt es einen Strang um, legt es zwei zusammen oder lässt es einen weg, gilt trotzdem GOAL.md; die Abweichung steht unter „Beim Ableiten aufgefallen“.
- **Ihr Endziel steht wörtlich da.**
- **Ihre Zwischenziele** stehen unter den Bändern, in ihrer Reihenfolge. Im Graphen stehen sie auf dem Stamm: Ein abgehaktes trägt den gefüllten Punkt, ins erste offene münden die Bahnen der Ziele.
- Findet das Modell in den anderen Quellen einen Strang, der in GOAL.md fehlt, hängt er hinten an und ist als „nicht in GOAL.md“ markiert.
- Ein Strang ohne Ziel sagt „kein Ziel festgelegt“. Was das Modell dazu vermutet, steht daneben als „vermutet: …“.
- **GOAL.md wird bei jedem Laden frisch gelesen.** Ein Ziel, das der Chat gerade eingetragen hat, zeigt „Neu laden“ sofort, ohne Modell-Aufruf. Hat sich GOAL.md seit dem letzten Ableiten geändert, sagt die Fläche das.

### Ohne GOAL.md

Die Fläche sagt zuerst „GOAL.md fehlt“, erklärt in einem Satz, wofür sie da ist, und bietet den Knopf „GOAL.md mit dem Chat entwerfen“. Die schmale Ansicht sagt es in einer Zeile, mit demselben Knopf. Das Ableiten läuft trotzdem: Das Modell schneidet die Stränge selbst. Alles über Ziele steht dann als „vermutet“ da.

## Woraus abgeleitet wird

Ein Lauf liest GOAL.md, `README.md`, `CLAUDE.md`, jede Markdown-Datei unter `docs/`, die laufenden Chats und die letzten 30 Commits. Tickets liest er noch nicht. Der Mod setzt kein Ticket-System voraus und läuft auch ohne Git und ohne Repo.

Das Modell antwortet mit einem JSON. Der Mod räumt es auf: Was nicht passt, lässt er weg oder repariert es, und jede Reparatur steht als Hinweis in der Fläche. Die schmale Ansicht nennt nur die Zahl der Hinweise.

## Chats

Die Chats sind dieselben wie in der schmalen Ansicht. Der Mod schreibt je Session eine Datei mit dem Stand ihres Chats: `~/.claude/ziel-graph/<schlüssel>/<session>.json`. Jede Session, in der der Mod geladen ist, liest sie alle 20 Sekunden neu und meldet eine neue Frage als Hinweis. Ändert sich nichts, wird die breite Ansicht nicht neu gezeichnet: So stört das Lesen niemanden, der dort gerade tippt. Ihre Zeitangaben wie „vor 3 Min“ rücken deshalb erst weiter, wenn sich etwas ändert oder jemand „Neu laden“ drückt. Die schmale Ansicht hat kein Eingabefeld; ihre Zeitangaben laufen alle 20 Sekunden weiter.

Welcher Chat an welcher Karte hängt, hat das Modell beim Ableiten zugeordnet. Ob er noch läuft und ob er wartet, sagen die Dateien. Ein Chat, der nach dem Ableiten dazukam, steht unter „Chats ohne Karte“ und lässt sich dort wählen. Im Graphen trägt die Zeile desselben Bündels die Marke „Chat“.

## Versuch: von hier antworten

In der Detail-Fläche einer Karte, deren Chat auf den Nutzer wartet, steht unter der Überschrift „Versuch: von hier antworten“ ein Eingabefeld und der Knopf „Antwort schicken“.

- **Senden:** `$.session.send` an die Session des wartenden Chats. Die Nachricht trägt die Marke `[[orchestrator-antwort v1]]`, allein in ihrer Zeile; in der Zeile danach stehen als JSON die Session, die Frage und die Antwort.
- **Anzeige:** Die Fläche sagt „Zugestellt“ oder „Nicht zugestellt“ mit dem Grund, zum Beispiel wenn die andere Session nicht läuft. Zugestellt heißt: in der Warteschlange des Chats, nicht: gelesen.
- **Empfangen:** Jede Session, in der der Mod geladen ist, sieht eingehende Nachrichten an (`session.receive`). Sie nimmt eine Nachricht nur an, wenn drei Dinge stimmen: Sie trägt die Marke, sie ist für diese Session bestimmt, und die Engine weist sie als vom `$.session.send` dieses Mods verschickt aus, also mit dem Mod-Namen `ziel-graph`. Dann reicht sie sie als Prompt ein (`$.prompt.submit`). Alles andere lässt sie unangetastet durch.
- **Warum der dritte Punkt:** Schreibt das Modell einer anderen Session eine Nachricht mit der Marke, trägt sie keinen Mod-Namen und bleibt eine gewöhnliche Nachricht von nebenan. So kann sich kein anderer Chat als der Nutzer ausgeben. Der Mod-Name ist eine Angabe des Absenders und kein Beweis: Ein anderer installierter Mod könnte ihn nachahmen.
- **Der empfangene Text ist nur die Antwort.** Er steht im Prompt hinter dem Satz „Antwort aus dem Orchestrator auf deine offene Frage …, dort vom Nutzer eingegeben:“. Der Prompt läuft unter dem Namen des Mods, nicht als vom Nutzer getippt: Die Marke kann jeder Prozess desselben Nutzers schreiben, sie soll einer Nachricht nicht mehr Gewicht geben, als sie hat.
- Die Handy-App hat kein Eingabefeld; dort steht nur der Hinweis. Dem eigenen Chat antwortet man in seinem Eingabefeld.

Der Versuch steht für sich in `plugins/ziel-graph/hooks/karten/antwort.tsx`. Wer ihn entfernt, löscht diese Datei und in `hooks/register.tsx` den Import und die eine Zeile `registriereAntwort(on)`.

## Speicherort

Alles liegt lokal unter `~/.claude/ziel-graph/<schlüssel>/`. Der Schlüssel kommt aus der Adresse von `origin`, sonst aus dem Pfad. Alle Worktrees eines Repos teilen den Ordner.

- **Direkt im Ordner** liegen die Stände der Chats, je Session eine Datei `<session>.json`.
- **Im Unterordner `plan/`** liegen der Plan und die Läufe. So zählt keine Datei eines Laufs als Chat.

| Datei unter `plan/` | Inhalt |
| --- | --- |
| `plan.json` | der letzte gelungene Lauf: die rohe Antwort des Modells, womit sie aufgeräumt wurde, der Text von GOAL.md, die Eckdaten und der Plan |
| `letzter.json` | der letzte Lauf, auch ein gescheiterter: Dauer, Verbrauch, Quellen, Antwort, Hinweise |
| `lauf-<zeit>.json` | derselbe Inhalt je Lauf |
| `letzte-eingabe.txt` | was das Modell als Eingabe bekommen hat |

Beide Ansichten lesen dieselbe `plan.json`. Ein Plan, den die Version 0.1.0 des Orchestrators unter `~/.claude/orchestrator/<schlüssel>/plan.json` abgelegt hat, wird nicht von selbst übernommen. Die Datei hat dieselbe Form: Wer sie nach `~/.claude/ziel-graph/<schlüssel>/plan/plan.json` kopiert, sieht den alten Plan wieder. Sonst genügt „Neu ableiten“.

## Aufbau der Fläche

Die Leiste setzt viele kleine Bilder neben- und untereinander. Kein Bild liegt über einem anderen.

- Jede Karte ist ein eigenes kleines SVG. Das Stück Verbindungslinie über und unter der Karte gehört zu ihrem Bild; Bilder einer Spalte stoßen ohne Lücke aneinander, so läuft die Linie durch.
- Neben jeder Karte steht ihr Knopf „›“. Ein Bild nimmt keine Klicks an.
- Je Band eine Reihe, darin je Strang eine Spalte. Jede Spalte ist in jeder Reihe gleich breit: Ihre Box hat eine Mindestbreite, und jedes Bild ohne Knopf ist so breit wie Karte und Knopf zusammen.
- Die Breite der Karten folgt der Breite der Leiste. Reicht sie, steht die Detail-Fläche rechts neben den Karten. Sonst steht sie darunter. Reicht es auch für Spalten nicht, stehen die Stränge untereinander.
- Die Detail-Fläche steht nie über den Karten: Sonst würden die Karten bei jeder Wahl verrutschen.
- Farben: „Auto“ folgt dem Farbschema, „Hell“ und „Dunkel“ legen es fest.

Für den Beispiel-Shop der Tests (die GOAL.md von oben, 4 Stränge, 11 Bündel) sind das 34 Bilder mit zusammen etwa 26.000 Zeichen Markup (mit festem Farbschema etwa 19.000); das größte Bild hat rund 1.400 Zeichen. Die Engine erlaubt je Bild 131.072.

## Dateien des Mods

Alles steht unter `plugins/ziel-graph/`. Nur `hooks/register.tsx` fasst die Engine an; die anderen Dateien rechnen und zeichnen.

| Datei | Inhalt |
| --- | --- |
| `hooks/register.tsx` | der Zugang zur Engine: Laden, der Lauf, die Handgriffe aller Knöpfe, die zwei Leisten |
| `hooks/chats.ts` | die laufenden Chats: ihre Dateien, die Selbst-Anmeldung, der Stand nach einer Antwort |
| `hooks/plan/goal.ts` | GOAL.md lesen; die Aufträge zum Anlegen und Festlegen |
| `hooks/plan/quellen.ts` | GOAL.md, Doku, Chats und Commits für einen Lauf lesen |
| `hooks/plan/ableiten.ts` | der Auftrag ans Modell, die Eingabe, das Aufräumen der Antwort zum Plan |
| `hooks/plan/lauf.ts` | ein Lauf von Anfang bis Ende; Speichern und Laden |
| `hooks/plan/lesen.ts` | was beide Ansichten aus dem Plan in denselben Worten sagen |
| `hooks/karten/karten.ts` | aus Plan und Chats werden Karten, Detail-Fläche und Aufträge |
| `hooks/karten/zeichnen.ts` | die Bilder und die Anordnung der Fläche |
| `hooks/karten/leiste.tsx` | die breite Leiste, ohne Engine |
| `hooks/karten/antwort.tsx` | der Versuch: von hier antworten |
| `hooks/graph/…` | die schmale Ansicht: aus dem Plan werden Zeilen, das Bild „Ruhig“, die Streifen, die Leiste |
| `hooks/probe.ts` | zum Prüfen ohne App: aus dem Text einer `plan.json` der Graph und ein Bild der Karten |
| `types/index.d.ts` | die Form des Plans und des Zustands |

## Offen und ungeprüft

- **In der echten App** ist noch nichts angesehen: ob die Spalten bündig stehen, wie breit der Knopf „›“ ist, ob „Auto“ dem Farbschema folgt, wie breit sich die Leiste ziehen lässt.
- **Der Versuch** ist nur gegen die Test-Engine geprüft. Ob `$.session.send` eine andere Session der Desktop-App erreicht, ob die Engine vor dem Senden nachfragt, ob sie den Versand dort wirklich mit dem Mod-Namen `ziel-graph` ausweist und wie die andere Session den Prompt des Mods aufnimmt, zeigt erst die App.
- **Tickets** als Quelle fehlen noch (GitLab, GitHub, Markdown).
- **Festlegungen** des Nutzers, wie die Spezifikation des Ziel-Graphen sie vorsieht, gibt es noch nicht. Der einzige feste Anker ist GOAL.md.
