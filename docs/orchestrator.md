# Orchestrator

Stand: 2026-10-05, Version 0.5.0. Seit Version 0.3.0 ist der Orchestrator kein eigener Mod mehr, sondern die breite Ansicht des Mods `ziel-graph`. Seit Version 0.4.0 gibt es Festlegungen, der Plan wird von Lauf zu Lauf fortgeschrieben, und beide Ansichten sagen, was ein Lauf geändert hat. Seit Version 0.5.0 sind die Tickets des Repos eine Quelle: aus GitHub, aus GitLab oder als Markdown-Dateien, und ihr Stand kommt bei jedem Laden frisch, ohne Modell-Aufruf. Gebaut und mit `validate`, den Tests des Mods und der Typprüfung geprüft. In der echten App und an einem echten Ticket-System noch nicht angesehen.

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
- **Über den Karten** steht das Feld für eine neue Festlegung und, nach jedem Lauf ab dem zweiten, was er am Plan geändert hat. **Unter den Karten** steht die Liste der Festlegungen.

## Bedienung

| Was | Wie |
| --- | --- |
| Fläche öffnen | `/orchestrator`. Die Leiste wünscht sich eine große Breite; breiter ziehen kann sie nur der Nutzer. Der letzte gespeicherte Plan des Repos wird geladen. |
| Plan ableiten | Knopf „Neu ableiten“, hier oder in `/graph`. Ein Modell-Aufruf mit `claude-sonnet-5-5`, etwa 30 Sekunden. Beide Leisten zählen mit, das Ende kommt als Hinweis. Läuft schon ein Lauf, startet kein zweiter. Abgeleitet wird nur per Knopf. |
| Neu lesen | Knopf „Neu laden“: der gespeicherte Plan, GOAL.md, die Chats und der Stand der Tickets. Kein Modell-Aufruf. |
| Karte wählen | Knopf „›“ an der Karte. Ohne Wahl gilt die erste Karte, an der ein anderer Chat auf den Nutzer wartet. |
| Arbeit beginnen | In der Detail-Fläche einer Karte aus „Jetzt möglich“: „Auftrag ins Eingabefeld legen“. Der Auftrag nennt Strang und dessen Ziel, Titel, Punkte und Quelle. Abschicken tut ihn der Nutzer. |
| Schritt verstehen | „Erklären lassen“ legt die Bitte ins Eingabefeld, den Schritt mit einem kleinen Bild zu erklären. |
| Ziel festlegen | Knopf „Ziel festlegen“ unter dem Kopf eines Strangs ohne Ziel, „Endziel festlegen“ neben einem offenen Endziel. Beide legen einen Auftrag ins Eingabefeld. Die schmale Ansicht hat dieselben Knöpfe mit denselben Aufträgen. |
| Festlegung eingeben | Den Satz ins Feld „Neue Festlegung“ unter „Neu ableiten“ tippen, dann Enter oder „Festlegen“. Er gilt ab dem nächsten Ableiten. Kein Modell-Aufruf. |
| Festlegung zurücknehmen | Knopf „Entfernen“ neben einer Festlegung, die noch nicht in GOAL.md steht. Was in GOAL.md steht, streicht der Chat. |
| Festlegungen ins Repo bringen | Knopf „In GOAL.md eintragen lassen“: legt den Auftrag ins Eingabefeld, die lokalen Sätze unter „## Festlegungen“ einzutragen. |

Steht im Eingabefeld schon ein Entwurf, bleibt er stehen, und der Auftrag kommt dahinter.

Im Terminal gibt es keine Bilder. Dort stehen die Karten als Liste, je Karte eine Zeile, die sich drücken lässt.

## GOAL.md

GOAL.md ist der Anker des Plans (Entscheidung des Nutzers vom 2026-10-05). Die Datei liegt in der Wurzel des Repos und nennt das Endziel, die Zwischenziele auf dem Weg dorthin, je Strang das größere Ziel, das er verfolgt, und die Festlegungen des Nutzers. Was noch nicht klar ist, bleibt offen und wird mit der Zeit gefüllt.

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

## Festlegungen
- <ein Satz, der bei jedem Ableiten des Plans gewinnt>
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

