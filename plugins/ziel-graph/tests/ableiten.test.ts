import { expect, test } from 'claude-code/testing'

import { STRANG_FARBEN } from '../hooks/fest'
import { AUFTRAG, MAX_BUENDEL, MAX_STRAENGE, baueEingabe, leseJson, normalisiere } from '../hooks/plan/ableiten'
import { leseGoal } from '../hooks/plan/goal'

import { CHAT, GOAL, OHNE_GOAL, STAMM_OHNE_GOAL, ZEILEN, antwort, antwortOhneGoal, gelungen, pruefe, umfeld } from './shop'

// Das Ableiten ohne Engine: der Auftrag ans Modell, die Eingabe und das Aufräumen der
// Antwort zu dem einen Plan. Alle Testdaten sind erfunden.

// ---------- Der Auftrag und die Eingabe ----------

test('der Auftrag lehrt die Begriffe, verlangt nur JSON und nennt die Regel für die Stränge aus GOAL.md', () => {
  for (const begriff of [
    'Endziel',
    'Zwischenziel',
    'Ziel:',
    'Dauerläufer',
    'Bahn:',
    'Bündel',
    'Treffpunkt',
    'Zone',
    'Wartet auf',
    'Stamm',
    'vermutet',
    '"quelle"',
    'Es gibt genau eines',
    '2 bis 6 Bahnen',
    '8 bis 24 Bündel',
    'höchstens 38 Zeichen',
    'höchstens 50 Zeichen',
    '"hinter"',
    '"jetzt"',
    '"spaeter"',
    'Antworte nur mit einem JSON-Objekt',
    'Erfinde nichts',
    'Strang und Bahn sind dasselbe',
    'Sie steht zuerst und geht jeder anderen Quelle vor',
    'Die Stränge aus GOAL.md sind die Spalten',
    'jeder mit genau der id und genau dem Namen aus <goal-gelesen>',
    'Du benennst keinen Strang um, legst keine zwei zusammen, teilst keinen und lässt keinen weg',
    'Das Programm zeigt sie als „nicht in GOAL.md“',
    'Das Endziel übernimmst du wörtlich aus GOAL.md',
    'Fehlt <goal>',
  ]) {
    expect(AUFTRAG).toContain(begriff)
  }
})

test('die Eingabe nennt GOAL.md zuerst, dann jede Quelle in ihrem eigenen Block', () => {
  const quellen = {
    wurzel: '/arbeit/shop',
    schluessel: 'github.com+beispiel+shop',
    goal: GOAL,
    doku: [
      { datei: 'README.md', text: '# Shop\n', zeichen: 7, gekuerzt: false },
      { datei: 'docs/kasse.md', text: 'Die Kasse …', zeichen: 20000, gekuerzt: true },
    ],
    chats: [{ ...CHAT, branch: 't21-warenkorb', stand: 'Der Entwurf steht.', naechster: '', frage: 'Sollen Gutscheine den Versand decken?' }],
    commits: ['2026-09-30 Warenkorb merkt sich die Menge'],
    hinweise: [],
  }
  const eingabe = baueEingabe(quellen, leseGoal(GOAL), '2026-10-04')

  expect(eingabe).toBe(
    [
      'Leite den Plan für dieses Repo ab. Heute ist der 2026-10-04.',
      `<goal datei="GOAL.md">\n${GOAL.trim()}\n</goal>`,
      [
        '<goal-gelesen>',
        'Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.',
        'Zwischenziele, in dieser Reihenfolge:',
        '- id "grundstock-steht": Grundstock steht (erreicht)',
        '- id "grosser-umbau": Großer Umbau',
        '- id "lasttest-bestanden": Lasttest bestanden',
        'Stränge, in dieser Reihenfolge:',
        '- id "katalog": Katalog · Ziel: Alle Produkte mit Text und Bild im Shop · gehört zu "grosser-umbau"',
        '- id "kasse": Kasse · kein Ziel festgelegt · gehört zu "grosser-umbau"',
        '- id "suche": Suche · Ziel: Jedes Produkt in zwei Klicks finden',
        '- id "betrieb": Betrieb · kein Ziel festgelegt',
        '</goal-gelesen>',
      ].join('\n'),
      '<doku datei="README.md">\n# Shop\n</doku>',
      '<doku datei="docs/kasse.md" gekuerzt="ja">\nDie Kasse …\n</doku>',
      '<chats>\nc1 · Warenkorb-Regeln · Branch t21-warenkorb\nStand: Der Entwurf steht.\nNächster Schritt: keiner genannt\nOffene Frage an den Nutzer: Sollen Gutscheine den Versand decken?\n</chats>',
      '<commits>\n2026-09-30 Warenkorb merkt sich die Menge\n</commits>',
    ].join('\n\n'),
  )
  expect(eingabe.indexOf('<goal ') < eingabe.indexOf('<doku ')).toBe(true)

  // Ohne GOAL.md gibt es keinen Block dafür; eine leere Datei sagt, dass sie leer ist.
  const ohne = baueEingabe({ ...quellen, goal: null, doku: [], chats: [], commits: [] }, leseGoal(null), '2026-10-04')

  expect(ohne).not.toContain('<goal')
  expect(ohne).toContain('Das Repo hat keine Markdown-Doku.')
  expect(ohne).toContain('Es laufen keine Chats.')
  expect(ohne).toContain('Kein Git-Verlauf lesbar.')

  const leer = baueEingabe({ ...quellen, goal: ' \n' }, leseGoal(' \n'), '2026-10-04')

  expect(leer).toContain('<goal datei="GOAL.md">\nDie Datei ist leer.\n</goal>')
  expect(leer).toContain('Endziel: noch offen\nZwischenziele: keine genannt\nStränge: keine genannt')
})

test('der Auftrag nennt die Festlegungen als verbindlich und lässt den vorigen Plan fortschreiben', () => {
  for (const satz of [
    '- <festlegungen>: Sätze des Nutzers, die bei jedem Ableiten gelten, je Zeile einer. Sie stehen gleich nach GOAL.md.',
    '- <voriger-plan>: der Plan, den der Nutzer zuletzt gesehen hat, in Kurzform',
    'Festlegungen gehen allem anderen vor, außer den Strängen und dem Endziel aus GOAL.md: der Doku, den Chats, den Commits, dem vorigen Plan und deinem eigenen Urteil.',
    'Du befolgst jede Festlegung, auch wenn die anderen Quellen etwas anderes nahelegen.',
    'Widerspricht eine Festlegung dem, was GOAL.md festlegt, gilt GOAL.md.',
    'Eine Festlegung bestimmt nur den Plan: wie er geschnitten, zugeordnet und geordnet ist. Die Form der Antwort ändert sie nicht',
    'Eine Festlegung allein ist kein Bündel',
    'Fehlt <festlegungen>, gibt es keine.',
    'Steht <voriger-plan> in der Eingabe, leitest du nicht von vorn ab: Du schreibst diesen Plan fort.',
    'Jedes Bündel, das es weiter gibt, behält seine id und seinen Titel, Zeichen für Zeichen.',
    'Das gilt auch für Erledigtes: Ein Bündel in der Zone "hinter" bleibt dort mit seiner id und seinem Titel stehen',
    'Zone, Stand und Zuschnitt eines Bündels änderst du nur, wo sich die Quellen seit dem vorigen Plan geändert haben oder wo eine Festlegung es verlangt.',
    'Dieselben Quellen anders zu lesen, ist kein Grund.',
    'Ein Bündel fügst du nur hinzu und lässt du nur weg, wenn die Quellen einen Grund dafür nennen',
    'Ein neues Bündel bekommt eine id, die im vorigen Plan nicht vorkommt.',
    'Der vorige Plan ist keine Quelle',
    'Fehlt <voriger-plan>, leitest du den Plan zum ersten Mal ab.',
    'Jede Festlegung ist befolgt. Jedes Bündel aus <voriger-plan>, das es weiter gibt, trägt seine id und seinen Titel von dort.',
  ]) {
    expect(AUFTRAG).toContain(satz)
  }

  // Erst GOAL.md, dann die Festlegungen, dann der vorige Plan: in dieser Reihenfolge gehen sie vor.
  const stellen = ['# GOAL.md geht vor', '# Festlegungen gehen vor', '# Der vorige Plan wird fortgeschrieben', '# Die Antwort'].map(one => AUFTRAG.indexOf(one))

  expect(stellen.every(one => one > 0)).toBe(true)
  expect(stellen).toEqual([...stellen].sort((a, b) => a - b))
})

