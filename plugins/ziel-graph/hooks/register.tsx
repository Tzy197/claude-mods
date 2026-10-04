import { atom, read, update } from 'claude-code'
import type {
  BoxProps,
  ButtonProps,
  ElementConstructor,
  EngineInterface,
  Register,
  RenderElement,
  SelectProps,
  SvgProps,
  TextProps,
} from 'claude-code'

import type { ZielGraphFarben, ZielGraphZustand } from '../types'

import { BEISPIEL } from './daten'
import {
  ALLE,
  SVG_GRENZE,
  ZEICHEN,
  chatMarke,
  klappZeichen,
  sicht,
  zeichneSvg,
} from './zeichnen'
import type { Sicht } from './zeichnen'

const PANE = 'ziel-graph'
const TITEL = 'Ziel-Graph'
// Das Bild ist 420 px breit; das sind etwa so viele Zellen der Code-Schrift.
const SPALTEN = 58

// Gezeichnet werden feste Beispieldaten. Wer echte Daten hat, ersetzt diese eine
// Stelle durch abgeleitete Daten derselben Form (ZielGraphDaten).
const DATEN = BEISPIEL

const START: ZielGraphZustand = {
  ansicht: 'schritte',
  ziel: ALLE,
  bahnenAus: [],
  personenAus: ['person-2'],
  offen: ['recherchen'],
  farben: 'auto',
}

const zustand = atom({ plugin: 'ziel-graph', key: 'zustand' } as const, START)

const FARBEN: readonly { value: ZielGraphFarben; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'hell', label: 'Hell' },
  { value: 'dunkel', label: 'Dunkel' },
]

const wechsle = (liste: readonly string[], id: string): string[] =>
  liste.includes(id) ? liste.filter(one => one !== id) : [...liste, id]

const aendere = (
  $: EngineInterface,
  fn: (alt: ZielGraphZustand) => ZielGraphZustand,
): Promise<unknown> => update($, zustand, alt => fn(alt ?? START))

const oeffne = ($: EngineInterface): Promise<unknown> =>
  $.ui.open({ id: PANE, title: TITEL, columns: SPALTEN })

// Die Elemente der Surface. Select und Svg gibt es nicht überall: null heißt Ersatz zeichnen.
type Teile = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Select: ElementConstructor<SelectProps> | null
  Svg: ElementConstructor<SvgProps> | null
}

