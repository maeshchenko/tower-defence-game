import { AnimationGroup } from '@babylonjs/core'

// Drives one instanced model's animation groups: plays the first group whose
// name matches a regex, stops the rest, and de-dupes repeat requests so a
// looping clip isn't restarted every frame. Shared by enemies and the hero.
export class ClipPlayer {
  private current = ''
  constructor(private groups: AnimationGroup[]) {}

  // Play the first group matching `re`. `id` (defaults to the regex source)
  // identifies the logical clip so the same request is a no-op while active —
  // unless `force` (used for one-shots that may repeat, e.g. attack).
  play(re: RegExp, opts: { loop?: boolean; force?: boolean; onEnd?: () => void; id?: string } = {}): void {
    const id = opts.id ?? re.source
    if (!opts.force && this.current === id) return
    this.current = id
    let started = false
    for (const g of this.groups) {
      if (!started && re.test(g.name)) {
        g.stop()
        g.start(opts.loop ?? true)
        started = true
        if (opts.onEnd) g.onAnimationGroupEndObservable.addOnce(() => opts.onEnd!())
      } else {
        g.stop()
      }
    }
  }

  // Forget the current clip so the next play() of the same id re-triggers.
  reset(): void { this.current = '' }

  dispose(): void { for (const g of this.groups) g.dispose() }
}