test('die Eingabe nennt die Festlegungen gleich nach GOAL.md und den vorigen Plan zuletzt, in Kurzform', () => {
  const quellen = {
    wurzel: '/arbeit/shop',
    schluessel: 'github.com+beispiel+shop',
    goal: GOAL,
    doku: [{ datei: 'README.md', text: '# Shop\n', zeichen: 7, gekuerzt: false }],
    chats: [],
    commits: ['2026-09-30 Warenkorb merkt sich die Menge'],
    hinweise: [],
  }
  const goal = leseGoal(GOAL)
  const ohne = baueEingabe(quellen, goal, '2026-10-04')
  const [vorn = '', hinten = ''] = ohne.split('</goal-gelesen>\n\n')
  const festlegungen = ['Die Gutscheine gehören zur Kasse, nicht zum Katalog.', 'Der Lasttest kommt erst nach dem großen Umbau.']
  // Der Plan von vor einer Woche: zwei Bündel, auf dem Stamm die Zwischenziele aus GOAL.md.
  const { plan } = gelungen(antwort({ zeilen: ZEILEN.slice(3, 5).map(one => (one.id === 'warenkorb' ? { ...one, titel: 'Regeln für den „Warenkorb“' } : one)), chats: [] }), umfeld(GOAL, []))
  const kurzform = [
    '<voriger-plan abgeleitet="2026-09-27">',
    'zeilen:',
    '{"id":"katalog-texte","bahn":"katalog","zone":"jetzt","stand":"bereit","titel":"Katalog-Texte abnehmen"}',
    '{"id":"warenkorb","bahn":"kasse","zone":"jetzt","stand":"bereit","titel":"Regeln für den „Warenkorb“"}',
    'stamm:',
    '{"id":"grundstock-steht","art":"zwischenziel","titel":"Grundstock steht"}',
    '{"id":"grosser-umbau","art":"zwischenziel","titel":"Großer Umbau"}',
    '{"id":"lasttest-bestanden","art":"zwischenziel","titel":"Lasttest bestanden"}',
    '</voriger-plan>',
  ].join('\n')

  expect(baueEingabe(quellen, goal, '2026-10-04', { festlegungen, voriger: { plan, zeit: Date.UTC(2026, 8, 27, 9) } })).toBe(
    `${vorn}</goal-gelesen>\n\n<festlegungen>\n- ${festlegungen[0]}\n- ${festlegungen[1]}\n</festlegungen>\n\n${hinten}\n\n${kurzform}`,
  )
  // Ohne Festlegungen und ohne vorigen Plan ist die Eingabe die des ersten Laufs.
  expect(baueEingabe(quellen, goal, '2026-10-04', { festlegungen: [], voriger: null })).toBe(ohne)
  expect(ohne).not.toContain('<festlegungen>')
  expect(ohne).not.toContain('<voriger-plan')
  expect(ohne.endsWith('</commits>')).toBe(true)
  // Ist nicht bekannt, wann der vorige Plan entstand, fehlt nur der Tag.
  expect(baueEingabe(quellen, goal, '2026-10-04', { voriger: { plan, zeit: 0 } })).toBe(`${ohne}\n\n${kurzform.replace(' abgeleitet="2026-09-27"', '')}`)
  // Ohne GOAL.md stehen die Festlegungen ganz vorn.
  expect(baueEingabe({ ...quellen, goal: null }, leseGoal(null), '2026-10-04', { festlegungen }).startsWith(
    `Leite den Plan für dieses Repo ab. Heute ist der 2026-10-04.\n\n<festlegungen>\n- ${festlegungen[0]}\n`,
  )).toBe(true)
})

// ---------- Das Aufräumen ----------

test('mit GOAL.md: Stränge, Endziel und Zwischenziele stehen wörtlich im Plan, das Modell füllt nur die Bündel', () => {
  const { plan, warnungen } = gelungen(antwort())

  expect(warnungen).toEqual([])
  pruefe(plan)

  expect(plan.mitGoal).toBe(true)
  expect(plan.endziel).toEqual({ text: 'Der Shop ist im Betrieb und nimmt Bestellungen an.', herkunft: 'goal' })
  expect(plan.straenge.map(({ farbe, ...rest }) => rest)).toEqual([
    { id: 'katalog', name: 'Katalog', art: 'ziel', ziel: 'Alle Produkte mit Text und Bild im Shop', vermutung: '', inGoal: true, gehoertZu: 'grosser-umbau' },
    // Kein Ziel in GOAL.md: Es bleibt leer, die Vermutung des Modells steht daneben.
    { id: 'kasse', name: 'Kasse', art: 'ziel', ziel: '', vermutung: 'Bestellen ohne Umweg', inGoal: true, gehoertZu: 'grosser-umbau' },
    { id: 'suche', name: 'Suche', art: 'ziel', ziel: 'Jedes Produkt in zwei Klicks finden', vermutung: '', inGoal: true, gehoertZu: '' },
    { id: 'betrieb', name: 'Betrieb', art: 'dauer', ziel: '', vermutung: '', inGoal: true, gehoertZu: '' },
  ])
  // Die Farben kommen der Reihe nach aus der festen Palette, nicht vom Modell.
  expect(plan.straenge.map(one => one.farbe)).toEqual(STRANG_FARBEN.slice(0, 4))

  expect(plan.buendel.map(one => one.id)).toEqual([
    'grundstock',
    'bilder',
    'zahlarten',
    'katalog-texte',
    'warenkorb',
    'gutscheine',
    'suchfelder',
    'ladezeit',
    'build-skripte',
    'rueckfragen',
    'rechnungen',
  ])
  expect(plan.buendel.find(one => one.id === 'katalog-texte')).toEqual({
    id: 'katalog-texte',
    strang: 'katalog',
    zone: 'jetzt',
    stand: 'bereit',
    titel: 'Katalog-Texte abnehmen',
    meta: '3 von 5 Kategorien abgenommen',
    punkte: ['Schuhe: Größen als Variante oder Filter', 'Jacken: Farbgruppen', 'Taschen: Leder oder Stoff'],
    quelle: 'docs/katalog.md',
    vermutet: false,
    wartetAuf: '',
    chats: [],
  })
  // Der zugeordnete Chat hängt mit seiner Session am Bündel.
  expect(plan.buendel.find(one => one.id === 'warenkorb')).toMatchObject({ zone: 'jetzt', stand: 'bereit', chats: ['sitzung-7'] })
  expect(plan.chats).toEqual([{ id: 'sitzung-7', kennung: 'c1', name: 'Warenkorb-Regeln', buendel: 'warenkorb' }])
  // „Wartet auf“ zeigt auf ein Zwischenziel und auf ein anderes Bündel.
  expect(plan.buendel.find(one => one.id === 'build-skripte')).toMatchObject({ stand: 'teilweise', wartetAuf: 'lasttest-bestanden' })
  expect(plan.buendel.find(one => one.id === 'rechnungen')).toMatchObject({ stand: 'blockiert', wartetAuf: 'warenkorb', vermutet: true })

  // Der Stamm: die Zwischenziele aus GOAL.md, wörtlich und in ihrer Reihenfolge.
  expect(plan.stamm).toEqual([
    { id: 'grundstock-steht', art: 'zwischenziel', titel: 'Grundstock steht', meta: '', quelle: 'GOAL.md', vermutet: false, inGoal: true, erreicht: true },
    { id: 'grosser-umbau', art: 'zwischenziel', titel: 'Großer Umbau', meta: 'sobald Katalog und Kasse fertig sind', quelle: 'GOAL.md', vermutet: false, inGoal: true, erreicht: false },
    { id: 'lasttest-bestanden', art: 'zwischenziel', titel: 'Lasttest bestanden', meta: '', quelle: 'GOAL.md', vermutet: false, inGoal: true, erreicht: false },
  ])
})

