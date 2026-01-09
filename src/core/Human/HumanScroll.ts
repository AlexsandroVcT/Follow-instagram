import { Page } from 'playwright';

export class HumanScroll {
  /**
   * Scroll humano aleatório em uma página
   */
  static async random(page: Page, steps = 3) {
    for (let i = 0; i < steps; i++) {
      const scrollAmount = Math.floor(Math.random() * 300 + 200);
      await page.evaluate((scrollBy) => window.scrollBy(0, scrollBy), scrollAmount);
      const delay = Math.floor(Math.random() * 2000 + 1000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
