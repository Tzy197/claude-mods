import type { RenderElement } from 'claude-code'

import type {
  ZielGraphChats,
  ZielGraphFarben,
  ZielGraphGeladen,
  ZielGraphKartenSicht,
  ZielGraphLauf,
  ZielGraphPlan,
} from '../../types'

import { alter, nameVon } from '../chats'
import { MODELL } from '../fest'
import { ZONEN_FOLGE, ZONEN_NAME } from '../plan/ableiten'
import {
  aenderungsListe,
  aenderungsZeile,
  endzielAuftrag,
  endzielZeile,
  faktenZeile,
  festAuftrag,
  festZeile,
  goalAuftrag,
  laufZeile,
  strangAuftrag,
} from '../plan/lesen'
import type { Taten, Teile } from '../teile'
import { LEERER_PLAN } from '../zustand'

import { auftragFuer, chatId, chatMarke, detail, erklaerungFuer, sicht, zeichenText } from './karten'
import type { Detail, DetailChat, Karte, Sicht } from './karten'
import { DETAIL, ZELLE_PX, baueFlaeche } from './zeichnen'
import type { Bild, Flaeche, Zelle } from './zeichnen'

// Die breite Ansicht `/orchestrator`: der Plan als Prozesskarten, die Detail-Fläche zur
// gewählten Karte, die Festlegungen des Nutzers, was der letzte Lauf geändert hat und was
// beim Ableiten aufgefallen ist. Hier wird nur gezeichnet, ohne `$`: Den Zustand und die
// Handgriffe der Knöpfe reicht register.tsx.

// Mehr Hinweise und mehr Änderungen zeigt die Leiste nicht; alle stehen in der Datei des Plans.
const HINWEISE = 12
const AENDERUNGEN = 12
// Der Platz in der Detail-Fläche für Zusätze, die sich von außen einhängen.
export const PLATZ = 'detail-zusatz'

const FARBEN: readonly { value: ZielGraphFarben; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'hell', label: 'Hell' },
  { value: 'dunkel', label: 'Dunkel' },
]

// Was die Zeichnung braucht: der Zustand der Session und die Breite der Leiste.
export type KartenLage = {
  stand: ZielGraphGeladen
  laufend: ZielGraphChats
  jetzt: ZielGraphLauf
  wahl: ZielGraphKartenSicht
  // die Breite der Leiste in Zeichenzellen
  zellen: number
  // was im Feld für eine neue Festlegung steht
  entwurf: string
}

const zeichneBild = (teile: Teile, bild: Bild): RenderElement | null => {
  const { Svg } = teile

  return Svg === null ? null : <Svg source={bild.source} alt={bild.alt} width={bild.breite} height={bild.hoehe} />
}

// Die Zellen einer Spalte, von oben nach unten: je Karte ihr Bild und rechts ihr Knopf.
const zeichneZellen = (teile: Teile, zellen: readonly Zelle[], taten: Taten): RenderElement[] => {
  const { Box, Button } = teile

  return zellen.map(zelle => (
    <Box flexDirection="row" alignItems="center">
      {zeichneBild(teile, zelle.bild)}
      {zelle.knopf !== '' && (
        <Button key={`karte-${zelle.knopf}`} plain label="›" onPress={() => taten.waehle(zelle.knopf)} />
      )}
    </Box>
  ))
}