test('mit GOAL.md: Umbenennen, Zusammenlegen und Weglassen durch das Modell gilt nicht; ein neuer Strang ist markiert', () => {
  const bahnen = [
    { id: 'katalog', name: 'Sortiment', art: 'ziel', ziel: 'Das Modell meint es anders' },
    // Zweimal dieselbe Kasse: einmal mit ihrer id, einmal nur beim Namen.
    { id: 'kasse', name: 'Kasse', art: 'dauer' },
    { id: 'checkout', name: 'Kasse', art: 'ziel' },
    { id: 'lager', name: 'Lager', art: 'ziel', ziel: 'Bestand in Echtzeit' },
  ]
  const zeilen = [
    { id: 'a', bahn: 'katalog', zone: 'jetzt', stand: 'bereit', titel: 'Katalog-Texte abnehmen', quelle: 'docs/katalog.md' },
    { id: 'b', bahn: 'checkout', zone: 'jetzt', stand: 'bereit', titel: 'Entwurf Warenkorb-Regeln', quelle: 'docs/kasse.md' },
    // Auch ein Strang, den das Modell unter "bahnen" weggelassen hat, nimmt seine Bündel.
    { id: 'c', bahn: 'Suche', zone: 'jetzt', stand: 'bereit', titel: 'Suchfelder und Sortierung', quelle: 'README.md' },
    { id: 'd', bahn: 'lager', zone: 'spaeter', stand: 'blockiert', titel: 'Bestand aus dem Lager lesen', quelle: 'README.md' },
    // Das Modell erfindet ein Zwischenziel und wartet darauf.
    { id: 'e', bahn: 'kasse', zone: 'spaeter', stand: 'blockiert', titel: 'Block Rechnungen', wartetAuf: 'abnahme', quelle: 'docs/kasse.md' },
  ]
  const stamm = [
    { id: 'grosser-umbau', art: 'zwischenziel', titel: 'Der ganz große Umbau', meta: 'sobald alles fertig ist' },
    { id: 'abnahme', art: 'zwischenziel', titel: 'Abnahme durch den Einkauf', meta: '', quelle: 'README.md' },
  ]
  const { plan, warnungen } = gelungen(antwort({ endziel: 'etwas ganz anderes', bahnen, zeilen, stamm, chats: [] }), umfeld(GOAL, []))

  pruefe(plan)
  // Name, Ziel und Reihenfolge aus GOAL.md; „Lager“ hängt hinten an und ist nicht aus GOAL.md.
  expect(plan.straenge.map(one => `${one.id}|${one.name}|${one.art}|${one.ziel}|${one.vermutung}|${one.inGoal}`)).toEqual([
    'katalog|Katalog|ziel|Alle Produkte mit Text und Bild im Shop||true',
    'kasse|Kasse|dauer|||true',
    'suche|Suche|ziel|Jedes Produkt in zwei Klicks finden||true',
    'betrieb|Betrieb|ziel|||true',
    'lager|Lager|ziel||Bestand in Echtzeit|false',
  ])
  expect(plan.endziel).toEqual({ text: 'Der Shop ist im Betrieb und nimmt Bestellungen an.', herkunft: 'goal' })
  expect(plan.buendel.map(one => `${one.id}:${one.strang}`)).toEqual(['a:katalog', 'b:kasse', 'c:suche', 'e:kasse', 'd:lager'])
  // Die Zwischenziele bleiben, wie GOAL.md sie nennt; das erfundene steht als Schritt dahinter.
  expect(plan.stamm.map(one => `${one.id}|${one.art}|${one.titel}|${one.inGoal}`)).toEqual([
    'grundstock-steht|zwischenziel|Grundstock steht|true',
    'grosser-umbau|zwischenziel|Großer Umbau|true',
    'lasttest-bestanden|zwischenziel|Lasttest bestanden|true',
    'abnahme|schritt|Abnahme durch den Einkauf|false',
  ])
  expect(plan.stamm[1]?.meta).toBe('sobald alles fertig ist')
  expect(plan.buendel.find(one => one.id === 'e')?.wartetAuf).toBe('abnahme')
  expect(warnungen).toEqual([
    'Das Modell nennt den Strang „Katalog“ aus GOAL.md „Sortiment“: Es gilt der Name aus GOAL.md.',
    'Das Modell nennt den Strang „Kasse“ aus GOAL.md zweimal („Kasse“): Beide gelten als dieser eine Strang.',
    'Das Modell hat den Strang „Lager“ gefunden, der nicht in GOAL.md steht.',
    'Das Modell hat den Strang „Suche“ aus GOAL.md weggelassen: Er bleibt als Spalte stehen.',
    'Das Modell hat den Strang „Betrieb“ aus GOAL.md weggelassen: Er bleibt als Spalte stehen.',
    '„Abnahme durch den Einkauf“ steht nicht als Zwischenziel in GOAL.md: Es steht als Schritt auf dem Stamm.',
    'Strang „Betrieb“ hat kein Bündel.',
  ])
})

