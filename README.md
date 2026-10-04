# claude-mods

Eigene Mods für Claude Code (Desktop-App und Terminal). Ein Mod ist ein Plugin aus Function Hooks: Er zeichnet eine Seitenleiste, hängt sich an Ereignisse der Session und bringt eigene Slash-Befehle mit.

## Was drin ist

| Mod | Befehle | Was er tut |
| --- | --- | --- |
| `pfad-board` | `/board`, `/pfad`, `/ziel` | Zeigt alle parallelen Chats eines Repos als Pfade: Stand, nächster Schritt, offene Frage. Ein Chat mit eigenem Branch oder Ticket meldet sich selbst an. |
| `ziel-graph` | `/graph` | Zeichnet Ziele und Schritte hochkant wie einen Git-Graphen. Stand: Schritt 1, nur zeichnen, mit festen Beispieldaten. |

## Auf einem Rechner einrichten

Einmal je Rechner, danach die App neu starten:

```bash
claude plugin marketplace add Tzy197/claude-mods
```

```bash
claude plugin install pfad-board@claude-mods
```

```bash
claude plugin install ziel-graph@claude-mods
```

## Aktualisieren

```bash
claude plugin marketplace update claude-mods
```

Danach die App neu starten: Ein Mod lädt beim Start der App.

## Was nicht im Repo liegt

Die Daten des Pfad-Boards bleiben auf dem jeweiligen Rechner unter `~/.claude/pfad-board/<repo-name>/`: die Stände der Chats und das Ziel. Zwei Rechner haben damit zwei getrennte Boards.

## Voraussetzungen des Pfad-Boards

- `git` im Pfad, für den Branch-Namen des Chats.
- `glab` im Pfad und im Repo angemeldet, für Ticket-Titel und das Ziel aus der Karte mit dem Label `wayfinder:map`. Ohne `glab` läuft das Board weiter, nur ohne Ticket-Titel und ohne Ziel aus der Karte.
- Die Zusammenfassung nach jeder Antwort macht ein Modell-Aufruf (`claude-sonnet-5-5`).

## Prüfen

```bash
claude plugin validate plugins/pfad-board
```

```bash
claude plugin test plugins/ziel-graph
```

## Lizenz

MIT, siehe `LICENSE`.

## Noch nicht geprüft

- Ob Mods mit Function Hooks über einen Marketplace genauso laden wie aus einem lokalen Ordner.
- Ob ein zugeschaltetes Gerät die Seitenleiste einer Session zeichnet, die auf einem anderen Rechner läuft.
