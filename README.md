# claude-mods

Eigene Mods für Claude Code (Desktop-App und Terminal). Ein Mod ist ein Plugin aus Function Hooks: Er zeichnet eine Seitenleiste, hängt sich an Ereignisse der Session und bringt eigene Slash-Befehle mit. Das Repo ist zugleich ein Marketplace.

## Was drin ist

Ein Mod: `ziel-graph`, Version 0.6.0. Er hält je Repo einen Plan und zeigt ihn in zwei Ansichten.

| Befehl | Was er zeigt |
| --- | --- |
| `/graph` | schmal: oben die laufenden Chats (Stand, nächster Schritt, offene Frage), darunter der Plan als Graph |
| `/orchestrator` | breit: derselbe Plan als Prozesskarten, je Strang eine Spalte, mit einer Detail-Fläche zur gewählten Karte. Von dort legt man Aufträge ins Eingabefeld, gibt Festlegungen ein und kann, als Versuch, einem wartenden Chat antworten |

- **Der Anker ist `GOAL.md`** in der Wurzel des Projekt-Repos: Endziel, Zwischenziele, Stränge und Festlegungen. Der Mod liest sie nur; schreiben tut sie der Chat auf Zuruf. Fehlt sie oder das Ziel eines Strangs, sagt der Mod das.
- **Den Plan leitet ein Modell-Aufruf ab,** per Knopf „Neu ableiten“: aus `GOAL.md`, den Festlegungen, den Tickets, der Doku, den Chats, den Commits und dem vorigen Plan. Danach zeigen beide Ansichten, was sich geändert hat.
- **Tickets** liest der Mod aus GitHub, aus GitLab oder als Markdown-Dateien. Ihr Stand kommt bei jedem Laden frisch, ohne Modell-Aufruf. Ohne Tickets läuft der Mod auch.
- **Chats** bekommen nach jeder Antwort eine Zusammenfassung. Ein fertiger Chat verschwindet nach 24 Stunden aus der Liste, ein stiller nach 7 Tagen; gelöscht wird nichts.

Wie der Mod arbeitet und wie `GOAL.md` aussieht, steht in `docs/orchestrator.md`. Die Entscheidungen stehen in `docs/ziel-graph-spec.md`, der Stand und was offen ist in `docs/offen.md`.

## Auf einem Rechner einrichten

Einmal je Rechner, danach die App neu starten:

```bash
claude plugin marketplace add Tzy197/claude-mods
```

```bash
claude plugin install ziel-graph@claude-mods
```

Den Orchestrator gab es kurz als eigenen Mod (0.1.0). Seit Ziel-Graph 0.3.0 steckt er im Ziel-Graph. Wer ihn noch installiert hat, entfernt ihn mit `claude plugin uninstall orchestrator@claude-mods`.

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

Die Daten liegen unter `~/.claude/ziel-graph/<schlüssel>/`: je Chat eine Datei mit seinem Stand, und im Unterordner `plan/` der Plan, jeder Lauf mit Eingabe und Antwort des Modells und die Festlegungen, die noch nicht in `GOAL.md` stehen. Der Schlüssel kommt aus der Adresse von `origin`, ohne `origin` aus dem Pfad des Ordners. Die Daten liegen auf dem Rechner, der die Session führt. Zwischen Rechnern wandert nichts.

## Voraussetzungen des Ziel-Graphen

- `git` im Pfad, für den Branch-Namen des Chats und die letzten Commits. Ohne Git-Repo läuft der Mod trotzdem.
- Für Tickets `gh` (GitHub) oder `glab` (GitLab), angemeldet. Tickets als Markdown-Dateien unter `.scratch/<vorhaben>/issues/` liest der Mod selbst. Fehlt das Werkzeug, läuft er ohne Tickets weiter und sagt es.
- Jeder Modell-Aufruf läuft mit `claude-sonnet-5-5`: einer nach jeder Antwort eines Chats, der sich angemeldet hat oder aufgenommen wurde, und einer je „Neu ableiten“.

## Prüfen

```bash
claude plugin validate .
```

```bash
claude plugin validate plugins/ziel-graph
```

```bash
claude plugin test plugins/ziel-graph
```

## Lizenz

MIT, siehe `LICENSE`.

## Noch nicht geprüft

- Was seit Version 0.3.0 dazukam, ist in der App noch nicht angesehen, auch die Karten-Ansicht nicht.
- GitLab: Dieser Zweig ist nur gegen nachgestellte Ausgaben getestet.
- Ob ein zugeschaltetes Gerät die Seitenleiste einer Session zeichnet, die auf einem anderen Rechner läuft.

Die ganze Liste steht in `docs/offen.md`.
