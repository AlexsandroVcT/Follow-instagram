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
    
    // Inicializa o HumanClock se ainda não foi inicializado
    HumanClock.initialize();

    const page = await this.resolvePage(container);
    
    // Log de estatísticas iniciais
    const initialStats = HumanClock.getStats();
    Logger.info(`⏰ Estatísticas da sessão: ${initialStats.elapsedTime} decorridos, média: ${initialStats.avgActionsPerHour} ações/hora`);

    while (HumanClock.canFollow(dailyLimit) && Runtime.running) {
      // Aguarda um pouco para garantir que a página renderizou
      await HumanDelay.random(500, 1000);
      
      const buttons = await container.$$('button');
      Logger.info(`🔍 Encontrados ${buttons.length} botões na página`);
      
      const actionButtons: Array<{ button: ElementHandle<HTMLElement>; status: ButtonStatus; index: number }> = [];
      const allButtonsInfo: Array<{ index: number; text: string; fullText: string; ariaLabel: string; status: ButtonStatus | 'unknown' }> = [];
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

          // Scrolla até o botão para garantir que está visível antes de ler
          await button.scrollIntoViewIfNeeded().catch(() => {});
          await HumanDelay.random(100, 200);

          // Captura TODAS as informações possíveis do botão
          const buttonInfo = await button.evaluate(el => {
            // Texto do botão em múltiplas formas
            const innerDiv = el.querySelector('div');
            const divs = el.querySelectorAll('div');
            
            // Coleta todo texto possível
            let allTexts: string[] = [];
            
            // Texto direto do botão
            if (el.textContent) allTexts.push(el.textContent.toLowerCase().trim());
            if (el.innerText) allTexts.push(el.innerText.toLowerCase().trim());
            
            // Texto de todos os divs internos
            divs.forEach(div => {
              if (div.textContent) allTexts.push(div.textContent.toLowerCase().trim());
              if (div.innerText) allTexts.push(div.innerText.toLowerCase().trim());
            });
            
            // Atributos HTML
            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase().trim() || '';
            const title = el.getAttribute('title')?.toLowerCase().trim() || '';
            const type = el.getAttribute('type') || '';
            const dataTestid = el.getAttribute('data-testid')?.toLowerCase().trim() || '';
            const role = el.getAttribute('role')?.toLowerCase().trim() || '';
            
            // Classes CSS (podem indicar status)
            const classes = Array.from(el.classList).join(' ').toLowerCase();
            
            // Verifica também no elemento pai (pode ter informações sobre perfil privado)
            const parent = el.parentElement;
            const parentClasses = parent ? Array.from(parent.classList).join(' ').toLowerCase() : '';
            const parentText = parent?.textContent?.toLowerCase().trim() || '';
            const parentAriaLabel = parent?.getAttribute('aria-label')?.toLowerCase().trim() || '';
            
            // Verifica elementos próximos que possam indicar perfil privado
            const siblingBefore = el.previousElementSibling;
            const siblingAfter = el.nextElementSibling;
            const siblingBeforeText = siblingBefore?.textContent?.toLowerCase().trim() || '';
            const siblingAfterText = siblingAfter?.textContent?.toLowerCase().trim() || '';
            
            // Junta tudo em uma string completa
            const fullText = [
              ...allTexts, 
              ariaLabel, 
              title, 
              classes,
              parentClasses,
              parentText,
              parentAriaLabel,
              dataTestid,
              role,
              siblingBeforeText,
              siblingAfterText
            ].filter(Boolean).join(' ');
            
            // Retorna objeto com todas as informações
            return {
              text: allTexts[0] || '',
              allTexts: allTexts.filter(Boolean),
              fullText,
              ariaLabel,
              title,
              classes,
              parentClasses,
              type,
              dataTestid,
              role,
              parentText,
              hasPrivateIndicator: fullText.includes('private') || 
                                   fullText.includes('privado') ||
                                   fullText.includes('solicitado') ||
                                   fullText.includes('requested') ||
                                   dataTestid.includes('request') ||
                                   classes.includes('request')
            };
          }).catch(() => ({
            text: '',
            allTexts: [],
            fullText: '',
            ariaLabel: '',
            title: '',
            classes: '',
            parentClasses: '',
            type: '',
            dataTestid: '',
            role: '',
            parentText: '',
            hasPrivateIndicator: false
          }));

          // Armazena informações de todos os botões para debug
          let detectedStatus: ButtonStatus | 'unknown' = 'unknown';
          
          // Log detalhado para debug (apenas primeiros 5 botões para não poluir)
          if (i < 5) {
            Logger.info(`🔍 Botão ${i + 1} detalhes: texto="${buttonInfo.text}", aria="${buttonInfo.ariaLabel}", title="${buttonInfo.title}", classes="${buttonInfo.classes}"`);
          }

          // Ignora botão "fechar" do modal (primeiro botão geralmente)
          if (buttonInfo.text === 'fechar' || 
              buttonInfo.ariaLabel.includes('fechar') ||
              buttonInfo.classes.includes('close') ||
              buttonInfo.classes.includes('_abl-')) {
            if (i < 5) Logger.info(`🚫 Botão ${i + 1} ignorado: É o botão "fechar" do modal`);
            allButtonsInfo.push({
              index: i + 1,
              text: buttonInfo.text,
              fullText: buttonInfo.fullText,
              ariaLabel: buttonInfo.ariaLabel,
              status: 'unknown'
            });
            continue;
          }

          if (!buttonInfo.fullText && !buttonInfo.text) {
            if (i < 5) Logger.warn(`⚠️ Botão ${i + 1} sem texto detectável`);
            allButtonsInfo.push({
              index: i + 1,
              text: buttonInfo.text,
              fullText: buttonInfo.fullText,
              ariaLabel: buttonInfo.ariaLabel,
              status: 'unknown'
            });
            continue;
          }

          let status: ButtonStatus = 'unknown';
          
          // Usa o texto completo para verificação
          const searchText = buttonInfo.fullText || buttonInfo.text;
          
          // Ordem de verificação IMPORTANTE: verificar "Seguindo" e "Solicitado" PRIMEIRO
          // para evitar confundir com "Seguir"
          
          // 1. Verifica "Solicitado" primeiro (mais específico)
          // Pode aparecer como: "solicitado", "requested", "cancelar solicitação", "cancelar pedido", etc.
          // Também verifica indicadores de perfil privado que podem virar solicitado após clique
          if (searchText.includes('solicitado') || 
              searchText.includes('requested') || 
              searchText.includes('pendente') ||
              searchText.includes('pending') ||
              (searchText.includes('cancelar') && (searchText.includes('solicit') || searchText.includes('request') || searchText.includes('pedido'))) ||
              searchText.includes('cancel request') ||
              buttonInfo.hasPrivateIndicator ||
              buttonInfo.dataTestid.includes('request') ||
              (buttonInfo.classes.includes('request') && !buttonInfo.classes.includes('follow'))) {
            status = 'solicitado';
            
            // Log detalhado se detectou por indicador indireto
            if (!searchText.includes('solicitado') && !searchText.includes('requested')) {
              Logger.info(`🔍 Botão ${validButtonsFound + 1} detectado como "Solicitado" por indicadores: data-testid="${buttonInfo.dataTestid}", classes="${buttonInfo.classes}", private="${buttonInfo.hasPrivateIndicator}"`);
            }
          }
          // 2. Verifica "Seguindo" - pode ser "seguindo", "following", "parar de seguir", "unfollow", "deixar de seguir"
          else if (searchText.includes('seguindo') || 
                   searchText === 'following' || 
                   searchText.includes('unfollow') ||
                   searchText.includes('parar de seguir') ||
                   searchText.includes('deixar de seguir') ||
                   searchText.includes('parar de seguir') ||
                   (searchText.includes('parar') && searchText.includes('seguir'))) {
            status = 'seguindo';
          }
          // 3. Verifica "Seguir" - deve ser exato e não conter as palavras acima
          else if (searchText === 'seguir' || 
                   searchText === 'follow' ||
                   (searchText.includes('seguir') && !searchText.includes('seguindo') && !searchText.includes('solicit'))) {
            // Verifica que não é "seguindo" ou "solicitado" disfarçado
            if (!searchText.includes('seguindo') && !searchText.includes('solicitado') && !searchText.includes('requested')) {
              status = 'seguir';
            }
          }

          detectedStatus = status;

          if (status !== 'unknown') {
            validButtonsFound++;
            actionButtons.push({ 
              button: button as ElementHandle<HTMLElement>, 
              status,
              index: validButtonsFound
            });
            
            // Log mais detalhado para os primeiros botões
            if (validButtonsFound <= 10) {
              const indicators = [];
              if (buttonInfo.hasPrivateIndicator) indicators.push('indicador-privado');
              if (buttonInfo.dataTestid) indicators.push(`data-testid="${buttonInfo.dataTestid}"`);
              const indicatorText = indicators.length > 0 ? ` [${indicators.join(', ')}]` : '';
              Logger.info(`✅ Botão ${validButtonsFound} identificado: [${status.toUpperCase()}]${indicatorText} - Texto: "${buttonInfo.text}" | Aria: "${buttonInfo.ariaLabel}" | Classes: "${buttonInfo.classes}"`);
            } else {
              Logger.info(`✅ Botão ${validButtonsFound} identificado: [${status.toUpperCase()}] - "${buttonInfo.text || buttonInfo.ariaLabel || 'sem texto'}"`);
            }
          } else {
            // Log para botões não identificados (apenas primeiros para debug)
            if (i < 5) {
              Logger.warn(`❓ Botão ${i + 1} não identificado - Texto: "${buttonInfo.text}" | Full: "${buttonInfo.fullText.substring(0, 50)}"`);
            }
          }
          
          // Armazena informação do botão para debug
          allButtonsInfo.push({
            index: i + 1,
            text: buttonInfo.text,
            fullText: buttonInfo.fullText.substring(0, 100), // Limita tamanho
            ariaLabel: buttonInfo.ariaLabel,
            status: detectedStatus
          });
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

      const seguirCount = actionButtons.filter(b => b.status === 'seguir').length;
      const seguindoCount = actionButtons.filter(b => b.status === 'seguindo').length;
      const solicitadoCount = actionButtons.filter(b => b.status === 'solicitado').length;
      
      Logger.info(`📋 Total de botões de ação válidos encontrados: ${actionButtons.length} de ${buttons.length} botões na página`);
      Logger.info(`   ├─ Seguir: ${seguirCount} (${((seguirCount / actionButtons.length) * 100).toFixed(1)}%)`);
      Logger.info(`   ├─ Seguindo: ${seguindoCount} (${((seguindoCount / actionButtons.length) * 100).toFixed(1)}%)`);
      Logger.info(`   └─ Solicitado: ${solicitadoCount} (${((solicitadoCount / actionButtons.length) * 100).toFixed(1)}%)`);
      
      // Se não encontrou nenhum "Solicitado" ou "Seguindo", avisa e mostra detalhes
      if (solicitadoCount === 0 && seguindoCount === 0) {
        Logger.warn(`⚠️ ATENÇÃO: Nenhum botão "Solicitado" ou "Seguindo" foi detectado! Todos estão como "Seguir".`);
        Logger.warn(`⚠️ Isso pode indicar que a detecção precisa ser ajustada ou não há perfis privados na lista.`);
        
        // Mostra informações detalhadas dos primeiros 10 botões não identificados como "solicitado" ou "seguindo"
        Logger.info(`🔍 DEBUG: Primeiros 10 botões encontrados na página:`);
        allButtonsInfo.slice(0, 10).forEach(btn => {
          Logger.info(`   Botão ${btn.index}: Status="${btn.status}" | Texto="${btn.text}" | Aria="${btn.ariaLabel}" | Full="${btn.fullText.substring(0, 60)}"`);
        });
      }

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
          // Scrolla até o botão ANTES de verificar visibilidade (importante!)
          await button.scrollIntoViewIfNeeded().catch(() => {});
          await HumanDelay.random(300, 600);

          // Verifica se o botão ainda existe na página (pode ter sido removido após scroll)
          const isVisible = await button.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0';
          }).catch(() => false);

          if (!isVisible) {
            Logger.warn(`⚠️ Botão ${index} (${i + 1}/${actionButtons.length}) não está visível após scroll, tentando novamente...`);
            
            // Tenta scrollar novamente e verificar
            await this.scroll(container);
            await HumanDelay.random(500, 1000);
            await button.scrollIntoViewIfNeeded().catch(() => {});
            await HumanDelay.random(300, 600);
            
            const retryVisible = await button.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }).catch(() => false);
            
            if (!retryVisible) {
              Logger.warn(`⚠️ Botão ${index} ainda não está visível após retry, pulando...`);
              skippedCount++;
              continue;
            }
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
          const totalActions = this.stats.followed + this.stats.requested + 
                              this.stats.seguindoProcessed + this.stats.solicitadoProcessed;
          const stats = HumanClock.getStats();
          
          const limitInfo = HumanClock.getLimitInfo();
          Logger.info(`📊 [${i + 1}/${actionButtons.length}] Resumo: Seguidos: ${this.stats.followed} | Solicitações: ${this.stats.requested} (${this.stats.solicitadoProcessed} eram perfis privados) | Seguindo: ${this.stats.seguindoProcessed} | Solicitado: ${this.stats.solicitadoProcessed} | Pulados: ${this.stats.skipped}`);
          Logger.info(`⏰ Tempo: ${stats.elapsedTime} | Média: ${stats.avgActionsPerHour} ações/hora`);
          Logger.info(`📋 Limites: Diário ${limitInfo.daily.current}/${limitInfo.daily.limit} | Hora ${limitInfo.hourly.current}/${limitInfo.hourly.limit} | Total ${limitInfo.total.current}/${limitInfo.total.limit}`);

          // Intervalo oficial do Instagram (36-48 segundos)
          // Aguarda APENAS após ações de "Seguir" que foram CONFIRMADAS
          // E só aguarda ANTES do próximo botão "Seguir" (não bloqueia "Seguindo" ou "Solicitado")
          if (status === 'seguir' && (this.stats.followed > 0 || this.stats.requested > 0)) {
            // Verifica se o próximo botão também é "Seguir" antes de aguardar intervalo
            const nextButton = actionButtons[i + 1];
            if (nextButton && nextButton.status === 'seguir') {
              Logger.info(`⏳ Aguardando intervalo oficial antes do próximo "Seguir"...`);
              await HumanClock.waitForNextAction();
            } else {
              // Se o próximo não é "Seguir" ou não existe, usa delay menor
              await HumanDelay.random(1500, 3000);
            }
          } else {
            // Para outros status (Seguindo/Solicitado) ou primeiro "Seguir", usa delay menor mas ainda humano
            await HumanDelay.random(1000, 2000);
          }
          
          // Scrolla suavemente para garantir que os próximos botões estarão visíveis
          if (i < actionButtons.length - 1) {
            // Scroll pequeno para manter os próximos botões visíveis
            try {
              if ('evaluate' in container) {
                await (container as ElementHandle<HTMLElement>).evaluate(el => {
                  el.scrollBy({ top: 100, behavior: 'smooth' });
                });
              } else {
                // Se for Page, scrolla no modal
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

          // Verifica pausa longa (a cada 300 ações de "Seguir" - aprox. 10 horas)
          const seguirActions = this.stats.followed + this.stats.requested;
          if (seguirActions > 0 && HumanClock.needsLongBreak()) {
            await HumanClock.takeLongBreak();
          }
          // Verifica pausa curta (a cada 30 ações de "Seguir" - aprox. 1 hora)
          else if (seguirActions > 0 && HumanClock.needsShortBreak()) {
            await HumanClock.takeShortBreak();
          }

        } catch (err: any) {
          Logger.warn(`⚠️ Falha no botão ${i + 1} [${status}]: ${err?.message || 'erro desconhecido'}`);
          this.stats.skipped++;
          skippedCount++;
        }
      }

      Logger.info(`✅ Lote processado: ${processedCount} processados, ${skippedCount} pulados de ${actionButtons.length} botões encontrados`);
      
      // Estatísticas finais do lote
      const batchStats = HumanClock.getStats();
      Logger.info(`⏰ Estatísticas do lote: ${batchStats.elapsedTime} decorridos | Total hoje: ${batchStats.followsToday}/${dailyLimit}`);

      await this.scroll(container);
      // Intervalo humano antes de buscar novos botões
      await HumanDelay.random(2000, 4000);
    }

    const finalStats = HumanClock.getStats();
    Logger.success(
      `🎯 Sessão finalizada | Seguidos: ${this.stats.followed} | Solicitações: ${this.stats.requested} | Seguindo processados: ${this.stats.seguindoProcessed} | Solicitado processados: ${this.stats.solicitadoProcessed} | Pulados: ${this.stats.skipped}`
    );
    Logger.info(`⏰ Tempo total: ${finalStats.elapsedTime} | Média: ${finalStats.avgActionsPerHour} ações/hora | Total hoje: ${finalStats.followsToday}/${dailyLimit}`);

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