test('das Endziel: wörtlich aus GOAL.md, sonst vermutet, sonst offen', () => {
  const offenesGoal = GOAL.replace('Der Shop ist im Betrieb und nimmt Bestellungen an.', 'noch offen')
  const vermutet = gelungen(antwort(), umfeld(offenesGoal))

  expect(vermutet.plan.endziel).toEqual({ text: 'der Shop im Betrieb', herkunft: 'vermutet' })
  expect(vermutet.warnungen).toEqual([])

  const offen = gelungen(antwort({ endziel: '' }), umfeld(offenesGoal))

  expect(offen.plan.endziel).toEqual({ text: '', herkunft: 'offen' })
  expect(offen.warnungen).toEqual(['Die Antwort nennt kein Endziel.'])

  // Ein langes Endziel aus GOAL.md bleibt ganz; das Wort „Endziel:“ vor dem des Modells fällt weg.
  const lang = `Der Shop ist im Betrieb, nimmt Bestellungen an, ${'liefert pünktlich, '.repeat(8)}und alle sind zufrieden.`

  expect(gelungen(antwort(), umfeld(GOAL.replace('Der Shop ist im Betrieb und nimmt Bestellungen an.', lang))).plan.endziel.text).toBe(lang)
  expect(gelungen(antwort({ endziel: 'Endziel: der Shop im Betrieb' }), umfeld(null)).plan.endziel.text).toBe('der Shop im Betrieb')
})

test('ohne GOAL.md: Der Plan kommt wie bisher vom Modell, und alles über Ziele gilt als vermutet', () => {
  const { plan, warnungen } = gelungen(antwort({ stamm: STAMM_OHNE_GOAL }), umfeld(null))

  expect(warnungen).toEqual([])
  pruefe(plan)
  expect(plan.mitGoal).toBe(false)
  expect(plan.endziel).toEqual({ text: 'der Shop im Betrieb', herkunft: 'vermutet' })
  expect(plan.straenge.map(one => `${one.id}|${one.art}|${one.ziel}|${one.vermutung}|${one.inGoal}`)).toEqual([
    'katalog|ziel|||false',
    'kasse|ziel||Bestellen ohne Umweg|false',
    'suche|ziel|||false',
    'betrieb|dauer|||false',
  ])
  expect(plan.stamm).toEqual([
    { id: 'umbau', art: 'treffpunkt', titel: 'Treffpunkt: Großer Umbau', meta: 'sobald Katalog, Kasse und Suche fertig sind', quelle: 'README.md', vermutet: true, inGoal: false, erreicht: false },
    { id: 'lasttest-bestanden', art: 'schritt', titel: 'Lasttest', meta: '', quelle: 'README.md', vermutet: false, inGoal: false, erreicht: false },
  ])
  expect(plan.buendel.find(one => one.id === 'build-skripte')?.wartetAuf).toBe('lasttest-bestanden')

  // Eine leere GOAL.md legt nichts fest: Die Stränge kommen vom Modell, ohne Hinweis darauf.
  const leer = gelungen(antwort({ stamm: STAMM_OHNE_GOAL }), umfeld(''))

  expect(leer.plan.mitGoal).toBe(true)
  expect(leer.plan.straenge.every(one => !one.inGoal)).toBe(true)
  expect(leer.warnungen).toEqual([])
})

test('eine Antwort mit Fehlern wird repariert; ohne JSON, ohne Strang oder ohne Bündel scheitert sie', () => {
  const zeilen = [
    { id: 'a', bahn: 'katalog', zone: 'jetzt', stand: 'bereit', titel: 'Katalog-Texte abnehmen', quelle: 'README.md' },
    { id: 'b', bahn: 'lager', zone: 'jetzt', stand: 'bereit', titel: 'Lager anbinden', quelle: 'README.md' },
    { id: 'c', bahn: 'katalog', zone: 'Später', stand: 'bereit', titel: 'Bilder für alle Kategorien', quelle: 'README.md' },
    { id: 'd', bahn: 'kasse', zone: 'irgendwann', stand: 'erledigt', titel: 'Zahlarten geklärt', quelle: 'README.md' },
    { id: 'a', bahn: 'kasse', zone: 'jetzt', stand: 'läuft', titel: 'Warenkorb merken\nund\u0007 zeigen', quelle: 'nirgends.md', wartetAuf: 'a' },
    { id: 'f', bahn: 'kasse', zone: 'jetzt', stand: 'bereit', titel: '', quelle: 'README.md' },
    { id: 'g', bahn: 'kasse', zone: 'spaeter', stand: 'blockiert', titel: 'Block Rechnungen', quelle: 'README.md', wartetAuf: 'd' },
    'kein Bündel',
  ]
  const { plan, warnungen } = gelungen(
    `Hier ist der Plan:\n\`\`\`json\n${antwort({ zeilen, chats: [{ id: 'c1', zeile: 'g' }, { id: 'c9', zeile: 'a' }] })}\n\`\`\``,
  )

  pruefe(plan)
  expect(plan.buendel.map(one => `${one.id}:${one.zone}:${one.stand}:${one.wartetAuf}`)).toEqual([
    'd:hinter:erledigt:',
    'a:jetzt:bereit:',
    'a-2:jetzt:teilweise:a',
    // Ein Chat arbeitet an dem Bündel: Es steht in „Jetzt möglich“, und es wartet auf nichts Erledigtes.
    'g:jetzt:bereit:',
    'c:spaeter:blockiert:',
  ])
  expect(plan.buendel.find(one => one.id === 'a-2')).toMatchObject({ titel: 'Warenkorb merken und zeigen', quelle: '', vermutet: true })
  expect(warnungen).toEqual([
    'Bündel „Lager anbinden“ nennt den unbekannten Strang „lager“: weggelassen.',
    'Bündel „Bilder für alle Kategorien“: Stand „bereit“ passt nicht zur Zone „Später“, es gilt „blockiert“.',
    'Bündel „Zahlarten geklärt“: Die Zone „irgendwann“ ist unbekannt, aus dem Stand wird „Hinter uns“.',
    'Bündel „Warenkorb merken und zeigen“: Ob es läuft, sagen die Chats, hier gilt „bereit“.',
    'Die id „a“ kommt zweimal vor: „Warenkorb merken und zeigen“ heißt jetzt „a-2“.',
    '„Warenkorb merken und zeigen“ nennt die Quelle „nirgends.md“, die das Modell nicht bekommen hat: als vermutet markiert.',
    'Bündel „f“ hat keinen Titel: weggelassen.',
    'Ein Bündel ist kein Objekt: weggelassen.',
    'Die Antwort ordnet einen Chat zu, den es nicht gibt („c9“): übergangen.',
    'Bündel „Block Rechnungen“ stand in „Später“, Chat „Warenkorb-Regeln“ arbeitet aber daran: nach „Jetzt möglich“ gesetzt.',
    'Bündel „Warenkorb merken und zeigen“ ist bereit, wartet aber auf „Katalog-Texte abnehmen“: als zum Teil möglich gezeichnet.',
    'Bündel „Block Rechnungen“ wartet auf „Zahlarten geklärt“, das schon erledigt ist: Der Verweis fällt weg.',
    'Strang „Suche“ hat kein Bündel.',
    'Strang „Betrieb“ hat kein Bündel.',
  ])

  expect(normalisiere('', umfeld())).toMatchObject({ ok: false, grund: 'Die Antwort des Modells ist leer.' })
  expect(normalisiere('Dazu kann ich nichts sagen.', umfeld())).toMatchObject({ ok: false, grund: 'In der Antwort des Modells steht kein JSON-Objekt.' })
  expect(normalisiere(antwort().slice(0, 400), umfeld())).toMatchObject({ ok: false, grund: 'In der Antwort des Modells steht kein JSON-Objekt.' })
  expect(normalisiere('{"endziel": "der Shop im Betrieb"}', umfeld(null))).toMatchObject({ ok: false, grund: 'Die Antwort des Modells nennt keinen Strang.' })
  expect(normalisiere(antwort({ zeilen: [] }), umfeld())).toMatchObject({ ok: false, grund: 'Die Antwort des Modells enthält kein brauchbares Bündel.' })

  // Zu viele Stränge des Modells fallen weg; die aus GOAL.md nie.
  const viele = Array.from({ length: 12 }, (_, n) => ({ id: `x${n}`, name: `Strang ${n}`, art: 'ziel' }))
  const ohneGoal = gelungen(antwort({ bahnen: viele, zeilen: [{ id: 'a', bahn: 'x0', zone: 'jetzt', stand: 'bereit', titel: 'Etwas', quelle: 'README.md' }], chats: [] }), umfeld(null, []))

  expect(ohneGoal.plan.straenge).toHaveLength(MAX_STRAENGE)

  const vielGoal = `## Stränge\n${Array.from({ length: 9 }, (_, n) => `### Strang ${n}`).join('\n')}\n`
  const mitGoal = gelungen(antwort({ bahnen: viele, zeilen: [{ id: 'a', bahn: 'strang-0', zone: 'jetzt', stand: 'bereit', titel: 'Etwas', quelle: 'README.md' }], stamm: [], chats: [] }), umfeld(vielGoal, []))

  expect(mitGoal.plan.straenge.map(one => one.id)).toEqual(Array.from({ length: 9 }, (_, n) => `strang-${n}`))
  expect(mitGoal.plan.straenge.every(one => one.inGoal)).toBe(true)
})

