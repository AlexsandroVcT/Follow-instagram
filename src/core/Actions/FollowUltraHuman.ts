import { Page, ElementHandle } from 'playwright';
import { Logger } from '../Logger/Logger';
import { HumanDelay } from '../Human/HumanDelay';
import { HumanScroll } from '../Human/HumanScroll';
import { HumanClock } from '../Human/HumanClock';
import { Runtime } from '../System/Runtime';

type Container = Page | ElementHandle<HTMLElement>;

interface FollowStats {
  followed: number;      // Seguidores confirmados
  requested: number;    // Solicitações enviadas
  skipped: number;      // Usuários ignorados/pulados
  seguindoProcessed: number;    // Usuários "Seguindo" processados
  solicitadoProcessed: number;   // Usuários "Solicitado" processados
}

type ButtonStatus = 'seguir' | 'seguindo' | 'solicitado' | 'unknown';

export class FollowActionUltraHuman {
  private static stats: FollowStats = {
    followed: 0,
    requested: 0,
    skipped: 0,
    seguindoProcessed: 0,
    solicitadoProcessed: 0,
  };

  /** Retorna a quantidade de seguidores confirmados */
  static getFollowedCount(): number {
    return this.stats.followed;
  }

  /** Retorna a quantidade de usuários pulados */
  static getSkippedCount(): number {
    return this.stats.skipped;
  }

  /** Retorna a quantidade de solicitações enviadas */
  static getRequestedCount(): number {
    return this.stats.requested;
  }

  /** Retorna a quantidade de usuários "Seguindo" processados */
  static getSeguindoProcessedCount(): number {
    return this.stats.seguindoProcessed;
  }

  /** Retorna a quantidade de usuários "Solicitado" processados */
  static getSolicitadoProcessedCount(): number {
    return this.stats.solicitadoProcessed;
  }

