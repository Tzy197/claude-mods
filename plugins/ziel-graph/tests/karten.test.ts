import { expect, test } from 'claude-code/testing'

import { STRANG_FARBEN } from '../hooks/fest'
import { auftragFuer, chatId, detail, erklaerungFuer, fertigId, sicht } from '../hooks/karten/karten'
import { KARTE_HOEHE, KARTE_MAX, KARTE_MIN, SVG_GRENZE, anordnung, baueFlaeche, vorschau, wunschZellen } from '../hooks/karten/zeichnen'

import { KEINE, LAUFEND, STAMM_OHNE_GOAL, antwort, gelungen, umfeld } from './shop'

// Die Karten ohne Engine: was die breite Ansicht aus dem einen Plan und den laufenden Chats
// macht, was die Detail-Fläche sagt, welche Aufträge sie legt und wie die Fläche gesetzt
// wird. Alle Testdaten sind erfunden.

test('die Sicht: je Strang eine Spalte, erledigte Bündel als eine Karte, der Chat als Marke', () => {
  const { plan } = gelungen(antwort())
  const bild = sicht(plan, LAUFEND, '')

  expect(bild.spalten.map(one => `${one.strang.name}|${one.ohneZiel}|${one.kopf.join(' / ')}|${one.wohin}`)).toEqual([
    'Katalog|false|Alle Produkte mit Text und Bild im Shop|→ Großer Umbau',
    'Kasse|true|kein Ziel festgelegt / vermutet: Bestellen ohne Umweg|→ Großer Umbau',
    'Suche|false|Jedes Produkt in zwei Klicks finden|→ Endziel',
    'Betrieb|true|kein Ziel festgelegt|Dauerläufer: läuft weiter',
  ])
  expect(bild.spalten[0]?.karten.hinter).toEqual([
    {
      id: fertigId('katalog'),
      art: 'fertig',
      strang: 'katalog',
      zone: 'hinter',
      zeichen: 'erledigt',
      titel: '2 erledigt',
      meta: 'Grundstock: 13 Produktseiten fertig · Bilder für Schuhe und Jacken',
      chat: '',
      leise: true,
      gewaehlt: false,
    },
  ])
  expect(bild.spalten[2]?.karten.hinter).toEqual([])
  expect(bild.spalten[1]?.karten.jetzt.map(one => `${one.id}|${one.zeichen}|${one.chat}|${one.gewaehlt}`)).toEqual([
    'warenkorb|laeuft|wartet|true',
    'gutscheine|bereit||false',
  ])
  // Worauf ein Bündel wartet, steht in seiner zweiten Zeile.
  expect(bild.spalten[1]?.karten.spaeter[0]).toMatchObject({ meta: 'vermutet · wartet auf: Entwurf Warenkorb-Regeln', leise: true })
  expect(bild.spalten[3]?.karten.jetzt[1]).toMatchObject({ zeichen: 'teilweise', meta: '1 von 3 erledigt · Rest wartet auf den Lasttest' })
  expect(bild.stamm.map(one => `${one.id}|${one.zeichen}|${one.titel}|${one.meta}`)).toEqual([
    'grundstock-steht|erreicht|Grundstock steht|erreicht',
    'grosser-umbau|zwischenziel|Großer Umbau|sobald Katalog und Kasse fertig sind',
    'lasttest-bestanden|zwischenziel|Lasttest bestanden|',
    'endziel|endziel|Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.|aus GOAL.md',
  ])
  // Ohne Wahl gilt die Karte, an der ein anderer Chat wartet. Der Chat ohne Bündel steht daneben.
  expect(bild.gewaehlt).toBe('warenkorb')
  expect(bild.ohneKarte.map(one => one.name)).toEqual(['Bilder zuschneiden'])
  expect(bild.zaehler).toBe('6 Bündel jetzt möglich · 2 Chats · 1 wartet auf dich')

  // Eine Wahl, die es gibt, gilt; ohne laufende Chats trägt keine Karte eine Marke.
  expect(sicht(plan, LAUFEND, 'gutscheine').gewaehlt).toBe('gutscheine')
  expect(sicht(plan, LAUFEND, chatId('sitzung-4')).gewaehlt).toBe(chatId('sitzung-4'))
  expect(sicht(plan, LAUFEND, 'gibt-es-nicht').gewaehlt).toBe('warenkorb')

  const ohneChats = sicht(plan, KEINE, '')

  expect(ohneChats.gewaehlt).toBe('')
  expect(ohneChats.spalten.flatMap(one => [...one.karten.jetzt, ...one.karten.spaeter]).every(one => one.chat === '')).toBe(true)
  expect(ohneChats.spalten[1]?.karten.jetzt[0]).toMatchObject({ id: 'warenkorb', zeichen: 'bereit' })
  expect(ohneChats.zaehler).toBe('6 Bündel jetzt möglich · 0 Chats · keiner wartet auf dich')
  // Der eigene Chat, der wartet, wird nicht von selbst gewählt.
  expect(sicht(plan, { ...LAUFEND, ich: 'sitzung-7' }, '').gewaehlt).toBe('')

  // Ohne GOAL.md: vermutet, und ohne Zwischenziel führen die Ziele zum Treffpunkt.
  const ohne = sicht(gelungen(antwort({ stamm: STAMM_OHNE_GOAL }), umfeld(null)).plan, KEINE, '')

  expect(ohne.spalten.map(one => `${one.kopf.join(' / ')}|${one.wohin}`)).toEqual([
    'kein Ziel festgelegt|→ Treffpunkt: Großer Umbau',
    'kein Ziel festgelegt / vermutet: Bestellen ohne Umweg|→ Treffpunkt: Großer Umbau',
    'kein Ziel festgelegt|→ Treffpunkt: Großer Umbau',
    'kein Ziel festgelegt|Dauerläufer: läuft weiter',
  ])
  expect(ohne.stamm.map(one => `${one.titel}|${one.meta}`)).toEqual([
    'Treffpunkt: Großer Umbau|vermutet · sobald Katalog, Kasse und Suche fertig sind',
    'Lasttest|',
    'Endziel (vermutet): der Shop im Betrieb|vermutet · in GOAL.md nicht festgelegt',
  ])
})

