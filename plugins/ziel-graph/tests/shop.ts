import { expect } from 'claude-code/testing'

import type { ZielGraphChats, ZielGraphPlan } from '../types'

import { STRANG_FARBEN } from '../hooks/fest'
import { normalisiere } from '../hooks/plan/ableiten'
import type { Umfeld } from '../hooks/plan/ableiten'
import { leseGoal } from '../hooks/plan/goal'

// Die Testdaten aller Dateien: ein erfundener Web-Shop. Hier stehen seine GOAL.md, die
// Antwort, die das Modell auf ihn geben soll, und die Chats, die an ihm arbeiten.

// ---------- GOAL.md ----------

export const GOAL = `# Ziel

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
`

// ---------- Eine Antwort, wie das Modell sie geben soll ----------

export type Zeile = {
  id: string
  bahn: string
  zone: string
  stand: string
  titel: string
  meta?: string
  punkte?: string[]
  wartetAuf?: string
  quelle?: string
  vermutet?: boolean
}

// Die Bahnen so, wie GOAL.md sie nennt. Für die Kasse, die dort kein Ziel hat, vermutet das Modell eines.
export const BAHNEN = [
  { id: 'katalog', name: 'Katalog', art: 'ziel', ziel: '' },
  { id: 'kasse', name: 'Kasse', art: 'ziel', ziel: 'Bestellen ohne Umweg' },
  { id: 'suche', name: 'Suche', art: 'ziel', ziel: '' },
  { id: 'betrieb', name: 'Betrieb', art: 'dauer', ziel: '' },
]

export const ZEILEN: Zeile[] = [
  { id: 'grundstock', bahn: 'katalog', zone: 'hinter', stand: 'erledigt', titel: 'Grundstock: 13 Produktseiten fertig', quelle: 'commits' },
  { id: 'bilder', bahn: 'katalog', zone: 'hinter', stand: 'erledigt', titel: 'Bilder für Schuhe und Jacken', meta: 'seit September', quelle: 'docs/katalog.md' },
  { id: 'zahlarten', bahn: 'kasse', zone: 'hinter', stand: 'erledigt', titel: 'Zahlarten geklärt und 5 Entwürfe', quelle: 'docs/kasse.md' },
  {
    id: 'katalog-texte',
    bahn: 'katalog',
    zone: 'jetzt',
    stand: 'bereit',
    titel: 'Katalog-Texte abnehmen',
    meta: '3 von 5 Kategorien abgenommen',
    punkte: ['Schuhe: Größen als Variante oder Filter', 'Jacken: Farbgruppen', 'Taschen: Leder oder Stoff'],
    quelle: 'docs/katalog.md',
  },
  { id: 'warenkorb', bahn: 'kasse', zone: 'jetzt', stand: 'bereit', titel: 'Entwurf Warenkorb-Regeln', quelle: 'chats' },
  {
    id: 'gutscheine',
    bahn: 'kasse',
    zone: 'jetzt',
    stand: 'bereit',
    titel: 'Entwurf Gutschein-Einlösung',
    punkte: ['Gutschein an der Kasse prüfen', 'Restbetrag merken'],
    quelle: 'docs/kasse.md',
  },
  { id: 'suchfelder', bahn: 'suche', zone: 'jetzt', stand: 'bereit', titel: 'Suchfelder und Sortierung', quelle: 'docs/plan/suche.md' },
  { id: 'ladezeit', bahn: 'betrieb', zone: 'jetzt', stand: 'bereit', titel: 'Ladezeit der Startseite senken', quelle: 'README.md' },
  {
    id: 'build-skripte',
    bahn: 'betrieb',
    zone: 'jetzt',
    stand: 'teilweise',
    titel: 'Umbau der Build-Skripte',
    meta: '1 von 3 erledigt · Rest wartet auf den Lasttest',
    wartetAuf: 'lasttest-bestanden',
    quelle: 'README.md',
  },
  { id: 'rueckfragen', bahn: 'katalog', zone: 'spaeter', stand: 'blockiert', titel: '10 Rückfragen an den Einkauf', meta: 'wartet auf Auskunft', quelle: 'docs/katalog.md' },
  {
    id: 'rechnungen',
    bahn: 'kasse',
    zone: 'spaeter',
    stand: 'blockiert',
    titel: 'Block Rechnungen',
    meta: 'vermutet: wartet auf die Entwürfe',
    wartetAuf: 'warenkorb',
    quelle: 'docs/kasse.md',
    vermutet: true,
  },
]

