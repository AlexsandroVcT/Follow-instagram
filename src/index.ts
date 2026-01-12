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
     * 4️⃣ Fila de perfis para processamento contínuo
     */
    const profileQueue: string[] = [
      'marchadamaconhasp',
      'smokebuddies_oficial',
      'marchadamaconhaaju',
      'marchadamaconhacwb',
      'marchadamaconharj',
      'marchadamaconhafloripa',
      'mobrisa__',
      'cannabismedicinal.oficial',
      'cultivebr',
      'smokebuddiesoficial',
      // Adicione mais perfis conforme necessário
    ];

    Logger.info(`📋 Fila de perfis configurada: ${profileQueue.length} perfis`);
    Logger.info(`   Perfis: ${profileQueue.join(', ')}`);

    /**
     * 5️⃣ Follow Ultra-Human com limites oficiais do Instagram
     */
    const dailyLimit = 500; // Limite diário oficial
    Logger.action(`▶️ Iniciando Follow Ultra-Human com limites oficiais do Instagram`);
    Logger.info(`📋 Limites oficiais Instagram (publicação oficial):`);
    Logger.info(`   ├─ Diário: ${dailyLimit} novos seguidores por dia`);
    Logger.info(`   ├─ Por hora: 30 novos seguidores por hora`);
    Logger.info(`   ├─ Total: 7.500 seguidores máximo`);
    Logger.info(`   └─ Intervalo: 36-48 segundos entre ações (para parecer natural)`);
    Logger.info(`⏰ Sistema respeitará todos os limites automaticamente`);

    // Reset stats antes de iniciar a sessão
    FollowActionUltraHuman['stats'] = { 
      followed: 0, 
      requested: 0, 
      skipped: 0,
      seguindoProcessed: 0,
      solicitadoProcessed: 0
    };

    // Inicializa o HumanClock
    HumanClock.initialize();
    
    // Reseta contadores diários (mantém total histórico)
    HumanClock.resetDaily();
    
    const sessionStats = HumanClock.getStats();
    const limitInfo = HumanClock.getLimitInfo();
    Logger.info(`⏰ Sessão iniciada | Tempo: ${sessionStats.elapsedTime}`);
    Logger.info(`📊 Status dos limites: Diário ${limitInfo.daily.current}/${limitInfo.daily.limit} | Hora ${limitInfo.hourly.current}/${limitInfo.hourly.limit} | Total ${limitInfo.total.current}/${limitInfo.total.limit}`);
    
    // Se o total já estiver muito alto, permite configurar manualmente
    if (limitInfo.total.current >= limitInfo.total.limit) {
      Logger.warn(`⚠️ ATENÇÃO: Limite total de ${limitInfo.total.limit} já atingido!`);
      Logger.warn(`⚠️ Se você tem menos de ${limitInfo.total.limit} seguidores, use HumanClock.setTotalFollows(count) para ajustar`);
    }

    /**
     * 6️⃣ Função para abrir modal de seguidores de um perfil
     */
    async function openFollowersModal(profileName: string): Promise<ElementHandle<HTMLElement> | null> {
      try {
        Logger.action(`📂 Abrindo perfil: @${profileName}`);
        await page.goto(`https://www.instagram.com/${profileName}/`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });

        // Aguarda carregamento REAL do perfil
        await page.waitForSelector('header', { timeout: 60000 });
        await HumanDelay.random(2000, 4000);

        if (!Runtime.running) return null;
        Logger.success(`✅ Perfil @${profileName} carregado com sucesso!`);

        // Localiza TEXTO "seguidores"
        Logger.action(`🔍 Localizando botão de seguidores de @${profileName}...`);
        const followersText = await page.waitForSelector(
          'span:has-text("seguidores")',
          { timeout: 30000 }
        );

        if (!followersText || !Runtime.running) {
          Logger.error(`❌ Texto "seguidores" não encontrado no perfil @${profileName}.`);
          return null;
        }

        // Sobe DOM até A ou BUTTON real
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
          Logger.error(`❌ Elemento clicável de seguidores não encontrado no perfil @${profileName}.`);
          return null;
        }

        // CLIQUE HUMANO REAL
        const box = await followersClickable.boundingBox();
        if (!box) {
          Logger.error(`❌ BoundingBox do botão seguidores não encontrada no perfil @${profileName}.`);
          return null;
        }

        await followersClickable.scrollIntoViewIfNeeded();
        await HumanDelay.random(400, 900);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
        await HumanDelay.random(120, 260);
        await page.mouse.down();
        await HumanDelay.random(90, 180);
        await page.mouse.up();

        Logger.wait(`⏳ Abrindo modal de seguidores de @${profileName}...`);

        // Aguarda modal REAL
        const modal = await page.waitForSelector('div[role="dialog"]', { timeout: 60000 });
        if (!modal || !Runtime.running) {
          Logger.error(`❌ Modal de seguidores não foi carregado para @${profileName}.`);
          return null;
        }

        Logger.success(`✅ Modal de seguidores de @${profileName} aberto com sucesso!`);

        // Scroll humano inicial
        await HumanScroll.random(page, 3);
        await HumanDelay.random(1500, 3000);

        return modal as ElementHandle<HTMLElement>;
      } catch (err: any) {
        Logger.error(`❌ Erro ao abrir modal de seguidores de @${profileName}: ${err?.message || err}`);
        return null;
      }
    }

    /**
     * 7️⃣ Função para fechar modal de seguidores
     */
    async function closeFollowersModal(): Promise<void> {
      try {
        Logger.action(`🔒 Fechando modal de seguidores...`);
        
        // Procura pelo botão de fechar (geralmente um X ou botão com aria-label "Fechar")
        const closeButton = await page.$('button[aria-label*="Fechar"], button[aria-label*="Close"], svg[aria-label*="Fechar"], svg[aria-label*="Close"]').catch(() => null);
        
        if (closeButton) {
          const box = await closeButton.boundingBox();
          if (box) {
            await closeButton.scrollIntoViewIfNeeded();
            await HumanDelay.random(400, 900);
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
            await HumanDelay.random(120, 260);
            await page.mouse.down();
            await HumanDelay.random(90, 180);
            await page.mouse.up();
            await HumanDelay.random(1000, 2000);
            Logger.success(`✅ Modal fechado com sucesso!`);
            return;
          }
        }
        
        // Se não encontrou botão de fechar, tenta ESC
        Logger.info(`⚠️ Botão de fechar não encontrado, tentando ESC...`);
        await page.keyboard.press('Escape');
        await HumanDelay.random(1000, 2000);
        
        // Verifica se o modal foi fechado
        const modalStillOpen = await page.$('div[role="dialog"]').catch(() => null);
        if (!modalStillOpen) {
          Logger.success(`✅ Modal fechado com ESC!`);
        } else {
          Logger.warn(`⚠️ Modal ainda está aberto após tentativa de fechar.`);
        }
      } catch (err: any) {
        Logger.warn(`⚠️ Erro ao fechar modal: ${err?.message || err}`);
      }
    }

    /**
     * 8️⃣ Loop principal: processa cada perfil da fila
     */
    let profileIndex = 0;
    let totalActionsAcrossProfiles = 0;

    while (Runtime.running && HumanClock.canFollow(dailyLimit) && profileIndex < profileQueue.length) {
      const currentProfile = profileQueue[profileIndex];
      Logger.info(`\n${'='.repeat(60)}`);
      Logger.info(`📊 Processando perfil ${profileIndex + 1}/${profileQueue.length}: @${currentProfile}`);
      Logger.info(`${'='.repeat(60)}\n`);

      // Abre modal de seguidores do perfil atual
      const modal = await openFollowersModal(currentProfile);
      
      if (!modal || !Runtime.running) {
        Logger.warn(`⚠️ Não foi possível abrir modal de @${currentProfile}. Pulando para próximo perfil...`);
        profileIndex++;
        await HumanDelay.random(2000, 4000);
        continue;
      }

      // Processa o modal até estar esgotado ou limite atingido
      let profileActions = 0;
      let modalExhausted = false;

      while (Runtime.running && HumanClock.canFollow(dailyLimit) && !modalExhausted) {
        const result = await FollowActionUltraHuman.execute(modal, dailyLimit);
        
        profileActions += result.actionCount;
        totalActionsAcrossProfiles += result.actionCount;
        modalExhausted = result.modalExhausted;

        // Log detalhado após cada lote processado
        Logger.info(`📊 Resumo do lote para @${currentProfile}:`);
        Logger.info(`   - Seguidores confirmados: ${FollowActionUltraHuman.getFollowedCount()}`);
        Logger.info(`   - Solicitações enviadas: ${FollowActionUltraHuman.getRequestedCount()}`);
        Logger.info(`   - Seguindo processados: ${FollowActionUltraHuman.getSeguindoProcessedCount()}`);
        Logger.info(`   - Solicitado processados: ${FollowActionUltraHuman.getSolicitadoProcessedCount()}`);
        Logger.info(`   - Pulados/ignorados: ${FollowActionUltraHuman.getSkippedCount()}`);
        Logger.info(`   - Ações neste perfil: ${profileActions}`);
        Logger.info(`   - Total de ações na sessão: ${totalActionsAcrossProfiles}`);
        
        // Estatísticas em tempo real
        const currentStats = HumanClock.getStats();
        const currentLimitInfo = HumanClock.getLimitInfo();
        const remainingActions = dailyLimit - (FollowActionUltraHuman.getFollowedCount() + FollowActionUltraHuman.getRequestedCount());
        Logger.info(`⏰ Tempo decorrido: ${currentStats.elapsedTime} | Restam: ${remainingActions} ações | Média: ${currentStats.avgActionsPerHour} ações/hora`);
        Logger.info(`📋 Limites atuais: Diário ${currentLimitInfo.daily.current}/${currentLimitInfo.daily.limit} | Hora ${currentLimitInfo.hourly.current}/${currentLimitInfo.hourly.limit} | Total ${currentLimitInfo.total.current}/${currentLimitInfo.total.limit}`);
        
        if (modalExhausted) {
          Logger.info(`🔄 Modal de @${currentProfile} esgotado. Fechando e trocando de perfil...`);
        } else if (Runtime.running && remainingActions > 0) {
          Logger.info(`🔄 Preparando próximo lote...`);
          await HumanDelay.random(2000, 4000);
        }
      }

      // Fecha o modal antes de trocar de perfil
      await closeFollowersModal();
      
      // Aguarda um tempo humano antes de trocar de perfil
      Logger.info(`⏳ Aguardando antes de trocar de perfil...`);
      await HumanDelay.random(3000, 6000);
      
      profileIndex++;
      
      // Se ainda há perfis na fila e não atingiu o limite, continua
      if (profileIndex < profileQueue.length && Runtime.running && HumanClock.canFollow(dailyLimit)) {
        Logger.info(`\n🔄 Troca de contexto: Próximo perfil será @${profileQueue[profileIndex]}\n`);
      }
    }

    Logger.info(`\n${'='.repeat(60)}`);
    Logger.info(`🎯 Processamento de perfis finalizado!`);
    Logger.info(`   ├─ Perfis processados: ${profileIndex}/${profileQueue.length}`);
    Logger.info(`   ├─ Total de ações: ${totalActionsAcrossProfiles}`);
    Logger.info(`   ├─ Seguidos: ${FollowActionUltraHuman.getFollowedCount()}`);
    Logger.info(`   └─ Solicitações: ${FollowActionUltraHuman.getRequestedCount()}`);
    Logger.info(`${'='.repeat(60)}\n`);

    Logger.info('Picatoc Instagram finalizado com sucesso!');
  } catch (err: any) {
    Logger.error(`Erro crítico no Picatoc: ${err?.message || err}`);
  }
})();
