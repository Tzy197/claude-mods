import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderElement, SessionSendResult } from 'claude-code'

import type { ZielGraphAntwort } from '../../types'

import { nameVon } from '../chats'
import { ruhende } from '../plan/dauer'
import { KARTEN_START, KEINE_CHATS, LEERER_PLAN, NICHTS_GELADEN, NIE_GESENDET } from '../zustand'

import { detail, sicht } from './karten'
import type { DetailChat } from './karten'
import { PLATZ } from './leiste'

// VERSUCH: einen wartenden Chat von der breiten Ansicht aus beantworten.
//
// Diese Datei steht für sich. Sie hängt sich mit zwei eigenen Hooks ein: Der eine setzt in
// die Detail-Fläche einer Karte, deren Chat wartet, ein Eingabefeld und schickt die Antwort
// mit `$.session.send` an die Session dieses Chats. Der andere nimmt in jeder Session, in
// der der Mod geladen ist, eine solche Antwort an und reicht sie dort als Prompt ein.
// Nichts sonst im Mod hängt an ihr: Wer den Versuch entfernt, löscht diese Datei und in
// register.tsx den Import und den einen Aufruf `registriereAntwort(on)`.

// Die Leiste der breiten Ansicht, wie in register.tsx. Hier noch einmal, weil `validate` den
// Namen im Matcher nur in dieser Datei liest.
const PANE = 'orchestrator'
// Der Name, unter dem die Engine das `$.session.send` dieses Mods beim Empfänger ausweist:
// der Name des Plugins, seit beide Ansichten in einem Mod stecken also `ziel-graph`.
export const MOD = 'ziel-graph'
const MAX_ANTWORT = 4000

// Der Zustand der Ansicht wird hier nur gelesen; geschrieben wird allein der eigene Versand.
const geladen = atom({ plugin: 'ziel-graph', key: 'geladen' } as const, NICHTS_GELADEN)
const chats = atom({ plugin: 'ziel-graph', key: 'chats' } as const, KEINE_CHATS)
const ansicht = atom({ plugin: 'ziel-graph', key: 'karten' } as const, KARTEN_START)
const antwort = atom({ plugin: 'ziel-graph', key: 'antwort' } as const, NIE_GESENDET)

// ---------- Die Marke ----------

// An dieser ersten Zeile erkennt der Empfänger eine Antwort aus dem Orchestrator. Ohne sie
// rührt er eine Nachricht nicht an.
export const MARKE = '[[orchestrator-antwort v1]]'

export type Paket = {
  // die Session, für die die Antwort bestimmt ist
  an: string
  // die Frage, auf die geantwortet wird; '' wenn keine bekannt ist
  frage: string
  antwort: string
}

// Nur Text: Steuerzeichen fallen weg, Zeilenumbrüche bleiben.
const rein = (wert: string, laenge: number): string =>
  wert
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]+/g, ' ')
    .trim()
    .slice(0, laenge)

export const verpacke = (paket: Paket): string =>
  `${MARKE}\n${JSON.stringify({ an: paket.an, frage: paket.frage, antwort: rein(paket.antwort, MAX_ANTWORT) })}`

// Das Paket aus einer empfangenen Nachricht; null, wenn sie die Marke nicht trägt oder
// dahinter nicht genau das steht, was `verpacke` schreibt. Die Marke steht allein in ihrer
// Zeile, das Paket in der Zeile danach: So stört es nicht, wenn die Engine die Nachricht in
// einen Rahmen aus weiteren Zeilen setzt.
export const entpacke = (nachricht: string): Paket | null => {
  const zeilen = nachricht.split('\n')
  const stelle = zeilen.findIndex(one => one.trim() === MARKE)

  if (stelle < 0) {
    return null
  }

  try {
    const wert: unknown = JSON.parse(zeilen[stelle + 1] ?? '')

    if (typeof wert !== 'object' || wert === null) {
      return null
    }

    const { an, frage, antwort: text } = wert as Record<string, unknown>

    if (typeof an !== 'string' || typeof frage !== 'string' || typeof text !== 'string') {
      return null
    }

    const paket = { an, frage: rein(frage, 400), antwort: rein(text, MAX_ANTWORT) }

    return paket.an === '' || paket.antwort === '' ? null : paket
  } catch {
    return null
  }
}