## Festlegungen
- Die Gutscheine gehören zur Kasse, nicht zum Katalog.
- Der Lasttest kommt erst nach dem großen Umbau.
```

Hier haben Kasse und Betrieb noch kein Ziel. Ihre Spalten sagen „kein Ziel festgelegt“ und haben den Knopf „Ziel festlegen“. In der schmalen Ansicht steht dafür über dem Graphen die Zeile „Ohne Ziel in GOAL.md: Kasse, Betrieb“ mit je einem Knopf.

### Wie die Datei gelesen wird

Die Datei darf unvollständig und eigenwillig geschrieben sein.

- **Abschnitte** erkennt der Mod an ihrer Überschrift, in jeder Tiefe und in jeder Reihenfolge: „Endziel“; „Zwischenziele“ oder „Meilensteine“; „Stränge“, „Straenge“ oder „Bahnen“; „Festlegungen“ oder „Festlegung“. Die erste Überschrift („# Ziel“) ist frei. Andere Abschnitte übergeht er.
- **Endziel:** der erste Absatz, wörtlich. Auch „## Endziel: der Satz“ gilt.
- **Zwischenziele:** je Listenpunkt eines, in der Reihenfolge der Datei. `- [x]` heißt erreicht. Eingerückte Zeilen darunter sind Erläuterung und zählen nicht.
- **Stränge:** jede Überschrift unter „Stränge“ ist ein Strang. Die Reihenfolge der Datei ist die Reihenfolge der Spalten. Eine Liste statt Überschriften geht auch: `- Kasse: Bestellen ohne Umweg`.
- **Felder eines Strangs:** `Ziel:` und `Gehört zu:`, auch als Listenpunkt oder fett. „Gehört zu“ muss eines der Zwischenziele nennen; sonst steht ein Hinweis in der Fläche.
- **Festlegungen:** je Listenpunkt ein Satz, wörtlich. Die Zeile gleich darunter setzt einen langen Satz fort; ein eingerückter Listenpunkt ist Erläuterung und zählt nicht. Ohne Liste zählt jede Zeile. Steht derselbe Satz zweimal da, gilt er einmal, und die Fläche sagt es. Nur tiefer als „Stränge“ und unter ihr darf die Überschrift nicht stehen: Dort ist jede Überschrift ein Strang.
- **Tracker:** ein freiwilliger Abschnitt „Tracker“ (auch „Ticket-System“, „Tickets“ oder „Labels“), der sagt, welche Labels etwas bedeuten. Siehe „Tickets“ weiter unten. Über Ziele sagt er nichts.
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
- **Ihre Festlegungen** gehen als verbindliche Regeln ans Modell, siehe unten.
- **GOAL.md wird bei jedem Laden frisch gelesen.** Ein Ziel, das der Chat gerade eingetragen hat, zeigt „Neu laden“ sofort, ohne Modell-Aufruf. Hat sich GOAL.md seit dem letzten Ableiten geändert, sagt die Fläche das.

### Ohne GOAL.md

Die Fläche sagt zuerst „GOAL.md fehlt“, erklärt in einem Satz, wofür sie da ist, und bietet den Knopf „GOAL.md mit dem Chat entwerfen“. Die schmale Ansicht sagt es in einer Zeile, mit demselben Knopf. Das Ableiten läuft trotzdem: Das Modell schneidet die Stränge selbst. Alles über Ziele steht dann als „vermutet“ da.

## Festlegungen

Eine Festlegung ist ein Satz des Nutzers, der bei jedem Ableiten gewinnt (Entscheidungen 3 und 16 der Spezifikation). Mit ihr korrigiert er den Plan, ohne die abgeleitete Datei anzufassen. Zwei erfundene Beispiele: „Die Gutscheine gehören zur Kasse, nicht zum Katalog.“ und „Der Lasttest kommt erst nach dem großen Umbau.“

- **Fest stehen sie in GOAL.md**, unter „## Festlegungen“, je Satz ein Listenpunkt. Eine GOAL.md, die nur Festlegungen nennt, sagt noch nichts über Ziele: Die Fläche nennt sie weiter „noch leer“ und bietet an, sie mit dem Chat zu entwerfen.
- **Eingeben** tut der Nutzer eine neue in der breiten Ansicht, im Feld unter „Neu ableiten“. Das Feld ist immer da und hängt an keiner Karte. Die Handy-App zeichnet kein Eingabefeld; dort steht nur ein Hinweis.
- **Sie gilt sofort:** ab dem nächsten Ableiten. Bis dahin sagt die Fläche „Die Festlegungen sind andere als beim letzten Ableiten“.
- **Sie liegt erst lokal**, in `plan/festlegungen.json`, weil der Mod GOAL.md nie schreibt. Der Knopf „In GOAL.md eintragen lassen“ legt dem Chat den Auftrag ins Eingabefeld.
- **Steht ein Satz in GOAL.md, fällt seine lokale Kopie weg**, beim nächsten Laden oder Ableiten. Verglichen wird nachsichtig: Leerraum, Groß- und Kleinschreibung und der Punkt am Ende zählen nicht. Streicht der Nutzer den Satz später wieder aus GOAL.md, kommt er nicht von selbst zurück.
- **Beide Ansichten sagen, wie viele es gibt** und wie viele noch nicht in GOAL.md stehen: „3 Festlegungen, 1 noch nicht in GOAL.md“. Die breite Ansicht sagt es immer, die schmale, sobald es eine gibt. Die Liste steht in der breiten Ansicht unter den Karten; eine lokale trägt den Zusatz „(noch nicht in GOAL.md)“ und den Knopf „Entfernen“.
- **Das Modell bekommt alle**, die aus GOAL.md und die lokalen, in einem eigenen Block gleich nach GOAL.md. Sein Auftrag nennt sie verbindlich: Sie gehen allem anderen vor, außer den Strängen und dem Endziel aus GOAL.md.
- **Nachgeprüft wird das nicht.** Ob das Modell eine Festlegung befolgt hat, sieht der Nutzer am Plan. Ein Satz ist höchstens 300 Zeichen lang.

## Der vorige Plan und was sich geändert hat

Zwei Läufe über dasselbe Repo ergaben früher zwei verschiedene Bilder: andere Worte, anders geschnittene Bündel. Seit Version 0.4.0 wird der Plan fortgeschrieben.

- **Der vorige Plan geht mit ans Modell**, in Kurzform und am Ende der Eingabe: je Bündel id, Strang, Zone, Stand und Titel, dazu die Schritte des Stamms. Der Auftrag dazu: Jedes Bündel, das es weiter gibt, behält id und Titel. Zone, Stand und Zuschnitt ändern sich nur, wo sich die Quellen geändert haben oder eine Festlegung es verlangt. Bündel kommen nur dazu und fallen nur weg, wenn die Quellen einen Grund nennen.
- **Der erste Lauf** hat keinen vorigen Plan und läuft wie bisher.
- **Als voriger Plan gilt, was die Ansichten gerade zeigen:** der gespeicherte Plan, aufgeräumt gegen die GOAL.md von jetzt. Was der Nutzer selbst in GOAL.md geändert hat (ein neues Endziel, ein abgehaktes Zwischenziel), zählt deshalb nicht als Änderung des Laufs.
- **Nach jedem Lauf vergleicht der Mod** den neuen Plan mit dem vorigen, Bündel für Bündel nach der id: neu, weggefallen, umbenannt, in einer anderen Zone oder einem anderen Stand, in einem anderen Strang. Dasselbe für die Schritte des Stamms und für das Endziel. Beim Strang zählt der Name, nicht die id.
- **Die schmale Ansicht** sagt es in einer Zeile: „Seit dem letzten Ableiten: 2 neu, 1 erledigt, 1 verschoben“. **Die breite Ansicht** zeigt darunter je Änderung eine Zeile, über den Karten, höchstens zwölf. Hat sich nichts geändert, steht „nichts geändert“ da.
- **Eine Karte und eine Zeile des Graphen**, die der Lauf neu gebracht, verschoben oder umbenannt hat, sagen das vorn in ihrer zweiten Zeile: „neu“, „verschoben“, „umbenannt“.
- **Das Ergebnis liegt beim Plan** und steht bis zum nächsten gelungenen Lauf da, auch nach „Neu laden“ und in einer neuen Session.

## Woraus abgeleitet wird

Ein Lauf liest GOAL.md, die Festlegungen, die Tickets des Repos, `README.md`, `CLAUDE.md`, jede Markdown-Datei unter `docs/`, die laufenden Chats, die letzten 30 Commits und den vorigen Plan. Der Mod setzt kein Ticket-System voraus und läuft auch ohne Git und ohne Repo: Ohne Tickets ist alles wie vor Version 0.5.0.

Die Doku ist gedeckelt: Von jeder Datei gehen höchstens 24.000 Zeichen ans Modell, von allen zusammen höchstens 96.000. Die Tickets sind es auch, siehe unten. Was gekürzt oder ausgelassen wurde, steht als Hinweis in der Fläche.

Das Modell antwortet mit einem JSON. Der Mod räumt es auf: Was nicht passt, lässt er weg oder repariert es, und jede Reparatur steht als Hinweis in der Fläche. Die schmale Ansicht nennt nur die Zahl der Hinweise.

## Tickets

Hat das Repo ein Ticket-System, steht sein wirklicher Stand dort. Der Mod liest ihn, setzt ihn aber nie voraus.

### Welches Ticket-System

Das entscheidet eine Stelle, dieselbe, die auch den Titel eines Tickets für einen Chat nachschlägt (`trackerAus` in `hooks/chats.ts`): zuerst die erste Zeile von `docs/agents/issue-tracker.md` (`# Issue tracker: GitHub`, `GitLab` oder `Local Markdown`), sonst der Host von `origin`. Passt nichts, gibt es keine Tickets, und es wird nichts aufgerufen.

