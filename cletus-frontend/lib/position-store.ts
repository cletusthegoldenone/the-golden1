/**
 * Persistent Database-backed Position Store with In-Memory fallback.
 *
 * Automatically connects to PostgreSQL if process.env.DATABASE_URL is set, and
 * self-heals by auto-initializing tables. Falls back gracefully to fully-functional
 * in-memory storage if the database is unconfigured or unavailable.
 *
 * ⚠️ DATA LOSS WARNING PREVENTED: Open positions are saved persistently in SQL,
 * which eliminates cold-start data losses in serverless environments.
 */

import { Pool } from 'pg';
import type { SignalBreakdown } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LivePosition {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  /** Buy-only for now; short-selling micro-caps is not safe */
  direction: 'LONG';
  /** Price in USD at entry */
  entryPrice: number;
  /** SOL spent on entry */
  entryAmountSol: number;
  /** Token units received */
  tokenAmount: number;
  /** Timestamp (ms) when position was opened */
  openedAt: number;
  /** Composite signal score that triggered the trade (0–1) */
  signalScore: number;
  /** Stop-loss price (entry * (1 - stopLossPct)) */
  stopLoss: number;
  /** Take-profit price (entry * (1 + takeProfitPct)) */
  takeProfit: number;
  /** Solana transaction signature for the entry */
  entrySignature: string;
  /** Most-recently observed price in USD */
  currentPrice: number;
  /** Current unrealised PnL in USD */
  pnlUsd: number;
  /** Signal breakdown that triggered the trade */
  signalBreakdown?: SignalBreakdown;
  /** True when the trade was simulated (not sent to chain) */
  isDryRun: boolean;
}

export interface ClosedPosition extends LivePosition {
  closedAt: number;
  exitPrice: number;
  exitSignature: string;
  realisedPnlUsd: number;
  closeReason: 'MANUAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'KILL_SWITCH';
}

// ── In-memory fallback stores ──────────────────────────────────────────────────

const openPositions = new Map<string, LivePosition>();
const closedPositions: ClosedPosition[] = [];

// ── ID generator ──────────────────────────────────────────────────────────────

let _idCounter = 0;
function generateId(): string {
  return `pos_${Date.now()}_${(_idCounter++).toString(36)}`;
}

// ── PostgreSQL client initialization ──────────────────────────────────────────

let pool: Pool | null = null;
let dbInitialized = false;

