# claude-mods

Eigene Mods für Claude Code (Desktop-App und Terminal). Ein Mod ist ein Plugin aus Function Hooks: Er zeichnet eine Seitenleiste, hängt sich an Ereignisse der Session und bringt eigene Slash-Befehle mit.

## Was drin ist

| Mod | Befehle | Was er tut |
| --- | --- | --- |
| `ziel-graph` | `/graph`, `/orchestrator` | Der Plan eines Repos in zwei Ansichten, mit `GOAL.md` als Anker. `/graph` zeigt schmal die laufenden Chats (Stand, nächster Schritt, offene Frage) und darunter den Plan als Graph. `/orchestrator` zeigt breit denselben Plan als Prozesskarten, je Strang eine Spalte; von dort legt man Aufträge ins Eingabefeld und kann, als Versuch, einem wartenden Chat antworten. Den Plan leitet ein Modell-Aufruf aus `GOAL.md`, der Doku, den Chats und den Commits ab. Fehlt `GOAL.md` oder das Ziel eines Strangs, sagt der Mod das. Mehr in `docs/orchestrator.md`. |

## Auf einem Rechner einrichten

Einmal je Rechner, danach die App neu starten:

```bash
claude plugin marketplace add Tzy197/claude-mods
```

```bash
claude plugin install ziel-graph@claude-mods
```

Bis Version 0.2 gab es den Orchestrator als eigenen Mod. Wer ihn noch installiert hat, entfernt ihn mit `claude plugin uninstall orchestrator@claude-mods`: Er steckt jetzt im Ziel-Graph.

Der Ziel-Graph ersetzt das frühere Pfad-Board. Ist davon noch eine alte Fassung lokal installiert (`~/.claude/skills/pfad-board`), muss sie vorher weg: Sonst fassen beide Mods jede Antwort zusammen.

## Aktualisieren

```bash
claude plugin marketplace update claude-mods
```

```bash
claude plugin update ziel-graph@claude-mods
```

Danach die App neu starten: Ein Mod lädt beim Start der App.

## Was nicht im Repo liegt

Die Chat-Stände liegen unter `~/.claude/ziel-graph/<schlüssel>/`, eine Datei je Chat; der Plan und jeder Lauf mit Eingabe und Antwort des Modells im Unterordner `plan/`. Der Schlüssel kommt aus der Adresse von `origin`, ohne `origin` aus dem Pfad des Ordners. Sie liegen auf dem Rechner, der die Session führt. Zwischen Rechnern wandert nichts.

## Voraussetzungen des Ziel-Graphen

- `git` im Pfad, für den Branch-Namen des Chats. Ohne Git-Repo läuft der Mod trotzdem.
- Für Ticket-Titel `glab` (GitLab) oder `gh` (GitHub), angemeldet. Tickets als Markdown-Dateien unter `.scratch/<vorhaben>/issues/` liest der Mod selbst. Ohne Ticket-System läuft er ohne Ticket-Titel.
- Die Zusammenfassung nach jeder Antwort und das Ableiten des Plans macht je ein Modell-Aufruf (`claude-sonnet-5-5`).

## Prüfen

```bash
claude plugin validate plugins/ziel-graph
```

```bash
claude plugin test plugins/ziel-graph
```

## Lizenz

MIT, siehe `LICENSE`.

## Noch nicht geprüft

- Ob ein zugeschaltetes Gerät die Seitenleiste einer Session zeichnet, die auf einem anderen Rechner läuft.
