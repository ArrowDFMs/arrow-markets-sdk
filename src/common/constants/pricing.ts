import { Ticker } from '../types/option'

export const coingeckoIDs: Record<string, string> = {
  [Ticker.AVAX]: 'avalanche-2',
  [Ticker.ETH]: 'ethereum',
  [Ticker.BTC]: 'bitcoin'
}

export const binanceSymbols: Record<string, string> = {
  [Ticker.AVAX]: 'AVAXUSDT',
  [Ticker.ETH]: 'ETHUSDT',
  [Ticker.BTC]: 'BTCUSDT'
}
