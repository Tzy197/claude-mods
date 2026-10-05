import { expect, test } from 'claude-code/testing'

import { baueEingabe } from '../hooks/plan/ableiten'
import {
  GOAL_FORMAT,
  istLeer,
  istOffen,
  leseGoal,
  promptDauerlaeufer,
  promptEndziel,
  promptGoalAnlegen,
  promptStrangZiel,
} from '../hooks/plan/goal'
import { dauerAuftrag, endzielAuftrag, goalAuftrag, ohneZiel, strangAuftrag, strangFrage } from '../hooks/plan/lesen'

import { BAHNEN, GOAL, ZEILEN, antwort, gelungen, umfeld } from './shop'

// GOAL.md: der Anker des Plans. Wie der Mod sie liest und welche Aufträge er dazu ins
// Eingabefeld legt. Alle Testdaten sind erfunden.

test('GOAL.md, vollständig: Endziel, Zwischenziele und Stränge stehen wörtlich da', () => {
  const goal = leseGoal(GOAL)

  expect(goal).toEqual({
    vorhanden: true,
    endziel: 'Der Shop ist im Betrieb und nimmt Bestellungen an.',
    zwischenziele: [
      { id: 'grundstock-steht', titel: 'Grundstock steht', erreicht: true },
      { id: 'grosser-umbau', titel: 'Großer Umbau', erreicht: false },
      { id: 'lasttest-bestanden', titel: 'Lasttest bestanden', erreicht: false },
    ],
    straenge: [
      { id: 'katalog', name: 'Katalog', ziel: 'Alle Produkte mit Text und Bild im Shop', gehoertZu: 'grosser-umbau', gehoertZuText: 'Großer Umbau', art: '', wer: '' },
      { id: 'kasse', name: 'Kasse', ziel: '', gehoertZu: 'grosser-umbau', gehoertZuText: 'Großer Umbau', art: '', wer: '' },
      { id: 'suche', name: 'Suche', ziel: 'Jedes Produkt in zwei Klicks finden', gehoertZu: '', gehoertZuText: '', art: '', wer: '' },
      { id: 'betrieb', name: 'Betrieb', ziel: '', gehoertZu: '', gehoertZuText: '', art: '', wer: '' },
    ],
    festlegungen: [],
    hinweise: [],
  })
  expect(istLeer(goal)).toBe(false)
  // Zeilenenden von Windows und ein BOM ändern nichts.
  expect(leseGoal(`\ufeff${GOAL.replace(/\n/g, '\r\n')}`)).toEqual(goal)
  // Das Format, das der Chat beim Anlegen bekommt, liest der Mod selbst ohne Hinweis.
  // Das Format selbst, mit seinen Platzhaltern, legt nichts fest: Es liest sich wie eine leere Datei.
  expect(leseGoal(GOAL_FORMAT)).toEqual({ vorhanden: true, endziel: '', zwischenziele: [], straenge: [], festlegungen: [], hinweise: [] })
})

test('GOAL.md, nur zum Teil: Was fehlt oder „noch offen“ ist, bleibt leer', () => {
  const nurStraenge = leseGoal('## Stränge\n### Katalog\n### Kasse\nZiel: noch offen\n')

  expect(nurStraenge).toMatchObject({ vorhanden: true, endziel: '', zwischenziele: [] })
  expect(nurStraenge.straenge.map(one => `${one.id}:${one.ziel}`)).toEqual(['katalog:', 'kasse:'])
  expect(istLeer(nurStraenge)).toBe(false)

  const nurEndziel = leseGoal('# Ziel\n\n## Endziel\n\nDer Shop im Betrieb.\n\nMehr dazu später.\n')

  expect(nurEndziel).toMatchObject({ endziel: 'Der Shop im Betrieb.', zwischenziele: [], straenge: [] })

  const offen = leseGoal('## Endziel\nnoch offen\n\n## Zwischenziele\n- noch offen\n\n## Stränge\n### Katalog\nZiel: ?\n')

  expect(offen).toMatchObject({ endziel: '', zwischenziele: [] })
  expect(offen.straenge).toEqual([{ id: 'katalog', name: 'Katalog', ziel: '', gehoertZu: '', gehoertZuText: '', art: '', wer: '' }])

  for (const wert of ['', ' ', 'noch offen', 'Noch offen.', 'offen', 'unklar', '?', '-', '–', '…', 'tbd', '(noch unklar, klären wir im Herbst)']) {
    expect(istOffen(wert)).toBe(true)
  }

  for (const wert of ['Der Shop im Betrieb', 'Offene Bestellungen sehen', 'Kasse ohne Umweg']) {
    expect(istOffen(wert)).toBe(false)
  }
})

