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
  Timer,
} from 'claude-code'

import type {
  OrchestratorChat,
  OrchestratorChats,
  OrchestratorFakten,
  OrchestratorFarben,
  OrchestratorGeladen,
  OrchestratorLauf,
  OrchestratorPlan,
  OrchestratorSicht,
} from '../types'

import { ZONEN_FOLGE, ZONEN_NAME } from './ableiten'
import { registriereAntwort } from './antwort'
import { promptEndziel, promptGoalAnlegen, promptStrangZiel } from './goal'
import {
  auftragFuer,
  chatId,
  chatMarke,
  detail,
  endzielZeile,
  erklaerungFuer,
  sicht,
  strangFrage,
  zeichenText,
} from './karten'
import type { Detail, Karte, Sicht } from './karten'
import { ladePlan, leiteAb } from './lauf'
import type { Aufruf, LaufZugang } from './lauf'
import { liesChats } from './quellen'
import { mehrzahl } from './worte'
import { DETAIL, ZELLE_PX, baueFlaeche, wunschZellen } from './zeichnen'
import type { Bild, Flaeche, Zelle } from './zeichnen'
import { KEINE_CHATS, LEERER_PLAN, NICHTS_GELADEN, RUHE, START } from './zustand'

const PANE = 'orchestrator'
const TITEL = 'Orchestrator'
// Jeder Modell-Aufruf läuft mit Sonnet 5.5.
const MODELL = 'claude-sonnet-5-5'
// Großzügig: Die Antwort ist ein JSON mit einigen tausend Tokens und kommt am Stück.
const MAX_TOKENS = 16_000
const TIMEOUT_MS = 240_000
const AUFRUF: Aufruf = { modell: MODELL, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS }
// So oft zählt die Leiste die Sekunden eines Laufs weiter.
const TAKT_MS = 5_000
// So oft liest die Leiste die Stände der Chats neu, sobald sie einmal geöffnet wurde.
const CHAT_TAKT_MS = 20_000
// Mehr Hinweise zeigt die Leiste nicht; alle stehen in der Datei des Plans.
const HINWEISE = 12
// Der Platz in der Detail-Fläche für Zusätze, die sich von außen einhängen.
const PLATZ = 'detail-zusatz'

const geladen = atom({ plugin: 'orchestrator', key: 'geladen' } as const, NICHTS_GELADEN)
const chats = atom({ plugin: 'orchestrator', key: 'chats' } as const, KEINE_CHATS)
const lauf = atom({ plugin: 'orchestrator', key: 'lauf' } as const, RUHE)
const ansicht = atom({ plugin: 'orchestrator', key: 'sicht' } as const, START)

const FARBEN: readonly { value: OrchestratorFarben; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'hell', label: 'Hell' },
  { value: 'dunkel', label: 'Dunkel' },
]

// Ob in diesem Fenster gerade ein Lauf unterwegs ist, und seit wann. Der Zustand `lauf`
// übersteht ein Neuladen des Mods, der Lauf selbst nicht: deshalb zählt für „läuft schon“
// nur das hier.
let unterwegs = false
let unterwegsSeit = 0
// Ein Lauf endet spätestens mit der Zeitgrenze des Modell-Aufrufs. Meldet er sich danach
// immer noch nicht, ist er verloren, und der Knopf darf einen neuen starten.
const VERLOREN_MS = TIMEOUT_MS + 60_000
// Der Takt, in dem die Chats neu gelesen werden; null, solange die Leiste nie geöffnet wurde.
let chatTakt: Timer | null = null

const sekunden = (ms: number): number => Math.max(1, Math.round(ms / 1000))

const alter = (jetzt: number, zeit: number): string => {
  const minuten = Math.round((jetzt - zeit) / 60_000)

  if (zeit === 0) {
    return 'noch nie'
  }

  if (minuten < 2) {
    return 'gerade eben'
  }

  if (minuten < 90) {
    return `vor ${minuten} Min`
  }

  if (minuten < 36 * 60) {
    return `vor ${Math.round(minuten / 60)} Std`
  }

  return `vor ${Math.round(minuten / 1440)} Tagen`
}

const faktenZeile = (fakten: OrchestratorFakten, jetzt: number): string =>
  `Abgeleitet ${alter(jetzt, fakten.zeit)} in ${sekunden(fakten.dauerMs)} s aus ` +
  `${mehrzahl(fakten.dateien, 'Datei', 'Dateien')}, ${mehrzahl(fakten.chats, 'Chat', 'Chats')} und ` +
  `${mehrzahl(fakten.commits, 'Commit', 'Commits')} · ${fakten.modell}`

