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

export const urls: any = {
    api: {
        [Version.V3]: "https://fuji-v3-api.arrow.markets/v1/",
        [Version.COMPETITION]: "https://competition-v2-api.arrow.markets/v1"
    },
    provider: {
        fuji: "https://api.avax-test.network/ext/bc/C/rpc"
    }
}

export const providers: any = {
    fuji: new ethers.providers.JsonRpcProvider(urls.provider.fuji)
}

export const addresses: any = {
    fuji: {
        router: {
            [Version.V3]: ethers.utils.getAddress(
                "0x31122CeF9891Ef661C99352266FA0FF0079a0e06"
            ),
            [Version.COMPETITION]: ethers.utils.getAddress(
                "0xD0890Cc0B2F5Cd6DB202378C35F39Db3EB0A4b0C"
            )
        }
    }
}

export const bytecodeHashes: any = {
    ArrowOptionChainProxy: {
        [Version.V3]: ethers.utils.solidityKeccak256(
            ["bytes"],
            [ArrowOptionChainProxy.v3.bytecode]
        ),
        [Version.COMPETITION]: ethers.utils.solidityKeccak256(
            ["bytes"],
            [ArrowOptionChainProxy.competition.bytecode]
        )
    }
}