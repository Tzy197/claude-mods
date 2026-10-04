export type Pfad = {
  id: string
  name: string
  aktiv: boolean
  branch: string
  stand: string
  naechster: string
  frage: string
  zeit: number
}

export type Board = { ziel: string; pfade: Pfad[]; gelesen: number }

declare module 'claude-code' {
  interface PluginState {
    'pfad-board': { board: Board; sitzung: string }
  }
}
