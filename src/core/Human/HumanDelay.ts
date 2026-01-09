export class HumanDelay {
  /**
   * Pausa por um tempo aleatório entre min e max (ms)
   */
  static async random(min: number, max: number) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}
