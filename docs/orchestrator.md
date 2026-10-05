# Orchestrator: der Plan, GOAL.md und die Karten-Ansicht

Stand: 2026-10-05, Version 0.6.0.

Diese Datei beschreibt den ganzen Mod `ziel-graph`, so wie er gebaut ist: wie der Plan entsteht, was `GOAL.md` ist, was mit Festlegungen, Tickets, Dauerläufern und Chats geschieht, wo die Daten liegen, und die breite Ansicht `/orchestrator` im Einzelnen. Der Name der Datei stammt aus der Zeit, als der Orchestrator ein eigener Mod war. Die Entscheidungen dahinter stehen in `docs/ziel-graph-spec.md`. Was geprüft ist und was nicht, steht in `docs/offen.md`: In der App ist seit Version 0.3.0 nichts davon angesehen.

## Überblick

Der Mod hat je Repo einen Plan und zeigt ihn in zwei Ansichten:

- **`/graph`**, die schmale Leiste in jedem Chat: oben die laufenden Chats, darunter der Plan als Graph.
- **`/orchestrator`**, die breite Leiste neben einem Chat, von dem aus man arbeitet: derselbe Plan als Prozesskarten.

Beide teilen sich alles, was zählt: eine Ableitung, einen gespeicherten Plan, dieselben Chats und dieselbe GOAL.md. Wer in der einen „Neu ableiten“ drückt, sieht den neuen Plan auch in der anderen. Nur was man einstellt, hat jede für sich: Eine gewählte Karte ändert den Graphen nicht, ein aufgeklapptes Bündel die Karten nicht.

Der Plan besteht aus Strängen (im Graphen Bahnen, auf den Karten Spalten), aus Bündeln in den drei Zonen „Hinter uns“, „Jetzt möglich“ und „Später“, aus dem Stamm mit Zwischenzielen und Endziel und aus der Zuordnung der Chats zu Bündeln.

| Version | Was dazukam |
| --- | --- |
| 0.3.0 | ein Plan für beide Ansichten; der Graph zeichnet den echten Plan |
| 0.4.0 | Festlegungen, Fortschreiben des vorigen Plans, was ein Lauf geändert hat |
| 0.5.0 | Tickets als Quelle, ihr Stand bei jedem Laden frisch |
| 0.6.0 | fertige und stille Chats, Dauerläufer, `Art:` und `Wer:` in GOAL.md |

## GOAL.md

GOAL.md ist der Anker des Plans (Entscheidung des Nutzers vom 2026-10-05). Die Datei liegt in der Wurzel des Projekt-Repos und nennt das Endziel, die Zwischenziele auf dem Weg dorthin, je Strang das größere Ziel, seine Art und wer ihn macht, und die Festlegungen des Nutzers. Was noch nicht klar ist, bleibt offen und wird mit der Zeit gefüllt.

**Der Mod schreibt GOAL.md nie.** Er liest sie nur. Schreiben tut sie der Chat, auf Zuruf des Nutzers; die Knöpfe beider Ansichten legen dafür nur den Auftrag ins Eingabefeld.

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
Art: <Ziel oder Dauerläufer; die Zeile darf fehlen>
Wer: <wer diesen Strang macht; die Zeile darf fehlen>

## Festlegungen
- <ein Satz, der bei jedem Ableiten des Plans gewinnt>

## Tracker
Blockiert: <die Labels dafür>
Wartet auf Auskunft: <die Labels dafür>
Bereich: <womit Bereichs-Labels beginnen>
```

Der Abschnitt „Tracker“ ist freiwillig und nur für ein Repo mit Tickets da; mehrere Labels trennt ein Komma. Der Auftrag „GOAL.md mit dem Chat entwerfen“ nennt den Abschnitt nicht.

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
Wer: Mara

### Suche
Ziel: Jedes Produkt in zwei Klicks finden

### Betrieb
Art: Dauerläufer
Wer: Jonas

## Festlegungen
- Die Gutscheine gehören zur Kasse, nicht zum Katalog.
- Der Lasttest kommt erst nach dem großen Umbau.

## Tracker
Blockiert: blocked, steht-still
Wartet auf Auskunft: needs-info
Bereich: bereich:
```

Die Namen sind erfunden. Hier haben Kasse und Betrieb noch kein Ziel. Ihre Spalten sagen „kein Ziel festgelegt“ und haben den Knopf „Ziel festlegen“. In der schmalen Ansicht steht dafür über dem Graphen die Zeile „Ohne Ziel in GOAL.md: Kasse, Betrieb“ mit je einem Knopf.

### Wie die Datei gelesen wird

Die Datei darf unvollständig und eigenwillig geschrieben sein.

