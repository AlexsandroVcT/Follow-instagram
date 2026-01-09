// core/Human/HumanClock.ts
export class HumanClock {
  private static followsToday = 0;
  private static lastFollowTime = 0;

  // intervalo BASE (será humanizado dinamicamente)
  private static BASE_INTERVAL = 60 * 1000; // 1 min

  static canFollow(dailyLimit: number): boolean {
    return this.followsToday < dailyLimit;
  }

  static async waitIfNeeded() {
    const now = Date.now();
    const elapsed = now - this.lastFollowTime;

    // jitter humano: 60s ~ 120s
    const dynamicInterval =
      this.BASE_INTERVAL + Math.floor(Math.random() * 60_000);

    if (elapsed < dynamicInterval) {
      const waitTime = dynamicInterval - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  static registerFollow() {
    this.followsToday++;
    this.lastFollowTime = Date.now();
  }

  static resetDaily() {
    this.followsToday = 0;
    this.lastFollowTime = 0;
  }

  static getStats() {
    return {
      followsToday: this.followsToday,
      lastFollowTime: this.lastFollowTime,
    };
  }
}
