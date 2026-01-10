import { BrowserManager } from './core/BrowserManager/BrowserManager';
import { Logger } from '../src/core/Logger/Logger';
import { FollowActionUltraHuman } from './core/Actions/FollowUltraHuman';
import { HumanDelay } from './core/Human/HumanDelay';
import { HumanScroll } from './core/Human/HumanScroll';
import { SessionValidator } from './core/session/SessionValidator';
import { Runtime } from './core/System/Runtime';
import { ElementHandle, Page } from 'playwright';
import { HumanClock } from './core/Human/HumanClock';

/**
 * 🛑 Encerramento manual seguro (Ctrl + C)
 */
process.on('SIGINT', () => {
  Logger.warn('⛔ Encerramento manual detectado (SIGINT)');
  Runtime.running = false;
  process.exit(0);
});

(async () => {
  try {
    Logger.info('Inicializando Picatoc Instagram');

    /**
     * 1️⃣ Inicia navegador com perfil persistente
     */
    const { page, context } = await BrowserManager.launch();
    Logger.success('Chrome iniciado com perfil Picatoc');

    /**
     * 2️⃣ Abre Instagram
     */
    Logger.action('Abrindo Instagram...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    /**
     * 3️⃣ Validação REAL de sessão
     */
    await SessionValidator.waitForLogin(page, context);

    if (!Runtime.running) return;
    await page.waitForLoadState('domcontentloaded');
    await HumanDelay.random(1500, 3000);

    Logger.success('Sessão validada, pronto para ações humanas!');

    /**
     * 4️⃣ Abre perfil alvo
     */
    const targetProfile = 'maceioalagoas';
    Logger.action(`Abrindo perfil: @${targetProfile}`);
    await page.goto(`https://www.instagram.com/${targetProfile}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    /**
     * 5️⃣ Aguarda carregamento REAL do perfil
     */
    await page.waitForSelector('header', { timeout: 60000 });
    await HumanDelay.random(2000, 4000);

    if (!Runtime.running) return;
    Logger.success('Perfil carregado com sucesso!');

    /**
     * 6️⃣ Localiza TEXTO "seguidores"
     */
    Logger.action('Localizando botão de seguidores...');
    const followersText = await page.waitForSelector(
      'span:has-text("seguidores")',
      { timeout: 30000 }
    );

    if (!followersText || !Runtime.running) {
      Logger.error('Texto "seguidores" não encontrado.');
      return;
    }

    /**
     * 7️⃣ Sobe DOM até A ou BUTTON real
     */
    const followersClickableHandle = await followersText.evaluateHandle(el => {
      let current: HTMLElement | null = el as HTMLElement;
      while (current) {
        if (current.tagName === 'A' || current.tagName === 'BUTTON') return current;
        current = current.parentElement;
      }
      return null;
    });

    const followersClickable = followersClickableHandle.asElement() as ElementHandle<HTMLElement> | null;
    if (!followersClickable || !Runtime.running) {
      Logger.error('Elemento clicável de seguidores não encontrado.');
      return;
    }

    /**
     * 8️⃣ CLIQUE HUMANO REAL
     */
    const box = await followersClickable.boundingBox();
    if (!box) {
      Logger.error('BoundingBox do botão seguidores não encontrada.');
      return;
    }

    await followersClickable.scrollIntoViewIfNeeded();
    await HumanDelay.random(400, 900);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
    await HumanDelay.random(120, 260);
    await page.mouse.down();
    await HumanDelay.random(90, 180);
    await page.mouse.up();

    Logger.wait('Abrindo modal de seguidores...');

    /**
     * 9️⃣ Aguarda modal REAL
     */
    const modal = await page.waitForSelector('div[role="dialog"]', { timeout: 60000 });
    if (!modal || !Runtime.running) {
      Logger.error('Modal de seguidores não foi carregado.');
      return;
    }

    Logger.success('Modal de seguidores aberto com sucesso!');

    /**
     * 🔟 Scroll humano inicial
     */
    await HumanScroll.random(page, 3);
    await HumanDelay.random(1500, 3000);

    if (!Runtime.running) return;

    /**
     * 1️⃣1️⃣ Follow Ultra-Human com intervalo dinâmico e limite diário
     */
    const dailyLimit = 500;
    Logger.action(`▶️ Iniciando Follow Ultra-Human com limite diário: ${dailyLimit}`);

    // Reset stats antes de iniciar a sessão
    FollowActionUltraHuman['stats'] = { 
      followed: 0, 
      requested: 0, 
      skipped: 0,
      seguindoProcessed: 0,
      solicitadoProcessed: 0
    };

    while (Runtime.running && HumanClock.canFollow(dailyLimit)) {
      // Executa o follow **uma vez por ciclo** para log imediato
      const result = await FollowActionUltraHuman.execute(modal as ElementHandle<HTMLElement>, dailyLimit);

      // Log detalhado **imediatamente após cada usuário**
      Logger.info(`📊 Seguidores confirmados: ${FollowActionUltraHuman.getFollowedCount()}`);
      Logger.info(`📨 Solicitações enviadas: ${FollowActionUltraHuman.getRequestedCount()}`);
      Logger.info(`🟢 Seguindo processados: ${FollowActionUltraHuman.getSeguindoProcessedCount()}`);
      Logger.info(`🟡 Solicitado processados: ${FollowActionUltraHuman.getSolicitadoProcessedCount()}`);
      Logger.info(`⚠️ Pulados/ignorados: ${FollowActionUltraHuman.getSkippedCount()}`);
      Logger.success(`Total de ações nesta sessão: ${result}`);

      // Descanso humano dinâmico
      const restMinutes = Math.floor(Math.random() * 5 + 3); // 3~7 min
      Logger.info(`😴 Descanso humano dinâmico (${restMinutes} min)`);
      await HumanDelay.random(restMinutes * 60 * 1000, restMinutes * 60 * 1000 + 2000);
    }

    Logger.info('Picatoc Instagram finalizado com sucesso!');
  } catch (err: any) {
    Logger.error(`Erro crítico no Picatoc: ${err?.message || err}`);
  }
})();