test('GOAL.md, leer oder fehlend: Die leere Datei ist da, legt aber nichts fest', () => {
  for (const leer of ['', '  \n\n', '# Ziel\n', '# Ziel\n\n## Endziel\n\n## Zwischenziele\n\n## Stränge\n', '<!-- kommt noch -->']) {
    const goal = leseGoal(leer)

    expect(goal).toEqual({ vorhanden: true, endziel: '', zwischenziele: [], straenge: [], festlegungen: [], hinweise: [] })
    expect(istLeer(goal)).toBe(true)
  }

  const fehlt = leseGoal(null)

  expect(fehlt).toEqual({ vorhanden: false, endziel: '', zwischenziele: [], straenge: [], festlegungen: [], hinweise: [] })
  expect(istLeer(fehlt)).toBe(false)
})

test('GOAL.md, eigenwillig geschrieben: andere Überschriften, Listen, Fettdruck, Kommentare', () => {
  const goal = leseGoal(`Ziel des Projekts
=================

## ENDZIEL:  **Der Shop läuft**

Dieser Absatz zählt nicht mehr.

### Meilensteine
1. Grundstock steht
   - eingerückt: nur eine Erläuterung
2) [X] Katalog abgenommen
* noch offen

\`\`\`
## Stränge
### Im Zaun steht kein Strang
\`\`\`

## Straenge:
- **Katalog** — alle Produkte mit Bild
  - Gehört zu: grundstock
- Kasse:
- Suche
  Ziel: schnell finden,
  auch mit Tippfehlern
- Katalog: doppelt

## Notizen
### Kein Strang
- Auch keiner
`)

  expect(goal.endziel).toBe('Der Shop läuft')
  expect(goal.zwischenziele).toEqual([
    { id: 'grundstock-steht', titel: 'Grundstock steht', erreicht: false },
    { id: 'katalog-abgenommen', titel: 'Katalog abgenommen', erreicht: true },
  ])
  expect(goal.straenge).toEqual([
    { id: 'katalog', name: 'Katalog', ziel: 'alle Produkte mit Bild', gehoertZu: 'grundstock-steht', gehoertZuText: 'grundstock', art: '', wer: '' },
    { id: 'kasse', name: 'Kasse', ziel: '', gehoertZu: '', gehoertZuText: '', art: '', wer: '' },
    { id: 'suche', name: 'Suche', ziel: 'schnell finden, auch mit Tippfehlern', gehoertZu: '', gehoertZuText: '', art: '', wer: '' },
  ])
  expect(goal.hinweise).toEqual(['GOAL.md nennt den Strang „Katalog“ zweimal: Der zweite fällt weg.'])

  // Felder als Listenpunkte unter einer Überschrift, das Ziel erst in der nächsten Zeile,
  // ein „Gehört zu“, das auf nichts zeigt, und Namen, die im Plan schon etwas bedeuten.
  const zweite = leseGoal(`## Endziel
- Der Shop im Betrieb
- und noch viel mehr

## Zwischenziele
Großer Umbau
Lasttest

## Bahnen
#### Kasse
- **Ziel:** Bestellen ohne Umweg
- Gehoert zu: Mondlandung
#### Suche
Ziel:
Jedes Produkt finden
#### Endziel
#### Stamm
`)

  expect(zweite.endziel).toBe('Der Shop im Betrieb')
  expect(zweite.zwischenziele.map(one => one.id)).toEqual(['grosser-umbau', 'lasttest'])
  expect(zweite.straenge).toEqual([
    { id: 'kasse', name: 'Kasse', ziel: 'Bestellen ohne Umweg', gehoertZu: '', gehoertZuText: 'Mondlandung', art: '', wer: '' },
    { id: 'suche', name: 'Suche', ziel: 'Jedes Produkt finden', gehoertZu: '', gehoertZuText: '', art: '', wer: '' },
    { id: 'endziel-2', name: 'Endziel', ziel: '', gehoertZu: '', gehoertZuText: '', art: '', wer: '' },
    { id: 'stamm-2', name: 'Stamm', ziel: '', gehoertZu: '', gehoertZuText: '', art: '', wer: '' },
  ])
  expect(zweite.hinweise).toEqual([
    'GOAL.md, Strang „Kasse“: „Gehört zu: Mondlandung“ nennt kein Zwischenziel aus der Liste.',
  ])
})