// ---------- Das Aufräumen im Einzelnen ----------

// Der Shop ohne GOAL.md: Das Modell schneidet die Stränge selbst und setzt einen Treffpunkt.
const ohne = (chats: Parameters<typeof umfeld>[1] = []) => umfeld(null, chats)

const chat = (nummer: number, name: string) => ({ id: `sitzung-${nummer}`, kennung: `c${nummer}`, name })

test('ein Markdown-Zaun oder Text um das JSON stört nicht', () => {
  const nackt = gelungen(antwort())

  expect(gelungen(`\`\`\`json\n${antwort()}\n\`\`\``)).toEqual(nackt)
  expect(gelungen(`Hier ist der Plan:\n\n${antwort()}\n\nSag Bescheid, wenn etwas fehlt.`)).toEqual(nackt)
  expect(gelungen(`Gern.\n\`\`\`\n${antwort()}\n\`\`\`\nDas war es {fast}.`)).toEqual(nackt)

  expect(leseJson('{"a": 1}')).toEqual({ a: 1 })
  expect(leseJson('[1, 2]')).toBe(null)
  expect(leseJson('{"a": ')).toBe(null)

  // Eine leere Antwort sagt das, und was GOAL.md auffiel, steht auch dann da.
  expect(normalisiere('', umfeld())).toEqual({ ok: false, grund: 'Die Antwort des Modells ist leer.', warnungen: [] })
  expect(normalisiere('  \n ', umfeld())).toMatchObject({ ok: false, grund: 'Die Antwort des Modells ist leer.' })
  expect(normalisiere(antwort({ zeilen: 'viele', bahnen: [{ name: 'Katalog' }] }), umfeld())).toMatchObject({ ok: false })
})

