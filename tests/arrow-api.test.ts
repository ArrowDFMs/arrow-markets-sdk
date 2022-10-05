import arrowsdk from "../src/arrow-sdk"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { ethers } from "ethers"
import {
    ContractType,
    DeliverOptionParams,
    OptionContract,
    OptionOrderParams,
    OrderType,
    Ticker,
    Version
} from "../src/types"

dayjs.extend(utc)
dayjs.extend(customParseFormat)

const versions = Object.values(Version).map(version => version as Version)

describe('Arrow API Request Tests', () => {
    const nextNearestFriday = dayjs.utc().add(1, 'week').set('day', 5)
    const readableExpiration = nextNearestFriday.format('MMDDYYYY')

    // Option order parameters
    const option: OptionContract = {
        ticker: Ticker.AVAX,
        expiration: readableExpiration, // The next nearest friday from today
        strike: [87.02, 84.0], // Note that the ordering of the strikes is always [long, short] for spreads and always [long, 0] for single calls/puts
        contractType: ContractType.PUT_SPREAD, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
    }

    let optionOrderParams: OptionOrderParams

    beforeAll(async () => {
        // Get current price of underlying asset from Binance/CryptoWatch and 12 weeks of price history from CoinGecko.
        option.spotPrice = await arrowsdk.getUnderlierSpotPrice(option.ticker)
        option.priceHistory = (await arrowsdk.getUnderlierMarketChart(option.ticker)).priceHistory

        optionOrderParams = {
            quantity: 2.0, // 2.0 contracts
            ...option,
            orderType: OrderType.LONG_OPEN
        }
    })

    test.each(versions.slice(1,2))('Expects to estimate option price (%p version)', async versions => {
        // Estimate option price by making API request.
        const estimatedOptionPrice = await arrowsdk.estimateOptionPrice(optionOrderParams, versions)

        expect(typeof(estimatedOptionPrice)).toBe('number')
        expect(estimatedOptionPrice).toBeGreaterThan(0)
    })
    
    test.each(versions)('Expects to get recommended option (%p version)', async version => {
        // const atSpotPriceForecast = option.spotPrice
        // const belowSpotPriceForecast = option.spotPrice! - 1.00
        const aboveSpotPriceForecast = option.spotPrice! + 1.00

        const recommendedOption = await arrowsdk.getRecommendedOption(
            option.ticker,
            option.expiration,
            aboveSpotPriceForecast,
            option.spotPrice,
            option.priceHistory!.map(entry => entry.price),
            version
        )
        
        expect(recommendedOption).toBeDefined()
        expect(Object.keys(recommendedOption)).toEqual(['ticker', 'expiration', 'strike', 'contractType', 'price', 'greeks'])
        expect(recommendedOption.contractType).toBe(ContractType.CALL)
        expect(Object.keys(recommendedOption.greeks!)).toEqual(['delta', 'gamma', 'rho', 'theta', 'vega'])
    })

    test.each(versions)('Expects to get strike grid (%p version)', async version => {
        const strikeGrid = await arrowsdk.getStrikeGrid(
            optionOrderParams.orderType,
            optionOrderParams.ticker,
            optionOrderParams.expiration,
            ContractType.CALL,
            optionOrderParams.spotPrice,
            optionOrderParams.priceHistory!.map(entry => entry.price),
            version
        )
        
        expect(strikeGrid).toBeDefined()
        expect(strikeGrid.length).toBeGreaterThan(0)
        expect(Object.keys(strikeGrid[0])).toEqual(['ticker', 'expiration', 'strike', 'contractType', 'price', 'greeks'])
        expect(Object.keys(strikeGrid[0].greeks!)).toEqual(['delta', 'gamma', 'rho', 'theta', 'vega'])
    })
})