// Der Zugang des Laufs zur Engine. `validate` folgt `$` nicht über einen Import hinweg:
// jede Stelle, an der lauf.ts und quellen.ts die Engine brauchen, steht deshalb hier.
const zugang = ($: EngineInterface): LaufZugang => ({
  sitzung: () => $.session.id(),
  heim: async () => (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.',
  repo: () => $.session.repo(),
  wurzel: () => $.session.root(),
  jetzt: () => $.clock.now(),
  gibtEs: pfad => $.fs.exists(pfad),
  liste: pfad => $.fs.list(pfad),
  lies: pfad => $.fs.read(pfad),
  schreibe: (pfad, text) => $.fs.write(pfad, text),
  laufe: argv => $.process.run(argv, { timeoutMs: 15_000 }),
  frage: (system, prompt) =>
    $.model.complete({ model: MODELL, system, prompt, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS }),
})

// ---------- Laden ----------

// Liest die Stände der laufenden Chats neu: die Dateien, die der Mod ziel-graph schreibt.
// `nurNeues`: Hat sich nichts geändert, bleibt der Zustand unberührt, und die Leiste wird
// nicht neu gezeichnet. So stört der Takt niemanden, der gerade in ein Feld tippt.
const ladeChats = async ($: EngineInterface, nurNeues = false): Promise<void> => {
  try {
    const neu = await liesChats(zugang($))
    const alt = await read($, chats)
    const istGleich = alt.ich === neu.ich && JSON.stringify(alt.chats) === JSON.stringify(neu.chats)

    if (!nurNeues || !istGleich) {
      await update($, chats, () => neu)
    }
  } catch (fehler) {
    $.ui.log(`Chats nicht lesbar: ${String(fehler)}`)
  }
}

// Lädt den letzten gespeicherten Plan des Repos, GOAL.md und die Chats.
const lade = async ($: EngineInterface): Promise<void> => {
  try {
    const neu = await ladePlan(zugang($))

    await update($, geladen, () => neu)
  } catch (fehler) {
    $.ui.log(`Plan nicht lesbar: ${String(fehler)}`)
  }

  await ladeChats($)
}

// Ab dem ersten Öffnen liest die Leiste die Chats von selbst neu.
const haltChatsFrisch = ($: EngineInterface): void => {
  chatTakt ??= $.clock.every(CHAT_TAKT_MS, () => void ladeChats($, true))
}

const ladeVomKnopf = async ($: EngineInterface): Promise<void> => {
  await lade($)
  haltChatsFrisch($)
}

// ---------- Der Lauf ----------

const scheitere = async ($: EngineInterface, grund: string): Promise<void> => {
  await update($, lauf, (alt): OrchestratorLauf => ({ ...alt, phase: 'fehler', grund }))
  $.ui.toast(`Ableiten fehlgeschlagen: ${grund}`, { timeoutMs: 10_000 })
}

// Zählt die Sekunden des Laufs weiter, damit die Leiste nicht stehen bleibt.
const zaehle = async ($: EngineInterface): Promise<void> => {
  try {
    const jetzt = await $.clock.now()

    await update($, lauf, alt =>
      alt.phase === 'laeuft' ? { ...alt, sekunden: Math.round((jetzt - alt.seit) / 1000) } : alt,
    )
  } catch {
    // Nur die Anzeige: Der Lauf geht weiter.
  }
}

// Der Lauf selbst. Er läuft außerhalb des Knopfdrucks, der ihn gestartet hat. `seit` ist
// sein Beginn und zugleich sein Name: Nur der jüngste Lauf darf etwas zeigen.
const fuehreAus = async ($: EngineInterface, seit: number): Promise<void> => {
  const takt = $.clock.every(TAKT_MS, () => void zaehle($))

  try {
    const ausgang = await leiteAb(zugang($), AUFRUF)

    takt.cancel()

    if (unterwegsSeit !== seit) {
      // Der Lauf galt als verloren, und ein neuerer ist unterwegs: Dessen Ergebnis zählt.
      return
    }

    if (ausgang.ok) {
      const { plan, warnungen, fakten } = ausgang.geladen

      await update($, geladen, () => ausgang.geladen)
      await update($, lauf, (alt): OrchestratorLauf => ({ ...alt, phase: 'fertig', grund: '' }))
      await ladeChats($)
      $.ui.toast(
        `Ableiten fertig nach ${sekunden(fakten?.dauerMs ?? 0)} s: ` +
          `${mehrzahl(plan?.buendel.length ?? 0, 'Bündel', 'Bündel')} in ` +
          mehrzahl(plan?.straenge.length ?? 0, 'Strang', 'Strängen') +
          (warnungen.length === 0 ? '' : `, ${mehrzahl(warnungen.length, 'Hinweis', 'Hinweise')}`),
        { timeoutMs: 8000 },
      )
    } else {
      await scheitere(
        $,
        ausgang.datei === '' ? ausgang.grund : `${ausgang.grund} Der Lauf liegt in ${ausgang.datei}.`,
      )
    }
  } catch (fehler) {
    takt.cancel()

    if (unterwegsSeit === seit) {
      await scheitere($, `Der Lauf ist abgebrochen: ${String(fehler)}`)
    }
  } finally {
    if (unterwegsSeit === seit) {
      unterwegs = false
    }
  }
}

// Startet einen Lauf, ohne auf ihn zu warten. false: Es ist schon einer unterwegs.
const starte = async ($: EngineInterface): Promise<boolean> => {
  const seit = await $.clock.now()

  // Von hier bis zum Merken ohne Warten: Zwei Starts zugleich ergeben einen Lauf.
  if (unterwegs && seit - unterwegsSeit < VERLOREN_MS) {
    return false
  }

  unterwegs = true
  unterwegsSeit = seit

  try {
    await update($, lauf, (): OrchestratorLauf => ({ phase: 'laeuft', seit, sekunden: 0, grund: '' }))
    // Nach dem Knopfdruck, nicht darin: Der Modell-Aufruf hält ihn nicht auf.
    $.clock.after(0, () => void fuehreAus($, seit))
  } catch (fehler) {
    unterwegs = false
    throw fehler
  }

  return true
}

const starteVomKnopf = async ($: EngineInterface): Promise<void> => {
  try {
    if (!(await starte($))) {
      $.ui.toast('Ein Lauf ist schon unterwegs.')
    }
  } catch (fehler) {
    $.ui.log(`Ableiten nicht gestartet: ${String(fehler)}`)
  }
}

// Ein Lauf, der laut Zustand noch läuft, obwohl in diesem Fenster keiner unterwegs ist:
// Der Mod wurde mittendrin neu geladen. Die Leiste soll das sagen, statt ewig zu warten.
const raeumeAuf = async ($: EngineInterface): Promise<void> => {
  if (!unterwegs && (await read($, lauf)).phase === 'laeuft') {
    await update($, lauf, (alt): OrchestratorLauf =>
      alt.phase === 'laeuft'
        ? { ...alt, phase: 'fehler', grund: 'Der Lauf wurde unterbrochen: Der Mod ist mittendrin neu geladen worden.' }
        : alt,
    )
  }
}

// ---------- Knöpfe ----------

const waehle = ($: EngineInterface, id: string): Promise<unknown> =>
  update($, ansicht, alt => ({ ...alt, wahl: id }))

const faerbe = ($: EngineInterface, farben: OrchestratorFarben): Promise<unknown> =>
  update($, ansicht, alt => ({ ...alt, farben }))

// Legt einen Auftrag ins Eingabefeld des Chats. Abschicken tut ihn der Nutzer selbst. Hat er
// dort schon etwas getippt, bleibt es stehen, und der Auftrag kommt dahinter.
const lege = async ($: EngineInterface, text: string | null, was: string): Promise<void> => {
  if (text === null) {
    return
  }

  try {
    let entwurf = ''

    try {
      entwurf = (await $.prompt.read()).text
    } catch {
      // Ohne lesbares Eingabefeld gilt es als leer.
    }

    const haengtAn = entwurf.trim() !== ''
    const r = await $.prompt.fill({
      text: haengtAn ? `\n\n${text}` : text,
      mode: haengtAn ? 'append' : 'replace',
    })
    const warum =
      r.refusal === 'dialog'
        ? ': Ein Dialog ist offen.'
        : r.refusal === 'no_composer'
          ? ': Diese Oberfläche hat kein Eingabefeld.'
          : '.'

    $.ui.toast(
      r.isFilled
        ? `${was} liegt im Eingabefeld${haengtAn ? ', hinter deinem Entwurf' : ''}. Prüfen und abschicken.`
        : `Das Eingabefeld hat den Text nicht angenommen${warum}`,
      { timeoutMs: 6000 },
    )
  } catch (fehler) {
    $.ui.log(`Eingabefeld nicht gefüllt: ${String(fehler)}`)
  }
}

const legeStrangZiel = ($: EngineInterface, plan: OrchestratorPlan, id: string): Promise<void> => {
  const frage = strangFrage(plan, id)

  return lege($, frage === null ? null : promptStrangZiel(frage), 'Der Auftrag „Ziel festlegen“')
}

const legeEndziel = ($: EngineInterface, plan: OrchestratorPlan): Promise<void> =>
  lege(
    $,
    promptEndziel(plan.mitGoal, plan.endziel.herkunft === 'vermutet' ? plan.endziel.text : ''),
    'Der Auftrag „Endziel festlegen“',
  )

// ---------- Die Leiste ----------

// Die Elemente der Surface. Select und Svg gibt es nicht überall: null heißt Ersatz zeichnen.
type Teile = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Select: ElementConstructor<SelectProps> | null
  Svg: ElementConstructor<SvgProps> | null
}