// Die Karten als Fläche: oben je Strang sein Kopf, darunter je Abschnitt ein Band mit einer
// Spalte je Strang, zuletzt der Stamm. Alles steht neben- und untereinander im Fluss; die
// Bilder einer Spalte stoßen ohne Lücke aneinander, so läuft die Verbindungslinie durch.
const zeichneFlaeche = (
  teile: Teile,
  plan: ZielGraphPlan,
  flaeche: Flaeche,
  taten: Taten,
): RenderElement => {
  const { Box, Text, Button } = teile
  const zielKnopf = (kopf: Flaeche['koepfe'][number]): RenderElement | false =>
    kopf.ohneZiel && (
      <Box>
        <Button key={`ziel-${kopf.id}`} label="Ziel festlegen" onPress={() => taten.lege(strangAuftrag(plan, kopf.id))} />
      </Box>
    )

  if (flaeche.art === 'gestapelt') {
    return (
      <Box flexDirection="column" gap={1}>
        {flaeche.koepfe.map(kopf => (
          <Box flexDirection="column">
            {zeichneBild(teile, kopf.bild)}
            {zielKnopf(kopf)}
          </Box>
        ))}
        {flaeche.baender.map(band => (
          <Box flexDirection="column">
            <Text bold>{band.titel.toUpperCase()}</Text>
            {band.spalten.map(
              (spalte, i) =>
                spalte.length > 0 && (
                  <Box flexDirection="column">
                    <Text dimColor>{flaeche.koepfe[i]?.name ?? ''}</Text>
                    {zeichneZellen(teile, spalte, taten)}
                  </Box>
                ),
            )}
          </Box>
        ))}
        <Box flexDirection="column">
          <Text bold>ZIELE</Text>
          {zeichneZellen(teile, flaeche.stamm, taten)}
        </Box>
      </Box>
    )
  }

  // Jede Spalte ist in jeder Reihe gleich breit, auf zwei Wegen: Ihre Box hat eine
  // Mindestbreite in Zeichenzellen, und jedes Bild ohne Knopf ist so breit wie Karte und Knopf.
  return (
    <Box flexDirection="column" flexShrink={0}>
      <Box flexDirection="row" alignItems="flex-start">
        {zeichneBild(teile, flaeche.kopfRand)}
        {flaeche.koepfe.map(kopf => (
          <Box flexDirection="column" minWidth={flaeche.spalte} flexShrink={0}>
            {zeichneBild(teile, kopf.bild)}
            {zielKnopf(kopf)}
          </Box>
        ))}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {flaeche.baender.map(band => (
          <Box flexDirection="row" alignItems="flex-start">
            {zeichneBild(teile, band.rand)}
            {band.spalten.map(spalte => (
              <Box flexDirection="column" minWidth={flaeche.spalte} flexShrink={0}>
                {zeichneZellen(teile, spalte, taten)}
              </Box>
            ))}
          </Box>
        ))}
        <Box flexDirection="row" alignItems="flex-start">
          {zeichneBild(teile, flaeche.endeRand)}
          {flaeche.enden.map(ende => (
            <Box flexDirection="column" minWidth={flaeche.spalte} flexShrink={0}>
              {zeichneBild(teile, ende)}
            </Box>
          ))}
        </Box>
      </Box>
      <Box flexDirection="row" alignItems="flex-start" marginTop={1}>
        {zeichneBild(teile, flaeche.stammRand)}
        <Box flexDirection="column">{zeichneZellen(teile, flaeche.stamm, taten)}</Box>
      </Box>
    </Box>
  )
}

const listenZeile = (karte: Karte, strang: string): string =>
  `${karte.gewaehlt ? '▸' : ' '} ${zeichenText(karte)} ${strang === '' ? '' : `${strang} · `}${karte.titel}` +
  `${karte.meta === '' ? '' : ` — ${karte.meta}`}${karte.chat === '' ? '' : ` [${chatMarke(karte)}]`}`

// Der Text-Ersatz für die Karten, wo es kein Bild gibt: eine Liste, je Karte eine Zeile, die
// sich drücken lässt.
const zeichneListe = (teile: Teile, plan: ZielGraphPlan, bild: Sicht, taten: Taten): RenderElement => {
  const { Box, Text, Button } = teile
  const zeile = (karte: Karte, strang: string): RenderElement => (
    <Button
      key={`karte-${karte.id}`}
      plain
      label={listenZeile(karte, strang)}
      dimColor={karte.leise && !karte.gewaehlt}
      onPress={() => taten.waehle(karte.id)}
    />
  )

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>STRÄNGE</Text>
        {bild.spalten.map(spalte => (
          <Box flexDirection="column">
            <Text wrap="wrap">{`${spalte.strang.name} — ${spalte.kopf.join(' · ')}`}</Text>
            {spalte.ohneZiel && (
              <Box>
                <Button
                  key={`ziel-${spalte.strang.id}`}
                  label={`Ziel festlegen: ${spalte.strang.name}`}
                  onPress={() => taten.lege(strangAuftrag(plan, spalte.strang.id))}
                />
              </Box>
            )}
          </Box>
        ))}
      </Box>
      {ZONEN_FOLGE.map(zone => {
        const karten = bild.spalten.flatMap(spalte =>
          spalte.karten[zone].map(karte => ({ karte, strang: spalte.strang.name })),
        )

        // Ein leerer Abschnitt bekommt keine Überschrift; „Jetzt möglich“ steht immer da.
        return (
          (karten.length > 0 || zone === 'jetzt') && (
            <Box flexDirection="column">
              <Text bold>{ZONEN_NAME[zone].toUpperCase()}</Text>
              {karten.map(one => zeile(one.karte, one.strang))}
            </Box>
          )
        )
      })}
      <Box flexDirection="column">
        <Text bold>ZIELE</Text>
        {bild.stamm.map(karte => zeile(karte, ''))}
      </Box>
    </Box>
  )
}