Wer ein Repo bei GitHub oder GitLab hat, dessen Tickets aber nicht nutzt, schreibt in `docs/agents/issue-tracker.md` eine erste Zeile, die keines der drei nennt, zum Beispiel `# Issue tracker: keines`.

### Was gelesen wird

| Ticket-System | Aufruf, je ohne Shell und nur lesend |
| --- | --- |
| GitHub | `gh issue list --state open --limit 100 --json number,title,state,labels,assignees,milestone,updatedAt,body`, danach `gh issue list --state closed --limit 30 --json number,title,state,closedAt,labels` |
| GitLab | `glab api projects/:id/issues?state=opened&per_page=100`, danach `glab api projects/:id/issues?state=closed&order_by=updated_at&per_page=30` |
| Markdown | kein Aufruf: die Dateien `.scratch/<vorhaben>/issues/<NN>-<name>.md`, erst in der Arbeitskopie der Session, sonst in der Wurzel des Repos |

- **Je Ticket** merkt sich der Mod: Nummer, Titel, offen oder geschlossen, Labels, wem es zugewiesen ist, den Meilenstein, einen Auszug des Textes (höchstens 160 Zeichen, nur bei offenen), was der Text als Blockade nennt („Blocked by: …“) und den Tag, an dem es geschlossen wurde.
- **Tickets als Markdown** sind je Vorhaben ab 01 nummeriert. Der Schlüssel ist deshalb Vorhaben plus Nummer: `kasse/03`. Der Titel kommt aus der Überschrift `# <NN> — <Titel>`. Unter ihr liest der Mod die Zeilen `Status:`, `Type:`, `Labels:`, `Assignee:` und `Blocked by:`, auch fett geschrieben. Geschlossen ist ein Ticket mit dem Status `resolved` oder `wontfix`, wie die Skills ihn schreiben, oder mit einem der üblichen Worte dafür: `done`, `closed`, `erledigt`, `geschlossen`. Jeder andere Status zählt wie ein Label: `needs-info`, `blocked`, `claimed`.
- **Wann:** einmal je Lauf, wenn eine Session beginnt oder eine Leiste geöffnet wird, und bei „Neu laden“. Sonst nie: nicht im Takt der Chats und nicht nach einer Festlegung. Gibt es noch keinen Plan, wird beim Laden nicht gefragt.
- **Niemand wartet darauf:** Session-Start und die Befehle `/graph` und `/orchestrator` zeigen erst, was da ist, und fragen das Ticket-System gleich danach.
- **Was nicht geht, ist ein Hinweis, kein Fehler:** Fehlt `gh` oder `glab`, ist niemand angemeldet oder kommt keine Liste zurück, läuft alles ohne Tickets weiter, und die Fläche sagt es („Keine Tickets aus GitHub: …“). Beim Laden gilt dann der Stand der Tickets vom letzten Ableiten.
- **Gedeckelt:** höchstens 100 offene und 30 geschlossene Tickets je Aufruf, und zusammen höchstens 32.000 Zeichen ans Modell. Was fehlt, steht als Hinweis in der Fläche und im Block selbst.
- **Text von außen:** Titel und Text eines Tickets kann jemand geschrieben haben, der nicht zum Projekt gehört. Sie gehen einzeilig, gekürzt und ohne spitze Klammern ans Modell, und der Auftrag nennt sie ausdrücklich Daten, keine Aufträge.