test('GOAL.md, je Strang: „Art:“ nennt Ziel oder Dauerläufer, „Wer:“ wer ihn macht; beides darf fehlen', () => {
  // Das Format nennt die zwei Zeilen, und der Auftrag zum Anlegen erklärt sie.
  expect(GOAL_FORMAT).toContain(
    'Gehört zu: <eines der Zwischenziele, wenn es passt>\nArt: <Ziel oder Dauerläufer; die Zeile darf fehlen>\nWer: <wer diesen Strang macht; die Zeile darf fehlen>\n',
  )
  expect(promptGoalAnlegen()).toContain('Dann steht bei ihm „Art: Dauerläufer“. „Wer:“ nennt, wer den Strang macht. Beide Zeilen dürfen fehlen.')

  const goal = leseGoal(`## Stränge
### Katalog
Ziel: Alle Produkte im Shop
Art: Ziel
Wer: Mara

### Betrieb
Art: Dauerläufer
- **Wer:** Jonas und Mara

### Werkzeug
- Typ: dauerlaeufer (läuft nebenher)
Zuständig: noch offen

### Suche
Art: noch offen
Verantwortlich: Jonas

### Kasse

### Lager
Art: Baustelle
`)

  expect(goal.straenge.map(one => `${one.id}|${one.art}|${one.wer}|${one.ziel}`)).toEqual([
    'katalog|ziel|Mara|Alle Produkte im Shop',
    'betrieb|dauer|Jonas und Mara|',
    'werkzeug|dauer||',
    'suche||Jonas|',
    'kasse|||',
    'lager|||',
  ])
  // Eine Art, die keine der zwei ist, zählt nicht und steht als Hinweis da.
  expect(goal.hinweise).toEqual(['GOAL.md, Strang „Lager“: „Art: Baustelle“ nennt weder „Ziel“ noch „Dauerläufer“: Die Zeile zählt nicht.'])

  // Auch bei Strängen als Liste, als eingerückte Punkte darunter.
  const liste = leseGoal('## Stränge\n- Betrieb: Der Shop läuft\n  - Art: Dauerläufer\n  - Wer: Jonas\n- Kasse\n')

  expect(liste.straenge.map(one => `${one.id}|${one.art}|${one.wer}|${one.ziel}`)).toEqual(['betrieb|dauer|Jonas|Der Shop läuft', 'kasse|||'])
  // Die zwei Zeilen allein legen kein Ziel fest: Der Strang hat weiter keines.
  expect(ohneZiel(gelungen(antwort(), umfeld(GOAL.replace('### Betrieb\n', '### Betrieb\nArt: Dauerläufer\nWer: Jonas\n'))).plan).map(one => one.id)).toEqual(['kasse', 'betrieb'])
})

