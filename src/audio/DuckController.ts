// Reference-counted ducking so overlapping big events don't fight: music stays
// ducked while count>0 and restores to full only when all ducks are released.
export class DuckController {
  private n = 0
  constructor(private duckLevel = 0.4) {}
  get count(): number { return this.n }
  private target(): number { return this.n > 0 ? this.duckLevel : 1 }
  push(): number { this.n++; return this.target() }
  pop(): number { this.n = Math.max(0, this.n - 1); return this.target() }
}