// Der Prompt, den der empfangende Chat bekommt. Der empfangene Text steht darin nur als
// die Antwort des Nutzers, nie als Auftrag des Mods.
export const promptAus = (paket: Paket): string =>
  `${
    paket.frage === ''
      ? 'Antwort aus dem Orchestrator, dort vom Nutzer eingegeben:'
      : `Antwort aus dem Orchestrator auf deine offene Frage „${paket.frage}“, dort vom Nutzer eingegeben:`
  }\n\n${paket.antwort}`

// ---------- Senden ----------

// Was der Nutzer je Chat getippt hat. Kein Zustand der Session: Jeder Tastendruck würde
// sonst die Leiste neu zeichnen.
const entwuerfe = new Map<string, string>()

const sende = async ($: EngineInterface, chat: DetailChat, text: string): Promise<void> => {
  const eingabe = rein(text, MAX_ANTWORT)

  if (eingabe === '') {
    $.ui.toast('Die Antwort ist leer.')

    return
  }

  let ergebnis: SessionSendResult

  try {
    ergebnis = await $.session.send({
      to: { sessionId: chat.id },
      text: verpacke({ an: chat.id, frage: chat.frage, antwort: eingabe }),
    })
  } catch (fehler) {
    ergebnis = { isDelivered: false, reason: String(fehler) }
  }

  const stand: ZielGraphAntwort = {
    chat: chat.id,
    phase: ergebnis.isDelivered ? 'zugestellt' : 'nicht',
    grund: ergebnis.isDelivered ? '' : ergebnis.reason,
    zeit: await $.clock.now(),
  }

  if (ergebnis.isDelivered) {
    entwuerfe.delete(chat.id)
  }

  await update($, antwort, () => stand)
  $.ui.toast(
    ergebnis.isDelivered
      ? `Antwort an „${nameVon(chat)}“ zugestellt.`
      : `Antwort an „${nameVon(chat)}“ nicht zugestellt: ${ergebnis.reason}`,
    { timeoutMs: 8000 },
  )
}

// ---------- Empfangen ----------

const reiche = async ($: EngineInterface, paket: Paket): Promise<void> => {
  try {
    await $.prompt.submit({ text: promptAus(paket) })
    $.ui.toast('Antwort aus dem Orchestrator übernommen.')
  } catch (fehler) {
    $.ui.log(`Antwort aus dem Orchestrator nicht eingereicht: ${String(fehler)}`)
  }
}

// ---------- Zeichnen ----------

// Hängt `zusatz` in die Box mit dem Schlüssel `platz`. null, wenn der Baum keine hat.
const setzeEin = (baum: RenderElement, platz: string, zusatz: RenderElement): RenderElement | null => {
  if (baum.type !== 'Box') {
    return null
  }

  const kinder = baum.children ?? []

  if (baum.props?.key === platz) {
    return { ...baum, children: [...kinder, zusatz] }
  }

  for (const [i, kind] of kinder.entries()) {
    const neu = typeof kind === 'string' ? null : setzeEin(kind, platz, zusatz)

    if (neu !== null) {
      return { ...baum, children: [...kinder.slice(0, i), neu, ...kinder.slice(i + 1)] }
    }
  }

  return null
}

const standZeile = (stand: ZielGraphAntwort, chat: DetailChat): string =>
  stand.chat !== chat.id || stand.phase === 'nie'
    ? ''
    : stand.phase === 'zugestellt'
      ? 'Zugestellt. Der Chat übernimmt die Antwort, sobald er frei ist; seine Karte ändert sich nach seiner nächsten Antwort.'
      : `Nicht zugestellt: ${stand.grund}`

