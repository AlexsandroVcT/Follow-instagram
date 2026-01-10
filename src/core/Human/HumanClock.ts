// core/Human/HumanClock.ts
import { Logger } from '../Logger/Logger';

export class HumanClock {
  private static followsToday = 0;
  private static lastFollowTime = 0;
  private static sessionStartTime = 0;
  private static followsThisHour: Array<number> = []; // Timestamps das ações nesta hora
  private static totalFollowsEver = 0; // Total de seguidores já seguidos (para limite de 7.500)

  // Limites oficiais do Instagram (publicação oficial)
  private static readonly HOURS_PER_DAY = 24;
  private static readonly MINUTES_PER_HOUR = 60;
  private static readonly SECONDS_PER_MINUTE = 60;
  private static readonly MS_PER_SECOND = 1000;
  
  // Limites oficiais
  private static readonly DAILY_LIMIT = 500; // Limite diário oficial
  private static readonly HOURLY_LIMIT = 30; // Limite por hora oficial
  private static readonly TOTAL_LIMIT = 7500; // Limite total de seguidores
  
  // Intervalo entre ações (oficial: 36-48 segundos para parecer natural)
  private static readonly MIN_INTERVAL_SECONDS = 36; // 36 segundos mínimo
  private static readonly MAX_INTERVAL_SECONDS = 48; // 48 segundos máximo
  
  // Descansos periódicos (ajustados para os limites oficiais)
  private static readonly SHORT_BREAK_INTERVAL = 30; // A cada 30 ações (aprox. 1 hora)
  private static readonly SHORT_BREAK_MINUTES = 5; // Pausa curta de 5-10 minutos
  private static readonly LONG_BREAK_INTERVAL = 300; // A cada 300 ações (aprox. 10 horas)
  private static readonly LONG_BREAK_MINUTES = 30; // Pausa longa de 30-60 minutos

  static initialize() {
    if (this.sessionStartTime === 0) {
      this.sessionStartTime = Date.now();
      this.cleanupOldHourlyData();
      Logger.info('⏰ HumanClock inicializado');
      Logger.info(`📋 Limites oficiais Instagram:`);
      Logger.info(`   ├─ Diário: ${this.DAILY_LIMIT} novos seguidores`);
      Logger.info(`   ├─ Por hora: ${this.HOURLY_LIMIT} novos seguidores`);
      Logger.info(`   ├─ Total: ${this.TOTAL_LIMIT} seguidores máximo`);
      Logger.info(`   └─ Intervalo: ${this.MIN_INTERVAL_SECONDS}-${this.MAX_INTERVAL_SECONDS} segundos entre ações`);
    }
  }

  /**
   * Remove timestamps de ações antigas (mais de 1 hora)
   */
  private static cleanupOldHourlyData(): void {
    const oneHourAgo = Date.now() - (this.MINUTES_PER_HOUR * this.SECONDS_PER_MINUTE * this.MS_PER_SECOND);
    this.followsThisHour = this.followsThisHour.filter(timestamp => timestamp > oneHourAgo);
  }