// Was eine Zeichnung braucht: der Zustand der Session und die Breite der Leiste.
type Lage = {
  stand: OrchestratorGeladen
  laufend: OrchestratorChats
  jetzt: OrchestratorLauf
  wahl: OrchestratorSicht
  // die Breite der Leiste in Zeichenzellen
  zellen: number
}

const zeichneBild = (teile: Teile, bild: Bild): RenderElement | null => {
  const { Svg } = teile

  return Svg === null ? null : <Svg source={bild.source} alt={bild.alt} width={bild.breite} height={bild.hoehe} />
}

// Die Zellen einer Spalte, von oben nach unten: je Karte ihr Bild und rechts ihr Knopf.
const zeichneZellen = ($: EngineInterface, teile: Teile, zellen: readonly Zelle[]): RenderElement[] => {
  const { Box, Button } = teile

  return zellen.map(zelle => (
    <Box flexDirection="row" alignItems="center">
      {zeichneBild(teile, zelle.bild)}
      {zelle.knopf !== '' && (
        <Button key={`karte-${zelle.knopf}`} plain label="›" onPress={() => void waehle($, zelle.knopf)} />
      )}
    </Box>
  ))
}

// Die Karten als Fläche: oben je Strang sein Kopf, darunter je Abschnitt ein Band mit einer
// Spalte je Strang, zuletzt der Stamm. Alles steht neben- und untereinander im Fluss; die
// Bilder einer Spalte stoßen ohne Lücke aneinander, so läuft die Verbindungslinie durch.
const zeichneFlaeche = (
  $: EngineInterface,
  teile: Teile,
  plan: OrchestratorPlan,
  flaeche: Flaeche,
): RenderElement => {
  const { Box, Text, Button } = teile
  const zielKnopf = (kopf: Flaeche['koepfe'][number]): RenderElement | false =>
    kopf.ohneZiel && (
      <Box>
        <Button key={`ziel-${kopf.id}`} label="Ziel festlegen" onPress={() => void legeStrangZiel($, plan, kopf.id)} />
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
                    {zeichneZellen($, teile, spalte)}
                  </Box>
                ),
            )}
          </Box>
        ))}
        <Box flexDirection="column">
          <Text bold>ZIELE</Text>
          {zeichneZellen($, teile, flaeche.stamm)}
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
                {zeichneZellen($, teile, spalte)}
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
        <Box flexDirection="column">{zeichneZellen($, teile, flaeche.stamm)}</Box>
      </Box>
    </Box>
  )
}