const chatZeilen = (teile: Teile, chat: DetailChat, jetzt: number): RenderElement => {
  const { Box, Text } = teile

  return (
    <Box flexDirection="column">
      <Text bold wrap="wrap">
        {`${chat.frage === '' ? '○' : '●'} Chat: ${nameVon(chat)}${chat.istDieser ? ' (dieser Chat)' : ''}`}
      </Text>
      <Text dimColor wrap="wrap">
        {`${alter(jetzt, chat.zeit)}${chat.branch === '' ? '' : ` · ${chat.branch}`}`}
      </Text>
      <Text wrap="wrap">{`Stand: ${chat.stand === '' ? 'noch keiner' : chat.stand}`}</Text>
      {chat.naechster !== '' && <Text wrap="wrap">{`Weiter: ${chat.naechster}`}</Text>}
      {chat.frage !== '' && (
        <Text bold wrap="wrap">
          {`Wartet auf dich: ${chat.frage}`}
        </Text>
      )}
    </Box>
  )
}

// Die Detail-Fläche zur gewählten Karte: was dazugehört, der Chat daran und die Knöpfe, die
// einen Auftrag ins Eingabefeld legen.
const zeichneDetail = (
  teile: Teile,
  plan: ZielGraphPlan,
  karte: Detail | null,
  jetzt: number,
  // die Breite in Zeichenzellen, wenn die Fläche neben den Karten steht
  breite: number | null,
  taten: Taten,
): RenderElement => {
  const { Box, Text, Button } = teile
  const mass = breite === null ? {} : { width: breite, flexGrow: 1 }

  if (karte === null) {
    return (
      <Box flexDirection="column" {...mass}>
        <Text dimColor wrap="wrap">
          Wähle eine Karte mit „›“: Hier steht dann, was dazugehört.
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1} {...mass}>
      <Box flexDirection="column">
        <Text dimColor wrap="wrap">
          {karte.kopf}
        </Text>
        <Text bold wrap="wrap">
          {karte.titel}
        </Text>
        {karte.zeilen.map(zeile => (
          <Text dimColor={zeile.art === 'leise'} bold={zeile.art === 'stark'} wrap="wrap">
            {zeile.art === 'punkt' ? `– ${zeile.text}` : zeile.text}
          </Text>
        ))}
      </Box>
      {karte.chats.map(chat => chatZeilen(teile, chat, jetzt))}
      {karte.knoepfe.length > 0 && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {karte.knoepfe.includes('auftrag') && (
            <Button
              key="auftrag"
              label="Auftrag ins Eingabefeld legen"
              variant="primary"
              onPress={() => taten.lege({ text: auftragFuer(plan, karte.id), was: 'Der Auftrag' })}
            />
          )}
          {karte.knoepfe.includes('erklaeren') && (
            <Button
              key="erklaeren"
              label="Erklären lassen"
              onPress={() =>
                taten.lege({ text: erklaerungFuer(plan, karte.id), was: 'Die Bitte um eine Erklärung' })
              }
            />
          )}
          {karte.knoepfe.includes('endziel') && (
            <Button key="endziel-detail" label="Endziel festlegen" onPress={() => taten.lege(endzielAuftrag(plan))} />
          )}
        </Box>
      )}
      <Box key={PLATZ} flexDirection="column" />
    </Box>
  )
}