  /**
   * Verifica se pode seguir (respeitando todos os limites)
   */
  static canFollow(dailyLimit?: number): boolean {
    // Limpe dados antigos primeiro
    this.cleanupOldHourlyData();
    
    const limit = dailyLimit || this.DAILY_LIMIT;
    
    // Verifica limite diário
    if (this.followsToday >= limit) {
      Logger.warn(`⚠️ Limite diário atingido: ${this.followsToday}/${limit}`);
      return false;
    }
    
    // Verifica limite por hora
    if (this.followsThisHour.length >= this.HOURLY_LIMIT) {
      // Verifica se o array não está vazio antes de calcular o mínimo
      if (this.followsThisHour.length > 0) {
        const oldestAction = Math.min(...this.followsThisHour);
        const waitUntil = oldestAction + (this.MINUTES_PER_HOUR * this.SECONDS_PER_MINUTE * this.MS_PER_SECOND);
        const waitMs = waitUntil - Date.now();
        
        if (waitMs > 0) {
          const waitMinutes = Math.ceil(waitMs / (this.SECONDS_PER_MINUTE * this.MS_PER_SECOND));
          Logger.warn(`⚠️ Limite por hora atingido: ${this.followsThisHour.length}/${this.HOURLY_LIMIT} | Aguarde ${waitMinutes} minutos`);
          return false;
        }
      } else {
        // Se o array está vazio mas passou na verificação de length, algo está errado - reseta
        this.followsThisHour = [];
      }
    }
    
    // Verifica limite total (7.500) - mas só bloqueia se realmente atingiu o limite
    if (this.totalFollowsEver >= this.TOTAL_LIMIT) {
      Logger.error(`❌ Limite total atingido: ${this.totalFollowsEver}/${this.TOTAL_LIMIT} seguidores. Não é possível seguir mais ninguém.`);
      Logger.info(`💡 Use HumanClock.setTotalFollows(count) para ajustar o total atual se necessário`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Retorna informações sobre os limites
   */
  static getLimitInfo() {
    this.cleanupOldHourlyData();
    return {
      daily: { current: this.followsToday, limit: this.DAILY_LIMIT, remaining: this.DAILY_LIMIT - this.followsToday },
      hourly: { current: this.followsThisHour.length, limit: this.HOURLY_LIMIT, remaining: this.HOURLY_LIMIT - this.followsThisHour.length },
      total: { current: this.totalFollowsEver, limit: this.TOTAL_LIMIT, remaining: this.TOTAL_LIMIT - this.totalFollowsEver }
    };
  }

  /**
   * Calcula o intervalo oficial do Instagram (36-48 segundos)
   * Intervalo fixo baseado na publicação oficial
   */
  private static calculateOfficialInterval(): number {
    // Intervalo oficial: 36-48 segundos entre ações
    const randomSeconds = this.MIN_INTERVAL_SECONDS + 
                         Math.floor(Math.random() * (this.MAX_INTERVAL_SECONDS - this.MIN_INTERVAL_SECONDS + 1));
    
    return randomSeconds * this.MS_PER_SECOND;
  }

  /**
   * Aguarda o intervalo oficial do Instagram (36-48 segundos)
   * Mostra logs em tempo real do progresso
   */
  static async waitForNextAction(): Promise<void> {
    // Verifica se precisa esperar por limite horário
    this.cleanupOldHourlyData();
    
    if (this.followsThisHour.length >= this.HOURLY_LIMIT && this.followsThisHour.length > 0) {
      const oldestAction = Math.min(...this.followsThisHour);
      const waitUntil = oldestAction + (this.MINUTES_PER_HOUR * this.SECONDS_PER_MINUTE * this.MS_PER_SECOND);
      const waitMs = waitUntil - Date.now();
      
      if (waitMs > 0) {
        const waitSeconds = Math.ceil(waitMs / this.MS_PER_SECOND);
        const waitMinutes = Math.floor(waitSeconds / this.SECONDS_PER_MINUTE);
        const remSec = waitSeconds % this.SECONDS_PER_MINUTE;
        
        Logger.warn(`⏸️ Limite horário atingido. Aguardando ${waitMinutes}min ${remSec}s até a próxima hora...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        this.cleanupOldHourlyData(); // Limpa após esperar
      }
    }
    
    // Intervalo oficial entre ações (36-48 segundos)
    const intervalMs = this.calculateOfficialInterval();
    const intervalSeconds = Math.floor(intervalMs / this.MS_PER_SECOND);
    
    Logger.info(`⏳ Intervalo oficial: ${intervalSeconds}s até próxima ação (${this.MIN_INTERVAL_SECONDS}-${this.MAX_INTERVAL_SECONDS}s)`);
    
    // Aguarda o intervalo
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  /**
   * Verifica se precisa de pausa curta (a cada 15 ações)
   */
  static needsShortBreak(): boolean {
    return this.followsToday > 0 && this.followsToday % this.SHORT_BREAK_INTERVAL === 0;
  }

  /**
   * Verifica se precisa de pausa longa (a cada 50 ações)
   */
  static needsLongBreak(): boolean {
    return this.followsToday > 0 && this.followsToday % this.LONG_BREAK_INTERVAL === 0;
  }

  /**
   * Pausa curta (15-25 minutos)
   */
  static async takeShortBreak(): Promise<void> {
    const breakMinutes = this.SHORT_BREAK_MINUTES + Math.floor(Math.random() * 10);
    const msPerMinute = this.SECONDS_PER_MINUTE * this.MS_PER_SECOND;
    const breakMs = breakMinutes * msPerMinute;
    
    Logger.info(`😴 Pausa curta: ${breakMinutes} minutos (a cada ${this.SHORT_BREAK_INTERVAL} ações)`);
    
    // Mostra progresso a cada 5 minutos
    const progressInterval = 5 * msPerMinute;
    const steps = Math.floor(breakMs / progressInterval);
    
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, progressInterval));
      const remaining = breakMs - (i * progressInterval);
      const remainingMinutes = Math.floor(remaining / msPerMinute);
      
      if (remaining > 0 && remainingMinutes > 0) {
        Logger.info(`😴 Pausa: ${remainingMinutes} minutos restantes...`);
      }
    }
    
    const remaining = breakMs % progressInterval;
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
    
    Logger.success('✅ Pausa curta finalizada. Retomando...');
  }

  /**
   * Pausa longa (1-2 horas)
   */
  static async takeLongBreak(): Promise<void> {
    const breakHours = 1 + Math.random(); // 1-2 horas
    const msPerMinute = this.SECONDS_PER_MINUTE * this.MS_PER_SECOND;
    const breakMs = breakHours * this.MINUTES_PER_HOUR * msPerMinute;
    
    Logger.info(`🌙 Pausa longa: ${breakHours.toFixed(1)} horas (a cada ${this.LONG_BREAK_INTERVAL} ações)`);
    
    // Mostra progresso a cada 15 minutos
    const progressInterval = 15 * msPerMinute;
    const steps = Math.floor(breakMs / progressInterval);
    
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, progressInterval));
      const remaining = breakMs - (i * progressInterval);
      const remainingMinutes = Math.floor(remaining / msPerMinute);
      const remainingHours = Math.floor(remainingMinutes / this.MINUTES_PER_HOUR);
      const remMins = remainingMinutes % this.MINUTES_PER_HOUR;
      
      if (remaining > 0) {
        if (remainingHours > 0) {
          Logger.info(`🌙 Pausa longa: ${remainingHours}h ${remMins}min restantes...`);
        } else {
          Logger.info(`🌙 Pausa longa: ${remainingMinutes}min restantes...`);
        }
      }
    }
    
    const remaining = breakMs % progressInterval;
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
    
    Logger.success('✅ Pausa longa finalizada. Retomando...');
  }

  static registerFollow() {
    const now = Date.now();
    this.followsToday++;
    this.totalFollowsEver++;
    this.lastFollowTime = now;
    this.followsThisHour.push(now);
    
    // Limpa dados antigos
    this.cleanupOldHourlyData();
    
    // Log informações de limites
    const limitInfo = this.getLimitInfo();
    Logger.info(`📊 Limites: Diário ${limitInfo.daily.current}/${limitInfo.daily.limit} | Hora ${limitInfo.hourly.current}/${limitInfo.hourly.limit} | Total ${limitInfo.total.current}/${limitInfo.total.limit}`);
  }

  static resetDaily() {
    this.followsToday = 0;
    this.lastFollowTime = 0;
    this.followsThisHour = [];
    // NÃO resetamos sessionStartTime e totalFollowsEver para manter histórico
  }
  
  /**
   * Define o total de seguidores já seguidos (para limite de 7.500)
   */
  static setTotalFollows(count: number) {
    this.totalFollowsEver = count;
    Logger.info(`📊 Total de seguidores configurado: ${this.totalFollowsEver}/${this.TOTAL_LIMIT}`);
  }

  static getStats() {
    const elapsed = this.sessionStartTime > 0 ? Date.now() - this.sessionStartTime : 0;
    const msPerHour = this.MINUTES_PER_HOUR * this.SECONDS_PER_MINUTE * this.MS_PER_SECOND;
    const elapsedHours = Math.floor(elapsed / msPerHour);
    const elapsedMinutes = Math.floor((elapsed % msPerHour) / (this.SECONDS_PER_MINUTE * this.MS_PER_SECOND));
    
    const hoursElapsed = elapsed / msPerHour;
    const avgActionsPerHour = elapsed > 0 ? (this.followsToday / hoursElapsed).toFixed(2) : '0';
    
    return {
      followsToday: this.followsToday,
      lastFollowTime: this.lastFollowTime,
      sessionStartTime: this.sessionStartTime,
      elapsedTime: `${elapsedHours}h ${elapsedMinutes}min`,
      avgActionsPerHour: avgActionsPerHour
    };
  }
}
