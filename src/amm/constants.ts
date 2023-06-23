/*****************************
 *          IMPORTS          *
 *****************************/

// Packages
import { ethers } from 'ethers'
import { Ticker } from '../common/types/option'

// Builds
import { ArrowOptionChainProxy } from '../../abis'
import { Version } from './types'

/*******************************
 *          CONSTANTS          *
 *******************************/

export const quantityScaleFactor = 10 ** 2
export const secondsPerDay = 60 * 60 * 24

export const binanceSymbols: Record<string, string> = {
  [Ticker.AVAX]: 'AVAXUSDT',
  [Ticker.ETH]: 'ETHUSDT',
  [Ticker.BTC]: 'BTCUSDT'
}

export const coingeckoIDs: Record<string, string> = {
  [Ticker.AVAX]: 'avalanche-2',
  [Ticker.ETH]: 'ethereum',
  [Ticker.BTC]: 'bitcoin'
}

export const DEFAULT_VERSION = Version.V4

export const urls: any = {
  api: {
    [Version.V4]: 'https://development-api.arrow.markets/v1',
    [Version.COMPETITION]: 'https://competition-v5-api.arrow.markets/v1'
  },
  provider: {
    fuji: 'https://api.avax-test.network/ext/bc/C/rpc'
  }
}

export const providers: any = {
  fuji: new ethers.providers.JsonRpcProvider(urls.provider.fuji)
}

export const addresses: any = {
  fuji: {
    router: {
      [Version.V4]: ethers.utils.getAddress(
        '0xaB12c83893ba35f2e4CEeA65429c5805CC86D4bD'
      ),
      [Version.COMPETITION]: ethers.utils.getAddress(
        '0xD05D064DBDCf8dB7D87EcD7E06c63874Bb968AA6'
      )
    }
  }
}

export const bytecodeHashes: any = {
  ArrowOptionChainProxy: {
    [Version.V4]: ethers.utils.solidityKeccak256(
      ['bytes'],
      [ArrowOptionChainProxy.v4.bytecode]
    ),
    [Version.COMPETITION]: ethers.utils.solidityKeccak256(
      ['bytes'],
      [ArrowOptionChainProxy.competition.bytecode]
    )
  }
}
