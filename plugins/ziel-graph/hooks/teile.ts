import type {
  BoxProps,
  ButtonProps,
  ElementConstructor,
  InputProps,
  SelectProps,
  SvgProps,
  TextProps,
} from 'claude-code'

import type { ZielGraphAnsicht, ZielGraphFarben } from '../types'

import type { Auftrag } from './plan/lesen'

// Was die zwei Leisten zum Zeichnen bekommen. Sie selbst fassen die Engine nie an:
// register.tsx reicht ihnen die Elemente der Surface und die Handgriffe ihrer Knöpfe.

// Die Elemente der Surface. Select, Svg und Input gibt es nicht überall: null heißt Ersatz
// zeichnen. Ein Eingabefeld hat nur die breite Ansicht.
export type Teile = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Select: ElementConstructor<SelectProps> | null
  Svg: ElementConstructor<SvgProps> | null
  Input: ElementConstructor<InputProps> | null
}

// Was ein Knopf auslöst. `validate` folgt `$` nicht über einen Import hinweg: Deshalb baut
// register.tsx diese Handgriffe aus `$`, und die Leisten rufen sie nur auf.
export type Taten = {
  // Beide Ansichten: den Plan neu ableiten, alles neu lesen, einen Auftrag ins Eingabefeld legen.
  ableiten: () => void
  laden: () => void
  lege: (auftrag: Auftrag) => void
  // Die schmale Ansicht: diesen Chat aufnehmen oder herausnehmen, die ausgeblendeten Chats
  // zeigen, bis neu geladen wird, die Ansicht wechseln, aufklappen.
  aufnehmen: () => void
  herausnehmen: () => void
  zeigeChats: () => void
  zeige: (ansicht: ZielGraphAnsicht) => void
  klappe: (id: string) => void
  klappeAlle: (ids: readonly string[]) => void
  // Die breite Ansicht: eine Karte wählen, die Farben festlegen.
  waehle: (id: string) => void
  faerbe: (farben: ZielGraphFarben) => void
  // Die breite Ansicht, Festlegungen: sich merken, was im Feld steht, den Satz aufnehmen
  // (ohne Angabe den aus dem Feld) und eine lokale Festlegung zurücknehmen.
  merkeFest: (text: string) => void
  festlegen: (satz?: string) => void
  entferneFest: (satz: string) => void
}