### Was das Modell bekommt

Einen Block `<tickets>` nach GOAL.md und den Festlegungen, vor der Doku, je Ticket eine Zeile. Ein erfundenes Beispiel:

```
<tickets system="GitHub" offen="2" geschlossen="1">
#14 · offen · Gutschein an der Kasse prüfen · Labels: bereich:kasse · Bereich: kasse · zugewiesen: kassenwart · Text: Der Gutschein wird geprüft, bevor die Zahlart gewählt ist.
#16 · offen · Rechnung als PDF · Labels: bereich:kasse, blocked · Bereich: kasse · blockiert laut Label · blockiert laut Ticket von: #15
#11 · geschlossen am 2026-09-12 · Zahlarten festlegen · Labels: bereich:kasse · Bereich: kasse
</tickets>
```

Der Auftrag sagt dazu (Entscheidungen 12 bis 15 der Spezifikation):

- Ein Bündel ist ein Bündel von Tickets, die ein Chat in einem Zug erledigen würde, in der Regel nie ein einzelnes Ticket.
- Jedes Bündel nennt seine Tickets im neuen Feld `"tickets"` der Antwort, und seine Punkte nennen sie mit Nummer und Titel.
- Die zweite Zeile nennt den Fortschritt: „3 von 8 erledigt“.
- Labels, die einen Bereich nennen, sind der stärkste Hinweis auf den Strang.
- Wem ein Ticket zugewiesen ist, der macht es.
- Was ein Ticket laut Ticket-System blockiert, steht als Grund da. Was das Modell nur schließt, ist „vermutet“.
- Ein Ticket, das auf eine Auskunft von außen wartet, steht in „Später“ mit diesem Grund.

