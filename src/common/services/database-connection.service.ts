import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

const RECONNECT_BASE_DELAY_MS = 30000;
const RECONNECT_JITTER_MS = 5000;

@Injectable()
export class DatabaseConnectionService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DatabaseConnectionService.name);
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectInFlight: Promise<void> | null = null;
  private isShuttingDown = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.connect();
  }

  async onApplicationShutdown() {
    this.isShuttingDown = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.connectInFlight) await this.connectInFlight;
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
  }

  getStatus() {
    return {
      configured: Boolean(this.configService.get<string>('database.url')),
      connected: this.dataSource.isInitialized,
      connecting: Boolean(this.connectInFlight),
    };
  }

  private async connect(): Promise<void> {
    if (
      this.dataSource.isInitialized ||
      this.connectInFlight ||
      this.isShuttingDown ||
      !this.configService.get<string>('database.url')
    ) {
      if (!this.configService.get<string>('database.url')) {
        this.logger.warn(
          JSON.stringify({
            event: 'database_connection_skipped',
            reason: 'not_configured',
          }),
        );
      }
      return;
    }

    const pending = this.dataSource
      .initialize()
      .then(() => {
        this.logger.log(JSON.stringify({ event: 'database_connected' }));
      })
      .catch((error: unknown) => {
        this.logger.warn(
          JSON.stringify({
            event: 'database_connection_failed',
            failureType:
              error instanceof Error ? error.constructor.name : 'UnknownError',
          }),
        );
        this.scheduleReconnect();
      });
    this.connectInFlight = pending.finally(() => {
      this.connectInFlight = null;
    });
    await this.connectInFlight;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.isShuttingDown) return;
    const delay =
      RECONNECT_BASE_DELAY_MS +
      Math.floor(Math.random() * RECONNECT_JITTER_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
    this.reconnectTimer.unref();
  }
}
