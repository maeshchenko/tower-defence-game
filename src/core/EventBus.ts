export type GameEvents = {
  enemyKilled: { bounty: number }
  baseHit: { remaining: number }
  waveCleared: { wave: number }
  heroDied: {}
  gameOver: { victory: boolean }
}
type Handler<K extends keyof GameEvents> = (p: GameEvents[K]) => void

export class EventBus {
  private map: { [K in keyof GameEvents]?: Set<Handler<K>> } = {}
  on<K extends keyof GameEvents>(k: K, cb: Handler<K>): () => void {
    const set = (this.map[k] ??= new Set()) as Set<Handler<K>>
    set.add(cb)
    return () => set.delete(cb)
  }
  emit<K extends keyof GameEvents>(k: K, p: GameEvents[K]): void {
    (this.map[k] as Set<Handler<K>> | undefined)?.forEach((cb) => cb(p))
  }
}