// Der Text-Ersatz für den Graphen: eine Liste, Zeile für Zeile. Bündel mit
// Tickets sind hier selbst der Aufklapp-Knopf.
const zeichneListe = ($: EngineInterface, teile: Teile, bild: Sicht): RenderElement => {
  const { Box, Text, Button } = teile

  return (
    <Box flexDirection="column">
      {bild.eintraege.map(eintrag => {
        if (eintrag.typ === 'zone') {
          return (
            <Text bold wrap="truncate-end">
              {eintrag.titel.toUpperCase()}
            </Text>
          )
        }

        if (eintrag.typ === 'ticket') {
          return (
            <Text dimColor wrap="truncate-end">
              {`      ${eintrag.text}`}
            </Text>
          )
        }

        const { zeile } = eintrag
        const bahn = eintrag.bahn === null ? '' : `${eintrag.bahn.name} · `
        const kopf = `${ZEICHEN[zeile.art]} ${zeile.titel}${chatMarke(zeile)}`
        const istLeise = zeile.art === 'erledigt' || zeile.art === 'blockiert'

        return (
          <Box flexDirection="column">
            {eintrag.aufklappbar ? (
              <Button
                key={`auf-${zeile.id}`}
                plain
                label={`${kopf} ${klappZeichen(eintrag.offen)}`}
                onPress={() =>
                  void aendere($, alt => ({ ...alt, offen: wechsle(alt.offen, zeile.id) }))
                }
              />
            ) : (
              <Text bold={!istLeise} dimColor={istLeise} wrap="truncate-end">
                {kopf}
              </Text>
            )}
            {`${bahn}${zeile.meta}` !== '' && (
              <Text dimColor wrap="truncate-end">
                {`  ${bahn}${zeile.meta}`}
              </Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

const zeichne = (
  $: EngineInterface,
  teile: Teile,
  stand: ZielGraphZustand,
): RenderElement => {
  const { Box, Text, Button, Select, Svg } = teile
  const bild = sicht(DATEN, stand)
  const svg = Svg === null ? null : zeichneSvg(DATEN, bild, stand.farben)
  const passt = svg !== null && svg.source.length <= SVG_GRENZE
  const ziele = [
    { value: ALLE, label: 'Alle Ziele' },
    ...bild.waehlbar.map(one => ({ value: one.id, label: one.name })),
  ]
  const naechstesZiel = ziele[(ziele.findIndex(one => one.value === bild.ziel) + 1) % ziele.length]
  const naechsteFarbe =
    FARBEN[(FARBEN.findIndex(one => one.value === stand.farben) + 1) % FARBEN.length]

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold wrap="wrap">
          {DATEN.endziel}
        </Text>
        <Text dimColor wrap="wrap">
          {bild.zaehler}
        </Text>
      </Box>

      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {Select === null ? (
          <Button
            key="ziel"
            label={`Ziel: ${ziele.find(one => one.value === bild.ziel)?.label ?? 'Alle Ziele'}`}
            onPress={() => void aendere($, alt => ({ ...alt, ziel: naechstesZiel?.value ?? ALLE }))}
          />
        ) : (
          <Select
            key="ziel"
            label="Ziel"
            options={ziele}
            value={bild.ziel}
            onSelect={wahl => void aendere($, alt => ({ ...alt, ziel: wahl }))}
          />
        )}
        <Button
          key="ansicht-schritte"
          label="Schritte"
          variant={stand.ansicht === 'schritte' ? 'primary' : 'secondary'}
          onPress={() => void aendere($, alt => ({ ...alt, ansicht: 'schritte' }))}
        />
        <Button
          key="ansicht-uebersicht"
          label="Übersicht"
          variant={stand.ansicht === 'uebersicht' ? 'primary' : 'secondary'}
          onPress={() => void aendere($, alt => ({ ...alt, ansicht: 'uebersicht' }))}
        />
      </Box>

      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {DATEN.personen.map(person => {
          const istAn = !stand.personenAus.includes(person.id)

          return (
            <Button
              key={`person-${person.id}`}
              label={`${istAn ? '✓' : '–'} ${person.name}`}
              dimColor={!istAn}
              onPress={() =>
                void aendere($, alt => ({
                  ...alt,
                  personenAus: wechsle(alt.personenAus, person.id),
                }))
              }
            />
          )
        })}
        {bild.ziel === ALLE &&
          bild.waehlbar.map(bahn => {
            const istAn = !stand.bahnenAus.includes(bahn.id)

            return (
              <Button
                key={`bahn-${bahn.id}`}
                label={`${istAn ? '✓' : '–'} ${bahn.name}`}
                dimColor={!istAn}
                onPress={() =>
                  void aendere($, alt => ({ ...alt, bahnenAus: wechsle(alt.bahnenAus, bahn.id) }))
                }
              />
            )
          })}
      </Box>

      {passt && bild.aufklappbar.length > 0 && (
        <Box flexDirection="column">
          <Text dimColor>Bündel auf- und zuklappen</Text>
          {bild.aufklappbar.map(one => (
            <Button
              key={`auf-${one.id}`}
              plain
              label={`${klappZeichen(one.offen)} ${one.titel} (${one.anzahl} Tickets)`}
              onPress={() =>
                void aendere($, alt => ({ ...alt, offen: wechsle(alt.offen, one.id) }))
              }
            />
          ))}
        </Box>
      )}

      {Svg !== null && svg !== null && passt ? (
        <Svg source={svg.source} alt={svg.alt} />
      ) : (
        zeichneListe($, teile, bild)
      )}

      {bild.ausgeblendet !== '' && (
        <Text dimColor wrap="wrap">
          {`▸ Ausgeblendet: ${bild.ausgeblendet}`}
        </Text>
      )}

      {Svg !== null && (
        <Box flexDirection="row">
          {Select === null ? (
            <Button
              key="farben"
              label={`Farben: ${FARBEN.find(one => one.value === stand.farben)?.label ?? 'Auto'}`}
              onPress={() =>
                void aendere($, alt => ({ ...alt, farben: naechsteFarbe?.value ?? 'auto' }))
              }
            />
          ) : (
            <Select
              key="farben"
              label="Farben"
              options={FARBEN}
              value={stand.farben}
              onSelect={wahl =>
                void aendere($, alt => ({
                  ...alt,
                  farben: FARBEN.find(one => one.value === wahl)?.value ?? 'auto',
                }))
              }
            />
          )}
        </Box>
      )}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'graph',
      description: 'Den Ziel-Graphen als Seitenleiste öffnen',
    })

    return next(e)
  })

  on('command.run', { command: 'graph' }, async $ => {
    await oeffne($)

    return { text: 'Ziel-Graph geöffnet.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const stand = await read($, zustand)

    // Das Terminal hat kein Svg, die mobile App kein Select: dort zeichnet der Ersatz.
    if (e.surface === 'terminal') {
      const { Box, Text, Button, Select } = $.ui.resolve(e)

      return zeichne($, { Box, Text, Button, Select, Svg: null }, stand)
    }

    if (e.surface === 'mobile') {
      const { Box, Text, Button, Svg } = $.ui.resolve(e)

      return zeichne($, { Box, Text, Button, Select: null, Svg }, stand)
    }

    const { Box, Text, Button, Select, Svg } = $.ui.resolve(e)

    return zeichne($, { Box, Text, Button, Select, Svg }, stand)
  })
}