// Wo der Lauf steht, und die Knöpfe der Leiste.
const zeichneKopf = (teile: Teile, lage: KartenLage, taten: Taten): RenderElement => {
  const { Box, Text, Button, Select, Svg } = teile
  const { stand, jetzt, wahl } = lage
  const { plan } = stand
  const status = laufZeile(jetzt)
  const naechsteFarbe = FARBEN[(FARBEN.findIndex(one => one.value === wahl.farben) + 1) % FARBEN.length]

  return (
    <Box flexDirection="column">
      {status !== '' && (
        <Text bold wrap="wrap">
          {status}
        </Text>
      )}
      {jetzt.phase === 'laeuft' && (
        <Text dimColor wrap="wrap">
          {`Ein Modell-Aufruf mit ${MODELL} liest GOAL.md, Doku, Chats und Commits des Repos. ` +
            'Die Leiste zeigt den Plan, sobald er fertig ist.'}
        </Text>
      )}
      {jetzt.phase === 'fehler' && plan !== null && (
        <Text dimColor wrap="wrap">
          Darunter steht weiter der vorige Plan.
        </Text>
      )}
      {jetzt.phase !== 'laeuft' && plan === null && (
        <Text wrap="wrap">
          {'Noch kein Plan für dieses Repo. „Neu ableiten“ liest GOAL.md, README.md, CLAUDE.md und ' +
            'die Doku unter docs/, die laufenden Chats und die letzten 30 Commits. Daraus leitet ein ' +
            'Modell-Aufruf den Plan ab.'}
        </Text>
      )}
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button
          key="neu"
          label="Neu ableiten"
          variant={plan === null ? 'primary' : 'secondary'}
          dimColor={jetzt.phase === 'laeuft'}
          onPress={taten.ableiten}
        />
        <Button key="laden" label="Neu laden" onPress={taten.laden} />
        {Svg !== null && Select !== null && (
          <Select
            key="farben"
            label="Farben"
            options={FARBEN}
            value={wahl.farben}
            onSelect={wert => taten.faerbe(FARBEN.find(one => one.value === wert)?.value ?? 'auto')}
          />
        )}
        {Svg !== null && Select === null && (
          <Button
            key="farben"
            label={`Farben: ${FARBEN.find(one => one.value === wahl.farben)?.label ?? 'Auto'}`}
            onPress={() => taten.faerbe(naechsteFarbe?.value ?? 'auto')}
          />
        )}
      </Box>
    </Box>
  )
}

// Wie GOAL.md dasteht: Fehlt sie, sagt die Leiste das zuerst und bietet an, sie mit dem
// Chat zu entwerfen. Schreiben tut sie nie der Mod.
const zeichneGoal = (teile: Teile, stand: ZielGraphGeladen, taten: Taten): RenderElement | null => {
  const { Box, Text, Button } = teile
  const { goal } = stand

  if (!goal.vorhanden || goal.leer) {
    return (
      <Box flexDirection="column">
        <Text bold wrap="wrap">
          {goal.vorhanden ? 'GOAL.md ist noch leer' : 'GOAL.md fehlt'}
        </Text>
        <Text wrap="wrap">
          {'GOAL.md in der Wurzel des Repos ist der Anker des Plans: Sie nennt das Endziel, die ' +
            'Zwischenziele und je Strang sein Ziel, und ohne sie ist hier alles über Ziele nur vermutet.'}
        </Text>
        <Box>
          <Button
            key="goal-anlegen"
            label="GOAL.md mit dem Chat entwerfen"
            variant="primary"
            onPress={() => taten.lege(goalAuftrag())}
          />
        </Box>
      </Box>
    )
  }

  return goal.geaendert && stand.plan !== null ? (
    <Text wrap="wrap">
      {'GOAL.md hat sich seit dem letzten Ableiten geändert. Ihre Ziele und Stränge stehen schon ' +
        'hier; „Neu ableiten“ ordnet die Bündel neu zu.'}
    </Text>
  ) : null
}