  static async execute(container: Container, dailyLimit = 150): Promise<number> {
    Logger.action(`▶️ Follow Ultra-Human iniciado (máx ${dailyLimit}/dia)`);

    const page = await this.resolvePage(container);

    while (HumanClock.canFollow(dailyLimit) && Runtime.running) {
      // Aguarda um pouco para garantir que a página renderizou
      await HumanDelay.random(500, 1000);
      
      const buttons = await container.$$('button');
      Logger.info(`🔍 Encontrados ${buttons.length} botões na página`);
      
      const actionButtons: Array<{ button: ElementHandle<HTMLElement>; status: ButtonStatus; index: number }> = [];
      let validButtonsFound = 0;

      // Identifica o status de cada botão (Seguir, Seguindo, ou Solicitado)
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        
        try {
          // Verifica se o botão está visível
          const isVisible = await button.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && 
                   window.getComputedStyle(el).display !== 'none' &&
                   window.getComputedStyle(el).visibility !== 'hidden';
          }).catch(() => false);

          if (!isVisible) continue;

          const text = await button.evaluate(el => {
            // Tenta várias formas de pegar o texto
            const innerDiv = el.querySelector('div');
            const textContent = innerDiv?.textContent?.toLowerCase().trim() || 
                              innerDiv?.innerText?.toLowerCase().trim() || 
                              el.textContent?.toLowerCase().trim() ||
                              el.innerText?.toLowerCase().trim() || '';
            return textContent;
          }).catch(() => '');

          if (!text) continue;

          let status: ButtonStatus = 'unknown';
          
          // Ordem de verificação IMPORTANTE: verificar "Seguindo" e "Solicitado" PRIMEIRO
          // para evitar confundir com "Seguir"
          
          // 1. Verifica "Solicitado" primeiro (mais específico)
          if (text.includes('solicitado') || 
              text.includes('requested') || 
              (text.includes('cancelar') && (text.includes('solicit') || text.includes('request')))) {
            status = 'solicitado';
          }
          // 2. Verifica "Seguindo" - pode ser "seguindo", "following", "parar de seguir", "unfollow"
          else if (text.includes('seguindo') || 
                   text === 'following' || 
                   text.includes('unfollow') ||
                   text.includes('parar de seguir') ||
                   (text.includes('parar') && text.includes('seguir'))) {
            status = 'seguindo';
          }
          // 3. Verifica "Seguir" - deve ser exato e não conter as palavras acima
          else if (text === 'seguir' || text === 'follow') {
            status = 'seguir';
          }

          if (status !== 'unknown') {
            validButtonsFound++;
            actionButtons.push({ 
              button: button as ElementHandle<HTMLElement>, 
              status,
              index: validButtonsFound
            });
            Logger.info(`✅ Botão ${validButtonsFound} identificado: [${status.toUpperCase()}] - "${text}"`);
          }
        } catch (err: any) {
          // Continua para o próximo botão se houver erro
          continue;
        }
      }

      if (!actionButtons.length) {
        Logger.info('⚠️ Nenhum botão válido encontrado após análise. Scrollando...');
        await this.scroll(container);
        await HumanDelay.random(1200, 2500);
        continue;
      }

      Logger.info(`📋 Total de botões de ação válidos encontrados: ${actionButtons.length} (Seguir: ${actionButtons.filter(b => b.status === 'seguir').length}, Seguindo: ${actionButtons.filter(b => b.status === 'seguindo').length}, Solicitado: ${actionButtons.filter(b => b.status === 'solicitado').length})`);

      let processedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < actionButtons.length; i++) {
        const { button, status, index } = actionButtons[i];
        
        // Log em tempo real do progresso
        Logger.info(`🔄 Processando botão ${index} (${i + 1}/${actionButtons.length}) [${status.toUpperCase()}]`);

        // Verifica se pode continuar (apenas para "Seguir" o limite importa)
        if (status === 'seguir' && !HumanClock.canFollow(dailyLimit)) {
          Logger.warn(`⚠️ Limite diário atingido. Parando processamento de "Seguir"`);
          break;
        }

        if (!Runtime.running) break;

        try {
          // Verifica se o botão ainda existe na página (pode ter sido removido após scroll)
          const isVisible = await button.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }).catch(() => false);

          if (!isVisible) {
            Logger.warn(`⚠️ Botão ${i + 1} não está mais visível, pulando...`);
            skippedCount++;
            continue;
          }

          // 🎯 Lógica separada baseada no status do botão
          if (status === 'seguir') {
            await this.handleSeguir(button, page, container, dailyLimit);
          } else if (status === 'seguindo') {
            await this.handleSeguindo(button, page, container);
          } else if (status === 'solicitado') {
            await this.handleSolicitado(button, page, container);
          }

          processedCount++;

          // Log resumo após cada ação
          Logger.info(`📊 [${i + 1}/${actionButtons.length}] Resumo: Seguidos: ${this.stats.followed} | Solicitações: ${this.stats.requested} | Seguindo: ${this.stats.seguindoProcessed} | Solicitado: ${this.stats.solicitadoProcessed} | Pulados: ${this.stats.skipped}`);

          await HumanDelay.random(3500, 7500);

          // Descanso humano a cada 8~14 ações
          const totalActions = this.stats.followed + this.stats.requested + 
                              this.stats.seguindoProcessed + this.stats.solicitadoProcessed;
          if (totalActions > 0 && totalActions % this.randomBetween(8, 14) === 0) {
            const rest = this.randomBetween(3, 7) * 60 * 1000;
            Logger.info(`😴 Descanso humano (${rest / 60000} min)`);
            await HumanDelay.random(rest, rest + 2000);
          }

        } catch (err: any) {
          Logger.warn(`⚠️ Falha no botão ${i + 1} [${status}]: ${err?.message || 'erro desconhecido'}`);
          this.stats.skipped++;
          skippedCount++;
        }
      }

      Logger.info(`✅ Lote processado: ${processedCount} processados, ${skippedCount} pulados de ${actionButtons.length} botões encontrados`);

      await this.scroll(container);
      await HumanDelay.random(1500, 3000);
    }

    Logger.success(
      `🎯 Sessão finalizada | Seguidos: ${this.stats.followed} | Solicitações: ${this.stats.requested} | Seguindo processados: ${this.stats.seguindoProcessed} | Solicitado processados: ${this.stats.solicitadoProcessed} | Pulados: ${this.stats.skipped}`
    );

    return this.stats.followed + this.stats.requested;
  }

  /**
   * 🔵 Lógica para botões "Seguir" (usuários não seguidos ainda)
   */
  private static async handleSeguir(
    button: ElementHandle<HTMLElement>,
    page: Page,
    container: Container,
    dailyLimit: number
  ): Promise<void> {
    Logger.info('👤 Usuário com botão "Seguir" encontrado. Processando...');
    await HumanDelay.random(1800, 4200);

    // Verifica novamente o texto antes de clicar (pode ter mudado)
    const beforeClickText = await button.evaluate(el => {
      const innerDiv = el.querySelector('div');
      return innerDiv?.textContent?.toLowerCase().trim() || 
             innerDiv?.innerText?.toLowerCase().trim() || 
             el.textContent?.toLowerCase().trim() ||
             el.innerText?.toLowerCase().trim() || '';
    });

    // Se mudou para "Seguindo" ou "Solicitado" antes de clicar, processa diferente
    if (beforeClickText.includes('seguindo') || beforeClickText === 'following') {
      Logger.info('🔄 Status mudou para "Seguindo" antes do clique. Redirecionando...');
      await this.handleSeguindo(button, page, container);
      return;
    }
    
    if (beforeClickText.includes('solicitado') || beforeClickText.includes('requested') || beforeClickText.includes('cancelar')) {
      Logger.info('🔄 Status mudou para "Solicitado" antes do clique. Redirecionando...');
      await this.handleSolicitado(button, page, container);
      return;
    }

    const box = await button.boundingBox();
    if (!box) {
      this.stats.skipped++;
      return;
    }

    await button.scrollIntoViewIfNeeded();
    await HumanDelay.random(400, 900);

    // 🎯 Movimento humano REAL
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: this.randomBetween(12, 25),
    });

    await HumanDelay.random(200, 400);
    await page.mouse.down();
    await HumanDelay.random(120, 260);
    await page.mouse.up();

    await HumanDelay.random(1800, 3200);

    // ✅ Confirmação real do status APÓS o clique
    const result = await this.confirmFollow(container);

    if (result === 'followed') {
      this.stats.followed++;
      HumanClock.registerFollow();
      Logger.success(`✅ Follow confirmado (${this.stats.followed}/${dailyLimit})`);
    } else if (result === 'requested') {
      this.stats.requested++;
      HumanClock.registerFollow();
      Logger.success(`📩 Solicitação enviada (${this.stats.requested}/${dailyLimit})`);
    } else {
      // Tenta verificar novamente após mais um delay
      await HumanDelay.random(1000, 2000);
      const retryResult = await this.confirmFollow(container);
      
      if (retryResult === 'followed') {
        this.stats.followed++;
        HumanClock.registerFollow();
        Logger.success(`✅ Follow confirmado na retry (${this.stats.followed}/${dailyLimit})`);
      } else if (retryResult === 'requested') {
        this.stats.requested++;
        HumanClock.registerFollow();
        Logger.success(`📩 Solicitação enviada na retry (${this.stats.requested}/${dailyLimit})`);
      } else {
        this.stats.skipped++;
        Logger.warn(`⚠️ Follow não confirmado ou UI atrasou (${this.stats.skipped} pulados)`);
      }
    }
  }

  /**
   * 🟢 Lógica para botões "Seguindo" (usuários já seguidos)
   */
  private static async handleSeguindo(
    button: ElementHandle<HTMLElement>,
    page: Page,
    container: Container
  ): Promise<void> {
    Logger.info('🟢 Usuário "Seguindo" identificado. Aplicando lógica de Seguindo...');
    
    // Garante que o botão está visível antes de processar
    await button.scrollIntoViewIfNeeded();
    await HumanDelay.random(800, 1500);

    // Verifica o texto atual do botão para confirmar
    const currentText = await button.evaluate(el => {
      const innerDiv = el.querySelector('div');
      return innerDiv?.textContent?.toLowerCase().trim() || 
             innerDiv?.innerText?.toLowerCase().trim() || 
             el.textContent?.toLowerCase().trim() ||
             el.innerText?.toLowerCase().trim() || '';
    }).catch(() => '');

    Logger.info(`🔍 Texto atual do botão "Seguindo": "${currentText}"`);

    // Aqui você pode adicionar a lógica específica para usuários que já estão sendo seguidos
    // Por exemplo: verificar perfil, interagir com stories, etc.
    
    this.stats.seguindoProcessed++;
    Logger.success(`🟢 Usuário "Seguindo" processado (${this.stats.seguindoProcessed} total)`);
    
    await HumanDelay.random(500, 1000);
  }

  /**
   * 🟡 Lógica para botões "Solicitado" (solicitações pendentes)
   */
  private static async handleSolicitado(
    button: ElementHandle<HTMLElement>,
    page: Page,
    container: Container
  ): Promise<void> {
    Logger.info('🟡 Usuário "Solicitado" identificado. Aplicando lógica de Solicitado...');
    
    // Garante que o botão está visível antes de processar
    await button.scrollIntoViewIfNeeded();
    await HumanDelay.random(800, 1500);

    // Verifica o texto atual do botão para confirmar
    const currentText = await button.evaluate(el => {
      const innerDiv = el.querySelector('div');
      return innerDiv?.textContent?.toLowerCase().trim() || 
             innerDiv?.innerText?.toLowerCase().trim() || 
             el.textContent?.toLowerCase().trim() ||
             el.innerText?.toLowerCase().trim() || '';
    }).catch(() => '');

    Logger.info(`🔍 Texto atual do botão "Solicitado": "${currentText}"`);

    // Aqui você pode adicionar a lógica específica para solicitações pendentes
    // Por exemplo: cancelar solicitação, aguardar aprovação, etc.
    
    this.stats.solicitadoProcessed++;
    Logger.success(`🟡 Usuário "Solicitado" processado (${this.stats.solicitadoProcessed} total)`);
    
    await HumanDelay.random(500, 1000);
  }

  // 🧠 Resolve Page REAL sem cast perigoso
  private static async resolvePage(container: Container): Promise<Page> {
    if ('mouse' in container) return container as Page;

    const element = container as ElementHandle<HTMLElement>;
    const frame = await element.ownerFrame();
    const page = frame?.page();
    if (!page) throw new Error('Não foi possível resolver a Page do container');
    return page;
  }

  // 🔍 Confirmação tolerante (Instagram assíncrono)
  private static async confirmFollow(container: Container): Promise<'followed' | 'requested' | false> {
    try {
      const buttons = await container.$$('button');

      for (const btn of buttons) {
        // Pega o texto do botão incluindo <div> interno - múltiplas tentativas
        const text = await btn.evaluate(el => {
          const innerDiv = el.querySelector('div');
          return innerDiv?.textContent?.toLowerCase().trim() || 
                 innerDiv?.innerText?.toLowerCase().trim() || 
                 el.textContent?.toLowerCase().trim() ||
                 el.innerText?.toLowerCase().trim() || '';
        });

        if (!text) continue;

        // Verifica "Seguindo" primeiro (pode ser "seguindo" ou "parar de seguir")
        if (text.includes('seguindo') || text === 'following' || text.includes('unfollow')) {
          return 'followed';
        }
        
        // Verifica "Solicitado" (pode ser "solicitado", "requested" ou "cancelar solicitação")
        if (text.includes('solicitado') || text.includes('requested') || text.includes('cancelar')) {
          return 'requested';
        }
      }
    } catch (err: any) {
      Logger.warn(`Erro ao confirmar follow: ${err?.message}`);
    }

    return false;
  }

  private static async scroll(container: Container) {
    try {
      if ('evaluate' in container) {
        await (container as ElementHandle<HTMLElement>).evaluate(el => {
          el.scrollBy(0, Math.floor(Math.random() * 400 + 300));
        });
      } else {
        await HumanScroll.random(container as Page);
      }
    } catch {
      Logger.warn('Falha ao scrollar modal');
    }
  }

  private static randomBetween(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