test('ein unbekannter Strang kostet nur sein Bündel; Zone und Stand werden repariert', () => {
  const zeilen = [
    { id: 'a', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Katalog-Texte abnehmen', quelle: 'README.md' },
    { id: 'b', bahn: 'lager', zone: 'jetzt', stand: 'bereit', titel: 'Lager anbinden', quelle: 'README.md' },
    { id: 'c', bahn: 'kat', zone: 'Später', stand: 'bereit', titel: 'Bilder für alle Kategorien', quelle: 'README.md' },
    { id: 'd', bahn: 'kat', zone: 'irgendwann', stand: 'erledigt', titel: 'Grundstock steht', quelle: 'README.md' },
    { id: 'e', bahn: 'kas', zone: 'jetzt', stand: 'in Arbeit', titel: 'Entwurf Gutschein-Einlösung', quelle: 'README.md' },
    { id: 'f', bahn: 'kas', zone: 'jetzt', stand: 'blockiert', titel: 'Block Rechnungen', quelle: 'README.md' },
    { id: 'g', bahn: 'kas', zone: 'hinter uns', stand: 'bereit', titel: 'Zahlarten geklärt', quelle: 'README.md' },
    { id: 'h', bahn: 'kas', zone: '', stand: '', titel: 'Ohne alles', quelle: 'README.md' },
    { id: 'i', bahn: 'kas', zone: 'jetzt', stand: 'läuft', titel: 'Warenkorb merken', quelle: 'README.md' },
    { id: 'j', bahn: 'kas', zone: 'jetzt', stand: 'bereit', titel: '', quelle: 'README.md' },
    'kein Bündel',
  ]
  const { plan, warnungen } = gelungen(antwortOhneGoal({ zeilen, chats: [] }), ohne())

  pruefe(plan)
  expect(plan.buendel.map(one => `${one.id}:${one.zone}:${one.stand}`)).toEqual([
    'd:hinter:erledigt',
    'g:hinter:erledigt',
    'a:jetzt:bereit',
    'e:jetzt:bereit',
    'f:jetzt:teilweise',
    'i:jetzt:bereit',
    'c:spaeter:blockiert',
  ])
  expect(warnungen).toEqual([
    'Bündel „Lager anbinden“ nennt den unbekannten Strang „lager“: weggelassen.',
    'Bündel „Bilder für alle Kategorien“: Stand „bereit“ passt nicht zur Zone „Später“, es gilt „blockiert“.',
    'Bündel „Grundstock steht“: Die Zone „irgendwann“ ist unbekannt, aus dem Stand wird „Hinter uns“.',
    'Bündel „Entwurf Gutschein-Einlösung“: Der Stand „in Arbeit“ ist unbekannt, in „Jetzt möglich“ gilt „bereit“.',
    'Bündel „Block Rechnungen“: Stand „blockiert“ passt nicht zur Zone „Jetzt möglich“, es gilt „teilweise“.',
    'Bündel „Zahlarten geklärt“: Stand „bereit“ passt nicht zur Zone „Hinter uns“, es gilt „erledigt“.',
    'Bündel „Ohne alles“ hat weder eine bekannte Zone noch einen bekannten Stand: weggelassen.',
    'Bündel „Warenkorb merken“: Ob es läuft, sagen die Chats, hier gilt „bereit“.',
    'Bündel „j“ hat keinen Titel: weggelassen.',
    'Ein Bündel ist kein Objekt: weggelassen.',
    'Strang „Suche“ hat kein Bündel.',
    'Strang „Betrieb“ hat kein Bündel.',
  ])
})

test('Stränge des Modells: unbekannte Art, doppelte id, vergebene Namen und zu viele', () => {
  const bahnen = [
    { id: 'Betrieb & Co', name: 'Betrieb', art: 'Dauerläufer' },
    { id: 'stamm', name: 'Stamm', art: 'ziel' },
    { id: 'kat', name: 'Katalog', art: 'projekt' },
    { id: 'kat', name: 'Katalog zwei', art: 'ziel' },
    { name: 'Kasse', art: 'ziel' },
    { id: 'x', art: 'ziel' },
    {},
    ...[1, 2, 3, 4, 5].map(n => ({ id: `mehr${n}`, name: `Mehr ${n}`, art: 'ziel' })),
  ]
  const zeilen = [
    { id: 'a', bahn: 'Betrieb & Co', zone: 'jetzt', stand: 'bereit', titel: 'Ladezeit senken', quelle: 'README.md' },
    { id: 'b', bahn: 'stamm', zone: 'jetzt', stand: 'bereit', titel: 'Auf dem Strang namens Stamm', quelle: 'README.md' },
    { id: 'c', bahn: 'kat', zone: 'hinter', stand: 'erledigt', titel: 'Grundstock steht', quelle: 'README.md' },
    { id: 'd', bahn: 'mehr5', zone: 'jetzt', stand: 'bereit', titel: 'Auf einem Strang zu viel', quelle: 'README.md' },
  ]
  const { plan, warnungen } = gelungen(antwortOhneGoal({ bahnen, zeilen, chats: [] }), ohne())

  pruefe(plan)
  // Die Ziele stehen vor dem Dauerläufer; „stamm“ ist für den gemeinsamen Weg vergeben.
  expect(plan.straenge.map(one => `${one.id}:${one.name}:${one.art}`)).toEqual([
    'stamm-2:Stamm:ziel',
    'kat:Katalog:ziel',
    'kasse:Kasse:ziel',
    'x:x:ziel',
    'mehr1:Mehr 1:ziel',
    'mehr2:Mehr 2:ziel',
    'betrieb-co:Betrieb:dauer',
  ])
  expect(plan.straenge).toHaveLength(MAX_STRAENGE)
  // Die Farbe folgt dem Platz im Plan: Der Dauerläufer am Ende bekommt die siebte.
  expect(plan.straenge.map(one => one.farbe)).toEqual(STRANG_FARBEN)
  expect(plan.buendel.map(one => `${one.id}:${one.strang}`)).toEqual(['c:kat', 'b:stamm-2', 'a:betrieb-co'])
  expect(warnungen).toContain('Strang „Katalog“: Die Art „projekt“ ist unbekannt, er gilt als Ziel.')
  expect(warnungen).toContain('Der Strang „kat“ kommt zweimal vor: Der zweite („Katalog zwei“) fällt weg.')
  expect(warnungen).toContain('Ein Strang hat weder Namen noch id: weggelassen.')
  expect(warnungen).toContain('Strang „Mehr 3“ weggelassen: Mehr als 7 Stränge zeichnet die Fläche nicht.')
  expect(warnungen).toContain('Bündel „Auf einem Strang zu viel“ nennt den unbekannten Strang „mehr5“: weggelassen.')
})

test('Verweise treffen auch beim Namen des Strangs und in anderer Schreibweise der id', () => {
  const zeilen = [
    { id: 'Katalog-Texte', bahn: 'Katalog', zone: 'jetzt', stand: 'bereit', titel: 'Katalog-Texte abnehmen', quelle: 'README.md' },
    { id: 'bilder', bahn: 'KAT', zone: 'spaeter', stand: 'blockiert', titel: 'Bilder für alle Kategorien', wartetAuf: 'katalog-texte', quelle: 'README.md' },
    { id: 'rechnungen', bahn: 'kas', zone: 'spaeter', stand: 'blockiert', titel: 'Block Rechnungen', wartetAuf: 'Katalog Texte', quelle: 'README.md' },
    { id: 'neu', bahn: 'katalog', zone: 'jetzt', stand: 'bereit', titel: 'Neuer Katalog', quelle: 'README.md' },
  ]
  const zuordnung = [{ id: 'c1', zeile: 'KATALOG-TEXTE' }]
  const { plan, warnungen } = gelungen(antwortOhneGoal({ zeilen, chats: zuordnung }), ohne([CHAT]))

  pruefe(plan)
  expect(plan.buendel.map(one => `${one.id}:${one.strang}:${one.stand}:${one.wartetAuf}`)).toEqual([
    'katalog-texte:kat:bereit:',
    'neu:kat:bereit:',
    'bilder:kat:blockiert:katalog-texte',
    'rechnungen:kas:blockiert:katalog-texte',
  ])
  expect(plan.chats).toEqual([{ id: 'sitzung-7', kennung: 'c1', name: 'Warenkorb-Regeln', buendel: 'katalog-texte' }])
  expect(warnungen).toEqual(['Strang „Suche“ hat kein Bündel.', 'Strang „Betrieb“ hat kein Bündel.'])

  // Ein zweiter Strang, dessen id der Name eines anderen ist, gilt als derselbe: So fallen
  // auch „Kasse“ und „kasse“ aus GOAL.md nie auseinander.
  const doppelt = gelungen(
    antwortOhneGoal({ bahnen: [...OHNE_GOAL.bahnen, { id: 'katalog', name: 'Katalog neu', art: 'ziel' }], zeilen, chats: zuordnung }),
    ohne([CHAT]),
  )

  expect(doppelt.plan.straenge.map(one => one.id)).toEqual(['kat', 'kas', 'suc', 'btr'])
  expect(doppelt.warnungen).toContain('Der Strang „katalog“ kommt zweimal vor: Der zweite („Katalog neu“) fällt weg.')
})

test('doppelte und unbrauchbare ids werden eindeutig, Verweise gelten der ersten', () => {
  const zeilen = [
    { id: 'entwurf', bahn: 'kas', zone: 'jetzt', stand: 'bereit', titel: 'Entwurf Warenkorb-Regeln', quelle: 'README.md' },
    { id: 'entwurf', bahn: 'kas', zone: 'jetzt', stand: 'bereit', titel: 'Entwurf Gutschein-Einlösung', quelle: 'README.md' },
    { id: 'Prüfung der Größen!', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Größen prüfen', quelle: 'README.md' },
    { bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Ohne id', quelle: 'README.md' },
    { id: 'endziel', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Heißt wie das Endziel', quelle: 'README.md' },
    { id: 'lasttest', bahn: 'btr', zone: 'spaeter', stand: 'blockiert', titel: 'Heißt wie ein Stamm-Schritt', wartetAuf: 'entwurf', quelle: 'README.md' },
  ]
  const { plan, warnungen } = gelungen(antwortOhneGoal({ zeilen }), ohne([CHAT]))

  pruefe(plan)
  expect(plan.buendel.map(one => one.id)).toEqual(['pruefung-der-groessen', 'ohne-id', 'endziel-2', 'entwurf', 'entwurf-2', 'lasttest'])
  expect(plan.stamm.map(one => one.id)).toEqual(['umbau', 'lasttest-2', 'lager'])
  expect(plan.buendel.find(one => one.id === 'lasttest')?.wartetAuf).toBe('entwurf')
  expect(warnungen).toEqual([
    'Die id „entwurf“ kommt zweimal vor: „Entwurf Gutschein-Einlösung“ heißt jetzt „entwurf-2“.',
    'Die id „lasttest“ kommt zweimal vor: „Lasttest“ heißt jetzt „lasttest-2“.',
    // Der Chat ist „warenkorb“ zugeordnet, das es hier nicht gibt.
    'Chat „Warenkorb-Regeln“ ist dem unbekannten Bündel „warenkorb“ zugeordnet: Er steht ohne Karte da.',
    'Strang „Suche“ hat kein Bündel.',
  ])
})

test('„wartet auf“ bleibt nur, wo es auf ein offenes anderes Bündel oder einen Schritt des Stamms zeigt', () => {
  const zeilen = [
    { id: 'grundstock', bahn: 'kat', zone: 'hinter', stand: 'erledigt', titel: 'Grundstock steht', wartetAuf: 'texte', quelle: 'README.md' },
    { id: 'texte', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Katalog-Texte abnehmen', wartetAuf: 'gibt-es-nicht', quelle: 'README.md' },
    { id: 'bilder', bahn: 'kat', zone: 'spaeter', stand: 'blockiert', titel: 'Bilder für alle Kategorien', wartetAuf: 'bilder', quelle: 'README.md' },
    { id: 'rechnungen', bahn: 'kas', zone: 'spaeter', stand: 'blockiert', titel: 'Block Rechnungen', wartetAuf: 'grundstock', quelle: 'README.md' },
    { id: 'gutscheine', bahn: 'kas', zone: 'spaeter', stand: 'blockiert', titel: 'Gutscheine einlösen', wartetAuf: 'texte', quelle: 'README.md' },
    { id: 'suchfelder', bahn: 'suc', zone: 'jetzt', stand: 'bereit', titel: 'Suchfelder und Sortierung', wartetAuf: 'lasttest', quelle: 'README.md' },
    { id: 'ladezeit', bahn: 'btr', zone: 'spaeter', stand: 'blockiert', titel: 'Ladezeit senken', wartetAuf: 'umbau', quelle: 'README.md' },
  ]
  const { plan, warnungen } = gelungen(antwortOhneGoal({ zeilen, chats: [] }), ohne())

  pruefe(plan)
  expect(plan.buendel.filter(one => one.wartetAuf !== '').map(one => `${one.id}→${one.wartetAuf}:${one.stand}`)).toEqual([
    'suchfelder→lasttest:teilweise',
    'gutscheine→texte:blockiert',
    'ladezeit→umbau:blockiert',
  ])
  expect(warnungen).toEqual([
    'Bündel „Grundstock steht“ ist erledigt und wartet auf nichts mehr: Der Verweis fällt weg.',
    'Bündel „Katalog-Texte abnehmen“ wartet auf etwas Unbekanntes („gibt-es-nicht“): Der Verweis fällt weg.',
    'Bündel „Bilder für alle Kategorien“ wartet auf sich selbst: Der Verweis fällt weg.',
    'Bündel „Block Rechnungen“ wartet auf „Grundstock steht“, das schon erledigt ist: Der Verweis fällt weg.',
    'Bündel „Suchfelder und Sortierung“ ist bereit, wartet aber auf „Lasttest“: als zum Teil möglich gezeichnet.',
  ])

  // Ein Zwischenziel, das GOAL.md als erreicht abhakt, hält niemanden mehr auf.
  const erreicht = gelungen(
    antwort({ zeilen: [{ id: 'a', bahn: 'kasse', zone: 'spaeter', stand: 'blockiert', titel: 'Block Rechnungen', wartetAuf: 'grundstock-steht', quelle: 'README.md' }], chats: [] }),
    umfeld(GOAL, []),
  )

  expect(erreicht.plan.buendel[0]?.wartetAuf).toBe('')
  expect(erreicht.warnungen).toContain('Bündel „Block Rechnungen“ wartet auf „Grundstock steht“, das schon erledigt ist: Der Verweis fällt weg.')
})

test('Chats: Das zugeordnete Bündel ist jetzt möglich; wer nicht passt, steht ohne Bündel da', () => {
  const chats = [
    chat(1, 'Warenkorb-Regeln'),
    chat(2, 'Katalog-Texte'),
    chat(3, 'Aufräumen'),
    chat(4, 'Rechnungen'),
    chat(5, 'Nicht genannt'),
    chat(6, 'Zweiter am Warenkorb'),
    chat(7, 'Am Treffpunkt'),
  ]
  const zuordnung = [
    { id: 'c1', zeile: 'warenkorb' },
    // Das Modell darf auch die id der Session nennen.
    { id: 'sitzung-2', zeile: 'katalog-texte' },
    { id: 'c3', zeile: '' },
    { id: 'c4', zeile: 'rechnungen' },
    { id: 'c6', zeile: 'warenkorb' },
    { id: 'c7', zeile: 'umbau' },
    { id: 'c9', zeile: 'warenkorb' },
    { id: 'c1', zeile: 'gutscheine' },
  ]
  const { plan, warnungen } = gelungen(antwortOhneGoal({ chats: zuordnung }), ohne(chats))
  const von = (id: string) => plan.buendel.find(one => one.id === id)

  pruefe(plan)
  expect(von('warenkorb')?.chats).toEqual(['sitzung-1', 'sitzung-6'])
  expect(von('katalog-texte')?.chats).toEqual(['sitzung-2'])
  // Das blockierte Bündel, an dem ein Chat arbeitet, steht jetzt in „Jetzt möglich“; weil
  // es weiter auf ein anderes wartet, ist es nur zum Teil möglich.
  expect(von('rechnungen')).toMatchObject({ zone: 'jetzt', stand: 'teilweise', wartetAuf: 'warenkorb', chats: ['sitzung-4'] })
  expect(von('gutscheine')?.chats).toEqual([])
  expect(plan.chats.map(one => `${one.kennung}:${one.buendel}`)).toEqual([
    'c1:warenkorb',
    'c2:katalog-texte',
    'c3:',
    'c4:rechnungen',
    'c5:',
    'c6:warenkorb',
    'c7:',
  ])
  expect(warnungen).toEqual([
    'Chat „Am Treffpunkt“ ist dem Stamm zugeordnet („Treffpunkt: Großer Umbau“): Er steht ohne Karte da.',
    'Die Antwort ordnet einen Chat zu, den es nicht gibt („c9“): übergangen.',
    'Chat „Warenkorb-Regeln“ ist zweimal zugeordnet: Die erste Zuordnung gilt.',
    'Bündel „Block Rechnungen“ stand in „Später“, Chat „Rechnungen“ arbeitet aber daran: nach „Jetzt möglich“ gesetzt.',
    'Chat „Nicht genannt“ fehlt in der Antwort: Er steht ohne Karte da.',
    'Bündel „Block Rechnungen“ ist bereit, wartet aber auf „Entwurf Warenkorb-Regeln“: als zum Teil möglich gezeichnet.',
  ])
})

test('Stamm ohne GOAL.md: Ein fehlender Treffpunkt bleibt weg, ein zweiter wird zum Schritt', () => {
  const kein = gelungen(antwortOhneGoal({ stamm: [], endziel: 'Endziel: alles läuft' }), ohne([CHAT]))

  pruefe(kein.plan)
  // Der Mod setzt keinen Treffpunkt, den niemand genannt hat. Der Verweis auf den
  // Stamm-Schritt, den es nicht mehr gibt, fällt weg.
  expect(kein.plan.stamm).toEqual([])
  expect(kein.plan.endziel).toEqual({ text: 'alles läuft', herkunft: 'vermutet' })
  expect(kein.warnungen).toEqual([
    'Bündel „Umbau der Build-Skripte“ wartet auf etwas Unbekanntes („lasttest“): Der Verweis fällt weg.',
    'Die Antwort nennt keinen Treffpunkt.',
  ])

  const stamm = [
    { id: 'lasttest', art: 'schritt', titel: 'Lasttest', quelle: 'README.md' },
    { id: 'umbau', art: 'Treffpunkt', titel: 'Treffpunkt: Großer Umbau', quelle: 'README.md' },
    { id: 'start', art: 'treffpunkt', titel: 'Treffpunkt: Start', quelle: 'nirgends.md' },
    { art: 'schritt', titel: '' },
    ...[1, 2, 3, 4, 5, 6].map(n => ({ id: `s${n}`, art: 'schritt', titel: `Schritt ${n}`, quelle: 'README.md' })),
  ]
  const viele = gelungen(antwortOhneGoal({ stamm, endziel: '' }), ohne([CHAT]))

  pruefe(viele.plan)
  expect(viele.plan.endziel).toEqual({ text: '', herkunft: 'offen' })
  expect(viele.plan.stamm.map(one => `${one.id}:${one.art}:${one.vermutet}`)).toEqual([
    // Ohne GOAL.md hat niemand den Treffpunkt bestätigt.
    'umbau:treffpunkt:true',
    'lasttest:schritt:false',
    'start:schritt:true',
    's1:schritt:false',
    's2:schritt:false',
    's3:schritt:false',
    's4:schritt:false',
  ])
  expect(viele.warnungen).toEqual([
    'Der Treffpunkt „Treffpunkt: Großer Umbau“ stand nicht am Anfang des Stamms: nach vorn gesetzt.',
    '„Treffpunkt: Start“ ist ein zweiter Treffpunkt: Die Fläche zeigt nur einen, dieser steht als Schritt auf dem Stamm.',
    '„Treffpunkt: Start“ nennt die Quelle „nirgends.md“, die das Modell nicht bekommen hat: als vermutet markiert.',
    'Stamm-Eintrag „ohne id“ hat keinen Titel: weggelassen.',
    'Stamm-Schritt „Schritt 5“ weggelassen: Mehr als 6 zeichnet die Fläche nicht.',
    'Stamm-Schritt „Schritt 6“ weggelassen: Mehr als 6 zeichnet die Fläche nicht.',
    'Die Antwort nennt kein Endziel.',
  ])

  // Auch ohne ein einziges Ziel ist der Plan gültig: Dann sind alle Stränge Dauerläufer.
  const nurDauer = gelungen(antwortOhneGoal({ bahnen: OHNE_GOAL.bahnen.map(one => ({ ...one, art: 'dauer' })) }), ohne([CHAT]))

  pruefe(nurDauer.plan)
  expect(nurDauer.plan.straenge.every(one => one.art === 'dauer')).toBe(true)
  expect(nurDauer.warnungen).toEqual([])
})

test('Quelle und „vermutet“: Jedes Bündel nennt seine Quelle, sonst gilt es als vermutet', () => {
  const zeilen = [
    { id: 'a', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Genau genannt', quelle: 'docs/plan/suche.md' },
    { id: 'b', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Nur der Dateiname', quelle: 'suche.md' },
    { id: 'c', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Mit Punkt davor', quelle: './README.md' },
    { id: 'c2', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Zwei Quellen', quelle: 'docs/geheim.md, `docs/kasse.md` und commits' },
    { id: 'c3', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Mit Abschnitt', quelle: 'docs/katalog.md#texte' },
    { id: 'd', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Erfundene Datei', meta: '2 von 5 erledigt', quelle: 'docs/geheim.md' },
    { id: 'e', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Ohne Quelle' },
    { id: 'f', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Vermutet ohne Wort', meta: 'braucht wohl die Suche', quelle: 'README.md', vermutet: true },
    { id: 'g', bahn: 'kat', zone: 'jetzt', stand: 'bereit', titel: 'Vermutet mit Wort', meta: 'Vermutet: braucht die Suche', quelle: 'README.md', vermutet: 'true' },
  ]
  const { plan, warnungen } = gelungen(antwortOhneGoal({ zeilen, chats: [] }), ohne())

  pruefe(plan)
  expect(plan.buendel.map(one => `${one.quelle}|${one.vermutet}`)).toEqual([
    'docs/plan/suche.md|false',
    'docs/plan/suche.md|false',
    'README.md|false',
    'docs/kasse.md|false',
    'docs/katalog.md|false',
    '|true',
    '|true',
    'README.md|true',
    'README.md|true',
  ])
  expect(warnungen).toEqual([
    '„Erfundene Datei“ nennt die Quelle „docs/geheim.md“, die das Modell nicht bekommen hat: als vermutet markiert.',
    '„Ohne Quelle“ nennt keine Quelle: als vermutet markiert.',
    'Strang „Kasse“ hat kein Bündel.',
    'Strang „Suche“ hat kein Bündel.',
    'Strang „Betrieb“ hat kein Bündel.',
  ])
})

test('zu viel und zu lang wird gedeckelt, Steuerzeichen fallen weg', () => {
  const lang = 'Sehr langer Text über die Kasse und den Katalog. '.repeat(20)
  const zeilen = Array.from({ length: 55 }, (_, n) => ({
    id: `z${n}`,
    bahn: OHNE_GOAL.bahnen[n % 4]?.id,
    zone: ['hinter', 'jetzt', 'spaeter'][n % 3],
    stand: ['erledigt', 'bereit', 'blockiert'][n % 3],
    titel: n === 0 ? 'Mit\nUmbruch\tund\u0000Steuerzeichen <b>&"quot"</b>' : `${n}: ${lang}`,
    meta: lang,
    punkte: Array.from({ length: 12 }, (_unused, p) => `Punkt ${p}: ${lang}`),
    quelle: 'README.md',
  }))
  const { plan, warnungen } = gelungen(antwortOhneGoal({ zeilen, chats: [], endziel: lang }), ohne())

  pruefe(plan)
  expect(plan.buendel).toHaveLength(MAX_BUENDEL)
  expect(warnungen).toContain('15 Bündel weggelassen: Mehr als 40 zeichnet die Fläche nicht.')
  expect(warnungen).toContain('Bündel „Mit Umbruch und Steuerzeichen <b>&"quot"</b>“: nur die ersten 8 von 12 Punkten.')
  expect(plan.buendel.find(one => one.id === 'z0')?.titel).toBe('Mit Umbruch und Steuerzeichen <b>&"quot"</b>')
  expect(plan.buendel.every(one => one.titel.length <= 70 && one.meta.length <= 90)).toBe(true)
  expect(plan.buendel.every(one => one.punkte.length <= 8 && one.punkte.every(punkt => punkt.length <= 100))).toBe(true)
  expect(plan.endziel.text.length <= 80).toBe(true)
})