Ohne den Block `<tickets>` gilt nichts davon, und die Eingabe ist Zeichen für Zeichen die von vorher.

### Der frische Stand

Erledigt, bereit und blockiert kommen bei jedem Laden aus dem Ticket-System, ohne Modell-Aufruf. Das ist eine Rechnung aus Plan und Tickets, die auf den gespeicherten Plan gelegt wird: Gespeichert bleibt, was das Modell gesagt hat, die Ansichten zeigen das Ergebnis. Für jedes Bündel, das Tickets nennt:

1. **Fortschritt.** Die zweite Zeile beginnt mit „n von m erledigt“, gezählt aus den Tickets. Was das Modell selbst gezählt hat, fällt weg.
2. **Erledigt.** Sind alle seine Tickets geschlossen, ist das Bündel erledigt und steht in „Hinter uns“.
3. **Aufgehalten.** Trägt jedes seiner offenen Tickets ein Label, das es aufhält, wartet das Bündel und steht in „Später“. Trägt nur ein Teil eines, ist es zum Teil möglich und steht in „Jetzt möglich“. Die zweite Zeile nennt die Tickets: „#16 blockiert“, „#18 wartet auf Auskunft“. Ein Bündel, das laut Plan ohnehin auf etwas wartet, das noch offen ist, bleibt in „Später“.
4. **Wieder möglich.** Ein Bündel, das wartete, ist bereit, wenn der Grund dafür weg ist: Das Bündel, auf das es wartete, ist jetzt erledigt, oder das Label, das es beim Ableiten aufhielt, ist fort. Wartet es aus einem Grund, den nur das Modell kennt, bleibt es stehen. Von selbst machen die Tickets ein Bündel also nie möglich.
5. **Wieder offen.** Ist ein Ticket eines erledigten Bündels wieder offen, ist das Bündel nicht mehr erledigt.
6. **Wer.** Sind alle offenen Tickets derselben einen Person zugewiesen, endet die zweite Zeile mit „macht <Name>“.
7. **Ein Ticket, das das Ticket-System nicht mehr nennt,** gilt als geschlossen, wenn die Liste der offenen Tickets vollständig ist (weniger als 100). Sonst bleibt es, wie es beim Ableiten stand. Nennt das Ticket-System gar keines der Tickets vom Ableiten mehr, oder ist es ein anderes als damals, gilt für alle der Stand vom Ableiten, und die Fläche sagt es.