test('was GOAL.md über die Art eines Strangs sagt, gewinnt; ohne Angabe zählt, was das Modell sagt', () => {
  const mitArt = GOAL.replace('### Katalog\n', '### Katalog\nArt: Dauerläufer\nWer: Mara\n').replace('### Betrieb\n', '### Betrieb\nArt: Ziel\n')
  // Das Modell nennt Katalog ein Ziel und Betrieb einen Dauerläufer, wie in jeder Antwort des Shops.
  const { plan, warnungen } = gelungen(antwort(), umfeld(mitArt))

  expect(plan.straenge.map(one => `${one.id}|${one.art}|${one.wer ?? ''}`)).toEqual(['katalog|dauer|Mara', 'kasse|ziel|', 'suche|ziel|', 'betrieb|ziel|'])
  // Dass das Modell es anders sah, ist kein Hinweis wert: GOAL.md gilt einfach.
  expect(warnungen).toEqual([])
  // Nennt das Modell den Strang gar nicht, gilt die Art aus GOAL.md trotzdem.
  expect(gelungen(antwort({ bahnen: BAHNEN.filter(one => one.id !== 'katalog') }), umfeld(mitArt)).plan.straenge[0]).toMatchObject({ id: 'katalog', art: 'dauer' })

  // Ohne „Art:“ in GOAL.md entscheidet das Modell, wie bisher; ohne „Wer:“ nennt der Strang niemanden.
  const ohne = gelungen(antwort({ bahnen: BAHNEN.map(one => (one.id === 'suche' ? { ...one, art: 'dauer' } : one)) })).plan

  expect(ohne.straenge.map(one => `${one.id}|${one.art}`)).toEqual(['katalog|ziel', 'kasse|ziel', 'suche|dauer', 'betrieb|dauer'])
  expect(ohne.straenge.every(one => !('wer' in one))).toBe(true)
  // Ein Strang, den nur das Modell kennt, hat seine Art von dort und niemanden, der ihn macht.
  expect(
    gelungen(
      antwort({
        bahnen: [...BAHNEN, { id: 'lager', name: 'Lager', art: 'dauer', ziel: '' }],
        zeilen: [...ZEILEN, { id: 'regale', bahn: 'lager', zone: 'jetzt', stand: 'bereit', titel: 'Regale beschriften', quelle: 'README.md' }],
      }),
      umfeld(mitArt),
    ).plan.straenge.at(-1),
  ).toMatchObject({ id: 'lager', art: 'dauer', inGoal: false })

  // Das Modell bekommt GOAL.md wie bisher, mit den zwei Zeilen darin; was das Programm zur
  // Art gelesen hat, steht bei den Strängen dabei. Einen eigenen Block gibt es nicht.
  const quellen = { wurzel: '/arbeit/shop', schluessel: 'x', goal: mitArt, doku: [], chats: [], commits: [], hinweise: [] }
  const eingabe = baueEingabe(quellen, leseGoal(mitArt), '2026-10-04')

  expect(eingabe).toContain('### Katalog\nArt: Dauerläufer\nWer: Mara\n')
  expect(eingabe).toContain('- id "katalog": Katalog · Ziel: Alle Produkte mit Text und Bild im Shop · gehört zu "grosser-umbau" · Art: Dauerläufer')
  expect(eingabe).toContain('- id "betrieb": Betrieb · kein Ziel festgelegt · Art: Ziel')
  expect(eingabe).toContain('- id "kasse": Kasse · kein Ziel festgelegt · gehört zu "grosser-umbau"\n')
  expect(eingabe.split('Mara')).toHaveLength(2)
  // Ohne die zwei Zeilen ist die Eingabe Zeichen für Zeichen die von vorher.
  expect(baueEingabe({ ...quellen, goal: GOAL }, leseGoal(GOAL), '2026-10-04')).not.toContain('Art:')
})