test('die Detail-Fläche und die Aufträge: Strang und sein Ziel, Titel, Punkte, Quelle', () => {
  const { plan } = gelungen(antwort())

  expect(detail(plan, LAUFEND, 'gutscheine')).toEqual({
    id: 'gutscheine',
    kopf: 'Jetzt möglich · Strang Kasse',
    titel: 'Entwurf Gutschein-Einlösung',
    zeilen: [
      { art: 'leise', text: 'bereit' },
      { art: 'leise', text: 'Ziel des Strangs: kein Ziel festgelegt' },
      { art: 'punkt', text: 'Gutschein an der Kasse prüfen' },
      { art: 'punkt', text: 'Restbetrag merken' },
      { art: 'leise', text: 'Quelle: docs/kasse.md' },
    ],
    chats: [],
    knoepfe: ['auftrag', 'erklaeren'],
  })
  expect(auftragFuer(plan, 'gutscheine')).toBe(
    [
      'Arbeite an diesem Schritt aus dem Plan des Repos.',
      [
        'Strang: Kasse',
        'Ziel des Strangs: noch nicht festgelegt',
        'Endziel: Der Shop ist im Betrieb und nimmt Bestellungen an.',
        'Schritt: Entwurf Gutschein-Einlösung',
        'Stand: bereit',
        'Dazu gehört:\n- Gutschein an der Kasse prüfen\n- Restbetrag merken',
        'Quelle: docs/kasse.md (dort steht, was gemeint ist)',
      ].join('\n'),
      'Lies zuerst die Quelle und was im Repo dazu schon steht. Sag mir dann in wenigen Sätzen, wie du vorgehst, und fang an. Bleib bei diesem einen Schritt. Wenn etwas unklar ist, frag mich, eine Frage auf einmal und mit einer Empfehlung.',
    ].join('\n\n'),
  )

  const erklaerung = erklaerungFuer(plan, 'katalog-texte') ?? ''

  expect(erklaerung).toContain('Erkläre mir diesen Schritt aus dem Plan des Repos')
  expect(erklaerung).toContain('Strang: Katalog\nZiel des Strangs: Alle Produkte mit Text und Bild im Shop')
  expect(erklaerung).toContain('Schritt: Katalog-Texte abnehmen\nStand: bereit · 3 von 5 Kategorien abgenommen')
  expect(erklaerung).toContain('- Jacken: Farbgruppen')
  expect(erklaerung).toContain('Zeig es mit einem kleinen Bild: ein echtes Beispiel, vorher und nachher.')
  expect(erklaerung).toContain('Ändere dabei nichts im Repo.')
  expect(auftragFuer(plan, 'build-skripte')).toContain('Wartet zum Teil auf: Lasttest bestanden')
  expect(auftragFuer(plan, 'gibt-es-nicht')).toBe(null)
  expect(erklaerungFuer(plan, fertigId('katalog'))).toBe(null)

  // Eine Karte mit Chat: sein Stand, sein nächster Schritt und seine Frage.
  expect(detail(plan, LAUFEND, 'warenkorb')).toMatchObject({
    kopf: 'Jetzt möglich · Strang Kasse',
    chats: [{ id: 'sitzung-7', name: 'Warenkorb-Regeln', stand: 'Der Entwurf der Regeln steht.', naechster: 'Die Rundung der Beträge prüfen.', frage: 'Sollen Gutscheine auch den Versand decken?', istDieser: false }],
    knoepfe: ['auftrag', 'erklaeren'],
  })
  // „Später“ hat keine Knöpfe, sagt aber, worauf es wartet.
  expect(detail(plan, LAUFEND, 'rechnungen')).toMatchObject({
    kopf: 'Später · Strang Kasse',
    knoepfe: [],
    zeilen: [
      { art: 'leise', text: 'wartet · vermutet: wartet auf die Entwürfe' },
      { art: 'leise', text: 'Ziel des Strangs: kein Ziel festgelegt' },
      { art: 'leise', text: 'Quelle: docs/kasse.md' },
      { art: 'text', text: 'Wartet auf: Entwurf Warenkorb-Regeln' },
      { art: 'leise', text: 'Vermutet: Das Modell hat dieses Bündel oder seinen Stand nur geschlossen.' },
    ],
  })
  expect(detail(plan, LAUFEND, fertigId('katalog'))).toMatchObject({
    kopf: 'Hinter uns · Strang Katalog',
    titel: '2 erledigt',
    zeilen: [
      { art: 'leise', text: 'Ziel des Strangs: Alle Produkte mit Text und Bild im Shop' },
      { art: 'punkt', text: 'Grundstock: 13 Produktseiten fertig' },
      { art: 'punkt', text: 'Bilder für Schuhe und Jacken (seit September)' },
    ],
    knoepfe: [],
  })
  expect(detail(plan, LAUFEND, 'grosser-umbau')).toMatchObject({
    kopf: 'Zwischenziel',
    titel: 'Großer Umbau',
    zeilen: [
      { art: 'leise', text: 'sobald Katalog und Kasse fertig sind' },
      { art: 'text', text: 'Dazu gehören die Stränge: Katalog, Kasse' },
      { art: 'leise', text: 'Quelle: GOAL.md' },
    ],
  })
  expect(detail(plan, LAUFEND, 'endziel')).toMatchObject({ titel: 'Der Shop ist im Betrieb und nimmt Bestellungen an.', knoepfe: [] })
  expect(detail(gelungen(antwort(), umfeld(null)).plan, LAUFEND, 'endziel')).toMatchObject({ titel: 'der Shop im Betrieb', knoepfe: ['endziel'] })
  expect(detail(plan, LAUFEND, chatId('sitzung-4'))).toMatchObject({ kopf: 'Chat ohne Karte', titel: 'Bilder zuschneiden', chats: [{ id: 'sitzung-4' }] })
  expect(detail(plan, LAUFEND, '')).toBe(null)
})