Ein Bündel ohne Tickets bleibt genau, wie das Modell es gesagt hat. Was das Modell sonst in die zweite Zeile geschrieben hat, bleibt stehen, solange der Stand des Bündels derselbe ist.

Offene Tickets, die es beim letzten Ableiten noch nicht gab, gehören zu keinem Bündel. Beide Ansichten zählen sie in einer Zeile: „3 neue Tickets seit dem letzten Ableiten“. In ein Bündel bringt sie erst „Neu ableiten“.

Was der frische Stand ändert, gilt nicht als Änderung eines Laufs: Als voriger Plan gilt weiter, was die Ansichten gerade zeigen.

### Welche Labels etwas bedeuten

Ohne Einstellung gilt:

- Ein Label heißt **blockiert**, wenn sein Name `block` enthält.
- Ein Label heißt **wartet auf Auskunft**, wenn sein Name `wartet`, `waiting`, `needs-info` oder `question` enthält.
- Kein Label gilt von selbst als **Bereichs-Label**. Das Modell sieht die Labels trotzdem.

Das ist grob: `non-blocking` enthält auch `block`. Wer es genau will, nennt die Labels in GOAL.md, in einem freiwilligen Abschnitt:

```
## Tracker
Blockiert: blocked, steht-still
Wartet auf Auskunft: needs-info
Bereich: bereich:
```

- `Blockiert:` und `Wartet auf Auskunft:` nennen Labels beim Namen, mit Komma getrennt. Dann zählen genau diese, die Vorgabe nicht mehr. Groß- und Kleinschreibung ist egal.
- `Bereich:` nennt, womit Bereichs-Labels beginnen. Mit `bereich:` nennt das Label `bereich:kasse` den Bereich „kasse“, und die Zeile des Tickets sagt es dem Modell.
- Jede der drei Zeilen ist für sich freiwillig. Die Zeilen dürfen Listenpunkte sein und fett geschrieben.
- Bei Tickets als Markdown ist der Status das Label: `Status: blocked` hält ein Ticket auf.

### Was die Ansichten zeigen

- Die Eckdaten eines Laufs nennen das Ticket-System und die Zahl der gelesenen Tickets: „… aus 5 Dateien, 1 Chat, 30 Commits und 14 Tickets (GitHub)“.
- Die Zeile im Graphen und die Karte eines Bündels mit Tickets zeigen den Fortschritt, auch wenn das Bündel auf ein anderes wartet.
- Die aufgeklappte Zeile und die Detail-Fläche nennen die Tickets mit Nummer, Titel und Zeichen: `✓` geschlossen, `○` offen, `·` aufgehalten, dann mit „(blockiert)“ oder „(wartet auf Auskunft)“. Punkte, die nur ein Ticket wiederholen, stehen nicht noch einmal da.
- Der Auftrag fürs Eingabefeld nennt die Tickets und sagt, welche schon geschlossen sind.

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
| `plan.json` | der letzte gelungene Lauf: die rohe Antwort des Modells, womit sie aufgeräumt wurde, die Tickets, die der Lauf gelesen hat, der Text von GOAL.md, die Festlegungen, die das Modell bekommen hat, was der Lauf am Plan davor geändert hat, die Eckdaten und der Plan, so wie das Modell ihn gesagt hat |
| `festlegungen.json` | die Festlegungen, die noch nicht in GOAL.md stehen: `{ "version": 1, "festlegungen": [{ "satz": "…", "zeit": 1791115200000 }] }` |
| `letzter.json` | der letzte Lauf, auch ein gescheiterter: Dauer, Verbrauch, Quellen, Festlegungen, Antwort, Hinweise, Änderungen |
| `lauf-<zeit>.json` | derselbe Inhalt je Lauf |
| `letzte-eingabe.txt` | was das Modell als Eingabe bekommen hat |