// Das Feld für eine neue Festlegung, immer da und an keine Karte gebunden: gleich unter
// „Neu ableiten“, weil der Satz ab dem nächsten Ableiten gilt. Darüber steht, wie viele
// Festlegungen es gibt und wie viele noch nicht in GOAL.md stehen. Die Liste selbst steht
// weiter unten.
const zeichneFestEingabe = (teile: Teile, lage: KartenLage, taten: Taten): RenderElement => {
  const { Box, Text, Button, Input } = teile
  const { stand } = lage
  const { liste, geaendert } = stand.festlegungen
  const hatLokale = liste.some(one => one.ort === 'lokal')

  return (
    <Box flexDirection="column">
      <Text bold wrap="wrap">
        {festZeile(liste)}
      </Text>
      {liste.length === 0 && (
        <Text dimColor wrap="wrap">
          {'Eine Festlegung ist ein Satz von dir, der bei jedem Ableiten gewinnt: wohin etwas ' +
            'gehört, was zuerst kommt, was zusammengehört.'}
        </Text>
      )}
      {geaendert && stand.plan !== null && (
        <Text wrap="wrap">
          Die Festlegungen sind andere als beim letzten Ableiten: „Neu ableiten“ wendet sie an.
        </Text>
      )}
      {Input === null ? (
        <Text dimColor wrap="wrap">
          Diese Oberfläche zeichnet kein Eingabefeld: Eine neue Festlegung gibst du am Rechner ein.
        </Text>
      ) : (
        <Input
          key="fest-eingabe"
          placeholder="Neue Festlegung: ein Satz, der bei jedem Ableiten gewinnt …"
          value={lage.entwurf}
          submitLabel="festlegen"
          onInput={wert => taten.merkeFest(wert)}
          onSubmit={wert => taten.festlegen(wert)}
        />
      )}
      {(Input !== null || hatLokale) && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {Input !== null && <Button key="festlegen" label="Festlegen" onPress={() => taten.festlegen()} />}
          {hatLokale && (
            <Button
              key="fest-eintragen"
              label="In GOAL.md eintragen lassen"
              onPress={() => taten.lege(festAuftrag(liste, stand.goal.vorhanden))}
            />
          )}
        </Box>
      )}
    </Box>
  )
}

// Was der letzte Lauf am Plan davor geändert hat: eine Zeile, die zählt, und darunter je
// Änderung eine. Sie steht bis zum nächsten Ableiten da. Ohne Plan davor steht nichts da.
const zeichneAenderungen = (teile: Teile, stand: ZielGraphGeladen): RenderElement | null => {
  const { Box, Text } = teile
  const kopf = aenderungsZeile(stand.aenderungen)
  const liste = aenderungsListe(stand.aenderungen)

  if (stand.plan === null || kopf === '') {
    return null
  }

  return (
    <Box flexDirection="column">
      <Text bold={liste.length > 0} dimColor={liste.length === 0} wrap="wrap">
        {kopf}
      </Text>
      {liste.slice(0, AENDERUNGEN).map(one => (
        <Text wrap="wrap">{`– ${one}`}</Text>
      ))}
      {liste.length > AENDERUNGEN && (
        <Text dimColor wrap="wrap">
          {`… und ${liste.length - AENDERUNGEN} weitere in der Datei des Plans.`}
        </Text>
      )}
    </Box>
  )
}

// Die Festlegungen als Liste. Was erst lokal liegt, sagt das und lässt sich zurücknehmen;
// was in GOAL.md steht, streicht nur der Chat.
const zeichneFestListe = (teile: Teile, stand: ZielGraphGeladen, taten: Taten): RenderElement | null => {
  const { Box, Text, Button } = teile
  const { liste } = stand.festlegungen

  if (liste.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column">
      <Text bold wrap="wrap">
        {`Festlegungen (${liste.length})`}
      </Text>
      {liste.map((eine, i) =>
        eine.ort === 'goal' ? (
          <Text wrap="wrap">{`– ${eine.satz}`}</Text>
        ) : (
          <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
            <Text wrap="wrap">{`– ${eine.satz} (noch nicht in GOAL.md)`}</Text>
            <Button key={`fest-weg-${i}`} label="Entfernen" onPress={() => taten.entferneFest(eine.satz)} />
          </Box>
        ),
      )}
    </Box>
  )
}