- **Abschnitte** erkennt der Mod an ihrer Überschrift, in jeder Tiefe und in jeder Reihenfolge: „Endziel“; „Zwischenziele“ oder „Meilensteine“; „Stränge“, „Straenge“ oder „Bahnen“; „Festlegungen“; „Tracker“, „Ticket-System“, „Tickets“ oder „Labels“. Die erste Überschrift („# Ziel“) ist frei. Andere Abschnitte übergeht er.
- **Endziel:** der erste Absatz, wörtlich. Auch „## Endziel: der Satz“ gilt.
- **Zwischenziele:** je Listenpunkt eines, in der Reihenfolge der Datei. `- [x]` heißt erreicht. Eingerückte Zeilen darunter sind Erläuterung und zählen nicht.
- **Stränge:** Jede Überschrift unter „Stränge“ ist ein Strang. Die Reihenfolge der Datei ist die Reihenfolge der Spalten. Eine Liste statt Überschriften geht auch: `- Kasse: Bestellen ohne Umweg`.
- **Felder eines Strangs:** `Ziel:`, `Gehört zu:`, `Art:` und `Wer:`, auch als Listenpunkt oder fett. „Gehört zu“ muss eines der Zwischenziele nennen; sonst steht ein Hinweis in der Fläche.
- **Art:** „Dauerläufer“ (auch „Dauerlaeufer“ oder „dauer“) oder „Ziel“; statt `Art:` geht auch `Typ:`. Fehlt die Zeile oder ist sie offen, sagt GOAL.md nichts dazu. Steht dort etwas anderes, zählt die Zeile nicht, und ein Hinweis sagt es.
- **Wer:** der Name dahinter, wörtlich, höchstens 24 Zeichen; statt `Wer:` geht auch `Zuständig:` oder `Verantwortlich:`.
- **Festlegungen:** je Listenpunkt ein Satz, wörtlich. Die Zeile gleich darunter setzt einen langen Satz fort; ein eingerückter Listenpunkt ist Erläuterung und zählt nicht. Ohne Liste zählt jede Zeile. Steht derselbe Satz zweimal da, gilt er einmal, und die Fläche sagt es. Tiefer als „Stränge“ und unter ihr darf die Überschrift nicht stehen: Dort ist jede Überschrift ein Strang.
- **Tracker:** siehe „Welche Labels etwas bedeuten“ weiter unten. Über Ziele sagt der Abschnitt nichts.
- **Offen** heißt zum Beispiel: leer, „noch offen“, „offen“, „unklar“, „?“, „–“, „tbd“ oder ein stehen gebliebener Platzhalter in spitzen Klammern.
- Kommentare (`<!-- … -->`) und Code-Blöcke zählen nicht. Gelesen werden höchstens 24.000 Zeichen.
- **Im Worktree** zählt zuerst die GOAL.md des Worktrees, sonst die der Haupt-Wurzel.

### Was aus GOAL.md folgt

- GOAL.md geht als erste und maßgebliche Quelle ans Modell, dazu was der Mod aus ihr gelesen hat, mit festen Kennungen für Stränge und Zwischenziele.
- **Ihre Stränge sind die Spalten** und im Graphen die Bahnen. Das Modell ordnet ihnen nur Bündel zu. Benennt es einen Strang um, legt es zwei zusammen oder lässt es einen weg, gilt trotzdem GOAL.md; die Abweichung steht unter „Beim Ableiten aufgefallen“.
- **Ihr Endziel steht wörtlich da.**
- **Ihre Zwischenziele** stehen unter den Bändern, in ihrer Reihenfolge. Im Graphen stehen sie auf dem Stamm: Ein abgehaktes trägt den gefüllten Punkt, ins erste offene münden die Bahnen der Ziele.
- Findet das Modell in den anderen Quellen einen Strang, der in GOAL.md fehlt, hängt er hinten an und ist als „nicht in GOAL.md“ markiert.
- Ein Strang ohne Ziel sagt „kein Ziel festgelegt“. Was das Modell dazu vermutet, steht daneben als „vermutet: …“.
- **Ihre Art eines Strangs gewinnt:** Sagt GOAL.md `Art: Dauerläufer` oder `Art: Ziel`, gilt das, was auch immer das Modell sagt. Sagt GOAL.md nichts, zählt, was das Modell sagt.
- **Wer einen Strang macht,** steht in der breiten Ansicht im Kopf seiner Spalte hinter dem Namen und in der schmalen hinter seinem Namen in der Legende („Kasse · Mara“). Ans Modell geht die Zeile nur als Teil von GOAL.md. Für ein einzelnes Bündel gewinnt die Zuweisung im Ticket-System: Es sagt dann „macht <Name>“.
- **Ihre Festlegungen** gehen als verbindliche Regeln ans Modell, siehe unten.
- **GOAL.md wird bei jedem Laden frisch gelesen.** Ein Ziel, das der Chat gerade eingetragen hat, zeigt „Neu laden“ sofort, ohne Modell-Aufruf. Hat sich GOAL.md seit dem letzten Ableiten geändert, sagen es beide Ansichten.

### Ohne GOAL.md

Die breite Ansicht sagt zuerst „GOAL.md fehlt“, erklärt in einem Satz, wofür sie da ist, und bietet den Knopf „GOAL.md mit dem Chat entwerfen“. Die schmale sagt es in einer Zeile, mit demselben Knopf. Dasselbe gilt für eine GOAL.md, die weder Endziel noch Zwischenziel noch Strang nennt: Sie heißt „noch leer“, auch wenn sie Festlegungen nennt. Das Ableiten läuft trotzdem: Das Modell schneidet die Stränge selbst. Alles über Ziele steht dann als „vermutet“ da.

## Ableiten

Den Plan leitet ein einzelner Modell-Aufruf mit `claude-sonnet-5-5` ab. Er startet nur über den Knopf „Neu ableiten“, in einer der zwei Ansichten, nie von selbst. In den bisherigen Läufen dauerte er etwa 30 Sekunden; nach 240 Sekunden bricht er ab. Beide Leisten zählen mit, das Ende kommt als Hinweis. Läuft schon ein Lauf, startet kein zweiter. Scheitert ein Lauf, bleibt der vorige Plan stehen.

### Woraus abgeleitet wird

Die Eingabe hat je Quelle einen Block, in dieser Reihenfolge:

1. GOAL.md und was der Mod daraus gelesen hat
2. die Festlegungen
3. die Tickets, wenn das Repo welche hat
4. die Doku: `README.md`, `CLAUDE.md` und jede Markdown-Datei unter `docs/`
5. die laufenden Chats mit Name, Branch, Stand, nächstem Schritt und offener Frage
6. die letzten 30 Commits mit Datum und Betreff
7. der vorige Plan in Kurzform

Der Mod setzt kein Ticket-System voraus und läuft auch ohne Git und ohne Repo. Gedeckelt ist alles: von jeder Doku-Datei höchstens 24.000 Zeichen, von allen zusammen 96.000, höchstens 40 Dateien, unter `docs/` bis vier Ebenen tief; höchstens 12 Chats; von den Tickets zusammen 32.000 Zeichen. Was gekürzt oder ausgelassen wurde, steht als Hinweis in der Fläche.

### Was mit der Antwort geschieht

Das Modell antwortet mit einem JSON. Der Mod räumt es auf: Was nicht passt, lässt er weg oder repariert es, und jede Reparatur steht in der breiten Ansicht unter „Beim Ableiten aufgefallen“. Die schmale Ansicht nennt nur die Zahl der Hinweise.

- Der Plan fasst höchstens 40 Bündel, je Bündel 8 Punkte, und auf dem Stamm 6 Schritte nach den Zwischenzielen oder dem Treffpunkt. Stränge aus GOAL.md fallen nie weg. Weitere, die das Modell findet, kommen nur dazu, solange es zusammen höchstens 7 sind.
- Ein Bündel ohne Quelle, oder mit einer Quelle, die das Modell nicht bekommen hat, gilt als vermutet.
- Arbeitet ein Chat an einem Bündel, das nicht in „Jetzt möglich“ stand, setzt der Mod es dorthin.
- Wartet ein Bündel auf etwas Erledigtes oder auf sich selbst, fällt der Verweis weg.
- Nur eine Antwort ohne JSON, ohne Strang oder ohne brauchbares Bündel scheitert.

### Der vorige Plan und was sich geändert hat

Zwei Läufe über dasselbe Repo ergaben früher zwei verschiedene Bilder. Deshalb wird der Plan fortgeschrieben.

- **Der vorige Plan geht mit ans Modell**, in Kurzform und am Ende der Eingabe: je Bündel id, Strang, Zone, Stand, Titel und Tickets, dazu die Schritte des Stamms. Der Auftrag dazu: Jedes Bündel, das es weiter gibt, behält id und Titel. Zone, Stand und Zuschnitt ändern sich nur, wo sich die Quellen geändert haben oder eine Festlegung es verlangt. Bündel kommen nur dazu und fallen nur weg, wenn die Quellen einen Grund nennen.
- **Der erste Lauf** hat keinen vorigen Plan.
- **Als voriger Plan gilt, was die Ansichten gerade zeigen:** der gespeicherte Plan, aufgeräumt gegen die GOAL.md von jetzt und mit dem Stand der Tickets von jetzt. Was der Nutzer selbst in GOAL.md geändert hat und was die Tickets geändert haben, zählt deshalb nicht als Änderung des Laufs.
- **Nach jedem Lauf vergleicht der Mod** den neuen Plan mit dem vorigen, Bündel für Bündel nach der id: neu, weggefallen, umbenannt, in einer anderen Zone oder einem anderen Stand, in einem anderen Strang. Dasselbe für die Schritte des Stamms und für das Endziel. Beim Strang zählt der Name, nicht die id.
- **Die schmale Ansicht** sagt es in einer Zeile: „Seit dem letzten Ableiten: 2 neu, 1 erledigt, 1 verschoben“. Hat sich nichts geändert, steht „nichts geändert“ da.
- **Die breite Ansicht** zeigt unter dieser Zeile je Änderung eine eigene, über den Karten, höchstens zwölf.
- **Eine Karte und eine Zeile des Graphen**, die der Lauf neu gebracht, verschoben oder umbenannt hat, sagen das vorn in ihrer zweiten Zeile.
- **Das Ergebnis liegt beim Plan** und steht bis zum nächsten gelungenen Lauf da, auch nach „Neu laden“ und in einer neuen Session.

## Festlegungen

Eine Festlegung ist ein Satz des Nutzers, der bei jedem Ableiten gewinnt. Mit ihr korrigiert er den Plan, ohne die abgeleitete Datei anzufassen. Zwei erfundene Beispiele stehen oben in der GOAL.md.

- **Fest stehen sie in GOAL.md**, unter „## Festlegungen“, je Satz ein Listenpunkt.
- **Eingeben** tut der Nutzer eine neue in der breiten Ansicht, im Feld unter „Neu ableiten“. Das Feld ist immer da und hängt an keiner Karte. Die Handy-App zeichnet kein Eingabefeld; dort steht nur ein Hinweis.
- **Sie gilt ab dem nächsten Ableiten.** Bis dahin sagt die breite Ansicht „Die Festlegungen sind andere als beim letzten Ableiten“.
- **Sie liegt erst lokal**, in `plan/festlegungen.json`, weil der Mod GOAL.md nie schreibt. Der Knopf „In GOAL.md eintragen lassen“ legt dem Chat den Auftrag ins Eingabefeld.
- **Steht ein Satz in GOAL.md, fällt seine lokale Kopie weg**, beim nächsten Laden oder Ableiten. Verglichen wird nachsichtig: Leerraum, Groß- und Kleinschreibung und der Punkt am Ende zählen nicht. Streicht der Nutzer den Satz später wieder aus GOAL.md, kommt er nicht von selbst zurück.
- **Beide Ansichten sagen, wie viele es gibt** und wie viele noch nicht in GOAL.md stehen: „3 Festlegungen, 1 noch nicht in GOAL.md“. Die breite Ansicht sagt es immer, die schmale, sobald es eine gibt. Die Liste steht in der breiten Ansicht unter den Karten; eine lokale trägt den Zusatz „(noch nicht in GOAL.md)“ und den Knopf „Entfernen“. Was in GOAL.md steht, streicht nur der Chat.
- **Das Modell bekommt alle**, die aus GOAL.md und die lokalen. Sein Auftrag nennt sie verbindlich: Sie gehen allem anderen vor, außer den Strängen und dem Endziel aus GOAL.md.
- **Nachgeprüft wird das nicht.** Ob das Modell eine Festlegung befolgt hat, sieht der Nutzer am Plan. Ein Satz ist höchstens 300 Zeichen lang.

## Tickets

Hat das Repo ein Ticket-System, steht sein wirklicher Stand dort. Der Mod liest ihn, setzt ihn aber nie voraus und schreibt dort nichts.

### Welches Ticket-System

Das entscheidet eine Stelle (`trackerAus` in `hooks/chats.ts`): zuerst die erste Zeile von `docs/agents/issue-tracker.md` (`# Issue tracker: GitHub`, `GitLab` oder `Local Markdown`), sonst der Host von `origin`. Passt nichts, gibt es keine Tickets, und es wird nichts aufgerufen.

Wer ein Repo bei GitHub oder GitLab hat, dessen Tickets aber nicht nutzt, schreibt in `docs/agents/issue-tracker.md` eine erste Zeile, die keines der drei nennt, zum Beispiel `# Issue tracker: keines`.

### Was gelesen wird

| Ticket-System | Aufruf, je ohne Shell und nur lesend |
| --- | --- |
| GitHub | `gh issue list --state open --limit 100 --json number,title,state,labels,assignees,milestone,updatedAt,body`, danach `gh issue list --state closed --limit 30 --json number,title,state,closedAt,labels` |
| GitLab | `glab api projects/:id/issues?state=opened&per_page=100`, danach `glab api projects/:id/issues?state=closed&order_by=updated_at&per_page=30` |
| Markdown | kein Aufruf: die Dateien `.scratch/<vorhaben>/issues/<NN>-<name>.md`, erst in der Arbeitskopie der Session, sonst in der Wurzel des Repos |

- **Je Ticket** merkt sich der Mod: Nummer, Titel, offen oder geschlossen, Labels, wem es zugewiesen ist, den Meilenstein, einen Auszug des Textes (höchstens 160 Zeichen, nur bei offenen), was der Text als Blockade nennt („Blocked by: …“) und den Tag, an dem es geschlossen wurde.
- **Tickets als Markdown** sind je Vorhaben ab 01 nummeriert. Der Schlüssel ist deshalb Vorhaben plus Nummer: `kasse/03`. Der Titel kommt aus der Überschrift `# <NN> — <Titel>`. Unter ihr liest der Mod die Zeilen `Status:`, `Type:`, `Labels:`, `Assignee:` und `Blocked by:`, auch fett geschrieben. Geschlossen ist ein Ticket mit dem Status `resolved` oder `wontfix`, wie die Skills ihn schreiben, oder mit einem der üblichen Worte dafür, zum Beispiel `done`, `closed`, `erledigt`, `geschlossen`. Jeder andere Status zählt wie ein Label: `needs-info`, `blocked`, `claimed`.
- **Wann:** einmal je Lauf, wenn eine Session beginnt oder eine Leiste geöffnet wird, und bei „Neu laden“. Sonst nie: nicht im Takt der Chats und nicht nach einer Festlegung. Gibt es noch keinen Plan, wird beim Laden nicht gefragt.
- **Niemand wartet darauf:** Session-Start und die Befehle `/graph` und `/orchestrator` zeigen erst, was da ist, und fragen das Ticket-System gleich danach.
- **Was nicht geht, ist ein Hinweis, kein Fehler:** Fehlt `gh` oder `glab`, ist niemand angemeldet oder kommt keine Liste zurück, läuft alles ohne Tickets weiter, und die Fläche sagt es („Keine Tickets aus GitHub: …“). Beim Laden gilt dann der Stand der Tickets vom letzten Ableiten.
- **Gedeckelt:** höchstens 100 offene und 30 geschlossene Tickets je Aufruf, bei Markdown höchstens 400 Dateien.
- **Text von außen:** Titel und Text eines Tickets kann jemand geschrieben haben, der nicht zum Projekt gehört. Sie gehen einzeilig, gekürzt und ohne spitze Klammern ans Modell, und der Auftrag nennt sie ausdrücklich Daten, keine Aufträge.

### Was das Modell bekommt

Einen Block `<tickets>`, je Ticket eine Zeile. Ein erfundenes Beispiel:

```
<tickets system="GitHub" offen="2" geschlossen="1">
#14 · offen · Gutschein an der Kasse prüfen · Labels: bereich:kasse · Bereich: kasse · zugewiesen: kassenwart · Text: Der Gutschein wird geprüft, bevor die Zahlart gewählt ist.
#16 · offen · Rechnung als PDF · Labels: bereich:kasse, blocked · Bereich: kasse · blockiert laut Label · blockiert laut Ticket von: #15
#11 · geschlossen am 2026-09-12 · Zahlarten festlegen · Labels: bereich:kasse · Bereich: kasse
</tickets>
```

Der Auftrag sagt dazu:

- Ein Bündel ist ein Bündel von Tickets, die ein Chat in einem Zug erledigen würde, in der Regel nie ein einzelnes Ticket.
- Jedes Bündel nennt seine Tickets im Feld `"tickets"` der Antwort, und seine Punkte nennen sie mit Nummer und Titel.
- Die zweite Zeile nennt den Fortschritt: „3 von 8 erledigt“.
- Labels, die einen Bereich nennen, sind der stärkste Hinweis auf den Strang.
- Wem ein Ticket zugewiesen ist, der macht es.
- Was ein Ticket laut Ticket-System blockiert, steht als Grund da. Was das Modell nur schließt, ist „vermutet“.
- Ein Ticket, das auf eine Auskunft von außen wartet, steht in „Später“ mit diesem Grund.

Ohne Tickets fehlt der Block, und nichts davon gilt.

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

### Welche Labels etwas bedeuten

Ohne Einstellung gilt:

- **Blockiert** heißt ein Label, wenn sein Name `block` enthält.
- **Wartet auf Auskunft** heißt ein Label, wenn sein Name `wartet`, `waiting`, `needs-info` oder `question` enthält.
- **Bereichs-Label** ist von selbst keines. Das Modell sieht die Labels trotzdem.

Das ist grob: `non-blocking` enthält auch `block`. Wer es genau will, nennt die Labels in GOAL.md im Abschnitt „Tracker“, wie im Beispiel oben:

- `Blockiert:` und `Wartet auf Auskunft:` nennen Labels beim Namen, mit Komma getrennt. Dann zählen genau diese, die Vorgabe nicht mehr. Groß- und Kleinschreibung ist egal.
- `Bereich:` nennt, womit Bereichs-Labels beginnen. Mit `bereich:` nennt das Label `bereich:kasse` den Bereich „kasse“, und die Zeile des Tickets sagt es dem Modell.
- Jede der drei Zeilen ist für sich freiwillig. Die Zeilen dürfen Listenpunkte sein und fett geschrieben.
- Bei Tickets als Markdown ist der Status das Label: `Status: blocked` hält ein Ticket auf.

### Was die Ansichten zeigen

- Die Eckdaten eines Laufs nennen das Ticket-System und die Zahl der gelesenen Tickets: „… aus 5 Dateien, 1 Chat, 30 Commits und 14 Tickets (GitHub)“.
- Die Zeile im Graphen und die Karte eines Bündels mit Tickets zeigen den Fortschritt, auch wenn das Bündel auf ein anderes wartet.
- Die aufgeklappte Zeile und die Detail-Fläche nennen die Tickets mit Nummer, Titel und Zeichen: `✓` geschlossen, `○` offen, `·` aufgehalten, dann mit „(blockiert)“ oder „(wartet auf Auskunft)“. Punkte, die nur ein Ticket wiederholen, stehen nicht noch einmal da.
- Der Auftrag fürs Eingabefeld nennt die Tickets und sagt, welche schon geschlossen sind.

## Dauerläufer

Ein Strang ist ein Ziel oder ein Dauerläufer. Ein Ziel hat ein Ende. Ein Dauerläufer hat keines und läuft neben den Zielen her: Werkzeug, Tests, Betrieb. Seine Bahn endet im Graphen in einem Pfeil, seine Spalte sagt unten „Dauerläufer: läuft weiter“.

### Wann ein Dauerläufer aktiv ist

Aktiv ist er, wenn eines von beidem gilt:

- **Ein laufender Chat hängt an einem seiner Bündel.** Ein fertiger oder ausgeblendeter Chat zählt nicht.
- **Ein Ticket eines seiner Bündel wurde in den letzten 7 Tagen geschlossen.** Gezählt wird in ganzen Tagen, nach dem Tag, den das Ticket-System nennt.

Offene Tickets allein zählen nicht, ein neues Label oder ein Kommentar auch nicht. Ohne Tickets zählt nur der Chat. Das ist eine reine Rechnung aus Plan, Chats und Uhr (`hooks/plan/dauer.ts`), bei jedem Zeichnen neu und ohne Modell-Aufruf.

### Was ein Dauerläufer zeigt, der ruht

Ein Dauerläufer, der nicht aktiv ist, ruht. Am Beispiel-Shop: Am „Betrieb“ arbeitet kein Chat, er hat zwei offene Bündel.

- **Im Graphen** stehen seine Bündel aus „Jetzt möglich“ und „Später“ in einer Zeile: „Betrieb: ruht · 2 offen“, blass und mit dem kleinen Punkt. Sie steht in „Jetzt möglich“, wenn eines davon jetzt möglich ist, sonst in „Später“. Sie klappt auf wie „… erledigt“; darunter stehen die Titel der Bündel. Die Übersicht sagt an der Zeile der Bahn „ruht · 2 offen“.
- **Auf den Karten** zeigt seine Spalte den Kopf und eine Karte „ruht · 2 offen“ statt der Karten seiner offenen Bündel. Ihre Detail-Fläche nennt die Bündel und hat je jetzt möglichem einen Knopf „Auftrag:“ mit dem Titel des Bündels: Sonst ließe sich an ihm aus der Fläche keine Arbeit mehr beginnen.
- **Was hinter uns liegt,** bleibt die Zeile oder Karte „n erledigt“.
- **Gezählt** wird, was er offen hat, nicht: „4 Bündel jetzt möglich“ meint die Bündel, die einzeln dastehen.
- **Neue Aktivität öffnet ihn von selbst:** Sobald ein laufender Chat an einem seiner Bündel hängt oder ein Ticket frisch geschlossen ist, stehen seine Bündel wieder einzeln da. An welchem Bündel ein Chat hängt, sagt das Modell beim Ableiten; ein Chat, der neu beginnt, weckt ihn also erst nach dem nächsten „Neu ableiten“.

### Vom Ziel zum Dauerläufer

Ist in einem Ziel jedes Bündel erledigt, sagen es beide Ansichten in einer Zeile: „Suche hat alles erledigt. Zum Dauerläufer machen?“. Der Knopf „Zum Dauerläufer machen“ daneben legt den Auftrag ins Eingabefeld, das mit dem Nutzer zu klären und dann unter dem Strang `Art: Dauerläufer` in GOAL.md einzutragen. Steht die Zeile dort, zeigt „Neu laden“ den Strang als Dauerläufer, ohne Modell-Aufruf. Ohne GOAL.md steht die Frage nicht da: Dort steht erst der Hinweis, die Datei anzulegen.

Den Rückweg, vom Dauerläufer zum Ziel, bietet der Mod nicht an. Wer ihn will, schreibt `Art: Ziel` in GOAL.md.

## Chats

Die Chats sind in beiden Ansichten dieselben. Der Mod schreibt je Session eine Datei mit dem Stand ihres Chats: `~/.claude/ziel-graph/<schlüssel>/<session>.json`.

- **Anmelden.** Von selbst meldet sich ein Chat nach seiner nächsten Antwort an, wenn er einen eigenen Branch hat (nicht `main` oder `master`) oder sein Branch oder sein erster Auftrag eine Ticketnummer nennt. Jeden anderen nimmt der Knopf „Diesen Chat aufnehmen“ der schmalen Ansicht auf, „Diesen Chat herausnehmen“ nimmt ihn heraus. Wer herausgenommen ist, bleibt draußen und zählt auch nicht als ausgeblendet.
- **Stand.** Nach jeder Antwort eines angemeldeten Chats fasst ein kleiner Modell-Aufruf (`claude-sonnet-5-5`) zusammen: Stand, nächster Schritt, offene Frage an den Nutzer und ob der Chat fertig ist. Beim ersten Mal gibt er dem Chat auch den Namen. Bleibt die Zusammenfassung aus, bleibt der Stand, wie er war.
- **Ticket-Titel.** Nennt der Chat ein Ticket, schlägt der Mod einmal den Titel nach: über `gh issue view`, über `glab api` oder in den Markdown-Dateien. Dort gilt die Nummer nur, wenn genau eine Datei passt.
- **Neu lesen.** Jede Session, in der der Mod geladen ist, liest die Dateien alle 20 Sekunden neu und meldet eine neue Frage eines anderen Chats als Hinweis. Ändert sich nichts, wird die breite Ansicht nicht neu gezeichnet: So stört das Lesen niemanden, der dort gerade tippt. Ihre Zeitangaben wie „vor 3 Min“ rücken deshalb erst weiter, wenn sich etwas ändert oder jemand „Neu laden“ drückt. Die Zeitangaben der schmalen Ansicht laufen alle 20 Sekunden weiter.
- **Am Plan.** Welcher Chat an welchem Bündel hängt, hat das Modell beim Ableiten zugeordnet. Ob er noch läuft und ob er wartet, sagen die Dateien. Ein Chat, der nach dem Ableiten dazukam, steht in der breiten Ansicht unter „Chats ohne Karte“ und lässt sich dort wählen. Im Graphen trägt die Zeile des Bündels die Marke „Chat“.

### Fertige und stille Chats

- **Fertig** ist ein Chat, wenn die Zusammenfassung es sagt: Die Aufgabe, für die er begonnen wurde, ist erledigt, und er wartet auf nichts. Der Auftrag ist vorsichtig: im Zweifel nicht fertig. Ein Chat mit einer offenen Frage ist nie fertig, und einer, dessen Zusammenfassung ausblieb, auch nicht. In der Datei steht das als `"fertig": true` oder `false`; eine Datei ohne das Feld gilt als nicht fertig.
- **24 Stunden.** Ein fertiger Chat steht noch 24 Stunden nach seiner letzten Antwort in der Liste der schmalen Ansicht: blass, unter den laufenden, mit dem Wort „fertig“. Danach ist er ausgeblendet.
- **7 Tage.** Ein Chat ohne neue Antwort seit 7 Tagen ist still und ausgeblendet, auch wenn er auf den Nutzer wartet.
- **Ausgeblendet ist nicht gelöscht.** Die Datei bleibt liegen. Die Liste sagt in einer blassen Zeile, wie viele es sind: „2 fertige oder stille Chats ausgeblendet“. Der Knopf „Zeigen“ daneben blendet sie ein, blass und mit „fertig“ oder „still“, bis neu geladen wird: „Neu laden“, ein neuer Befehl `/graph` oder `/orchestrator`, eine neue Session. Der Takt von 20 Sekunden blendet sie nicht wieder aus.
- **Eine neue Antwort** in einem fertigen oder ausgeblendeten Chat schreibt seinen Stand neu: Er steht sofort wieder da, und er läuft wieder, wenn die Zusammenfassung ihn nicht erneut fertig nennt. Setzt das Modell „fertig“ einmal zu früh, holt die nächste Antwort den Chat also zurück.
- **Nur ein laufender Chat zählt.** Ein fertiger oder ausgeblendeter Chat markiert keine Zeile und keine Karte, zählt nicht als wartend, löst keinen Hinweis aus, hält keinen Dauerläufer offen und geht nicht ans Modell. Er ist weiter angemeldet und lässt sich herausnehmen.

## Die breite Ansicht `/orchestrator`

### Was sie zeigt

- **Je Strang eine Spalte.** Im Kopf steht das Ziel des Strangs und hinter seinem Namen, wer ihn laut GOAL.md macht.
- **Drei Bänder von oben nach unten:** „Hinter uns“ (je Strang eine Karte „n erledigt“), „Jetzt möglich“ und „Später“.
- **Darunter die Ziele:** die Zwischenziele und zuletzt das Endziel.
- **Eine Karte** hat ein Zeichen in der Farbe ihres Strangs, den Titel auf bis zu zwei Zeilen und eine zweite Zeile mit Fortschritt oder Grund. Arbeitet ein Chat an ihr, steht dort „Chat läuft“ oder „Chat wartet auf dich“; die wartende Karte ist warm umrandet.
- **Die Detail-Fläche** zeigt zur gewählten Karte ihre Tickets und Punkte, ihre Quelle, worauf sie wartet und den Chat daran mit Stand, „Weiter“ und offener Frage.

### Bedienung

| Was | Wie |
| --- | --- |
| Fläche öffnen | `/orchestrator`. Die Leiste wünscht sich eine große Breite; breiter ziehen kann sie nur der Nutzer. Der letzte gespeicherte Plan des Repos wird geladen. |
| Plan ableiten | Knopf „Neu ableiten“, hier oder in `/graph`. |
| Neu lesen | Knopf „Neu laden“: der gespeicherte Plan, GOAL.md, die Chats und der Stand der Tickets. Kein Modell-Aufruf. |
| Farben | Auswahl „Farben“: „Auto“ folgt dem Farbschema, „Hell“ und „Dunkel“ legen es fest. |
| Karte wählen | Knopf „›“ an der Karte. Ohne Wahl gilt die erste Karte, an der ein anderer Chat auf den Nutzer wartet. |
| Arbeit beginnen | In der Detail-Fläche einer Karte aus „Jetzt möglich“: „Auftrag ins Eingabefeld legen“. Der Auftrag nennt Strang und dessen Ziel, Titel, Stand, Tickets, Punkte und Quelle. Abschicken tut ihn der Nutzer. |
| Schritt verstehen | „Erklären lassen“ legt die Bitte ins Eingabefeld, den Schritt mit einem kleinen Bild zu erklären. |
| Ziel festlegen | Knopf „Ziel festlegen“ unter dem Kopf eines Strangs ohne Ziel, „Endziel festlegen“ neben einem offenen Endziel. Beide legen einen Auftrag ins Eingabefeld. Die schmale Ansicht hat dieselben Knöpfe mit denselben Aufträgen. |
| Ziel zum Dauerläufer machen | Knopf „Zum Dauerläufer machen“ neben der Frage, in beiden Ansichten. |
| An einem Dauerläufer arbeiten, der ruht | Seine Karte „ruht“ wählen, dann in der Detail-Fläche „Auftrag:“ mit dem Titel des Bündels. |
| Festlegung eingeben | Den Satz ins Feld „Neue Festlegung“ unter „Neu ableiten“ tippen, dann Enter oder „Festlegen“. Kein Modell-Aufruf. |
| Festlegung zurücknehmen | Knopf „Entfernen“ neben einer Festlegung, die noch nicht in GOAL.md steht. |
| Festlegungen ins Repo bringen | Knopf „In GOAL.md eintragen lassen“: legt den Auftrag ins Eingabefeld, die lokalen Sätze unter „## Festlegungen“ einzutragen. |

Steht im Eingabefeld schon ein Entwurf, bleibt er stehen, und der Auftrag kommt dahinter.

Im Terminal gibt es keine Bilder. Dort stehen die Karten als Liste, je Karte eine Zeile, die sich drücken lässt.

### Aufbau der Fläche

Die Leiste setzt viele kleine Bilder neben- und untereinander. Kein Bild liegt über einem anderen.

- Jede Karte ist ein eigenes kleines SVG. Das Stück Verbindungslinie über und unter der Karte gehört zu ihrem Bild; Bilder einer Spalte stoßen ohne Lücke aneinander, so läuft die Linie durch.
- Neben jeder Karte steht ihr Knopf „›“. Ein Bild nimmt keine Klicks an.
- Je Band eine Reihe, darin je Strang eine Spalte. Jede Spalte ist in jeder Reihe gleich breit: Ihre Box hat eine Mindestbreite, und jedes Bild ohne Knopf ist so breit wie Karte und Knopf zusammen.
- Die Breite der Karten folgt der Breite der Leiste. Reicht sie, steht die Detail-Fläche rechts neben den Karten. Sonst steht sie darunter. Reicht es auch für Spalten nicht, stehen die Stränge untereinander.
- Die Detail-Fläche steht nie über den Karten: Sonst würden die Karten bei jeder Wahl verrutschen.
- Von oben nach unten: Endziel und Eckdaten, der Stand von GOAL.md, die Ziele, die alles erledigt haben, die Knöpfe „Neu ableiten“ und „Neu laden“, das Feld für eine Festlegung, was der letzte Lauf geändert hat, die Karten mit der Detail-Fläche, die Chats ohne Karte, die Liste der Festlegungen, die Hinweise (höchstens zwölf).

Die Tests prüfen am Beispiel-Shop, dass jedes Bild unter 2.000 Zeichen Markup bleibt und alle zusammen unter einem Viertel dessen, was die Engine für ein einziges Bild erlaubt (131.072). Beim Bau von 0.6.0 gemessen: 4 Stränge, 11 Bündel, der Dauerläufer „Betrieb“ ruht, das sind 34 Bilder mit zusammen etwa 25.000 Zeichen (mit festem Farbschema etwa 18.000); das größte hat rund 1.400.

### Versuch: von hier antworten

In der Detail-Fläche einer Karte, deren Chat auf den Nutzer wartet, steht unter der Überschrift „Versuch: von hier antworten“ ein Eingabefeld und der Knopf „Antwort schicken“. Der Versuch ist nur gegen die Test-Engine geprüft.

- **Senden:** `$.session.send` an die Session des wartenden Chats. Die Nachricht trägt die Marke `[[orchestrator-antwort v1]]`, allein in ihrer Zeile; in der Zeile danach stehen als JSON die Session, die Frage und die Antwort (höchstens 4.000 Zeichen).
- **Anzeige:** Die Fläche sagt „Zugestellt“ oder „Nicht zugestellt“ mit dem Grund, zum Beispiel wenn die andere Session nicht läuft. Zugestellt heißt: in der Warteschlange des Chats, nicht: gelesen.
- **Empfangen:** Jede Session, in der der Mod geladen ist, sieht eingehende Nachrichten an (`session.receive`). Sie nimmt eine Nachricht nur an, wenn drei Dinge stimmen: Sie trägt die Marke, sie ist für diese Session bestimmt, und die Engine weist sie als vom `$.session.send` dieses Mods verschickt aus, also mit dem Mod-Namen `ziel-graph`. Dann reicht sie sie als Prompt ein (`$.prompt.submit`). Alles andere lässt sie unangetastet durch.
- **Warum der dritte Punkt:** Schreibt das Modell einer anderen Session eine Nachricht mit der Marke, trägt sie keinen Mod-Namen und bleibt eine gewöhnliche Nachricht von nebenan. So kann sich kein anderer Chat als der Nutzer ausgeben. Der Mod-Name ist eine Angabe des Absenders und kein Beweis: Ein anderer installierter Mod könnte ihn nachahmen.
- **Der empfangene Text ist nur die Antwort.** Er steht im Prompt hinter dem Satz „Antwort aus dem Orchestrator auf deine offene Frage …, dort vom Nutzer eingegeben:“. Der Prompt läuft unter dem Namen des Mods, nicht als vom Nutzer getippt: Die Marke kann jeder Prozess desselben Nutzers schreiben, sie soll einer Nachricht nicht mehr Gewicht geben, als sie hat.
- Die Handy-App hat kein Eingabefeld; dort steht nur der Hinweis. Dem eigenen Chat antwortet man in seinem Eingabefeld.

Der Versuch steht für sich in `hooks/karten/antwort.tsx`. Wer ihn entfernt, löscht diese Datei und in `hooks/register.tsx` den Import und die eine Zeile `registriereAntwort(on)`.

## Die schmale Ansicht `/graph`

- **Oben die Chats:** die Zeile „3 Chats, 1 wartet auf dich“, dann je laufendem Chat Name, Alter, Branch, Stand, „Weiter: …“ und „Wartet auf dich: …“. Wer wartet, steht oben. Darunter blass die fertigen und die Zeile über die ausgeblendeten. Dazu die Knöpfe „Neu laden“ und „Diesen Chat aufnehmen“ oder „Diesen Chat herausnehmen“.
- **Darunter der Plan:** der Knopf „Neu ableiten“, die Hinweise zu GOAL.md mit ihren Knöpfen, die Zahl der Festlegungen, das Endziel, die Eckdaten des Laufs, die Zeile „n Bündel jetzt möglich · n laufen · n warten auf dich“ und was der letzte Lauf geändert hat.
- **Der Graph** im Aussehen „Ruhig“: Bahnen links, je Zeile ein Bündel mit Titel und zweiter Zeile. „Hinter uns“ steht je Bahn in einer Zeile „<Bahn>: n erledigt“. Die Knöpfe „Schritte“ und „Übersicht“ wechseln zwischen den Bündeln und einer Zeile je Strang.
- **Aufklappen:** Das Bild ist in Streifen je Zeile zerlegt. Eine Zeile mit Unterzeilen hat rechts einen Pfeil-Knopf; ein weiterer Knopf klappt alles auf oder zu. Aufgeklappt stehen dort der Chat, die Tickets, die Punkte und die Quelle.
- **Ohne Bild** (Terminal, oder ein Bild über der Grenze der Engine) steht der Graph als Liste da.
- **Ohne Plan** stehen nur die Chats da und der Hinweis, dass „Neu ableiten“ den Plan ableitet.
- Die Leiste wünscht sich 66 Zeichenzellen: so breit ist das Bild von 500 Pixeln. Die Zeichen stehen in `docs/ziel-graph-spec.md`.

## Speicherort

Alles liegt lokal unter `~/.claude/ziel-graph/<schlüssel>/`, auf dem Rechner, der die Session führt. Der Schlüssel kommt aus der Adresse von `origin`, sonst aus dem Pfad. Alle Worktrees eines Repos teilen den Ordner.

- **Direkt im Ordner** liegen die Stände der Chats, je Session eine Datei `<session>.json`.
- **Im Unterordner `plan/`** liegen der Plan und die Läufe. So zählt keine Datei eines Laufs als Chat.

| Datei unter `plan/` | Inhalt |
| --- | --- |
| `plan.json` | der letzte gelungene Lauf: die rohe Antwort des Modells, womit sie aufgeräumt wurde, die Tickets, die der Lauf gelesen hat, der Text von GOAL.md, die Festlegungen, die das Modell bekommen hat, was der Lauf am Plan davor geändert hat, die Eckdaten und der Plan, so wie das Modell ihn gesagt hat |
| `festlegungen.json` | die Festlegungen, die noch nicht in GOAL.md stehen: `{ "version": 1, "festlegungen": [{ "satz": "…", "zeit": 1791115200000 }] }` |
| `letzter.json` | der letzte Lauf, auch ein gescheiterter: Dauer, Verbrauch, Quellen, Festlegungen, Antwort, Hinweise, Änderungen |
| `lauf-<zeit>.json` | derselbe Inhalt je Lauf |
| `letzte-eingabe.txt` | was das Modell als Eingabe bekommen hat |

Beim Laden entsteht der Plan neu aus der gespeicherten Antwort, der GOAL.md von jetzt und den Tickets von jetzt.

`plan.json` trägt die Version 3. Version 2 (seit 0.4.0) brachte `festlegungen` und `aenderungen`, Version 3 (seit 0.5.0) unter `fakten` das Ticket-System und die Zahl der Tickets und unter `umfeld.tickets` je gelesenem Ticket Schlüssel, Titel, ob es geschlossen war, Labels und Zuweisung. Seit 0.6.0 steht dort bei einem geschlossenen Ticket auch der Tag, an dem es geschlossen wurde; die Version bleibt 3. Mit den gemerkten Tickets lässt sich der Plan auch ohne Ticket-System so zeigen, wie er beim Ableiten stand. Dateien der Versionen 1 und 2 laden weiter: Sie nennen keine Tickets, eine der Version 1 zeigt auch keine Änderungen. Die Datei eines Chats trägt seit 0.6.0 das Feld `fertig`.

Ein Plan, den der frühere Mod `orchestrator` 0.1.0 unter `~/.claude/orchestrator/<schlüssel>/plan.json` abgelegt hat, wird nicht von selbst übernommen. Die Datei hat dieselbe Form: Wer sie nach `~/.claude/ziel-graph/<schlüssel>/plan/plan.json` kopiert, sieht den alten Plan wieder. Sonst genügt „Neu ableiten“.

## Dateien des Mods

Alles steht unter `plugins/ziel-graph/`. Die Engine fassen nur `hooks/register.tsx` und, für den Versuch, `hooks/karten/antwort.tsx` an; die anderen Dateien rechnen und zeichnen.

| Datei | Inhalt |
| --- | --- |
| `hooks/register.tsx` | der Zugang zur Engine: die zwei Befehle, Laden, der Lauf, die Handgriffe aller Knöpfe, die zwei Leisten |
| `hooks/chats.ts` | die Chats: ihre Dateien, die Selbst-Anmeldung, der Stand nach einer Antwort, wer läuft, wer fertig ist und wer ausgeblendet wird; welches Ticket-System das Repo nutzt |
| `hooks/plan/goal.ts` | GOAL.md lesen, auch `Art:` und `Wer:` je Strang und den Abschnitt „Tracker“; die Aufträge zum Anlegen, zum Festlegen, zum Dauerläufer und zum Eintragen der Festlegungen |
| `hooks/plan/quellen.ts` | GOAL.md, Tickets, Doku, Chats und Commits für einen Lauf lesen |
| `hooks/plan/tickets.ts` | die Tickets: lesen aus GitHub, GitLab und Markdown-Dateien, was die Labels bedeuten, die Zeile fürs Modell |
| `hooks/plan/ableiten.ts` | der Auftrag ans Modell, die Eingabe mit Festlegungen und vorigem Plan, das Aufräumen der Antwort zum Plan |
| `hooks/plan/frisch.ts` | der frische Stand: aus Plan und Tickets, was erledigt, bereit und blockiert ist |
| `hooks/plan/dauer.ts` | Dauerläufer: wann einer aktiv ist und welche gerade ruhen |
| `hooks/plan/festlegungen.ts` | die lokalen Festlegungen: lesen, aufnehmen, zurücknehmen, mit denen aus GOAL.md zusammenführen |
| `hooks/plan/vergleich.ts` | der neue Plan gegen den vorigen: was sich geändert hat |
| `hooks/plan/lauf.ts` | ein Lauf von Anfang bis Ende; Speichern und Laden |
| `hooks/plan/lesen.ts` | was beide Ansichten aus dem Plan in denselben Worten sagen |
| `hooks/karten/karten.ts` | aus Plan und Chats werden Karten, Detail-Fläche und Aufträge |
| `hooks/karten/zeichnen.ts` | die Bilder und die Anordnung der Fläche |
| `hooks/karten/leiste.tsx` | die breite Leiste, ohne Engine |
| `hooks/karten/antwort.tsx` | der Versuch: von hier antworten |
| `hooks/graph/…` | die schmale Ansicht: aus dem Plan werden Zeilen (`zeilen.ts`), das Aussehen „Ruhig“ (`ruhig.ts`), das Bild (`zeichnen.ts`), die Streifen (`streifen.ts`), die Leiste mit der Liste der Chats (`leiste.tsx`) |
| `hooks/probe.ts` | zum Prüfen ohne App: aus dem Text einer `plan.json` der Graph und ein Bild der Karten |
| `hooks/fest.ts`, `teile.ts`, `worte.ts`, `zustand.ts` | feste Werte wie das Modell und die Farben, die Handgriffe der Knöpfe, Helfer für Texte, die Anfangswerte des Zustands |
| `types/index.d.ts` | die Form des Plans und des Zustands |
| `tests/` | die Tests; `welt.ts` stellt Dateien, Befehle und Modell aus dem Speicher, `shop.ts` den erfundenen Shop |

## Bekannte Grenzen

Was noch zu bauen und zu testen ist, steht in `docs/offen.md`. Hier steht, wo der Mod heute anders rechnet, als man erwarten könnte.

- **Verknüpfungen** zwischen Tickets liest der Mod nicht als solche, weder die von GitLab noch die von GitHub (`blockedBy`). Was ein Ticket blockiert, erfährt das Modell aus Labels und aus der Zeile „Blocked by“ im Text. Der frische Stand rechnet nur mit Labels und mit dem, worauf ein Bündel laut Plan wartet.
- **`gh issue list --state closed --limit 30`** ordnet wohl nach dem Anlegen, nicht nach dem Schließen; nachgeprüft ist das nicht. Dann stimmt „zuletzt geschlossen“ bei GitHub nur ungefähr: Ein altes Ticket, das gerade geschlossen wurde, kann in der Eingabe fehlen. Der frische Stand merkt es trotzdem, weil es nicht mehr unter den offenen steht.
- **Ein geschlossenes Ticket ohne Tag zählt nicht als Aktivität.** Den Tag kennt der Mod nur von den 30 zuletzt geschlossenen Tickets. Ein älteres Ticket, das gerade geschlossen wurde und dort fehlt, gilt als geschlossen, hält seinen Dauerläufer aber nicht offen. Bei GitHub kann das öfter vorkommen, siehe den Punkt davor.
- **Bei Tickets als Markdown** gilt ohne eine Zeile wie `Closed: 2026-10-01` der Tag, an dem die Datei zuletzt geschrieben wurde, als Tag des Schließens. Wer eine geschlossene Datei noch einmal anfasst, hält ihren Dauerläufer deshalb 7 Tage offen, obwohl bloßes Anfassen nicht zählen soll.
- **Die ausgeblendeten Chats werden nie weniger:** Der Mod löscht keine Datei. Über Monate wächst die Zahl in der Zeile, und „Zeigen“ listet sie alle. Ob und wann alte Dateien wegfallen, ist nicht entschieden.
- **Was hinter uns liegt, wächst.** Beim Fortschreiben bleibt jedes erledigte Bündel eine eigene Zeile des Plans, damit kein Lauf Erledigtes neu zusammenfasst und das als Änderung erscheint. Beide Ansichten fassen es je Strang zusammen. Über viele Läufe kann der Plan so an die Grenze von 40 Bündeln stoßen; wann und wie Erledigtes dann aus dem Plan fällt, ist nicht entschieden.
- **Ziel-Karten, Vorschläge des Modells und ein Merge Request** sind nicht gebaut, ebenso wenig das Ausblenden nach Bahnen und Personen.
