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

export type ExecuteResult = {
  actionCount: number;
  modalExhausted: boolean;
};

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

  static async execute(container: Container, dailyLimit = 150): Promise<ExecuteResult> {
    Logger.action(`▶️ Follow Ultra-Human iniciado (máx ${dailyLimit}/dia)`);
    
    // Inicializa o HumanClock se ainda não foi inicializado
    HumanClock.initialize();

    const page = await this.resolvePage(container);
    
    // Log de estatísticas iniciais
    const initialStats = HumanClock.getStats();
    Logger.info(`⏰ Estatísticas da sessão: ${initialStats.elapsedTime} decorridos, média: ${initialStats.avgActionsPerHour} ações/hora`);

    // 🔒 CONTROLE DE ESTADO ISOLADO POR PERFIL
    // Rastreia usuários/botões já processados usando identificadores únicos
    const processedUserIds = new Set<string>();
    
    // Contador de ciclos sem novos botões (critério REAL de modal esgotado)
    let noNewButtonsCycles = 0;
    const MAX_NO_NEW_BUTTONS_CYCLES = 3; // 3 ciclos consecutivos sem novos botões = modal esgotado
    
    // Contador de ações processadas neste modal
    let actionsProcessedThisModal = 0;

    /**
     * 🔍 FUNÇÃO: Captura APENAS botões visíveis e não processados
     * Esta é a função crítica que evita loops infinitos
     */
    async function getVisibleUnprocessedButtons(): Promise<Array<{
      button: ElementHandle<HTMLElement>;
      status: ButtonStatus;
      userId: string;
    }>> {
      const result: Array<{
        button: ElementHandle<HTMLElement>;
        status: ButtonStatus;
        userId: string;
      }> = [];

      // 🔄 CAPTURA DINÂMICA: Busca botões no DOM atual (não lista estática)
      const allButtons = await container.$$('button');
      Logger.info(`🔍 Encontrados ${allButtons.length} botões no DOM`);

      for (const button of allButtons) {
        try {
          // ✅ VERIFICAÇÃO 1: Botão está visível?
          const isVisible = await button.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0';
          }).catch(() => false);

          // ❌ Se não está visível, descarta IMEDIATAMENTE (não entra no loop)
          if (!isVisible) continue;

          // Scrolla até o botão para garantir que está na viewport
          await button.scrollIntoViewIfNeeded().catch(() => {});
          await HumanDelay.random(100, 200);

          // ✅ VERIFICAÇÃO 2: Identifica o usuário e status do botão
          const buttonData = await button.evaluate(el => {
            // Busca o container do usuário (geralmente um <a> ou <div> pai)
            let userElement: HTMLElement | null = el;
            let attempts = 0;
            while (userElement && attempts < 5) {
              const parent: HTMLElement | null = userElement.parentElement;
              if (parent) {
                // Procura por link de perfil ou elemento com username
                const profileLink = parent.querySelector('a[href*="/"]');
                if (profileLink) {
                  const href = profileLink.getAttribute('href') || '';
                  const usernameMatch = href.match(/\/([^\/\?]+)\/?/);
                  if (usernameMatch && usernameMatch[1] && !usernameMatch[1].includes('p') && !usernameMatch[1].includes('reel')) {
                    return {
                      userId: usernameMatch[1],
                      profileLink: href
                    };
                  }
                }
              }
              userElement = parent;
              attempts++;
            }
            return null;
          }).catch(() => null);

          // Se não conseguiu identificar o usuário, tenta método alternativo
          let userId = buttonData?.userId || '';
          if (!userId) {
            // Método alternativo: usa texto do botão + posição como ID único
            const buttonText = await button.evaluate(el => {
              const innerDiv = el.querySelector('div');
              return innerDiv?.textContent?.trim() || el.textContent?.trim() || '';
            }).catch(() => '');
            
            const buttonIndex = allButtons.indexOf(button);
            userId = `button_${buttonIndex}_${buttonText.substring(0, 20)}`;
          }

          // ✅ VERIFICAÇÃO 3: Botão já foi processado?
          if (processedUserIds.has(userId)) {
            continue; // Descarta - já foi processado
          }

          // ✅ VERIFICAÇÃO 4: Identifica status do botão (Seguir, Seguindo, Solicitado)
          const buttonInfo = await button.evaluate(el => {
            const innerDiv = el.querySelector('div');
            const divs = el.querySelectorAll('div');
            
            let allTexts: string[] = [];
            if (el.textContent) allTexts.push(el.textContent.toLowerCase().trim());
            if (el.innerText) allTexts.push(el.innerText.toLowerCase().trim());
            
            divs.forEach(div => {
              if (div.textContent) allTexts.push(div.textContent.toLowerCase().trim());
              if (div.innerText) allTexts.push(div.innerText.toLowerCase().trim());
            });
            
            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase().trim() || '';
            const title = el.getAttribute('title')?.toLowerCase().trim() || '';
            const dataTestid = el.getAttribute('data-testid')?.toLowerCase().trim() || '';
            const classes = Array.from(el.classList).join(' ').toLowerCase();
            
            const fullText = [...allTexts, ariaLabel, title, classes, dataTestid].filter(Boolean).join(' ');
            
            return {
              text: allTexts[0] || '',
              fullText,
              ariaLabel,
              classes,
              dataTestid,
              hasPrivateIndicator: fullText.includes('private') || 
                                 fullText.includes('privado') ||
                                 fullText.includes('solicitado') ||
                                 fullText.includes('requested') ||
                                 dataTestid.includes('request')
            };
          }).catch(() => ({
            text: '',
            fullText: '',
            ariaLabel: '',
            classes: '',
            dataTestid: '',
            hasPrivateIndicator: false
          }));

          // Ignora botão "fechar" do modal
          if (buttonInfo.text === 'fechar' || 
              buttonInfo.ariaLabel.includes('fechar') ||
              buttonInfo.classes.includes('close') ||
              buttonInfo.classes.includes('_abl-')) {
            continue;
          }

          // Determina status do botão
          let status: ButtonStatus = 'unknown';
          const searchText = buttonInfo.fullText || buttonInfo.text;
          
          if (searchText.includes('solicitado') || 
              searchText.includes('requested') || 
              searchText.includes('pendente') ||
              searchText.includes('pending') ||
              (searchText.includes('cancelar') && (searchText.includes('solicit') || searchText.includes('request'))) ||
              buttonInfo.hasPrivateIndicator ||
              buttonInfo.dataTestid.includes('request')) {
            status = 'solicitado';
          } else if (searchText.includes('seguindo') || 
                     searchText === 'following' || 
                     searchText.includes('unfollow') ||
                     searchText.includes('parar de seguir')) {
            status = 'seguindo';
          } else if (searchText === 'seguir' || 
                     searchText === 'follow' ||
                     (searchText.includes('seguir') && !searchText.includes('seguindo') && !searchText.includes('solicit'))) {
            status = 'seguir';
          }

          if (status !== 'unknown') {
            result.push({ button, status, userId });
          }
        } catch (err: any) {
          // Continua para o próximo botão em caso de erro
          continue;
        }
      }

      Logger.info(`✅ Botões válidos encontrados: ${result.length} (visíveis e não processados)`);
      return result;
    }

    // 🔁 LOOP PRINCIPAL: Processa ciclos até modal esgotado ou limite atingido
    while (HumanClock.canFollow(dailyLimit) && Runtime.running) {
      await HumanDelay.random(500, 1000);
      
      // 🔄 CAPTURA DINÂMICA: Busca apenas botões visíveis e não processados
      const visibleButtons = await getVisibleUnprocessedButtons();

      // ✅ CRITÉRIO REAL DE MODAL ESGOTADO: Nenhum botão novo após múltiplos ciclos
      if (visibleButtons.length === 0) {
        noNewButtonsCycles++;
        Logger.warn(`⚠️ Nenhum botão novo encontrado (ciclo ${noNewButtonsCycles}/${MAX_NO_NEW_BUTTONS_CYCLES})`);
        
        if (noNewButtonsCycles >= MAX_NO_NEW_BUTTONS_CYCLES) {
          Logger.warn(`⚠️ Modal esgotado: ${MAX_NO_NEW_BUTTONS_CYCLES} ciclos consecutivos sem novos botões`);
          Logger.info(`📊 Ações processadas neste modal: ${actionsProcessedThisModal}`);
          const actionCount = this.stats.followed + this.stats.requested;
          return { actionCount, modalExhausted: true };
        }
        
        // Faz scroll controlado e tenta novamente
        Logger.info(`🔄 Fazendo scroll para carregar mais conteúdo...`);
        await this.scroll(container);
        await HumanDelay.random(2000, 3500);
        continue;
      }

      // ✅ Reset contador quando encontra novos botões
      noNewButtonsCycles = 0;

      // 📊 Estatísticas dos botões encontrados
      const seguirCount = visibleButtons.filter(b => b.status === 'seguir').length;
      const seguindoCount = visibleButtons.filter(b => b.status === 'seguindo').length;
      const solicitadoCount = visibleButtons.filter(b => b.status === 'solicitado').length;
      
      Logger.info(`📋 Botões válidos encontrados: ${visibleButtons.length}`);
      Logger.info(`   ├─ Seguir: ${seguirCount}`);
      Logger.info(`   ├─ Seguindo: ${seguindoCount}`);
      Logger.info(`   └─ Solicitado: ${solicitadoCount}`);

      // 🔄 PROCESSA APENAS OS BOTÕES NOVOS (visíveis e não processados)
      let processedThisCycle = 0;
      let skippedThisCycle = 0;

      for (let i = 0; i < visibleButtons.length; i++) {
        const { button, status, userId } = visibleButtons[i];
        
        // ✅ Marca como processado IMEDIATAMENTE (antes de processar)
        processedUserIds.add(userId);
        actionsProcessedThisModal++;

        // Verifica se pode continuar (apenas para "Seguir" o limite importa)
        if (status === 'seguir' && !HumanClock.canFollow(dailyLimit)) {
          Logger.warn(`⚠️ Limite diário atingido. Parando processamento.`);
          const actionCount = this.stats.followed + this.stats.requested;
          return { actionCount, modalExhausted: false };
        }

        if (!Runtime.running) {
          const actionCount = this.stats.followed + this.stats.requested;
          return { actionCount, modalExhausted: false };
        }

        try {
          Logger.info(`🔄 Processando usuário ${i + 1}/${visibleButtons.length} [${status.toUpperCase()}] - ID: ${userId.substring(0, 20)}...`);

          // Scrolla até o botão
          await button.scrollIntoViewIfNeeded().catch(() => {});
          await HumanDelay.random(300, 600);

          // ✅ VERIFICAÇÃO FINAL: Botão ainda está visível?
          const isStillVisible = await button.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0';
          }).catch(() => false);

          // ❌ Se não está mais visível, descarta (não tenta retry infinito)
          if (!isStillVisible) {
            Logger.warn(`⚠️ Botão não está mais visível após scroll. Descartando.`);
            skippedThisCycle++;
            this.stats.skipped++;
            continue;
          }

          // 🎯 Processa ação baseada no status
          if (status === 'seguir') {
            await this.handleSeguir(button, page, container, dailyLimit);
          } else if (status === 'seguindo') {
            await this.handleSeguindo(button, page, container);
          } else if (status === 'solicitado') {
            await this.handleSolicitado(button, page, container);
          }

          processedThisCycle++;

          // Log resumo após cada ação
          const stats = HumanClock.getStats();
          const limitInfo = HumanClock.getLimitInfo();
          Logger.info(`📊 [${i + 1}/${visibleButtons.length}] Resumo: Seguidos: ${this.stats.followed} | Solicitações: ${this.stats.requested} | Seguindo: ${this.stats.seguindoProcessed} | Solicitado: ${this.stats.solicitadoProcessed} | Pulados: ${this.stats.skipped}`);
          Logger.info(`⏰ Tempo: ${stats.elapsedTime} | Média: ${stats.avgActionsPerHour} ações/hora`);
          Logger.info(`📋 Limites: Diário ${limitInfo.daily.current}/${limitInfo.daily.limit} | Hora ${limitInfo.hourly.current}/${limitInfo.hourly.limit} | Total ${limitInfo.total.current}/${limitInfo.total.limit}`);

          // Intervalo oficial do Instagram (36-48 segundos) apenas para "Seguir"
          if (status === 'seguir' && (this.stats.followed > 0 || this.stats.requested > 0)) {
            const nextButton = visibleButtons[i + 1];
            if (nextButton && nextButton.status === 'seguir') {
              Logger.info(`⏳ Aguardando intervalo oficial antes do próximo "Seguir"...`);
              await HumanClock.waitForNextAction();
            } else {
              await HumanDelay.random(1500, 3000);
            }
          } else {
            await HumanDelay.random(1000, 2000);
          }

          // Scroll suave para próximo botão
          if (i < visibleButtons.length - 1) {
            try {
              if ('evaluate' in container) {
                await (container as ElementHandle<HTMLElement>).evaluate(el => {
                  el.scrollBy({ top: 100, behavior: 'smooth' });
                });
              } else {
                const modal = await page.$('div[role="dialog"]');
                if (modal) {
                  await modal.evaluate(el => {
                    el.scrollBy({ top: 100, behavior: 'smooth' });
                  });
                }
              }
              await HumanDelay.random(300, 500);
            } catch {
              // Ignora erros de scroll
            }
          }

          // Verifica pausas
          const seguirActions = this.stats.followed + this.stats.requested;
          if (seguirActions > 0 && HumanClock.needsLongBreak()) {
            await HumanClock.takeLongBreak();
          } else if (seguirActions > 0 && HumanClock.needsShortBreak()) {
            await HumanClock.takeShortBreak();
          }

        } catch (err: any) {
          Logger.warn(`⚠️ Falha ao processar usuário [${status}]: ${err?.message || 'erro desconhecido'}`);
          this.stats.skipped++;
          skippedThisCycle++;
        }
      }

      Logger.info(`✅ Ciclo processado: ${processedThisCycle} processados, ${skippedThisCycle} pulados de ${visibleButtons.length} botões encontrados`);

      // Scroll controlado antes do próximo ciclo
      await this.scroll(container);
      await HumanDelay.random(2000, 4000);
    }

    // Se saiu do loop por limite ou Runtime.running = false
    const finalStats = HumanClock.getStats();
    const actionCount = this.stats.followed + this.stats.requested;
    
    Logger.success(
      `🎯 Processamento do modal finalizado | Seguidos: ${this.stats.followed} | Solicitações: ${this.stats.requested} | Seguindo processados: ${this.stats.seguindoProcessed} | Solicitado processados: ${this.stats.solicitadoProcessed} | Pulados: ${this.stats.skipped}`
    );
    Logger.info(`⏰ Tempo total: ${finalStats.elapsedTime} | Média: ${finalStats.avgActionsPerHour} ações/hora | Total hoje: ${finalStats.followsToday}/${dailyLimit}`);

    return { actionCount, modalExhausted: false };
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

    // Verifica novamente o texto ANTES de clicar (pode ter mudado ou pode ser perfil privado)
    // Tenta múltiplas formas de pegar o texto para detectar perfil privado
    const beforeClickText = await button.evaluate(el => {
      // Tenta pegar o texto do botão
      const innerDiv = el.querySelector('div');
      const allDivs = el.querySelectorAll('div');
      
      let text = innerDiv?.textContent?.toLowerCase().trim() || 
                 innerDiv?.innerText?.toLowerCase().trim() || 
                 el.textContent?.toLowerCase().trim() ||
                 el.innerText?.toLowerCase().trim() || '';
      
      // Coleta texto de todos os divs para detectar "privado" ou outros indicadores
      const allTexts: string[] = [text];
      allDivs.forEach(div => {
        const divText = div.textContent?.toLowerCase().trim() || div.innerText?.toLowerCase().trim() || '';
        if (divText) allTexts.push(divText);
      });
      
      // Verifica também o aria-label e title para detectar perfil privado
      const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
      const title = el.getAttribute('title')?.toLowerCase() || '';
      
      // Verifica classes CSS que podem indicar perfil privado
      const classes = Array.from(el.classList).join(' ').toLowerCase();
      const parentClasses = el.parentElement ? Array.from(el.parentElement.classList).join(' ').toLowerCase() : '';
      
      // Verifica atributos de acessibilidade
      const role = el.getAttribute('role') || '';
      const dataTestid = el.getAttribute('data-testid') || '';
      
      return { 
        text, 
        allTexts: allTexts.filter(Boolean),
        ariaLabel, 
        title,
        classes,
        parentClasses,
        role,
        dataTestid
      };
    }).catch(() => ({ 
      text: '', 
      allTexts: [],
      ariaLabel: '', 
      title: '',
      classes: '',
      parentClasses: '',
      role: '',
      dataTestid: ''
    }));

    const fullText = `${beforeClickText.allTexts.join(' ')} ${beforeClickText.ariaLabel} ${beforeClickText.title} ${beforeClickText.classes} ${beforeClickText.parentClasses}`.toLowerCase();

    // Se mudou para "Seguindo" ou "Solicitado" antes de clicar, processa diferente
    if (fullText.includes('seguindo') || fullText.includes('following')) {
      Logger.info('🔄 Status mudou para "Seguindo" antes do clique. Redirecionando...');
      await this.handleSeguindo(button, page, container);
      return;
    }
    
    // Verifica se é perfil privado ou já está como "Solicitado" (mais verificações)
    // Não há como saber 100% antes de clicar, mas podemos tentar detectar sinais
    const isPossiblyPrivate = fullText.includes('solicitado') || 
                              fullText.includes('requested') || 
                              fullText.includes('cancelar') ||
                              fullText.includes('pending') ||
                              fullText.includes('pendente') ||
                              fullText.includes('private') ||
                              fullText.includes('privado') ||
                              beforeClickText.dataTestid.includes('request') ||
                              beforeClickText.classes.includes('request');
    
    if (isPossiblyPrivate) {
      Logger.info('🔄 Possível perfil "Solicitado" detectado antes do clique. Processando como solicitado...');
      Logger.info(`🔍 Detalhes: Texto="${beforeClickText.text}" | Aria="${beforeClickText.ariaLabel}" | Classes="${beforeClickText.classes}" | DataTestId="${beforeClickText.dataTestid}"`);
      await this.handleSolicitado(button, page, container);
      return;
    }
    
    Logger.info(`🔍 Texto verificado antes do clique: "${beforeClickText.text}" | Aria: "${beforeClickText.ariaLabel}" | Classes: "${beforeClickText.classes}"`);

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
    // Verifica especificamente o botão que acabou de clicar primeiro
    const result = await this.confirmFollowForButton(button, container);
    
    // Se não conseguiu confirmar no botão específico, tenta método geral
    const finalResult = result || await this.confirmFollow(container);

    if (finalResult === 'followed') {
      this.stats.followed++;
      HumanClock.registerFollow();
      Logger.success(`✅ Follow confirmado (${this.stats.followed}/${dailyLimit})`);
    } else if (finalResult === 'requested') {
      // Quando um "Seguir" vira "Solicitado" (perfil privado), conta tanto em requested quanto em solicitadoProcessed
      this.stats.requested++;
      this.stats.solicitadoProcessed++; // Incrementa também o contador de solicitado processados
      HumanClock.registerFollow();
      Logger.success(`📩 Solicitação enviada (Perfil privado detectado!) (${this.stats.requested}/${dailyLimit})`);
      Logger.info(`🟡 Total de perfis "Solicitado" processados: ${this.stats.solicitadoProcessed}`);
    } else {
      // Tenta verificar novamente após mais um delay (tenta botão específico primeiro)
      await HumanDelay.random(1000, 2000);
      const retryResult = await this.confirmFollowForButton(button, container) || await this.confirmFollow(container);
      
      if (retryResult === 'followed') {
        this.stats.followed++;
        HumanClock.registerFollow();
        Logger.success(`✅ Follow confirmado na retry (${this.stats.followed}/${dailyLimit})`);
      } else if (retryResult === 'requested') {
        // Quando um "Seguir" vira "Solicitado" (perfil privado), conta tanto em requested quanto em solicitadoProcessed
        this.stats.requested++;
        this.stats.solicitadoProcessed++; // Incrementa também o contador de solicitado processados
        HumanClock.registerFollow();
        Logger.success(`📩 Solicitação enviada na retry (Perfil privado detectado!) (${this.stats.requested}/${dailyLimit})`);
        Logger.info(`🟡 Total de perfis "Solicitado" processados: ${this.stats.solicitadoProcessed}`);
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

  // 🔍 Confirma o status para um botão específico
  private static async confirmFollowForButton(
    button: ElementHandle<HTMLElement>,
    container: Container
  ): Promise<'followed' | 'requested' | false> {
    try {
      // Aguarda um pouco para o DOM atualizar após o clique
      await HumanDelay.random(500, 1000);
      
      // Verifica o texto do botão que acabou de clicar
      const text = await button.evaluate(el => {
        const innerDiv = el.querySelector('div');
        return innerDiv?.textContent?.toLowerCase().trim() || 
               innerDiv?.innerText?.toLowerCase().trim() || 
               el.textContent?.toLowerCase().trim() ||
               el.innerText?.toLowerCase().trim() || '';
      }).catch(() => '');

      if (!text) return false;

      Logger.info(`🔍 Texto após clique: "${text}"`);

      // Verifica "Seguindo" primeiro (pode ser "seguindo" ou "parar de seguir")
      if (text.includes('seguindo') || text === 'following' || text.includes('unfollow')) {
        return 'followed';
      }
      
      // Verifica "Solicitado" (pode ser "solicitado", "requested" ou "cancelar solicitação")
      if (text.includes('solicitado') || text.includes('requested') || 
          (text.includes('cancelar') && (text.includes('solicit') || text.includes('request')))) {
        return 'requested';
      }
    } catch (err: any) {
      Logger.warn(`Erro ao confirmar follow no botão específico: ${err?.message}`);
    }

    return false;
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