// Die ganze Leiste: Kopf und Knöpfe, der Stand von GOAL.md, das Feld für eine Festlegung,
// was der letzte Lauf geändert hat, die Karten, die Detail-Fläche, die Festlegungen und was
// beim Ableiten aufgefallen ist.
export const zeichneKartenLeiste = (teile: Teile, lage: KartenLage, taten: Taten): RenderElement => {
  const { Box, Text, Button } = teile
  const { stand, laufend, wahl } = lage
  const plan = stand.plan ?? LEERER_PLAN
  const bild = sicht(plan, laufend, wahl.wahl, stand.aenderungen)
  const flaeche =
    stand.plan === null || teile.Svg === null ? null : baueFlaeche(bild, { zellen: lage.zellen, farben: wahl.farben })
  const steht = flaeche?.art === 'neben'
  const karten =
    stand.plan === null
      ? null
      : flaeche === null
        ? zeichneListe(teile, plan, bild, taten)
        : zeichneFlaeche(teile, plan, flaeche, taten)
  const zurKarte = zeichneDetail(
    teile,
    plan,
    detail(plan, laufend, bild.gewaehlt),
    laufend.gelesen,
    steht ? Math.floor(DETAIL / ZELLE_PX) : null,
    taten,
  )

  return (
    <Box flexDirection="column" gap={1}>
      {stand.plan !== null && (
        <Box flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
            <Text bold wrap="wrap">
              {endzielZeile(plan)}
            </Text>
            {plan.endziel.herkunft !== 'goal' && (
              <Button key="endziel-festlegen" label="Endziel festlegen" onPress={() => taten.lege(endzielAuftrag(plan))} />
            )}
          </Box>
          <Text dimColor wrap="wrap">
            {bild.zaehler}
          </Text>
          {stand.fakten !== null && (
            <Text dimColor wrap="wrap">
              {faktenZeile(stand.fakten, laufend.gelesen || stand.gelesen)}
            </Text>
          )}
        </Box>
      )}

      {zeichneGoal(teile, stand, taten)}
      {zeichneKopf(teile, lage, taten)}
      {zeichneFestEingabe(teile, lage, taten)}
      {zeichneAenderungen(teile, stand)}

      {steht ? (
        <Box flexDirection="row" alignItems="flex-start" columnGap={2}>
          {karten}
          {zurKarte}
        </Box>
      ) : (
        karten
      )}

      {bild.ohneKarte.length > 0 && (
        <Box flexDirection="column">
          <Text bold wrap="wrap">
            {stand.plan === null ? 'Laufende Chats' : 'Chats ohne Karte'}
          </Text>
          {bild.ohneKarte.map(chat => (
            <Button
              key={`karte-${chatId(chat.id)}`}
              plain
              label={
                `${chatId(chat.id) === bild.gewaehlt ? '▸' : ' '} ${chat.frage === '' ? '○' : '●'} ${nameVon(chat)}` +
                `${chat.frage === '' ? '' : ' · wartet auf dich'}${chat.id === laufend.ich ? ' (dieser Chat)' : ''}`
              }
              onPress={() => taten.waehle(chatId(chat.id))}
            />
          ))}
        </Box>
      )}

      {!steht && (stand.plan !== null || bild.ohneKarte.length > 0) && zurKarte}

      {zeichneFestListe(teile, stand, taten)}

      {stand.warnungen.length > 0 && (
        <Box flexDirection="column">
          <Text bold wrap="wrap">
            {`Beim Ableiten aufgefallen (${stand.warnungen.length})`}
          </Text>
          {stand.warnungen.slice(0, HINWEISE).map(one => (
            <Text dimColor wrap="wrap">
              {`– ${one}`}
            </Text>
          ))}
          {stand.warnungen.length > HINWEISE && (
            <Text dimColor wrap="wrap">
              {`… und ${stand.warnungen.length - HINWEISE} weitere in der Datei des Plans.`}
            </Text>
          )}
        </Box>
      )}

      {stand.plan !== null && (
        <Text dimColor wrap="wrap">
          {'Diesen Plan hat ein Modell aus GOAL.md, Doku, Chats und Git-Verlauf abgeleitet. ' +
            'Festgelegt ist nur, was in GOAL.md steht und was du als Festlegung eingegeben hast.' +
            (stand.fakten === null || stand.fakten.datei === '' ? '' : ` Der Plan liegt in ${stand.fakten.datei}.`)}
        </Text>
      )}
    </Box>
  )
}