// Mit GOAL.md stehen deren Zwischenziele auf dem Stamm, ohne sie ein Treffpunkt des Modells.
export const STAMM_MIT_GOAL = [
  { id: 'grundstock-steht', art: 'zwischenziel', titel: 'Grundstock steht', meta: '', quelle: 'GOAL.md', vermutet: false },
  { id: 'grosser-umbau', art: 'zwischenziel', titel: 'Großer Umbau', meta: 'sobald Katalog und Kasse fertig sind', quelle: 'GOAL.md', vermutet: false },
  { id: 'lasttest-bestanden', art: 'zwischenziel', titel: 'Lasttest bestanden', meta: '', quelle: 'GOAL.md', vermutet: false },
]

export const STAMM_OHNE_GOAL = [
  { id: 'umbau', art: 'treffpunkt', titel: 'Treffpunkt: Großer Umbau', meta: 'sobald Katalog, Kasse und Suche fertig sind', quelle: 'README.md', vermutet: false },
  { id: 'lasttest-bestanden', art: 'schritt', titel: 'Lasttest', meta: '', quelle: 'README.md', vermutet: false },
]

export const antwort = (anders: Record<string, unknown> = {}): string =>
  JSON.stringify(
    {
      endziel: 'der Shop im Betrieb',
      bahnen: BAHNEN,
      zeilen: ZEILEN.map(one => ({ meta: '', punkte: [], wartetAuf: '', vermutet: false, ...one })),
      stamm: STAMM_MIT_GOAL,
      chats: [{ id: 'c1', zeile: 'warenkorb' }],
      ...anders,
    },
    null,
    2,
  )

export const QUELLEN = ['GOAL.md', 'README.md', 'CLAUDE.md', 'docs/kasse.md', 'docs/katalog.md', 'docs/plan/suche.md', 'chats', 'commits']
export const CHAT = { id: 'sitzung-7', kennung: 'c1', name: 'Warenkorb-Regeln' }
export const umfeld = (goal: string | null = GOAL, chats = [CHAT]): Umfeld => ({ chats, quellen: QUELLEN, goal: leseGoal(goal) })

export const gelungen = (text: string, wo: Umfeld = umfeld()) => {
  const ableitung = normalisiere(text, wo)

  if (!ableitung.ok) {
    throw new Error(`gescheitert: ${ableitung.grund}`)
  }

  return ableitung
}

// Die Regeln, auf die sich beide Ansichten verlassen.
export const pruefe = (plan: ZielGraphPlan): void => {
  const straenge = new Set(plan.straenge.map(one => one.id))
  const ids = [...plan.buendel.map(one => one.id), ...plan.stamm.map(one => one.id)]

  expect(straenge.size).toBe(plan.straenge.length)
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).not.toContain('endziel')

  for (const id of [...straenge, ...ids]) {
    expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  }

  for (const strang of plan.straenge) {
    expect(STRANG_FARBEN).toContainEqual(strang.farbe)
    expect(strang.gehoertZu === '' || plan.stamm.some(one => one.id === strang.gehoertZu)).toBe(true)
  }

  for (const eines of plan.buendel) {
    expect(straenge.has(eines.strang)).toBe(true)
    expect({ hinter: ['erledigt'], jetzt: ['bereit', 'teilweise'], spaeter: ['blockiert'] }[eines.zone]).toContain(eines.stand)
    expect(eines.wartetAuf === '' || (eines.wartetAuf !== eines.id && ids.includes(eines.wartetAuf))).toBe(true)
    expect(`${eines.titel}${eines.meta}${eines.punkte.join('')}`).not.toMatch(/[\u0000-\u001f\u007f]/)
  }

  // Abschnitt für Abschnitt, darin Strang für Strang.
  const folge = plan.buendel.map(
    one => ['hinter', 'jetzt', 'spaeter'].indexOf(one.zone) * 100 + plan.straenge.findIndex(strang => strang.id === one.strang),
  )

  expect(folge).toEqual([...folge].sort((a, b) => a - b))
}

// ---------- Derselbe Shop ohne GOAL.md ----------

