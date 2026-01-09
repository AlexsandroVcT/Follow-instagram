import { Page, BrowserContext } from 'playwright';
import { Logger } from '../Logger/Logger';

export class SessionValidator {
  static async waitForLogin(
    page: Page,
    context: BrowserContext
  ): Promise<void> {
    Logger.wait('Verificando se o usuário está logado...');

    // 1️⃣ Se já estiver logado, segue direto
    if (await this.isLogged(context)) {
      Logger.success('Usuário já está logado!');
      return;
    }

    Logger.info('Usuário NÃO está logado. Aguardando login manual...');

    // 2️⃣ Loop seguro (não quebra com navegação)
    while (true) {
      try {
        // Aguarda a página estabilizar
        await page.waitForLoadState('domcontentloaded');

        // Verifica cookies (fonte da verdade)
        const cookies = await context.cookies('https://www.instagram.com');

        const logged = cookies.some(
          c => c.name === 'sessionid' && c.value.length > 10
        );

        if (logged) {
          Logger.success('Login manual validado com sucesso!');
          return;
        }

      } catch {
        // ⚠️ Navegação aconteceu — totalmente normal no Instagram
      }

      // Pausa humana
      await page.waitForTimeout(1000);
    }
  }

  static async isLogged(context: BrowserContext): Promise<boolean> {
    try {
      const cookies = await context.cookies('https://www.instagram.com');
      return cookies.some(
        c => c.name === 'sessionid' && c.value.length > 10
      );
    } catch {
      return false;
    }
  }
}