`plan.json` trägt seit Version 0.4.0 die Version 2: Dazugekommen sind `festlegungen` (eine Liste von Sätzen) und `aenderungen` (`null` nach dem ersten Lauf, sonst `eintraege` und `endziel`). Eine Datei der Version 1 lädt weiter; sie zeigt keine Änderungen und gilt beim nächsten Lauf als voriger Plan.

Seit Version 0.5.0 trägt sie die Version 3: Dazugekommen sind unter `fakten` das Ticket-System (`tracker`) und die Zahl der gelesenen Tickets (`tickets`), und unter `umfeld.tickets` je gelesenem Ticket Schlüssel, Titel, ob es geschlossen war, Labels und Zuweisung. Damit lässt sich der Plan auch ohne Ticket-System wieder so zeigen, wie er beim Ableiten stand, und es ist zu sehen, welche Tickets seitdem neu sind. Dateien der Versionen 1 und 2 laden weiter; sie nennen keine Tickets.

Beide Ansichten lesen dieselbe `plan.json`. Ein Plan, den die Version 0.1.0 des Orchestrators unter `~/.claude/orchestrator/<schlüssel>/plan.json` abgelegt hat, wird nicht von selbst übernommen. Die Datei hat dieselbe Form: Wer sie nach `~/.claude/ziel-graph/<schlüssel>/plan/plan.json` kopiert, sieht den alten Plan wieder. Sonst genügt „Neu ableiten“.

## Aufbau der Fläche

Die Leiste setzt viele kleine Bilder neben- und untereinander. Kein Bild liegt über einem anderen.

- Jede Karte ist ein eigenes kleines SVG. Das Stück Verbindungslinie über und unter der Karte gehört zu ihrem Bild; Bilder einer Spalte stoßen ohne Lücke aneinander, so läuft die Linie durch.
- Neben jeder Karte steht ihr Knopf „›“. Ein Bild nimmt keine Klicks an.
- Je Band eine Reihe, darin je Strang eine Spalte. Jede Spalte ist in jeder Reihe gleich breit: Ihre Box hat eine Mindestbreite, und jedes Bild ohne Knopf ist so breit wie Karte und Knopf zusammen.
- Die Breite der Karten folgt der Breite der Leiste. Reicht sie, steht die Detail-Fläche rechts neben den Karten. Sonst steht sie darunter. Reicht es auch für Spalten nicht, stehen die Stränge untereinander.
- Die Detail-Fläche steht nie über den Karten: Sonst würden die Karten bei jeder Wahl verrutschen.
- Von oben nach unten: Endziel und Eckdaten, der Stand von GOAL.md, die Knöpfe „Neu ableiten“ und „Neu laden“, das Feld für eine Festlegung, was der letzte Lauf geändert hat, die Karten mit der Detail-Fläche, die Chats ohne Karte, die Liste der Festlegungen, die Hinweise.
- Farben: „Auto“ folgt dem Farbschema, „Hell“ und „Dunkel“ legen es fest.

Für den Beispiel-Shop der Tests (die GOAL.md von oben, 4 Stränge, 11 Bündel) sind das 34 Bilder mit zusammen etwa 26.000 Zeichen Markup (mit festem Farbschema etwa 19.000); das größte Bild hat rund 1.400 Zeichen. Die Engine erlaubt je Bild 131.072.

## Dateien des Mods

Alles steht unter `plugins/ziel-graph/`. Nur `hooks/register.tsx` fasst die Engine an; die anderen Dateien rechnen und zeichnen.

