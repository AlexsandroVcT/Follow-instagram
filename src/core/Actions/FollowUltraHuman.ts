import { Page, ElementHandle } from 'playwright';
import { Logger } from '../Logger/Logger';
import { HumanDelay } from '../Human/HumanDelay';
import { HumanScroll } from '../Human/HumanScroll';
import { HumanClock } from '../Human/HumanClock';
import { Runtime } from '../System/Runtime';

type Container = Page | ElementHandle<HTMLElement>;

interface FollowStats {
  followed: number;
  skipped: number;
}

export class FollowActionUltraHuman {
  private static stats: FollowStats = {
    followed: 0,
    skipped: 0,
  };

  static async execute(
    container: Container,
    dailyLimit = 150
  ): Promise<number> {
    Logger.action(`▶️ Follow Ultra-Human iniciado (máx ${dailyLimit}/dia)`);

    const page = await this.resolvePage(container);

    while (HumanClock.canFollow(dailyLimit) && Runtime.running) {
      const buttons = await container.$$('button');
      const followButtons: ElementHandle<HTMLElement>[] = [];

      for (const button of buttons) {
        const text = await button.evaluate(el =>
          el.innerText?.toLowerCase().trim()
        );

        if (text === 'seguir' || text === 'follow') {
          followButtons.push(button as ElementHandle<HTMLElement>);
        }
      }

      if (!followButtons.length) {
        Logger.info('Nenhum botão "Seguir" encontrado. Scrollando...');
        await this.scroll(container);
        await HumanDelay.random(1200, 2500);
        continue;
      }

      for (const button of followButtons) {
        if (!HumanClock.canFollow(dailyLimit) || !Runtime.running) break;

        try {
          const before = await button.evaluate(el =>
            el.innerText?.toLowerCase()
          );

          if (!before || before.includes('seguindo') || before.includes('solicit')) {
            this.stats.skipped++;
            continue;
          }

          Logger.info('Usuário válido encontrado. Observando...');
          await HumanDelay.random(1800, 4200);

          const box = await button.boundingBox();
          if (!box) {
            this.stats.skipped++;
            continue;
          }

          await button.scrollIntoViewIfNeeded();
          await HumanDelay.random(400, 900);

          // 🎯 Movimento humano REAL
          await page.mouse.move(
            box.x + box.width / 2,
            box.y + box.height / 2,
            { steps: this.randomBetween(12, 25) }
          );

          await HumanDelay.random(200, 400);
          await page.mouse.down();
          await HumanDelay.random(120, 260);
          await page.mouse.up();

          // ⏳ tempo real de reação do Instagram
          await HumanDelay.random(1800, 3200);

          // ✅ CONFIRMAÇÃO FLEXÍVEL
          const confirmed = await this.confirmFollow(container);

          this.stats.followed++;
          HumanClock.registerFollow();

          if (confirmed) {
            Logger.success(
              `✅ Follow confirmado (${this.stats.followed}/${dailyLimit})`
            );
          } else {
            Logger.info(
              `ℹ️ Follow executado (${this.stats.followed}/${dailyLimit}) — UI atrasou`
            );
          }

          await HumanDelay.random(3500, 7500);

          if (this.stats.followed % this.randomBetween(8, 14) === 0) {
            const rest = this.randomBetween(3, 7) * 60 * 1000;
            Logger.info(`😴 Descanso humano (${rest / 60000} min)`);
            await HumanDelay.random(rest, rest + 2000);
          }

        } catch (err: any) {
          Logger.warn(
            `⚠️ Falha controlada no follow (${err?.message || 'erro desconhecido'})`
          );
          this.stats.skipped++;
        }
      }

      await this.scroll(container);
      await HumanDelay.random(1500, 3000);
    }

    Logger.success(
      `🎯 Sessão finalizada | Seguidos: ${this.stats.followed} | Pulados: ${this.stats.skipped}`
    );

    return this.stats.followed;
  }

  // 🧠 Resolve Page REAL sem cast perigoso
  private static async resolvePage(container: Container): Promise<Page> {
    if ('mouse' in container) {
      return container as Page;
    }

    const element = container as ElementHandle<HTMLElement>;
    const frame = await element.ownerFrame();
    const page = frame?.page();
    if (!page) {
      throw new Error('Não foi possível resolver a Page do container');
    }

    return page;
  }

  // 🔍 Confirmação tolerante (Instagram é assíncrono)
  private static async confirmFollow(container: Container): Promise<boolean> {
    try {
      const buttons = await container.$$('button');

      for (const btn of buttons) {
        const text = await btn.evaluate(el =>
          el.innerText?.toLowerCase()
        );

        if (text?.includes('seguindo') || text?.includes('solicit')) {
          return true;
        }
      }
    } catch {}

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