if (typeof window === 'undefined') {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    pool = new Pool({
      connectionString: dbUrl,
      max: parseInt(process.env.DATABASE_POOL_SIZE ?? '20', 10),
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }
}

async function initDb(): Promise<void> {
  if (!pool || dbInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS open_positions (
        id VARCHAR(100) PRIMARY KEY,
        token_address VARCHAR(100) NOT NULL,
        token_symbol VARCHAR(50) NOT NULL,
        token_name VARCHAR(100) NOT NULL,
        direction VARCHAR(20) NOT NULL,
        entry_price DOUBLE PRECISION NOT NULL,
        entry_amount_sol DOUBLE PRECISION NOT NULL,
        token_amount DOUBLE PRECISION NOT NULL,
        opened_at BIGINT NOT NULL,
        signal_score DOUBLE PRECISION NOT NULL,
        stop_loss DOUBLE PRECISION NOT NULL,
        take_profit DOUBLE PRECISION NOT NULL,
        entry_signature VARCHAR(255) NOT NULL,
        current_price DOUBLE PRECISION NOT NULL,
        pnl_usd DOUBLE PRECISION NOT NULL,
        signal_breakdown JSONB,
        is_dry_run BOOLEAN NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS closed_positions (
        id VARCHAR(100) PRIMARY KEY,
        token_address VARCHAR(100) NOT NULL,
        token_symbol VARCHAR(50) NOT NULL,
        token_name VARCHAR(100) NOT NULL,
        direction VARCHAR(20) NOT NULL,
        entry_price DOUBLE PRECISION NOT NULL,
        entry_amount_sol DOUBLE PRECISION NOT NULL,
        token_amount DOUBLE PRECISION NOT NULL,
        opened_at BIGINT NOT NULL,
        signal_score DOUBLE PRECISION NOT NULL,
        stop_loss DOUBLE PRECISION NOT NULL,
        take_profit DOUBLE PRECISION NOT NULL,
        entry_signature VARCHAR(255) NOT NULL,
        current_price DOUBLE PRECISION NOT NULL,
        pnl_usd DOUBLE PRECISION NOT NULL,
        signal_breakdown JSONB,
        is_dry_run BOOLEAN NOT NULL,
        closed_at BIGINT NOT NULL,
        exit_price DOUBLE PRECISION NOT NULL,
        exit_signature VARCHAR(255) NOT NULL,
        realised_pnl_usd DOUBLE PRECISION NOT NULL,
        close_reason VARCHAR(50) NOT NULL
      );
    `);

    dbInitialized = true;
  } catch (err) {
    console.error('Failed to initialize PostgreSQL database for position-store:', err);
    pool = null; // Disable DB usage so we fall back to memory query-by-query
  }
}

// ── Row Mappers ───────────────────────────────────────────────────────────────

function mapRowToLivePosition(row: any): LivePosition {
  return {
    id: row.id,
    tokenAddress: row.token_address,
    tokenSymbol: row.token_symbol,
    tokenName: row.token_name,
    direction: row.direction as 'LONG',
    entryPrice: Number(row.entry_price),
    entryAmountSol: Number(row.entry_amount_sol),
    tokenAmount: Number(row.token_amount),
    openedAt: Number(row.opened_at),
    signalScore: Number(row.signal_score),
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    entrySignature: row.entry_signature,
    currentPrice: Number(row.current_price),
    pnlUsd: Number(row.pnl_usd),
    signalBreakdown: row.signal_breakdown || undefined,
    isDryRun: Boolean(row.is_dry_run),
  };
}

function mapRowToClosedPosition(row: any): ClosedPosition {
  return {
    ...mapRowToLivePosition(row),
    closedAt: Number(row.closed_at),
    exitPrice: Number(row.exit_price),
    exitSignature: row.exit_signature,
    realisedPnlUsd: Number(row.realised_pnl_usd),
    closeReason: row.close_reason as ClosedPosition['closeReason'],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Add a newly-opened position. Returns the assigned ID. */
export async function openPosition(
  params: Omit<LivePosition, 'id' | 'pnlUsd'>,
): Promise<LivePosition> {
  const id = generateId();
  const position: LivePosition = {
    ...params,
    id,
    pnlUsd: 0,
  };

  if (pool) {
    await initDb();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO open_positions (
            id, token_address, token_symbol, token_name, direction,
            entry_price, entry_amount_sol, token_amount, opened_at,
            signal_score, stop_loss, take_profit, entry_signature,
            current_price, pnl_usd, signal_breakdown, is_dry_run
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            position.id,
            position.tokenAddress,
            position.tokenSymbol,
            position.tokenName,
            position.direction,
            position.entryPrice,
            position.entryAmountSol,
            position.tokenAmount,
            position.openedAt,
            position.signalScore,
            position.stopLoss,
            position.takeProfit,
            position.entrySignature,
            position.currentPrice,
            position.pnlUsd,
            position.signalBreakdown || null,
            position.isDryRun,
          ]
        );
        return position;
      } catch (err) {
        console.error('Failed to save open position to database, falling back to memory:', err);
      }
    }
  }

  openPositions.set(id, position);
  return position;
}

/** Update the current market price and recalculate unrealised PnL. */
export async function updatePositionPrice(id: string, currentPrice: number): Promise<LivePosition | null> {
  if (pool) {
    await initDb();
    if (pool) {
      try {
        const res = await pool.query('SELECT * FROM open_positions WHERE id = $1', [id]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const tokenAmount = Number(row.token_amount);
          const entryPrice = Number(row.entry_price);
          const pnlUsd = (currentPrice - entryPrice) * tokenAmount;

          const updateRes = await pool.query(
            'UPDATE open_positions SET current_price = $1, pnl_usd = $2 WHERE id = $3 RETURNING *',
            [currentPrice, pnlUsd, id]
          );
          if (updateRes.rows.length > 0) {
            return mapRowToLivePosition(updateRes.rows[0]);
          }
        }
      } catch (err) {
        console.error('Failed to update position price in database:', err);
      }
    }
  }

  const pos = openPositions.get(id);
  if (!pos) return null;

  const pnlUsd = (currentPrice - pos.entryPrice) * pos.tokenAmount;
  const updated: LivePosition = { ...pos, currentPrice, pnlUsd };
  openPositions.set(id, updated);
  return updated;
}

/** Close a position and move it to the closed history. */
export async function closePosition(
  id: string,
  exitPrice: number,
  exitSignature: string,
  reason: ClosedPosition['closeReason'],
): Promise<ClosedPosition | null> {
  if (pool) {
    await initDb();
    if (pool) {
      try {
        const res = await pool.query('SELECT * FROM open_positions WHERE id = $1', [id]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const tokenAmount = Number(row.token_amount);
          const entryPrice = Number(row.entry_price);
          const realisedPnlUsd = (exitPrice - entryPrice) * tokenAmount;
          const closedAt = Date.now();

          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query('DELETE FROM open_positions WHERE id = $1', [id]);
            await client.query(
              `INSERT INTO closed_positions (
                id, token_address, token_symbol, token_name, direction,
                entry_price, entry_amount_sol, token_amount, opened_at,
                signal_score, stop_loss, take_profit, entry_signature,
                current_price, pnl_usd, signal_breakdown, is_dry_run,
                closed_at, exit_price, exit_signature, realised_pnl_usd, close_reason
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
              [
                row.id,
                row.token_address,
                row.token_symbol,
                row.token_name,
                row.direction,
                row.entry_price,
                row.entry_amount_sol,
                row.token_amount,
                row.opened_at,
                row.signal_score,
                row.stop_loss,
                row.take_profit,
                row.entry_signature,
                row.current_price,
                row.pnl_usd,
                row.signal_breakdown || null,
                row.is_dry_run,
                closedAt,
                exitPrice,
                exitSignature,
                realisedPnlUsd,
                reason,
              ]
            );
            await client.query('COMMIT');

            return {
              id: row.id,
              tokenAddress: row.token_address,
              tokenSymbol: row.token_symbol,
              tokenName: row.token_name,
              direction: row.direction as 'LONG',
              entryPrice: Number(row.entry_price),
              entryAmountSol: Number(row.entry_amount_sol),
              tokenAmount: Number(row.token_amount),
              openedAt: Number(row.opened_at),
              signalScore: Number(row.signal_score),
              stopLoss: Number(row.stop_loss),
              takeProfit: Number(row.take_profit),
              entrySignature: row.entry_signature,
              currentPrice: Number(row.current_price),
              pnlUsd: Number(row.pnl_usd),
              signalBreakdown: row.signal_breakdown || undefined,
              isDryRun: Boolean(row.is_dry_run),
              closedAt,
              exitPrice,
              exitSignature,
              realisedPnlUsd,
              closeReason: reason,
            };
          } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
          } finally {
            client.release();
          }
        }
      } catch (err) {
        console.error('Failed to close position in database, falling back to memory:', err);
      }
    }
  }

  const pos = openPositions.get(id);
  if (!pos) return null;

  const realisedPnlUsd = (exitPrice - pos.entryPrice) * pos.tokenAmount;
  const closed: ClosedPosition = {
    ...pos,
    closedAt: Date.now(),
    exitPrice,
    exitSignature,
    realisedPnlUsd,
    closeReason: reason,
  };
  openPositions.delete(id);
  closedPositions.unshift(closed);
  return closed;
}

