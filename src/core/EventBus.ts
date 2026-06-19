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
    // TS widens indexed access on this mapped type to a union, so view the
    // store through a Record<K,...> to assign/read without `any`.
    const sets = this.map as Record<K, Set<Handler<K>> | undefined>
    const set = sets[k] ?? (sets[k] = new Set<Handler<K>>())
    set.add(cb)
    return () => set.delete(cb)
  }
  emit<K extends keyof GameEvents>(k: K, p: GameEvents[K]): void {
    const sets = this.map as Record<K, Set<Handler<K>> | undefined>
    sets[k]?.forEach((cb) => cb(p))
  }
}
