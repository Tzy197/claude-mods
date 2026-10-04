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
  UiOpenResult,
} from 'claude-code'

import type { ZielGraphChats, ZielGraphFarben, ZielGraphZustand } from '../types'

import { alter, fasseZusammen, kurz, liesChats, neueFragen, pfadBefehl, zaehler } from './chats'
import type { ChatZugang } from './chats'
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
// Jeder Modell-Aufruf läuft mit Sonnet 5.5.
const MODELL = 'claude-sonnet-5-5'
// Das Bild ist 420 px breit; das sind etwa so viele Zellen der Code-Schrift.
const SPALTEN = 58
// So oft liest jede Session die Stände der anderen neu.
const TAKT_MS = 20_000

// Der Beispiel-Graph zeichnet feste, erfundene Daten. Wer einen echten Plan hat, ersetzt
// diese eine Stelle durch abgeleitete Daten derselben Form (ZielGraphDaten).
const DATEN = BEISPIEL

const START: ZielGraphZustand = {
  beispiel: false,
  ansicht: 'schritte',
  ziel: ALLE,
  bahnenAus: [],
  personenAus: ['person-2'],
  offen: ['recherchen'],
  farben: 'auto',
}

const LEER: ZielGraphChats = { ich: '', chats: [], gelesen: 0 }

const zustand = atom({ plugin: 'ziel-graph', key: 'zustand' } as const, START)
const chats = atom({ plugin: 'ziel-graph', key: 'chats' } as const, LEER)

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

const oeffne = ($: EngineInterface): Promise<UiOpenResult> =>
  $.ui.open({ id: PANE, title: TITEL, columns: SPALTEN })

// Der Zugang der Chat-Logik zur Engine. `validate` folgt `$` nicht über einen Import
// hinweg: jede Stelle, an der hooks/chats.ts die Engine braucht, steht deshalb hier.
const zugang = ($: EngineInterface): ChatZugang => ({
  sitzung: () => $.session.id(),
  heim: async () => (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.',
  repo: () => $.session.repo(),
  wurzel: () => $.session.root(),
  nachrichten: () => $.session.messages(),
  jetzt: () => $.clock.now(),
  gibtEs: pfad => $.fs.exists(pfad),
  liste: pfad => $.fs.list(pfad),
  lies: pfad => $.fs.read(pfad),
  schreibe: (pfad, text) => $.fs.write(pfad, text),
  laufe: argv => $.process.run(argv, { timeoutMs: 15_000 }),
  frage: (system, prompt) =>
    $.model.complete({ model: MODELL, system, prompt, maxTokens: 400, timeoutMs: 30_000 }),
  melde: text => $.ui.log(text),
})

let letzterPrompt = ''
// Die Fragen, die dieses Fenster schon kennt: nur neue lösen einen Toast aus.
let bekannt: Map<string, string> | null = null

// Liest die Chats des Repos neu ein und meldet, wo ein anderer Chat neu auf den Nutzer wartet.
const lade = async ($: EngineInterface): Promise<void> => {
  try {
    const neu = await liesChats(zugang($))
    const vorher = bekannt

    bekannt = new Map(neu.chats.map(one => [one.id, one.frage]))

    for (const chat of neueFragen(vorher, neu)) {
      $.ui.toast(`${chat.name} wartet auf dich: ${kurz(chat.frage, 90)}`, { timeoutMs: 8000 })
    }

    await update($, chats, () => neu)
  } catch (fehler) {
    $.ui.log(`Chats nicht lesbar: ${String(fehler)}`)
  }
}

const nachAntwort = async ($: EngineInterface, antwort: string): Promise<void> => {
  if (await fasseZusammen(zugang($), antwort, letzterPrompt)) {
    await lade($)
  }
}

// Die Elemente der Surface. Select und Svg gibt es nicht überall: null heißt Ersatz zeichnen.
type Teile = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Select: ElementConstructor<SelectProps> | null
  Svg: ElementConstructor<SvgProps> | null
}

// Der obere Teil der Leiste, immer da: die echten Chats des Repos.
const zeichneChats = ($: EngineInterface, teile: Teile, laufend: ZielGraphChats): RenderElement => {
  const { Box, Text, Button } = teile

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold wrap="wrap">
        {zaehler(laufend.chats)}
      </Text>

      {laufend.chats.length === 0 && (
        <Text dimColor wrap="wrap">
          {'Ein Chat mit eigenem Branch oder Ticket meldet sich nach seiner nächsten Antwort ' +
            'selbst an, jeder andere mit /pfad <Name>.'}
        </Text>
      )}

      {laufend.chats.map(chat => (
        <Box flexDirection="column">
          <Text bold wrap="wrap">
            {`${chat.frage === '' ? '○' : '●'} ${chat.name}`}
            {chat.id === laufend.ich ? ' (dieser Chat)' : ''}
          </Text>
          <Text dimColor wrap="wrap">
            {alter(laufend.gelesen, chat.zeit)}
            {chat.branch === '' ? '' : ` · ${chat.branch}`}
          </Text>
          <Text wrap="wrap">{chat.stand}</Text>
          {chat.naechster !== '' && <Text wrap="wrap">{`Weiter: ${chat.naechster}`}</Text>}
          {chat.frage !== '' && (
            <Text bold wrap="wrap">
              {`Wartet auf dich: ${chat.frage}`}
            </Text>
          )}
        </Box>
      ))}

      <Box>
        <Button key="laden" label="Neu laden" onPress={() => void lade($)} />
      </Box>
    </Box>
  )
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