const listenZeile = (karte: Karte, strang: string): string =>
  `${karte.gewaehlt ? '▸' : ' '} ${zeichenText(karte)} ${strang === '' ? '' : `${strang} · `}${karte.titel}` +
  `${karte.meta === '' ? '' : ` — ${karte.meta}`}${karte.chat === '' ? '' : ` [${chatMarke(karte)}]`}`

// Der Text-Ersatz für die Karten, wo es kein Bild gibt: eine Liste, je Karte eine Zeile, die
// sich drücken lässt.
const zeichneListe = (
  $: EngineInterface,
  teile: Teile,
  plan: OrchestratorPlan,
  bild: Sicht,
): RenderElement => {
  const { Box, Text, Button } = teile
  const zeile = (karte: Karte, strang: string): RenderElement => (
    <Button
      key={`karte-${karte.id}`}
      plain
      label={listenZeile(karte, strang)}
      dimColor={karte.leise && !karte.gewaehlt}
      onPress={() => void waehle($, karte.id)}
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
                  onPress={() => void legeStrangZiel($, plan, spalte.strang.id)}
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

const chatZeilen = (teile: Teile, chat: OrchestratorChat & { istDieser: boolean }, jetzt: number): RenderElement => {
  const { Box, Text } = teile

  return (
    <Box flexDirection="column">
      <Text bold wrap="wrap">
        {`${chat.frage === '' ? '○' : '●'} Chat: ${chat.name}${chat.istDieser ? ' (dieser Chat)' : ''}`}
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
  $: EngineInterface,
  teile: Teile,
  plan: OrchestratorPlan,
  karte: Detail | null,
  jetzt: number,
  // die Breite in Zeichenzellen, wenn die Fläche neben den Karten steht
  breite: number | null,
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
              onPress={() => void lege($, auftragFuer(plan, karte.id), 'Der Auftrag')}
            />
          )}
          {karte.knoepfe.includes('erklaeren') && (
            <Button
              key="erklaeren"
              label="Erklären lassen"
              onPress={() => void lege($, erklaerungFuer(plan, karte.id), 'Die Bitte um eine Erklärung')}
            />
          )}
          {karte.knoepfe.includes('endziel') && (
            <Button key="endziel-detail" label="Endziel festlegen" onPress={() => void legeEndziel($, plan)} />
          )}
        </Box>
      )}
      <Box key={PLATZ} flexDirection="column" />
    </Box>
  )
}