/** Get a single open position by ID. */
export async function getPosition(id: string): Promise<LivePosition | undefined> {
  if (pool) {
    await initDb();
    if (pool) {
      try {
        const res = await pool.query('SELECT * FROM open_positions WHERE id = $1', [id]);
        if (res.rows.length > 0) {
          return mapRowToLivePosition(res.rows[0]);
        }
        return undefined;
      } catch (err) {
        console.error('Failed to get position from database, falling back to memory:', err);
      }
    }
  }
  return openPositions.get(id);
}

/** Get all currently open positions. */
export async function getOpenPositions(): Promise<LivePosition[]> {
  if (pool) {
    await initDb();
    if (pool) {
      try {
        const res = await pool.query('SELECT * FROM open_positions ORDER BY opened_at DESC');
        return res.rows.map(mapRowToLivePosition);
      } catch (err) {
        console.error('Failed to get open positions from database, falling back to memory:', err);
      }
    }
  }
  return Array.from(openPositions.values()).sort((a, b) => b.openedAt - a.openedAt);
}

/** Get closed position history (most recent first, capped at 100). */
export async function getClosedPositions(): Promise<ClosedPosition[]> {
  if (pool) {
    await initDb();
    if (pool) {
      try {
        const res = await pool.query('SELECT * FROM closed_positions ORDER BY closed_at DESC LIMIT 100');
        return res.rows.map(mapRowToClosedPosition);
      } catch (err) {
        console.error('Failed to get closed positions from database, falling back to memory:', err);
      }
    }
  }
  return closedPositions.slice(0, 100);
}

