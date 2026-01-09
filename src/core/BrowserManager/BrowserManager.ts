import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { Logger } from '../Logger/Logger';

interface BrowserLaunchResult {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export class BrowserManager {
  private static browser: Browser | null = null;
  private static context: BrowserContext | null = null;

  public static async launch(): Promise<BrowserLaunchResult> {
    try {
      const userDataDir = path.resolve(
        process.cwd(),
        'profiles',
        'picatoc-instagram'
      );

      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }

      Logger.info('Iniciando Chrome com perfil persistente...');

      /**
       * 🚀 Chrome REAL (não headless)
       */
      this.browser = await chromium.launch({
        headless: false,
        args: [
          '--start-maximized',
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      /**
       * 🧠 CONTEXTO REAL (CRÍTICO)
       */
      this.context = await this.browser.newContext({
        viewport: null,
        locale: 'pt-BR',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        storageState: fs.existsSync(
          path.join(userDataDir, 'state.json')
        )
          ? path.join(userDataDir, 'state.json')
          : undefined,
      });

      /**
       * 💾 Salva cookies automaticamente
       */
      this.context.on('close', async () => {
        try {
          await this.context?.storageState({
            path: path.join(userDataDir, 'state.json'),
          });
        } catch {}
      });

      const page = await this.context.newPage();

      Logger.success('Chrome iniciado com perfil Picatoc');

      return {
        browser: this.browser,
        context: this.context,
        page,
      };
    } catch (err: any) {
      Logger.error(
        `Falha ao iniciar BrowserManager: ${err?.message || err}`
      );
      throw err;
    }
  }
}