// Wo der Lauf steht, und die Knöpfe der Leiste.
const zeichneKopf = ($: EngineInterface, teile: Teile, lage: Lage): RenderElement => {
  const { Box, Text, Button, Select, Svg } = teile
  const { stand, jetzt, wahl } = lage
  const { plan } = stand
  const naechsteFarbe = FARBEN[(FARBEN.findIndex(one => one.value === wahl.farben) + 1) % FARBEN.length]

  return (
    <Box flexDirection="column">
      {jetzt.phase === 'laeuft' && (
        <Text bold wrap="wrap">
          {`Ableiten läuft …${jetzt.sekunden === 0 ? '' : ` seit ${jetzt.sekunden} s`}`}
        </Text>
      )}
      {jetzt.phase === 'laeuft' && (
        <Text dimColor wrap="wrap">
          {`Ein Modell-Aufruf mit ${MODELL} liest GOAL.md, Doku, Chats und Commits des Repos. ` +
            'Die Leiste zeigt den Plan, sobald er fertig ist.'}
        </Text>
      )}
      {jetzt.phase === 'fehler' && (
        <Text bold wrap="wrap">
          {`Ableiten fehlgeschlagen: ${jetzt.grund}`}
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
          onPress={() => void starteVomKnopf($)}
        />
        <Button key="laden" label="Neu laden" onPress={() => void ladeVomKnopf($)} />
        {Svg !== null && Select !== null && (
          <Select
            key="farben"
            label="Farben"
            options={FARBEN}
            value={wahl.farben}
            onSelect={wert => void faerbe($, FARBEN.find(one => one.value === wert)?.value ?? 'auto')}
          />
        )}
        {Svg !== null && Select === null && (
          <Button
            key="farben"
            label={`Farben: ${FARBEN.find(one => one.value === wahl.farben)?.label ?? 'Auto'}`}
            onPress={() => void faerbe($, naechsteFarbe?.value ?? 'auto')}
          />
        )}
      </Box>
    </Box>
  )
}

// Wie GOAL.md dasteht: Fehlt sie, sagt die Leiste das zuerst und bietet an, sie mit dem
// Chat zu entwerfen. Schreiben tut sie nie der Mod.
const zeichneGoal = ($: EngineInterface, teile: Teile, stand: OrchestratorGeladen): RenderElement | null => {
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
            onPress={() => void lege($, promptGoalAnlegen(), 'Der Auftrag für GOAL.md')}
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

// Die ganze Leiste: Kopf und Knöpfe, der Stand von GOAL.md, die Karten, die Detail-Fläche
// und was beim Ableiten aufgefallen ist.
const zeichne = ($: EngineInterface, teile: Teile, lage: Lage): RenderElement => {
  const { Box, Text, Button } = teile
  const { stand, laufend, wahl } = lage
  const plan = stand.plan ?? LEERER_PLAN
  const bild = sicht(plan, laufend, wahl.wahl)
  const flaeche =
    stand.plan === null || teile.Svg === null ? null : baueFlaeche(bild, { zellen: lage.zellen, farben: wahl.farben })
  const steht = flaeche?.art === 'neben'
  const karten =
    stand.plan === null ? null : flaeche === null ? zeichneListe($, teile, plan, bild) : zeichneFlaeche($, teile, plan, flaeche)
  const zurKarte = zeichneDetail(
    $,
    teile,
    plan,
    detail(plan, laufend, bild.gewaehlt),
    laufend.gelesen,
    steht ? Math.floor(DETAIL / ZELLE_PX) : null,
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
              <Button key="endziel-festlegen" label="Endziel festlegen" onPress={() => void legeEndziel($, plan)} />
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

      {zeichneGoal($, teile, stand)}
      {zeichneKopf($, teile, lage)}

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
                `${chatId(chat.id) === bild.gewaehlt ? '▸' : ' '} ${chat.frage === '' ? '○' : '●'} ${chat.name}` +
                `${chat.frage === '' ? '' : ' · wartet auf dich'}${chat.id === laufend.ich ? ' (dieser Chat)' : ''}`
              }
              onPress={() => void waehle($, chatId(chat.id))}
            />
          ))}
        </Box>
      )}

      {!steht && (stand.plan !== null || bild.ohneKarte.length > 0) && zurKarte}

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
            'Festgelegt ist nur, was in GOAL.md steht.' +
            (stand.fakten === null || stand.fakten.datei === '' ? '' : ` Der Plan liegt in ${stand.fakten.datei}.`)}
        </Text>
      )}
    </Box>
  )
}

