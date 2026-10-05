import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { AUFRUFE } from '../hooks/plan/tickets'
import { lesePlan, zeichneGraph } from '../hooks/probe'

import { CHAT, GOAL, QUELLEN, TICKETS, alsGithub, alsGitlab, antwort, antwortMitTickets, pruefe } from './shop'
import type { ShopTicket } from './shop'
import {
  BREIT,
  GITHUB,
  GITLAB,
  GRAPH,
  JETZT,
  TAG,
  VERBRAUCH,
  WURZEL,
  baue,
  befehl,
  gespeichert,
  inhalt,
  legeDoku,
  leiteAb,
  mitBildern,
  mitTickets,
  ordnerVon,
} from './welt'
import type { Vorgabe } from './welt'

// Tickets als Quelle, durch den ganzen Mod: Ein Repo bei GitHub, eines bei GitLab und eines
// mit Tickets als Markdown-Dateien. `gh` und `glab` gibt es hier nur als Antworten aus dem
// Speicher des Tests: Kein echtes Repo wird gefragt.

const GH_OFFEN = 'gh issue list --state open --limit 100 --json number,title,state,labels,assignees,milestone,updatedAt,body'
const GH_ZU = 'gh issue list --state closed --limit 30 --json number,title,state,closedAt,labels'
const GL_OFFEN = 'glab api projects/:id/issues?state=opened&per_page=100'
const GL_ZU = 'glab api projects/:id/issues?state=closed&order_by=updated_at&per_page=30'
const GIT_LOG = 'git log -n 30 --date=short --pretty=format:%ad %s'
const BEI_GITHUB = `${ordnerVon('github.com+beispiel+shop')}/plan`
const BEI_GITLAB = `${ordnerVon('gitlab.example.org+beispiel+shop')}/plan`
// GOAL.md des Shops, die dazu sagt, welche Labels einen Bereich nennen.
const GOAL_MIT_TRACKER = `${GOAL}\n## Tracker\nBereich: bereich:\n`
const MIT_TICKETS = { isAnswered: true as const, text: antwortMitTickets({ chats: [] }), usage: VERBRAUCH }

// Der Shop bei GitHub: Was im Ticket-System steht, nennt `stand.tickets`.
const beiGithub = (on: On, vorgabe: Partial<Vorgabe> = {}) => {
  const stand = { tickets: TICKETS as readonly ShopTicket[] }
  const welt = baue(on, { remote: GITHUB, werkzeug: mitTickets(() => stand.tickets, alsGithub), modell: MIT_TICKETS, ...vorgabe })

  legeDoku(welt)
  welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL_MIT_TRACKER)

  return { welt, stand }
}

const anders = (tickets: readonly ShopTicket[], wie: Record<number, Partial<ShopTicket>>): ShopTicket[] =>
  tickets.map(one => ({ ...one, ...wie[one.nr] }))

