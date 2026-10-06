// Time-windowed budget for automatic engine restarts: at most `limit` within `windowMs`.
export class RestartBudget {
  private stamps: number[] = [];
  constructor(
    private readonly limit = 3,
    private readonly windowMs = 5 * 60_000
  ) {}
  /** Records an automatic restart and returns false when the budget is exhausted. */
  take(now = Date.now()) {
    this.stamps = this.stamps.filter((at) => now - at < this.windowMs);
    if (this.stamps.length >= this.limit) return false;
    this.stamps.push(now);
    return true;
  }
  reset() {
    this.stamps = [];
  }
}