| Datei | Inhalt |
| --- | --- |
| `hooks/register.tsx` | der Zugang zur Engine: Laden, der Lauf, die Handgriffe aller Knöpfe, die zwei Leisten |
| `hooks/chats.ts` | die laufenden Chats: ihre Dateien, die Selbst-Anmeldung, der Stand nach einer Antwort; welches Ticket-System das Repo nutzt |
| `hooks/plan/goal.ts` | GOAL.md lesen, auch den Abschnitt „Tracker“; die Aufträge zum Anlegen, zum Festlegen und zum Eintragen der Festlegungen |
| `hooks/plan/quellen.ts` | GOAL.md, Tickets, Doku, Chats und Commits für einen Lauf lesen |
| `hooks/plan/tickets.ts` | die Tickets: lesen aus GitHub, GitLab und Markdown-Dateien, was die Labels bedeuten, die Zeile fürs Modell |
| `hooks/plan/frisch.ts` | der frische Stand: aus Plan und Tickets, was erledigt, bereit und blockiert ist |
| `hooks/plan/festlegungen.ts` | die lokalen Festlegungen: lesen, aufnehmen, zurücknehmen, mit denen aus GOAL.md zusammenführen |
| `hooks/plan/ableiten.ts` | der Auftrag ans Modell, die Eingabe mit Festlegungen und vorigem Plan, das Aufräumen der Antwort zum Plan |
| `hooks/plan/vergleich.ts` | der neue Plan gegen den vorigen: was sich geändert hat |
| `hooks/plan/lauf.ts` | ein Lauf von Anfang bis Ende; Speichern und Laden |
| `hooks/plan/lesen.ts` | was beide Ansichten aus dem Plan in denselben Worten sagen, auch zu Festlegungen und Änderungen |
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
- **Tickets** sind nur gegen die Test-Engine geprüft, mit erfundenen Tickets und vorgetäuschter Ausgabe von `gh` und `glab`. Kein echtes Repo wurde gefragt. Die Felder für GitHub sind an der echten Ausgabe von `gh` nachgesehen. **GitLab ist ganz ungeprüft:** `glab` war beim Bauen nicht installiert; die Felder stammen aus der Beschreibung der Schnittstelle. Offen ist dort auch, ob `glab api` `:id` in jedem Repo ersetzt und was es ohne Anmeldung ausgibt.
- **`gh issue list --state closed --limit 30`** ordnet wohl nach dem Anlegen, nicht nach dem Schließen; nachgeprüft ist das nicht. Dann stimmt „zuletzt geschlossen“ bei GitHub nur ungefähr: Ein altes Ticket, das gerade geschlossen wurde, kann in der Eingabe fehlen. Der frische Stand merkt es trotzdem, weil es nicht mehr unter den offenen steht.
- **Verknüpfungen** zwischen Tickets liest der Mod nicht als solche, weder die von GitLab noch die von GitHub (`blockedBy`). Was ein Ticket blockiert, erfährt das Modell aus Labels und aus der Zeile „Blocked by“ im Text. Der frische Stand rechnet nur mit Labels und mit dem, worauf ein Bündel laut Plan wartet.
- **Ob das Modell die Regeln für Tickets befolgt** (Bündel statt einzelner Tickets, Bereichs-Labels, Zuweisung), zeigt erst ein echter Lauf in einem Repo mit Tickets.
- **Ziel-Karten, Zuständigkeit je Bahn und das Ausblenden nach Personen** (Entscheidungen 13 und 14 der Spezifikation) gibt es weiter nicht. Wer ein Bündel macht, steht nur in seiner zweiten Zeile.
- **Festlegungen und Fortschreiben** sind nur gegen die Test-Engine und mit erfundenen Antworten geprüft. Ob das Modell die Festlegungen befolgt und ob der Plan mit dem vorigen als Vorgabe wirklich ruhiger wird, zeigt erst ein echter Lauf. Ob das Feld für eine Festlegung nach „Festlegen“ in der App leer dasteht, auch.
- **Was hinter uns liegt, wächst.** Beim Fortschreiben bleibt jedes erledigte Bündel eine eigene Zeile des Plans, damit kein Lauf Erledigtes neu zusammenfasst und das als Änderung erscheint. Beide Ansichten fassen es je Strang zusammen. Über viele Läufe kann der Plan so an die Grenze von 40 Bündeln stoßen; wann und wie Erledigtes dann aus dem Plan fällt, ist nicht entschieden.
- **Vorschläge** des ableitenden Modells, die der Nutzer mit Ja oder Nein beantwortet (Entscheidung 16 der Spezifikation), gibt es noch nicht, und keinen Merge Request auf Knopfdruck: Den Eintrag in GOAL.md macht der Chat auf Zuruf.