test('GitHub: Der Lauf liest die Tickets über gh, gibt sie dem Modell, und beide Ansichten zeigen Fortschritt und Tickets', async ($, on) => {
  const { welt } = beiGithub(on)

  // Die Aufrufe, je ohne Shell: Beide lesen nur.
  expect(AUFRUFE.github.offen.join(' ')).toBe(GH_OFFEN)
  expect(AUFRUFE.github.zu.join(' ')).toBe(GH_ZU)

  // Ohne Plan gibt es nichts aufzufrischen: Das Öffnen fragt das Ticket-System nicht.
  await befehl($, 'orchestrator')
  expect(welt.laeufe).toEqual([])

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(ui, welt)

  // Ein Lauf fragt das Ticket-System einmal: die offenen Tickets, dann die zuletzt geschlossenen.
  expect(welt.laeufe).toEqual([GIT_LOG, GH_OFFEN, GH_ZU])
  expect(welt.fragen).toHaveLength(1)

  // Die Tickets stehen nach GOAL.md und vor der Doku, je Ticket eine Zeile.
  const eingabe = welt.fragen[0]?.prompt ?? ''

  expect(eingabe).toContain('</goal-gelesen>\n\n<tickets system="GitHub" offen="6" geschlossen="2">\n#14 · offen · Gutschein an der Kasse prüfen · Labels: bereich:kasse · Bereich: kasse · zugewiesen: kassenwart')
  expect(eingabe).toContain('#16 · offen · Rechnung als PDF · Labels: bereich:kasse, blocked · Bereich: kasse · blockiert laut Label · blockiert laut Ticket von: #15')
  expect(eingabe).toContain('#11 · geschlossen am 2026-09-12 · Zahlarten festlegen · Labels: bereich:kasse · Bereich: kasse\n</tickets>\n\n<doku datei="README.md">')
  expect(eingabe.match(/^#\d+ · /gm)).toHaveLength(8)

  // Die Eckdaten nennen das Ticket-System und die Zahl der gelesenen Tickets.
  const text = await inhalt(ui)

  expect(text).toContain('Abgeleitet gerade eben in 23 s aus 5 Dateien, 0 Chats, 30 Commits und 8 Tickets (GitHub) · claude-sonnet-5-5')
  expect(text).not.toContain('Beim Ableiten aufgefallen')
  expect(text).not.toContain('seit dem letzten Ableiten')
  expect(welt.toasts).toEqual(['Ableiten fertig nach 23 s: 11 Bündel in 4 Strängen'])
  // Jede Karte eines Bündels mit Tickets zeigt den Fortschritt, gezählt aus den Tickets.
  expect(text).toContain('  ○ Kasse · Entwurf Gutschein-Einlösung — 0 von 2 erledigt · macht kassenwart')
  expect(text).toContain('  · Kasse · Block Rechnungen — 0 von 1 erledigt · wartet auf: Entwurf Gutschein-Einlösung')
  expect(text).toContain('  · Katalog · 10 Rückfragen an den Einkauf — 0 von 1 erledigt · wartet auf Auskunft: Maße vom Einkauf')
  expect(text).toContain('  ○ Katalog · Katalog-Texte abnehmen — 0 von 1 erledigt')
  // Ein Bündel ohne Tickets steht da wie bisher. Der Dauerläufer „Betrieb“ hat keine Tickets,
  // und kein Chat arbeitet an ihm: Er ruht in einer Zeile.
  expect(text).toContain('  ○ Kasse · Entwurf Warenkorb-Regeln')
  expect(text).toContain('  · Betrieb · ruht · 2 offen — Ladezeit der Startseite senken · Umbau der Build-Skripte')

  // Die Detail-Fläche nennt die Tickets: Nummer, Titel und ob sie geschlossen sind.
  await ui.press({ key: 'karte-gutscheine' })

  const detail = await inhalt(ui)

  expect(detail).toContain('bereit · 0 von 2 erledigt · macht kassenwart')
  expect(detail).toContain('– ○ #14 Gutschein an der Kasse prüfen')
  expect(detail).toContain('– ○ #15 Restbetrag eines Gutscheins merken')
  // Den Punkt, der kein Ticket ist, gibt es weiter; die Punkte, die Tickets wiederholen, nicht.
  expect(detail).toContain('– Text für die Hilfe-Seite')
  expect(detail).not.toContain('– #14 Gutschein an der Kasse prüfen')
  expect(detail).toContain('Quelle: Tickets')
  await ui.press({ key: 'auftrag' })
  expect(welt.gefuellt.at(-1)?.text).toContain(
    'Die Tickets dazu:\n- #14 Gutschein an der Kasse prüfen (offen)\n- #15 Restbetrag eines Gutscheins merken (offen)\nDazu gehört:\n- Text für die Hilfe-Seite',
  )
  await ui.press({ key: `karte-fertig--kasse` })
  expect(await inhalt(ui)).toContain('– Zahlarten geklärt und 5 Entwürfe (2 von 2 erledigt)')

  // Gespeichert ist, was das Modell gesagt hat, und dazu die Tickets, die der Lauf gelesen hat.
  const datei = welt.dateien.get(`${BEI_GITHUB}/plan.json`) ?? ''
  const plan = gespeichert(welt, `${BEI_GITHUB}/plan.json`) as {
    version: number
    fakten: Record<string, unknown>
    umfeld: { quellen: string[]; tickets: { schluessel: string }[] }
    plan: { buendel: { id: string; meta: string; tickets?: unknown[] }[] }
  }

  expect(plan.version).toBe(3)
  expect(plan.fakten).toMatchObject({ tracker: 'github', tickets: 8, commits: 30 })
  expect(plan.umfeld.quellen.at(-1)).toBe('tickets')
  expect(plan.umfeld.tickets.map(one => one.schluessel)).toEqual(['14', '15', '16', '17', '18', '19', '12', '11'])
  expect(plan.umfeld.tickets[2]).toEqual({ schluessel: '16', titel: 'Rechnung als PDF', zu: false, labels: ['bereich:kasse', 'blocked'], zugewiesen: [] })
  expect(plan.plan.buendel.find(one => one.id === 'gutscheine')).toMatchObject({ meta: '0 von 2 erledigt', tickets: [{ schluessel: '14' }, { schluessel: '15' }] })
  expect(gespeichert(welt, `${BEI_GITHUB}/letzter.json`)).toMatchObject({
    quellen: { tickets: { tracker: 'github', gelesen: 8, offen: 6, gesendet: 8, namen: { blockiert: [], auskunft: [], bereich: ['bereich:'] } }, hinweise: [] },
  })
  expect(datei).not.toContain('macht kassenwart')

  await ui.unmount()
})

test('GitHub: „Neu laden“ holt erledigt, bereit und blockiert frisch aus den Tickets, ohne Modell-Aufruf', async ($, on) => {
  const { welt, stand } = beiGithub(on)

  await befehl($, 'orchestrator')

  const karten = await $.ui.mount({ ...BREIT, surface: 'terminal' })
  const graph = await $.ui.mount({ ...GRAPH, surface: 'desktop' })

  await leiteAb(karten, welt)

  const datei = welt.dateien.get(`${BEI_GITHUB}/plan.json`)

  // Seit dem Ableiten: zwei Tickets geschlossen, das Blockade-Label ist weg, ein neues Ticket.
  stand.tickets = [
    ...anders(TICKETS, { 14: { zu: '2026-10-04' }, 15: { zu: '2026-10-04' }, 16: { labels: ['bereich:kasse'] }, 17: { labels: ['bereich:katalog', 'blocked'] } }),
    { nr: 20, titel: 'Versandkosten anzeigen', labels: ['bereich:kasse'] },
  ]
  welt.laeufe.length = 0
  await karten.press({ key: 'laden' })

  // Genau die zwei Aufrufe, kein Modell, und die Plan-Datei bleibt, was das Modell gesagt hat.
  expect(welt.laeufe).toEqual([GH_OFFEN, GH_ZU])
  expect(welt.fragen).toHaveLength(1)
  expect(welt.dateien.get(`${BEI_GITHUB}/plan.json`)).toBe(datei)

  const text = await inhalt(karten)

  // Alle Tickets geschlossen: Das Bündel liegt hinter uns.
  expect(text).toContain('  ✓ Kasse · 2 erledigt — Zahlarten geklärt und 5 Entwürfe · Entwurf Gutschein-Einlösung')
  expect(text).not.toContain('Kasse · Entwurf Gutschein-Einlösung —')
  // Worauf es wartete, ist erledigt, und sein Label ist weg: Es ist jetzt möglich.
  expect(text).toContain('  ○ Kasse · Block Rechnungen — 0 von 1 erledigt')
  expect(text).not.toContain('Block Rechnungen — 0 von 1 erledigt ·')
  // Ein Ticket hat jetzt ein Blockade-Label: Das Bündel wartet.
  expect(text).toContain('  · Katalog · Katalog-Texte abnehmen — 0 von 1 erledigt · #17 blockiert')
  expect(text).toContain('1 neues Ticket seit dem letzten Ableiten')
  // Warenkorb, Rechnungen und Suchfelder; was der Dauerläufer offen hat, der ruht, zählt nicht mit.
  expect(text).toContain('3 Bündel jetzt möglich')
  // Was der Lauf geändert hatte, bleibt stehen: Der frische Stand ist keine Änderung eines Laufs.
  expect(text).not.toContain('Seit dem letzten Ableiten')

  // Dieselbe Lage in der schmalen Ansicht; aufgeklappt stehen die Tickets da.
  const schmal = await mitBildern(graph)

  expect(schmal).toContain('1 neues Ticket seit dem letzten Ableiten')
  expect(schmal).toContain('>Kasse: 2 erledigt</text>')
  expect(schmal).toContain('>0 von 1 erledigt · #17 blockiert</text>')
  expect(schmal).not.toContain('#17 Texte für Taschen abnehmen')
  await graph.press({ key: 'auf-katalog-texte' })
  expect(await mitBildern(graph)).toContain('>· #17 Texte für Taschen abnehmen (blockiert)</text>')
  await graph.press({ key: 'auf-rechnungen' })
  expect(await mitBildern(graph)).toContain('>○ #16 Rechnung als PDF</text>')
  expect(await mitBildern(graph)).toContain('>Quelle: Tickets</text>')

  // Wer eine Leiste öffnet, wartet nicht auf das Ticket-System: Der Befehl kehrt mit dem
  // zurück, was zuletzt bekannt war, und der frische Stand kommt gleich danach.
  welt.laeufe.length = 0
  stand.tickets = [...stand.tickets, { nr: 21, titel: 'Rabatt für Stammkunden', labels: ['bereich:kasse'] }]
  expect(await befehl($, 'graph')).toBe('Ziel-Graph geöffnet. (Oberflächen: desktop)')
  expect(welt.laeufe).toEqual([])
  expect(await mitBildern(graph)).toContain('1 neues Ticket seit dem letzten Ableiten')
  await welt.uhr.advance(0)
  expect(welt.laeufe).toEqual([GH_OFFEN, GH_ZU])
  expect(await mitBildern(graph)).toContain('2 neue Tickets seit dem letzten Ableiten')
  stand.tickets = stand.tickets.filter(one => one.nr !== 21)
  await karten.press({ key: 'laden' })

  // Eine Festlegung baut den Plan neu auf, fragt das Ticket-System aber nicht noch einmal.
  welt.laeufe.length = 0
  await karten.input({ key: 'fest-eingabe', text: 'Die Rechnungen kommen vor dem Lasttest.' })
  expect(welt.toasts.at(-1)).toBe('Festgelegt. Der Satz gilt ab dem nächsten Ableiten.')
  expect(welt.laeufe).toEqual([])
  expect(await inhalt(karten)).toContain('  · Katalog · Katalog-Texte abnehmen — 0 von 1 erledigt · #17 blockiert')
  expect(await inhalt(karten)).toContain('1 neues Ticket seit dem letzten Ableiten')
  // Auch der Takt, der die Chats liest, fragt es nicht.
  await welt.uhr.advance(60_000)
  expect(welt.laeufe).toEqual([])

  // Der nächste Lauf schreibt den Plan fort, den die Ansichten zeigen: mit dem frischen Stand
  // und je Bündel seinen Tickets. Was der Tracker geändert hat, ist keine Änderung des Laufs.
  welt.modell = {
    isAnswered: true,
    usage: VERBRAUCH,
    text: antwortMitTickets({
      chats: [],
      zeilen: JSON.parse(antwortMitTickets()).zeilen.map((one: { id: string }) =>
        one.id === 'gutscheine' ? { ...one, zone: 'hinter', stand: 'erledigt', meta: '2 von 2 erledigt' } : one.id === 'rechnungen' ? { ...one, zone: 'jetzt', stand: 'bereit', meta: '0 von 1 erledigt', wartetAuf: '', tickets: ['#16', '#20'] } : one,
      ),
    }),
  }
  await leiteAb(karten, welt)
  expect(welt.laeufe).toEqual([GIT_LOG, GH_OFFEN, GH_ZU])
  expect(welt.fragen[1]?.prompt).toContain('{"id":"gutscheine","bahn":"kasse","zone":"hinter","stand":"erledigt","titel":"Entwurf Gutschein-Einlösung","tickets":["#14","#15"]}')
  expect(welt.fragen[1]?.prompt).toContain('{"id":"rechnungen","bahn":"kasse","zone":"jetzt","stand":"bereit","titel":"Block Rechnungen","tickets":["#16"]}')
  expect(welt.fragen[1]?.prompt).toContain('#20 · offen · Versandkosten anzeigen · Labels: bereich:kasse · Bereich: kasse')

  const danach = await inhalt(karten)

  // Das Modell nannte „Katalog-Texte“ bereit; das Label am Ticket sagt es anders, und das galt schon vorher.
  expect(danach).toContain('Seit dem letzten Ableiten: nichts geändert')
  expect(danach).toContain('  ○ Kasse · Block Rechnungen — 0 von 2 erledigt')
  expect(danach).not.toContain('neues Ticket seit dem letzten Ableiten')
  expect(danach).toContain('30 Commits und 9 Tickets (GitHub)')

  await karten.unmount()
  await graph.unmount()
})

test('GitHub ohne ein einziges Ticket: Die Eingabe ist die ohne Tickets, nur die Eckdaten nennen GitHub', async ($, on) => {
  const { welt, stand } = beiGithub(on, { modell: { isAnswered: true, text: antwort({ chats: [] }), usage: VERBRAUCH } })

  stand.tickets = []
  await befehl($, 'orchestrator')

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(ui, welt)
  expect(welt.laeufe).toEqual([GIT_LOG, GH_OFFEN, GH_ZU])
  expect(welt.fragen[0]?.prompt).not.toContain('<tickets')
  expect(welt.fragen[0]?.prompt).toContain('</goal-gelesen>\n\n<doku datei="README.md">')
  expect(await inhalt(ui)).toContain('Abgeleitet gerade eben in 23 s aus 5 Dateien, 0 Chats, 30 Commits und 0 Tickets (GitHub) · claude-sonnet-5-5')
  expect(await inhalt(ui)).not.toContain('Beim Ableiten aufgefallen')
  expect(await inhalt(ui)).toContain('  ○ Kasse · Entwurf Gutschein-Einlösung')
  expect(gespeichert(welt, `${BEI_GITHUB}/plan.json`)).toMatchObject({ version: 3, fakten: { tracker: 'github', tickets: 0 }, umfeld: { tickets: [] } })
  // Ohne Tickets nennt die Antwort keine Quelle „tickets“: Sie gälte als unbekannt.
  expect((gespeichert(welt, `${BEI_GITHUB}/plan.json`).umfeld as { quellen: string[] }).quellen).not.toContain('tickets')

  await ui.unmount()
})

test('GitHub: Viele Tickets sind gedeckelt, und die Fläche sagt, was fehlt', async ($, on) => {
  // Hundert offene Tickets, jedes mit vielen langen Labels: mehr, als ans Modell geht.
  const viele: ShopTicket[] = Array.from({ length: 100 }, (_, n) => ({
    nr: 200 + n,
    titel: `Produktseite ${n + 1} prüfen`,
    labels: Array.from({ length: 8 }, (_unbenutzt, k) => `bereich:katalog-mit-langem-namen-${k}`),
    text: 'Bild, Text und Preis stimmen. '.repeat(20),
  }))
  const zeilen = [{ id: 'seiten', bahn: 'katalog', zone: 'jetzt', stand: 'bereit', titel: 'Produktseiten prüfen', quelle: 'tickets', tickets: ['#200', '#201'] }]
  const { welt, stand } = beiGithub(on, { modell: { isAnswered: true, usage: VERBRAUCH, text: antwort({ chats: [], zeilen: zeilen.map(one => ({ meta: '', punkte: [], wartetAuf: '', vermutet: false, ...one })) }) } })

  stand.tickets = [...viele, ...TICKETS.filter(one => one.zu !== undefined)]
  await befehl($, 'orchestrator')

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(ui, welt)

  const eingabe = welt.fragen[0]?.prompt ?? ''
  const block = eingabe.slice(eingabe.indexOf('<tickets'), eingabe.indexOf('</tickets>'))
  const gesendet = block.match(/^#\d+ · /gm)?.length ?? 0
  const text = await inhalt(ui)

  // Der Block bleibt unter der Grenze und sagt selbst, wie viele Tickets fehlen.
  expect(block.length <= 32_200).toBe(true)
  expect(gesendet > 20 && gesendet < 102).toBe(true)
  expect(block).toContain(`… und ${102 - gesendet} weitere, die hier fehlen: Die Grenze für Tickets ist erreicht.`)
  expect(text).toContain(`– ${102 - gesendet} Tickets ausgelassen: Die Grenze für Tickets ist erreicht.`)
  expect(text).toContain('– GitHub nennt 100 offene Tickets oder mehr: Gelesen sind die ersten 100.')
  expect(text).toContain('30 Commits und 102 Tickets (GitHub)')
  expect(text).toContain('  ○ Katalog · Produktseiten prüfen — 0 von 2 erledigt')

  // Die Liste der offenen ist abgeschnitten: Ein Ticket, das dort fehlt, kann weiter hinten
  // stehen. Es bleibt, wie es beim Ableiten stand; ein geschlossenes zählt.
  stand.tickets = [...viele.slice(2), { nr: 300, titel: 'Neu' }, { nr: 301, titel: 'Auch neu' }, { ...viele[1]!, zu: '2026-10-04' }]
  await ui.press({ key: 'laden' })
  expect(await inhalt(ui)).toContain('  ○ Katalog · Produktseiten prüfen — 1 von 2 erledigt')
  // Sind es wieder weniger als hundert, nennt die Liste alle offenen: Was fehlt, ist nicht mehr offen.
  stand.tickets = viele.slice(2, 60)
  await ui.press({ key: 'laden' })
  expect(await inhalt(ui)).toContain('  ✓ Katalog · 1 erledigt — Produktseiten prüfen')

  await ui.unmount()
})

test('GitHub: fehlt gh oder antwortet es nicht mit Tickets, läuft alles ohne sie weiter, mit einem Hinweis', async ($, on) => {
  // gh ist nicht installiert: Der Aufruf lässt sich nicht starten.
  const { welt } = beiGithub(on, { werkzeug: null, modell: { isAnswered: true, text: antwort({ chats: [] }), usage: VERBRAUCH } })

  await befehl($, 'orchestrator')

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(ui, welt)

  // Nach dem ersten gescheiterten Aufruf gibt es keinen zweiten.
  expect(welt.laeufe).toEqual([GIT_LOG, GH_OFFEN])
  expect(welt.fragen[0]?.prompt).not.toContain('<tickets')
  expect(welt.toasts).toEqual(['Ableiten fertig nach 23 s: 11 Bündel in 4 Strängen, 1 Hinweis'])
  expect(await inhalt(ui)).toContain('– Keine Tickets aus GitHub: gh ließ sich nicht starten oder hat nicht geantwortet.')
  expect(await inhalt(ui)).toContain('30 Commits und 0 Tickets (GitHub)')
  expect(await inhalt(ui)).toContain('  ○ Kasse · Entwurf Gutschein-Einlösung')
  expect(welt.meldungen).toEqual([])
  // Beim Laden steht derselbe Hinweis einmal da, nicht zweimal.
  await ui.press({ key: 'laden' })
  expect(await inhalt(ui)).toContain('Beim Ableiten aufgefallen (1)')

  // gh meldet einen Fehler, etwa ohne Anmeldung.
  welt.werkzeug = () => ({ fehler: 'To get started with GitHub CLI, please run:  gh auth login\nmehr Text' })
  await leiteAb(ui, welt)
  expect(await inhalt(ui)).toContain('– Keine Tickets aus GitHub: gh meldet einen Fehler (To get started with GitHub CLI, please run: gh auth login).')

  // gh antwortet mit etwas anderem als einer Liste.
  welt.werkzeug = () => '{"message": "Not Found"}'
  await leiteAb(ui, welt)
  expect(await inhalt(ui)).toContain('– Keine Tickets aus GitHub: Die Antwort von gh ist keine Liste von Tickets.')

  // Die offenen Tickets kommen, die geschlossenen nicht: Der Plan nimmt, was da ist.
  welt.werkzeug = argv => (argv.includes('closed') ? { fehler: 'HTTP 502' } : alsGithub(TICKETS, false))
  welt.modell = MIT_TICKETS
  await leiteAb(ui, welt)
  expect(welt.fragen.at(-1)?.prompt).toContain('<tickets system="GitHub" offen="6" geschlossen="0">')
  expect(await inhalt(ui)).toContain('– Die zuletzt geschlossenen Tickets aus GitHub fehlen: gh meldet einen Fehler (HTTP 502).')
  expect(await inhalt(ui)).toContain('30 Commits und 6 Tickets (GitHub)')
  // Das Modell nennt zwei Tickets, die der Lauf nicht gelesen hat: Sie fallen weg.
  expect(await inhalt(ui)).toContain('– Bündel „Zahlarten geklärt und 5 Entwürfe“ nennt 2 Tickets, die der Lauf nicht gelesen hat: weggelassen.')

  // Das Ticket-System nennt plötzlich kein einziges der Tickets von damals: ein anderes Repo
  // etwa. Daraus folgt nicht, dass alle geschlossen sind: Es gilt der Stand vom Ableiten.
  welt.werkzeug = argv => alsGithub([{ nr: 501, titel: 'Etwas ganz anderes' }], argv.includes('closed'))
  await ui.press({ key: 'laden' })
  expect(await inhalt(ui)).toContain('– Das Ticket-System nennt keines der Tickets vom letzten Ableiten: Die Bündel zeigen den Stand von damals.')
  expect(await inhalt(ui)).toContain('  ○ Kasse · Entwurf Gutschein-Einlösung — 0 von 2 erledigt · macht kassenwart')
  expect(await inhalt(ui)).toContain('1 neues Ticket seit dem letzten Ableiten')

  // Später lässt sich das Ticket-System beim Laden nicht fragen: Es gilt der Stand vom Ableiten.
  welt.werkzeug = null
  await ui.press({ key: 'laden' })

  const ohne = await inhalt(ui)

  expect(ohne).toContain('– Keine Tickets aus GitHub: gh ließ sich nicht starten oder hat nicht geantwortet.')
  expect(ohne).toContain('– Die Bündel zeigen den Stand der Tickets vom letzten Ableiten.')
  expect(ohne).toContain('  ○ Kasse · Entwurf Gutschein-Einlösung — 0 von 2 erledigt · macht kassenwart')
  expect(ohne).not.toContain('seit dem letzten Ableiten')

  await ui.unmount()
})

test('GitHub: Der Start der Session wartet nicht auf das Ticket-System; Pläne der Versionen 1 und 2 laden weiter', async ($, on) => {
  const { welt, stand } = beiGithub(on)

  // So lag der Plan bis Version 0.4.0 da: ohne Tickets.
  welt.dateien.set(
    `${BEI_GITHUB}/plan.json`,
    JSON.stringify({
      version: 2,
      fakten: { zeit: JETZT - 3 * TAG, dauerMs: 31_000, modellMs: 30_000, dateien: 5, chats: 0, commits: 30, modell: 'claude-sonnet-5-5', datei: '' },
      antwort: antwort({ chats: [] }),
      umfeld: { chats: [], quellen: QUELLEN },
      goal: GOAL_MIT_TRACKER,
      hinweise: [],
      festlegungen: [],
      aenderungen: null,
    }),
  )
  await $.session.start({ cwd: WURZEL, surface: 'desktop', isInteractive: true })

  // Im Start selbst wird kein Werkzeug gerufen: Die Leiste steht sofort da, mit dem gespeicherten Plan.
  expect(welt.laeufe).toEqual([])

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  expect(await inhalt(ui)).toContain('Abgeleitet vor 3 Tagen in 31 s aus 5 Dateien, 0 Chats und 30 Commits · claude-sonnet-5-5')
  expect(await inhalt(ui)).not.toContain('seit dem letzten Ableiten')

  // Gleich danach kommt der frische Stand: Der alte Plan kennt keines der sechs offenen Tickets.
  await welt.uhr.advance(0)
  expect(welt.laeufe).toEqual([GH_OFFEN, GH_ZU])
  expect(await inhalt(ui)).toContain('6 neue Tickets seit dem letzten Ableiten')
  expect(await inhalt(ui)).toContain('  ○ Kasse · Entwurf Gutschein-Einlösung')
  expect(await inhalt(ui)).not.toContain('Beim Ableiten aufgefallen')
  expect(welt.fragen).toHaveLength(0)
  expect(welt.geschrieben.size).toBe(0)

  // Eine Datei der Version 1 genauso.
  welt.dateien.set(
    `${BEI_GITHUB}/plan.json`,
    JSON.stringify({ version: 1, fakten: { zeit: JETZT - 2 * TAG, dauerMs: 31_000, dateien: 5, chats: 1, commits: 30, modell: 'claude-sonnet-5-5' }, antwort: antwort(), umfeld: { chats: [CHAT], quellen: QUELLEN }, goal: GOAL, hinweise: [] }),
  )
  stand.tickets = TICKETS.slice(0, 2)
  await ui.press({ key: 'laden' })
  expect(await inhalt(ui)).toContain('Abgeleitet vor 2 Tagen in 31 s aus 5 Dateien, 1 Chat und 30 Commits · claude-sonnet-5-5')
  expect(await inhalt(ui)).toContain('2 neue Tickets seit dem letzten Ableiten')

  // Der nächste Lauf legt die Datei in der neuen Form ab.
  await leiteAb(ui, welt)
  expect(gespeichert(welt, `${BEI_GITHUB}/plan.json`)).toMatchObject({ version: 3, fakten: { tracker: 'github', tickets: 2 } })
  expect(await inhalt(ui)).not.toContain('seit dem letzten Ableiten:')

  await ui.unmount()
})

test('GitLab: dieselben Tickets über glab, mit vorgetäuschter Ausgabe', async ($, on) => {
  const stand = { tickets: TICKETS as readonly ShopTicket[] }
  const welt = baue(on, { remote: GITLAB, werkzeug: mitTickets(() => stand.tickets, alsGitlab), modell: MIT_TICKETS })

  legeDoku(welt)
  welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL_MIT_TRACKER)
  expect(AUFRUFE.gitlab.offen.join(' ')).toBe(GL_OFFEN)
  expect(AUFRUFE.gitlab.zu.join(' ')).toBe(GL_ZU)
  await befehl($, 'graph')

  const ui = await $.ui.mount({ ...GRAPH, surface: 'terminal' })

  await leiteAb(ui, welt)
  expect(welt.laeufe).toEqual([GIT_LOG, GL_OFFEN, GL_ZU])
  expect(welt.fragen[0]?.prompt).toContain('<tickets system="GitLab" offen="6" geschlossen="2">\n#14 · offen · Gutschein an der Kasse prüfen · Labels: bereich:kasse · Bereich: kasse · zugewiesen: kassenwart')
  expect(welt.fragen[0]?.prompt).toContain('#12 · geschlossen am 2026-09-20 · Warenkorb merkt sich die Menge')

  const text = await mitBildern(ui)

  expect(text).toContain('30 Commits und 8 Tickets (GitLab) · claude-sonnet-5-5')
  expect(text).toContain('  Kasse · 0 von 2 erledigt · macht kassenwart')
  expect(text).not.toContain('Beim Ableiten aufgefallen')
  expect(gespeichert(welt, `${BEI_GITLAB}/plan.json`)).toMatchObject({ version: 3, fakten: { tracker: 'gitlab', tickets: 8 } })

  // Frisch geladen: ein Ticket geschlossen, eines wartet jetzt auf eine Auskunft.
  stand.tickets = anders(TICKETS, { 14: { zu: '2026-10-04' }, 19: { labels: ['bereich:suche', 'needs-info'] } })
  welt.laeufe.length = 0
  await ui.press({ key: 'laden' })
  expect(welt.laeufe).toEqual([GL_OFFEN, GL_ZU])
  expect(welt.fragen).toHaveLength(1)
  expect(await mitBildern(ui)).toContain('  Kasse · 1 von 2 erledigt · macht kassenwart')
  expect(await mitBildern(ui)).toContain('  Suche · 0 von 1 erledigt · #19 wartet auf Auskunft')

  // Fehlt glab, bleibt der Stand vom Ableiten, mit einem Hinweis.
  welt.werkzeug = null
  await ui.press({ key: 'laden' })
  expect(await mitBildern(ui)).toContain('  Kasse · 0 von 2 erledigt · macht kassenwart')
  expect(await mitBildern(ui)).toContain('Beim Ableiten aufgefallen: 2 Hinweise.')

  await ui.unmount()
})

// Die Tickets des Shops als Dateien, so wie die mattpocock-Skills sie schreiben: je Vorhaben
// ab 01 nummeriert.
const DATEIEN: Record<string, string> = {
  'kasse/issues/01-zahlarten.md': '# 01 — Zahlarten festlegen\n\n**What to build:** Karte und Rechnung.\n\n**Blocked by:** None — can start immediately\n\n**Status:** resolved\n',
  'kasse/issues/02-gutschein-pruefen.md': '# 02 — Gutschein an der Kasse prüfen\n\n**What to build:** Der Gutschein wird geprüft, bevor die Zahlart gewählt ist.\n\n**Blocked by:** 01\n\n**Status:** ready-for-agent\n\n- [ ] Ein abgelaufener Gutschein wird abgelehnt\n',
  'kasse/issues/03-rechnung.md': '# 03 — Rechnung als PDF\n\n**What to build:** Die Rechnung kommt als PDF per Mail.\n\n**Blocked by:** 02\n\n**Status:** blocked\n',
  'katalog/issues/01-taschen.md': '# 01 — Texte für Taschen abnehmen\n\nType: task\nStatus: needs-info\n\nWer nimmt die Texte ab?\n',
  'katalog/issues/02-jacken.md': '# 02 — Texte für Jacken abnehmen\n\nType: task\nStatus: claimed\nAssignee: lagerist\n',
  // Was daneben liegt, ist kein Ticket.
  'katalog/map.md': '# Karte\n',
  'katalog/issues/notizen.md': '# Notizen\n',
  'kasse/spec.md': '# Kasse\n',
}

test('Tickets als Markdown: Der Lauf liest die Dateien unter .scratch und ruft dafür nichts auf', async ($, on) => {
  const zeilen = [
    { id: 'kasse-fertig', bahn: 'kasse', zone: 'hinter', stand: 'erledigt', titel: 'Zahlarten', quelle: 'tickets', tickets: ['kasse/01'] },
    { id: 'kasse-offen', bahn: 'kasse', zone: 'jetzt', stand: 'bereit', titel: 'Gutscheine und Rechnung', quelle: 'tickets', tickets: ['kasse/02', 'kasse/3'] },
    // Die Nummer allein: 01 und 02 gibt es in zwei Vorhaben, sie sagt also nichts.
    { id: 'katalog-texte', bahn: 'katalog', zone: 'jetzt', stand: 'bereit', titel: 'Texte abnehmen', quelle: 'tickets', tickets: ['katalog/01', 'katalog/02', '02'] },
  ]
  const welt = baue(on, { modell: { isAnswered: true, usage: VERBRAUCH, text: antwort({ chats: [], zeilen: zeilen.map(one => ({ meta: '', punkte: [], wartetAuf: '', vermutet: false, ...one })) }) } })

  legeDoku(welt)
  welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL)
  // Das Repo sagt selbst, dass seine Tickets Dateien sind.
  welt.dateien.set(`${WURZEL}/docs/agents/issue-tracker.md`, '# Issue tracker: Local Markdown\n\nTickets liegen in .scratch.\n')

  for (const [pfad, text] of Object.entries(DATEIEN)) {
    welt.dateien.set(`${WURZEL}/.scratch/${pfad}`, text)
  }

  await befehl($, 'orchestrator')

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(ui, welt)

  // Kein gh, kein glab: nur git für den Verlauf.
  expect(welt.laeufe).toEqual([GIT_LOG])

  const eingabe = welt.fragen[0]?.prompt ?? ''

  expect(eingabe).toContain(
    [
      '<tickets system="Markdown-Dateien" offen="4" geschlossen="1">',
      'kasse/02 · offen · Gutschein an der Kasse prüfen · Labels: ready-for-agent · blockiert laut Ticket von: 01 · Text: What to build: Der Gutschein wird geprüft, bevor die Zahlart gewählt ist. Blocked by: 01 - [ ] Ein abgelaufener Gutschein wird abgelehnt',
      'kasse/03 · offen · Rechnung als PDF · Labels: blocked · blockiert laut Label · blockiert laut Ticket von: 02 · Text: What to build: Die Rechnung kommt als PDF per Mail. Blocked by: 02',
      'katalog/01 · offen · Texte für Taschen abnehmen · Labels: needs-info, task · wartet auf Auskunft laut Label · Text: Wer nimmt die Texte ab?',
      'katalog/02 · offen · Texte für Jacken abnehmen · Labels: claimed, task · zugewiesen: lagerist',
      'kasse/01 · geschlossen am 2026-10-04 · Zahlarten festlegen',
      '</tickets>',
    ].join('\n'),
  )

  const text = await inhalt(ui)

  expect(text).toContain('30 Commits und 5 Tickets (Markdown-Dateien) · claude-sonnet-5-5')
  expect(text).toContain('  ✓ Kasse · 1 erledigt — Zahlarten')
  // Eines von zwei offenen Tickets trägt den Status „blocked“: zum Teil möglich.
  expect(text).toContain('  ◐ Kasse · Gutscheine und Rechnung — 0 von 2 erledigt · kasse/03 blockiert')
  expect(text).toContain('  ◐ Katalog · Texte abnehmen — 0 von 2 erledigt · katalog/01 wartet auf Auskunft')
  expect(text).toContain('– Bündel „Texte abnehmen“ nennt 1 Ticket, das der Lauf nicht gelesen hat: weggelassen.')
  await ui.press({ key: 'karte-kasse-offen' })
  expect(await inhalt(ui)).toContain('– ○ kasse/02 Gutschein an der Kasse prüfen')
  expect(await inhalt(ui)).toContain('– · kasse/03 Rechnung als PDF (blockiert)')

  // Der Chat setzt die Dateien fort: Eine ist gelöst, eine nicht mehr blockiert, eine ist neu.
  welt.dateien.set(`${WURZEL}/.scratch/kasse/issues/02-gutschein-pruefen.md`, DATEIEN['kasse/issues/02-gutschein-pruefen.md']?.replace('ready-for-agent', 'resolved') ?? '')
  welt.dateien.set(`${WURZEL}/.scratch/kasse/issues/03-rechnung.md`, DATEIEN['kasse/issues/03-rechnung.md']?.replace('**Status:** blocked', '**Status:** ready-for-agent') ?? '')
  welt.dateien.set(`${WURZEL}/.scratch/suche/issues/01-preis.md`, '# 01 — Suchfeld für den Preis\n\n**Status:** ready-for-agent\n')
  await ui.press({ key: 'laden' })
  expect(welt.laeufe).toEqual([GIT_LOG])
  expect(welt.fragen).toHaveLength(1)
  expect(await inhalt(ui)).toContain('▸ ○ Kasse · Gutscheine und Rechnung — 1 von 2 erledigt')
  expect(await inhalt(ui)).toContain('– ✓ kasse/02 Gutschein an der Kasse prüfen')
  expect(await inhalt(ui)).toContain('– ○ kasse/03 Rechnung als PDF')
  expect(await inhalt(ui)).toContain('1 neues Ticket seit dem letzten Ableiten')

  // Sind alle Dateien eines Bündels gelöst, liegt es hinter uns.
  welt.dateien.set(`${WURZEL}/.scratch/kasse/issues/03-rechnung.md`, '# 03 — Rechnung als PDF\n\nStatus: done\n')
  await ui.press({ key: 'laden' })
  expect(await inhalt(ui)).toContain('  ✓ Kasse · 2 erledigt — Zahlarten · Gutscheine und Rechnung')

  await ui.unmount()
})

test('die Probe zeigt einen Plan mit Tickets so, wie er beim Ableiten stand', async ($, on) => {
  const { welt } = beiGithub(on)

  await befehl($, 'orchestrator')

  const ui = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(ui, welt)
  await ui.unmount()

  const json = welt.dateien.get(`${BEI_GITHUB}/plan.json`) ?? ''
  const gelesen = lesePlan(json)

  if (gelesen === null) {
    throw new Error('kein Plan')
  }

  pruefe(gelesen.plan)
  expect(gelesen.warnungen).toEqual([])
  expect(gelesen.plan.buendel.find(one => one.id === 'gutscheine')).toMatchObject({ zone: 'jetzt', stand: 'bereit', meta: '0 von 2 erledigt · macht kassenwart' })
  expect(gelesen.plan.buendel.find(one => one.id === 'rechnungen')?.tickets).toEqual([{ schluessel: '16', titel: 'Rechnung als PDF', zu: false, grund: 'blockiert' }])
  expect(zeichneGraph(json, { chats: [], offen: ['gutscheine'] })?.bild.source).toContain('>○ #14 Gutschein an der Kasse prüfen</text>')
  expect(zeichneGraph(json, { chats: [] })?.bild.source).toContain('>0 von 2 erledigt · macht kassenwart</text>')
})