/** Get all open position IDs. */
export async function getOpenPositionIds(): Promise<string[]> {
  if (pool) {
    await initDb();
    if (pool) {
      try {
        const res = await pool.query('SELECT id FROM open_positions');
        return res.rows.map((r) => r.id);
      } catch (err) {
        console.error('Failed to get open position IDs from database, falling back to memory:', err);
      }
    }
  }
  return Array.from(openPositions.keys());
}

/** How many positions are currently open. */
export async function getOpenCount(): Promise<number> {
  if (pool) {
    await initDb();
    if (pool) {
      try {
        const res = await pool.query('SELECT COUNT(*)::int as count FROM open_positions');
        return res.rows[0].count;
      } catch (err) {
        console.error('Failed to get open count from database, falling back to memory:', err);
      }
    }
  }
  return openPositions.size;
}

/** Aggregate stats across closed positions. */
export async function getStats() {
  if (pool) {
    await initDb();
    if (pool) {
      try {
        const openCountRes = await pool.query('SELECT COUNT(*)::int as count FROM open_positions');
        const closedStatsRes = await pool.query(`
          SELECT 
            COUNT(*)::int as total_trades,
            COALESCE(SUM(realised_pnl_usd), 0)::double precision as total_pnl,
            COUNT(CASE WHEN realised_pnl_usd > 0 THEN 1 END)::int as wins,
            COALESCE(MAX(CASE WHEN realised_pnl_usd > 0 THEN realised_pnl_usd END), 0)::double precision as best_trade,
            COALESCE(MIN(CASE WHEN realised_pnl_usd <= 0 THEN realised_pnl_usd END), 0)::double precision as worst_trade
          FROM closed_positions
        `);

        const openTrades = openCountRes.rows[0].count;
        const s = closedStatsRes.rows[0];
        const winRate = s.total_trades > 0 ? s.wins / s.total_trades : 0;

        return {
          totalTrades: s.total_trades,
          openTrades,
          winRate,
          totalPnlUsd: s.total_pnl,
          bestTrade: s.best_trade,
          worstTrade: s.worst_trade,
        };
      } catch (err) {
        console.error('Failed to get stats from database, falling back to memory:', err);
      }
    }
  }

  const closed = closedPositions;
  const wins = closed.filter((p) => p.realisedPnlUsd > 0);
  const losses = closed.filter((p) => p.realisedPnlUsd <= 0);
  const totalPnl = closed.reduce((sum, p) => sum + p.realisedPnlUsd, 0);
  const winRate = closed.length > 0 ? wins.length / closed.length : 0;
  const bestTrade = wins.length > 0 ? Math.max(...wins.map((p) => p.realisedPnlUsd)) : 0;
  const worstTrade = losses.length > 0 ? Math.min(...losses.map((p) => p.realisedPnlUsd)) : 0;

  return {
    totalTrades: closed.length,
    openTrades: openPositions.size,
    winRate,
    totalPnlUsd: totalPnl,
    bestTrade,
    worstTrade,
  };
}