test('die Fläche: je nach Breite neben, unter oder gestapelt; jede Karte ist ein eigenes kleines Bild', () => {
  // 4 Stränge: breit genug für die Detail-Fläche daneben, sonst darunter, sonst untereinander.
  expect(anordnung(200, 4)).toEqual({ art: 'neben', karte: 219 })
  expect(anordnung(150, 4)).toEqual({ art: 'unter', karte: 210 })
  expect(anordnung(320, 3)).toEqual({ art: 'neben', karte: KARTE_MAX })
  expect(anordnung(100, 4).art).toBe('gestapelt')
  expect(anordnung(58, 4)).toEqual({ art: 'gestapelt', karte: KARTE_MAX })
  expect(anordnung(30, 4)).toEqual({ art: 'gestapelt', karte: 190 })
  expect(anordnung(150, 4).karte >= KARTE_MIN).toBe(true)
  expect(wunschZellen(0)).toBe(172)
  expect(wunschZellen(4)).toBe(200)
  expect(wunschZellen(7)).toBe(200)

  const { plan } = gelungen(antwort())
  const bild = sicht(plan, LAUFEND, 'gutscheine')

  for (const farben of ['auto', 'hell', 'dunkel'] as const) {
    for (const zellen of [200, 150, 58]) {
      const flaeche = baueFlaeche(bild, { zellen, farben })
      const zellenAller = [...flaeche.baender.flatMap(one => one.spalten.flat()), ...flaeche.stamm]
      const bilder = [
        flaeche.kopfRand,
        flaeche.endeRand,
        flaeche.stammRand,
        ...flaeche.koepfe.map(one => one.bild),
        ...flaeche.baender.map(one => one.rand),
        ...flaeche.enden,
        ...zellenAller.map(one => one.bild),
      ]

      expect(flaeche.koepfe.map(one => `${one.id}:${one.ohneZiel}`)).toEqual(['katalog:false', 'kasse:true', 'suche:false', 'betrieb:true'])
      expect(flaeche.baender.map(one => one.titel)).toEqual(['Hinter uns', 'Jetzt möglich', 'Später'])

      for (const eines of bilder) {
        expect(eines.source.startsWith('<svg ')).toBe(true)
        expect(eines.source.endsWith('</svg>')).toBe(true)
        expect(eines.source).not.toMatch(/NaN|undefined|[\u0000-\u001f]/)
        expect(eines.source.split('<text ').length).toBe(eines.source.split('</text>').length)
        expect(eines.source.includes('prefers-color-scheme')).toBe(farben === 'auto' && eines.alt !== 'Rand')
        // Kein Bild ist groß: Jedes bleibt weit unter der Grenze der Engine.
        expect(eines.source.length < 2000).toBe(true)
        expect(eines.alt).not.toBe('')
      }

      // Jede Karte hat ihren Knopf, die Füllung zwischen den Karten keinen.
      expect(zellenAller.filter(one => one.knopf !== '').map(one => one.knopf)).toEqual([
        fertigId('katalog'),
        fertigId('kasse'),
        'katalog-texte',
        'warenkorb',
        'gutscheine',
        'suchfelder',
        'ladezeit',
        'build-skripte',
        'rueckfragen',
        'rechnungen',
        'grundstock-steht',
        'grosser-umbau',
        'lasttest-bestanden',
        'endziel',
      ])
      // Gezählt wird, was die Leiste zeichnet: gestapelt ohne Ränder und ohne die Enden der Spalten.
      const gezeichnet = flaeche.art === 'gestapelt' ? [...flaeche.koepfe.map(one => one.bild), ...zellenAller.map(one => one.bild)] : bilder

      expect(flaeche.zeichen).toBe(gezeichnet.reduce((summe, one) => summe + one.source.length, 0))
      // Das ganze Markup einer Zeichnung bleibt klein: ein Viertel dessen, was ein einziges Svg dürfte.
      expect(flaeche.zeichen < SVG_GRENZE / 4).toBe(true)

      if (flaeche.art !== 'gestapelt') {
        // In jedem Band sind alle Spalten gleich hoch: So stehen die Bänder ohne Versatz untereinander.
        for (const band of flaeche.baender) {
          for (const spalte of band.spalten) {
            expect(spalte.reduce((summe, one) => summe + one.bild.hoehe, 0)).toBe(band.rand.hoehe)
          }
        }

        expect(flaeche.baender.map(one => one.rand.hoehe / KARTE_HOEHE)).toEqual([1, 2, 1])
        expect(flaeche.spalte).toBe(Math.ceil((flaeche.karte + 36) / 7.8) + 1)
        // Alle Spalten und der Rand passen in die Leiste.
        expect(84 + 4 * flaeche.spalte * 7.8 + (flaeche.art === 'neben' ? 330 + 2 * 7.8 : 0) <= zellen * 7.8).toBe(true)
      }

      if (farben !== 'auto') {
        const ganz = vorschau(flaeche, farben)

        expect(ganz.source.startsWith('<svg ')).toBe(true)
        expect(ganz.source.split('<svg ').length).toBe(ganz.source.split('</svg>').length)
      }
    }
  }

  // Die gewählte Karte ist kräftig umrandet, die wartende warm; hell und dunkel nehmen andere Farben.
  const hell = baueFlaeche(bild, { zellen: 200, farben: 'hell' })
  const dunkel = baueFlaeche(bild, { zellen: 200, farben: 'dunkel' })
  const karte = (flaeche: typeof hell, id: string): string =>
    [...flaeche.baender.flatMap(one => one.spalten.flat()), ...flaeche.stamm].find(one => one.knopf === id)?.bild.source ?? ''

  expect(karte(hell, 'gutscheine')).toContain('stroke-width="2" fill="#ffffff" stroke="#16242b"')
  expect(karte(dunkel, 'gutscheine')).toContain('stroke-width="2" fill="#1d242b" stroke="#e9eef1"')
  expect(karte(hell, 'warenkorb')).toContain('stroke-width="2" fill="#ffffff" stroke="#c27a00"')
  expect(karte(hell, 'warenkorb')).toContain('Chat wartet auf dich')
  expect(karte(hell, 'katalog-texte')).toContain('stroke-width="1" fill="#ffffff" stroke="#c3cfd5"')
  expect(karte(dunkel, 'katalog-texte')).toContain(STRANG_FARBEN[0]?.dunkel ?? '-')
  expect(hell.zeichen).toBe(dunkel.zeichen)
})