test('die Aufträge zu GOAL.md: anlegen, das Ziel eines Strangs und das Endziel festlegen', () => {
  const { plan } = gelungen(antwort())

  expect(promptGoalAnlegen()).toContain('Lass uns für dieses Repo die Datei GOAL.md in der Wurzel anlegen.')
  expect(promptGoalAnlegen()).toContain(GOAL_FORMAT)
  expect(promptGoalAnlegen()).toContain('Schreib die Datei erst, wenn ich zugestimmt habe.')
  expect(strangFrage(plan, 'kasse')).toEqual({
    name: 'Kasse',
    inGoal: true,
    mitGoal: true,
    vermutung: 'Bestellen ohne Umweg',
    buendel: ['Zahlarten geklärt und 5 Entwürfe', 'Entwurf Warenkorb-Regeln', 'Entwurf Gutschein-Einlösung', 'Block Rechnungen'],
  })
  expect(strangFrage(plan, 'gibt-es-nicht')).toBe(null)
  expect(promptStrangZiel({ name: 'Lager', inGoal: false, mitGoal: true, vermutung: '', buendel: [] })).toContain(
    'Der Strang steht noch nicht in GOAL.md',
  )
  expect(promptStrangZiel({ name: 'Lager', inGoal: false, mitGoal: false, vermutung: '', buendel: [] })).toContain(GOAL_FORMAT)
  expect(promptEndziel(true, 'der Shop im Betrieb')).toBe(
    [
      'In GOAL.md ist noch kein Endziel festgelegt. Klär mit mir, was am Ende erreicht sein soll, und trag es dann als einen Satz unter „## Endziel“ ein.',
      'Der Plan vermutet als Endziel: der Shop im Betrieb',
      'Frag mich, wo etwas unklar ist, eine Frage auf einmal und mit einer Empfehlung. Was noch nicht klar ist, bleibt offen. Schreib die Datei erst, wenn ich zugestimmt habe.',
    ].join('\n\n'),
  )
  expect(promptEndziel(false, '')).toContain(GOAL_FORMAT)

  // Beide Ansichten legen dieselben Aufträge ins Eingabefeld: Text und wie der Hinweis ihn nennt.
  expect(goalAuftrag()).toEqual({ text: promptGoalAnlegen(), was: 'Der Auftrag für GOAL.md' })
  expect(endzielAuftrag(plan)).toEqual({ text: promptEndziel(true, ''), was: 'Der Auftrag „Endziel festlegen“' })
  expect(endzielAuftrag(gelungen(antwort(), umfeld(null)).plan)).toEqual({
    text: promptEndziel(false, 'der Shop im Betrieb'),
    was: 'Der Auftrag „Endziel festlegen“',
  })
  expect(strangAuftrag(plan, 'kasse').was).toBe('Der Auftrag „Ziel festlegen“')
  expect(strangAuftrag(plan, 'kasse').text).toContain('Es fehlt die Zeile „Ziel: …“ unter „### Kasse“.')
  expect(strangAuftrag(plan, 'gibt-es-nicht').text).toBe(null)
  expect(ohneZiel(plan).map(one => one.id)).toEqual(['kasse', 'betrieb'])
})

test('der Auftrag, ein Ziel zum Dauerläufer zu machen: Der Chat trägt „Art: Dauerläufer“ ein, wenn der Nutzer zustimmt', () => {
  const { plan } = gelungen(antwort())

  expect(dauerAuftrag(plan, 'katalog')).toEqual({
    text: [
      'Im Strang „Katalog“ ist alles erledigt, was der Plan dort kennt. Klär mit mir, ob der Strang damit seine Basis erreicht hat und ab jetzt als Dauerläufer weiterläuft: ohne Ende, neben den Zielen, für das, was dort immer wieder anfällt.',
      'Wenn ja, trag es in GOAL.md ein: Der Strang steht schon unter „## Stränge“. Setz unter „### Katalog“ die Zeile „Art: Dauerläufer“. Ändere sonst nichts an der Datei.',
      'Was der Plan in diesem Strang als erledigt sieht:\n- Grundstock: 13 Produktseiten fertig\n- Bilder für Schuhe und Jacken',
      'Frag mich, wo etwas unklar ist, eine Frage auf einmal und mit einer Empfehlung. Was noch nicht klar ist, bleibt offen. Schreib die Datei erst, wenn ich zugestimmt habe.',
    ].join('\n\n'),
    was: 'Der Auftrag „Zum Dauerläufer machen“',
  })
  expect(dauerAuftrag(plan, 'gibt-es-nicht').text).toBe(null)
  // Ein Strang, den nur das Modell kennt, steht noch nicht in GOAL.md: Der Chat legt ihn dort an.
  expect(promptDauerlaeufer({ name: 'Lager', inGoal: false, erledigt: [] })).toBe(
    [
      'Im Strang „Lager“ ist alles erledigt, was der Plan dort kennt. Klär mit mir, ob der Strang damit seine Basis erreicht hat und ab jetzt als Dauerläufer weiterläuft: ohne Ende, neben den Zielen, für das, was dort immer wieder anfällt.',
      'Wenn ja, trag es in GOAL.md ein: Der Strang steht dort noch nicht, der Plan hat ihn in den anderen Quellen gefunden. Leg ihn unter „## Stränge“ als „### Lager“ mit der Zeile „Art: Dauerläufer“ an. Ändere sonst nichts an der Datei.',
      'Frag mich, wo etwas unklar ist, eine Frage auf einmal und mit einer Empfehlung. Was noch nicht klar ist, bleibt offen. Schreib die Datei erst, wenn ich zugestimmt habe.',
    ].join('\n\n'),
  )
})