// So leitet das Modell ihn ab, wenn es die Bahnen selbst schneidet: eigene Kürzel, ein
// Treffpunkt, danach zwei Schritte. An diesem Plan hängen die Maße des Graphen in den Tests.
export const OHNE_GOAL = {
  bahnen: [
    { id: 'kat', name: 'Katalog', art: 'ziel' },
    { id: 'kas', name: 'Kasse', art: 'ziel' },
    { id: 'suc', name: 'Suche', art: 'ziel' },
    { id: 'btr', name: 'Betrieb', art: 'dauer' },
  ],
  zeilen: [
    { id: 'grundstock', bahn: 'kat', zone: 'hinter', stand: 'erledigt', titel: 'Grundstock: 13 Produktseiten fertig', quelle: 'commits' },
    { id: 'zahlarten', bahn: 'kas', zone: 'hinter', stand: 'erledigt', titel: 'Zahlarten geklärt und 5 Entwürfe', quelle: 'docs/kasse.md' },
    {
      id: 'katalog-texte',
      bahn: 'kat',
      zone: 'jetzt',
      stand: 'bereit',
      titel: 'Katalog-Texte abnehmen',
      meta: '3 von 5 Kategorien abgenommen',
      punkte: ['Schuhe: Größen als Variante oder Filter', 'Jacken: Farbgruppen', 'Taschen: Leder oder Stoff'],
      quelle: 'docs/katalog.md',
    },
    { id: 'warenkorb', bahn: 'kas', zone: 'jetzt', stand: 'bereit', titel: 'Entwurf Warenkorb-Regeln', quelle: 'chats' },
    { id: 'gutscheine', bahn: 'kas', zone: 'jetzt', stand: 'bereit', titel: 'Entwurf Gutschein-Einlösung', quelle: 'docs/kasse.md' },
    {
      id: 'suchfelder',
      bahn: 'suc',
      zone: 'jetzt',
      stand: 'bereit',
      titel: 'Suchfelder und Sortierung',
      punkte: ['Preis als eigenes Feld', 'Sortierung nach Beliebtheit'],
      quelle: 'docs/plan/suche.md',
    },
    { id: 'ladezeit', bahn: 'btr', zone: 'jetzt', stand: 'bereit', titel: 'Ladezeit der Startseite senken', quelle: 'README.md' },
    {
      id: 'build-skripte',
      bahn: 'btr',
      zone: 'jetzt',
      stand: 'teilweise',
      titel: 'Umbau der Build-Skripte',
      meta: '1 von 3 erledigt · Rest wartet auf den Lasttest',
      wartetAuf: 'lasttest',
      quelle: 'README.md',
    },
    { id: 'rueckfragen', bahn: 'kat', zone: 'spaeter', stand: 'blockiert', titel: '10 Rückfragen an den Einkauf', meta: 'wartet auf Auskunft', quelle: 'docs/katalog.md' },
    {
      id: 'rechnungen',
      bahn: 'kas',
      zone: 'spaeter',
      stand: 'blockiert',
      titel: 'Block Rechnungen',
      meta: 'vermutet: wartet auf die Entwürfe',
      wartetAuf: 'warenkorb',
      quelle: 'docs/kasse.md',
      vermutet: true,
    },
  ] as Zeile[],
  stamm: [
    { id: 'umbau', art: 'treffpunkt', titel: 'Treffpunkt: Großer Umbau', meta: 'sobald Katalog, Kasse und Suche fertig sind', quelle: 'README.md', vermutet: false },
    { id: 'lasttest', art: 'schritt', titel: 'Lasttest', meta: '', quelle: 'README.md', vermutet: false },
    { id: 'lager', art: 'schritt', titel: 'Lageranbindung', meta: 'noch nicht ausgearbeitet', quelle: 'README.md', vermutet: false },
  ],
}

export const antwortOhneGoal = (anders: Record<string, unknown> = {}): string =>
  antwort({ bahnen: OHNE_GOAL.bahnen, zeilen: OHNE_GOAL.zeilen, stamm: OHNE_GOAL.stamm, ...anders })

// ---------- Die laufenden Chats ----------

const chat = (id: string, name: string, mehr: Partial<ZielGraphChats['chats'][number]> = {}): ZielGraphChats['chats'][number] => ({
  id,
  name,
  aktiv: true,
  branch: '',
  stand: '',
  naechster: '',
  frage: '',
  zeit: 1,
  ...mehr,
})

export const KEINE: ZielGraphChats = { ich: 'sitzung-1', chats: [], gelesen: 0 }

// Zwei Chats: Der eine hängt am Bündel „warenkorb“ und wartet, der andere hängt an keinem.
export const LAUFEND: ZielGraphChats = {
  ich: 'sitzung-1',
  gelesen: 1,
  chats: [
    chat('sitzung-7', 'Warenkorb-Regeln', {
      branch: 't21-warenkorb',
      stand: 'Der Entwurf der Regeln steht.',
      naechster: 'Die Rundung der Beträge prüfen.',
      frage: 'Sollen Gutscheine auch den Versand decken?',
    }),
    chat('sitzung-4', 'Bilder zuschneiden', { stand: 'Die Hälfte ist zugeschnitten.' }),
  ],
}

// Nur der Chat am Bündel „warenkorb“; `frage`: Mit ihr wartet er auf den Nutzer.
export const amWarenkorb = (frage = ''): ZielGraphChats => ({
  ich: 'sitzung-1',
  gelesen: 1,
  chats: [chat('sitzung-7', 'Warenkorb-Regeln', { frage })],
})