export const registriereAntwort = (on: On): void => {
  on('session.receive', async ($, e, next) => {
    // Eine Zustellung an einen Subagenten ist nie eine Antwort des Nutzers an den Chat.
    const paket = e.agentId === undefined ? entpacke(e.text) : null

    if (paket === null || paket.an !== (await $.session.id())) {
      return next(e)
    }

    // Als Antwort gilt nur, was das `$.session.send` dieses Mods verschickt hat. Eine
    // Nachricht, die das Modell einer anderen Session selbst geschrieben hat, trägt keinen
    // Mod-Namen: Sie bleibt eine gewöhnliche Nachricht von nebenan, auch wenn sie die Marke
    // nachahmt. Der Name ist eine Angabe des Absenders und kein Beweis. Er hält aber genau
    // den Fall draußen, in dem sich ein anderer Chat als der Nutzer ausgibt.
    if (e.origin.kind !== 'peer' || e.origin.plugin !== MOD) {
      $.ui.log('Nachricht mit der Marke des Orchestrators nicht übernommen: Sie kommt nicht von diesem Mod.')

      return next(e)
    }

    // Woher die Engine die Nachricht einordnet, steht nur im Protokoll: Es ist eine Angabe
    // des Absenders und keine Prüfung. Am Protokoll lässt sich der Versuch beurteilen.
    $.ui.log(
      `Antwort aus dem Orchestrator angenommen (Herkunft: ${e.origin.kind}` +
        `${'plugin' in e.origin && e.origin.plugin !== undefined ? `, Mod ${e.origin.plugin}` : ''})`,
    )
    // Nach dem Empfang, nicht darin: Der Prompt startet eine eigene Runde.
    $.clock.after(0, () => void reiche($, paket))

    return { consumed: `${MOD}: als Antwort aus dem Orchestrator übernommen` }
  })

  // Liegt über dem Zeichnen der breiten Ansicht in register.tsx: Dessen Baum kommt von `next`.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const baum = await next(e)
    const laufend = await read($, chats)
    const lage = await read($, geladen)
    const plan = lage.plan ?? LEERER_PLAN
    // Dieselbe Karte, die die Ansicht als gewählt zeigt: Was ruht, hat dort nur eine Karte.
    const ruhend = ruhende(plan, laufend, laufend.gelesen || lage.gelesen)
    const gewaehlt = sicht(plan, laufend, (await read($, ansicht)).wahl, null, ruhend).gewaehlt
    const chat = detail(plan, laufend, gewaehlt)?.chats.find(one => one.frage !== '' && !one.istDieser)
    const stand = await read($, antwort)

    if (chat === undefined) {
      return baum
    }

    const kopf = 'Versuch: von hier antworten'
    const hinweis =
      `Die Antwort geht an den Chat „${nameVon(chat)}“. Er übernimmt sie als deine Antwort, ` +
      'wenn der Mod Ziel-Graph auch dort geladen ist. Du bleibst hier.'

    // Die Handy-App zeichnet kein Eingabefeld.
    if (e.surface === 'mobile') {
      const { Box, Text } = $.ui.resolve(e)

      return (
        setzeEin(
          baum,
          PLATZ,
          <Box flexDirection="column">
            <Text bold wrap="wrap">
              {kopf}
            </Text>
            <Text dimColor wrap="wrap">
              Diese Oberfläche zeichnet kein Eingabefeld: Antworte im Chat selbst.
            </Text>
          </Box>,
        ) ?? baum
      )
    }

    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const zeile = standZeile(stand, chat)

    return (
      setzeEin(
        baum,
        PLATZ,
        <Box flexDirection="column">
          <Text bold wrap="wrap">
            {kopf}
          </Text>
          <Text dimColor wrap="wrap">
            {hinweis}
          </Text>
          <Input
            key="antwort"
            placeholder="Deine Antwort …"
            value={entwuerfe.get(chat.id) ?? ''}
            submitLabel="senden"
            onInput={wert => void entwuerfe.set(chat.id, wert)}
            onSubmit={wert => void sende($, chat, wert)}
          />
          <Box>
            <Button
              key="antwort-senden"
              label="Antwort schicken"
              variant="primary"
              onPress={() => void sende($, chat, entwuerfe.get(chat.id) ?? '')}
            />
          </Box>
          {zeile !== '' && (
            <Text bold={stand.phase === 'nicht'} wrap="wrap">
              {zeile}
            </Text>
          )}
        </Box>,
      ) ?? baum
    )
  })
}
