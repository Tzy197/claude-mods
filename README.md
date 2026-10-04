# claude-mods

Eigene Mods für Claude Code (Desktop-App und Terminal). Ein Mod ist ein Plugin aus Function Hooks: Er zeichnet eine Seitenleiste, hängt sich an Ereignisse der Session und bringt eigene Slash-Befehle mit.

## Was drin ist

| Mod | Befehle | Was er tut |
| --- | --- | --- |
| `ziel-graph` | `/graph` | Zeigt die laufenden Chats eines Repos: Stand, nächster Schritt, offene Frage. Ein Chat mit eigenem Branch oder Ticket meldet sich selbst an, jeden anderen nimmt ein Knopf in der Leiste auf. Der hochkant laufende Graph der Ziele zeigt bis zum ersten Plan nur erfundene Beispieldaten, auf Knopfdruck. Stand: Schritt 2 von 5. |

## Auf einem Rechner einrichten

Einmal je Rechner, danach die App neu starten:

```bash
claude plugin marketplace add Tzy197/claude-mods
```

```bash
claude plugin install ziel-graph@claude-mods
```

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

Die Chat-Stände des Ziel-Graphen liegen unter `~/.claude/ziel-graph/<schlüssel>/`, eine Datei je Chat. Der Schlüssel kommt aus der Adresse von `origin`, ohne `origin` aus dem Pfad des Ordners. Sie liegen auf dem Rechner, der die Session führt. Zwischen Rechnern wandert nichts.

## Voraussetzungen des Ziel-Graphen

- `git` im Pfad, für den Branch-Namen des Chats. Ohne Git-Repo läuft der Mod trotzdem.
- Für Ticket-Titel `glab` (GitLab) oder `gh` (GitHub), angemeldet. Tickets als Markdown-Dateien unter `.scratch/<vorhaben>/issues/` liest der Mod selbst. Ohne Ticket-System läuft er ohne Ticket-Titel.
- Die Zusammenfassung nach jeder Antwort macht ein Modell-Aufruf (`claude-sonnet-5-5`).

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