export const register: Register = on => {
  // Versuch, in sich geschlossen: einen wartenden Chat von hier aus beantworten. Der Aufruf
  // steht zuerst, damit sein Hook über dem Zeichnen der Leiste liegt.
  registriereAntwort(on)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'orchestrator',
      description: 'Den Plan des Repos als Prozesskarten breit neben dem Chat öffnen',
    })
    await raeumeAuf($)
    // Eine Leiste, die vom letzten Mal noch offen ist, soll nicht leer dastehen.
    await lade($)

    return next(e)
  })

  on('command.run', { command: 'orchestrator' }, async $ => {
    await lade($)
    haltChatsFrisch($)

    const { plan } = await read($, geladen)
    const offen = await $.ui.open({
      id: PANE,
      title: TITEL,
      columns: wunschZellen(plan?.straenge.length ?? 0),
    })
    // Sagt, ob die Leiste wirklich gezeichnet wird: auf einem verbundenen Gerät ohne Platz
    // dafür wartet sie nur.
    const lage = offen.isPlaced
      ? 'geöffnet.'
      : `wartet und wird nicht gezeichnet: ${offen.reason.replace(/\.$/, '')}.`
    const inhalt =
      plan === null
        ? 'Noch kein Plan für dieses Repo: „Neu ableiten“ in der Leiste leitet ihn ab.'
        : `Letzter Plan geladen: ${mehrzahl(plan.buendel.length, 'Bündel', 'Bündel')} in ` +
          `${mehrzahl(plan.straenge.length, 'Strang', 'Strängen')}.`

    return { text: `Orchestrator ${lage} ${inhalt}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const lage: Lage = {
      stand: await read($, geladen),
      laufend: await read($, chats),
      jetzt: await read($, lauf),
      wahl: await read($, ansicht),
      zellen: e.props.bodyColumns,
    }

    // Das Terminal hat kein Svg, die mobile App kein Select: dort zeichnet der Ersatz.
    if (e.surface === 'terminal') {
      const { Box, Text, Button, Select } = $.ui.resolve(e)

      return zeichne($, { Box, Text, Button, Select, Svg: null }, lage)
    }

    if (e.surface === 'mobile') {
      const { Box, Text, Button, Svg } = $.ui.resolve(e)

      return zeichne($, { Box, Text, Button, Select: null, Svg }, lage)
    }

    const { Box, Text, Button, Select, Svg } = $.ui.resolve(e)

    return zeichne($, { Box, Text, Button, Select, Svg }, lage)
  })
}
