export class HumanClock {
  private static followsToday = 0;
  private static lastFollowTime = 0;
  private static FOLLOW_INTERVAL = 60 * 1000; // 1 minuto entre follows padrão

  /**
   * Verifica se podemos seguir mais alguém
   */
  static canFollow(dailyLimit: number): boolean {
    const now = Date.now();
    const intervalPassed = now - this.lastFollowTime > this.FOLLOW_INTERVAL;
    return this.followsToday < dailyLimit && intervalPassed;
  }

  /**
   * Registra um follow feito
   */
  static registerFollow() {
    this.followsToday++;
    this.lastFollowTime = Date.now();
  }

  /**
   * Aguarda próximo slot para simular ritmo humano
   */
  static async waitNextSlot() {
    const delay = Math.floor(Math.random() * 2000 + 1000); // 1~3s
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Zera contagem diária (pode ser chamada à meia-noite)
   */
  static resetDaily() {
    this.followsToday = 0;
    this.lastFollowTime = 0;
  }
}
