import { Page, BrowserContext } from 'playwright';
import { Logger } from '../Logger/Logger';

export class SessionValidator {
  static async waitForLogin(page: Page): Promise<void> {
    const context = page.context();

    Logger.wait('Verificando se o usuário está logado...');

    // 1️⃣ Já está logado?
    if (await this.isLogged(context)) {
      Logger.success('Usuário já está logado!');
      return;
    }

    Logger.info('Usuário NÃO está logado. Aguardando login manual...');

    /**
     * 🔁 Loop humano REAL
     * - Não usa Promise.race
     * - Não usa document.cookie
     * - Não usa timeout
     */
    while (true) {
      // Aguarda um pouco como humano
      await page.waitForTimeout(1200);

      const isStillOnLoginPage = await page.$(
        'input[name="username"], input[name="password"]'
      );

      // Se formulário SUMIU, tenta validar sessão
      if (!isStillOnLoginPage) {
        if (await this.isLogged(context)) {
          Logger.success('Login manual validado com sucesso!');
          return;
        }
      }
    }
  }

  static async isLogged(context: BrowserContext): Promise<boolean> {
    const cookies = await context.cookies('https://www.instagram.com');
    return cookies.some(c => c.name === 'sessionid');
  }
}
