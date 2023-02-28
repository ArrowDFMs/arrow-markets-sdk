/*****************************
 *          IMPORTS          *
 *****************************/

// Packages
import { ethers } from "ethers"
import { Ticker, Version } from "./types"

// Builds
import { ArrowOptionChainProxy } from "../build"

/*******************************
 *          CONSTANTS          *
 *******************************/

export const quantityScaleFactor = 10**2
export const secondsPerDay = 60 * 60 * 24

export const binanceSymbols: Record<string, string> = {
    [Ticker.AVAX]: "AVAXUSDT",
    [Ticker.ETH]: "ETHUSDT",
    [Ticker.BTC]: "BTCUSDT"
}

export const coingeckoIDs: Record<string, string> = {
    [Ticker.AVAX]: "avalanche-2",
    [Ticker.ETH]: "ethereum",
    [Ticker.BTC]: "bitcoin"
}

export const UNSUPPORTED_VERSION_ERROR = new Error(
    "Please select a supported contract version."
)

export const UNSUPPORTED_EXPIRATION_ERROR = new Error(
    "Please select a Friday expiration date."
)

export const DEFAULT_VERSION = Version.V4

export const urls: any = {
    api: {
        [Version.V4]: "https://fuji-v5-api.arrow.markets/v1",
        [Version.COMPETITION]: "https://competition-v5-api.arrow.markets/v1"
    },
    provider: {
        fuji: "https://api.avax-test.network/ext/bc/C/rpc"
    }
}

export const providers: any = {
    fuji: new ethers.providers.JsonRpcProvider(urls.provider.fuji)
}