// Der Beispiel-Graph mit seinen Knöpfen: so sieht die Leiste aus, sobald es einen Plan gibt.
const zeichneBeispiel = (
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

// Die ganze Leiste: oben die echten Chats, darunter der Hinweis auf den fehlenden Plan
// und, nur auf Knopfdruck, der Beispiel-Graph.
const zeichne = (
  $: EngineInterface,
  teile: Teile,
  stand: ZielGraphZustand,
  laufend: ZielGraphChats,
): RenderElement => {
  const { Box, Text, Button } = teile
  // Ein Zustand, den noch Schritt 1 geschrieben hat, kennt das Feld nicht.
  const mitBeispiel = stand.beispiel === true

  return (
    <Box flexDirection="column" gap={1}>
      {zeichneChats($, teile, laufend)}

      <Box flexDirection="column">
        <Text dimColor wrap="wrap">
          Noch kein Plan: Ohne Zielliste zeigt der Ziel-Graph nur die laufenden Chats.
        </Text>
        <Box>
          <Button
            key="beispiel"
            label={mitBeispiel ? 'Beispiel-Graph ausblenden' : 'Beispiel-Graph zeigen'}
            onPress={() => void aendere($, alt => ({ ...alt, beispiel: alt.beispiel !== true }))}
          />
        </Box>
      </Box>

      {mitBeispiel && (
        <Text bold wrap="wrap">
          Erfundene Beispieldaten, kein echter Stand. So sieht der Graph mit einem Plan aus.
        </Text>
      )}
      {mitBeispiel && zeichneBeispiel($, teile, stand)}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'graph',
      description: 'Den Ziel-Graphen als Seitenleiste öffnen',
    })
    await $.command.register({
      name: 'pfad',
      description: 'Diesen Chat im Ziel-Graphen anmelden oder umbenennen, mit "aus" abmelden',
      argumentHint: '[Name | aus]',
    })

    await lade($)
    $.clock.every(TAKT_MS, () => void lade($))

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    letzterPrompt = e.text

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    const istEigeneAntwort = e.agentId === undefined && e.reason === 'answer' && e.answer !== ''

    if (istEigeneAntwort) {
      // Nach der Runde, nicht in ihr: die Zusammenfassung hält das Rundenende nicht auf.
      $.clock.after(0, () => void nachAntwort($, e.answer))
    }

    return next(e)
  })

  on('command.run', { command: 'graph' }, async $ => {
    await lade($)
    const offen = await oeffne($)
    const flaechen = (await $.session.surfaces()).join(', ') || 'keine'
    // Sagt, ob die Leiste wirklich gezeichnet wird: auf einem verbundenen Gerät ohne Platz
    // dafür wartet sie nur.
    const lage = offen.isPlaced ? 'geöffnet.' : `wartet und wird nicht gezeichnet: ${offen.reason}`

    return { text: `Ziel-Graph ${lage} (Oberflächen: ${flaechen})` }
  })

  on('command.run', { command: 'pfad' }, async ($, e) => {
    const eingabe = e.args.trim()
    const text = await pfadBefehl(zugang($), eingabe)

    await lade($)

    // Wer sich abmeldet, will die Leiste nicht aufgedrängt bekommen.
    if (eingabe.toLowerCase() !== 'aus') {
      await oeffne($)
    }

    return { text }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const stand = await read($, zustand)
    const laufend = await read($, chats)

    // Das Terminal hat kein Svg, die mobile App kein Select: dort zeichnet der Ersatz.
    if (e.surface === 'terminal') {
      const { Box, Text, Button, Select } = $.ui.resolve(e)

      return zeichne($, { Box, Text, Button, Select, Svg: null }, stand, laufend)
    }

    if (e.surface === 'mobile') {
      const { Box, Text, Button, Svg } = $.ui.resolve(e)

      return zeichne($, { Box, Text, Button, Select: null, Svg }, stand, laufend)
    }

    const { Box, Text, Button, Select, Svg } = $.ui.resolve(e)

    return zeichne($, { Box, Text, Button, Select, Svg }, stand, laufend)
  })
}
