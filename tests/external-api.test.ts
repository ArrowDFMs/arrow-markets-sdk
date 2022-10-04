import { ethers } from "ethers"
import moment from "moment"
import arrowsdk from "../src/arrow-sdk"
import { OptionContract, Ticker, ContractType, OptionOrderParams, OrderType, Version } from "../src/types"

describe('External API Request Tests', () => {
    test('Expects to get single spot price', async () => {
        const spotPrice = await arrowsdk.getUnderlierSpotPrice(arrowsdk.Ticker.BTC)

        expect(typeof(spotPrice)).toBe('number')
    })

    test('Expects to get underlier market chart', async () => {
        const marketChart = await arrowsdk.getUnderlierMarketChart(arrowsdk.Ticker.AVAX)

        expect(typeof(marketChart.priceHistory[0].price)).toBe('number')
        expect(typeof(marketChart.priceHistory[0].date)).toBe('number')
        expect(typeof(marketChart.marketCaps[0][0])).toBe('number')
        expect(typeof(marketChart.marketCaps[0][1])).toBe('number')
    })

    test('Excepts to get spot price and historical prices', async () => {
        const {
            spotPrice,
            marketChart
        } = await arrowsdk.getUnderlierSpotPriceAndMarketChart(arrowsdk.Ticker.ETH)

        expect(typeof(spotPrice)).toBe('number')
        expect(typeof(marketChart.priceHistory[0].price)).toBe('number')
        expect(typeof(marketChart.priceHistory[0].date)).toBe('number')
        expect(typeof(marketChart.marketCaps[0][0])).toBe('number')
        expect(typeof(marketChart.marketCaps[0][1])).toBe('number')
    })

    test('Excepts to prepare deliver option params', async () => {
         // Option order parameters
         // Dummy testing account
        const wallet = new ethers.Wallet('65acf45f04d6c793712caa5aba61a9e3d2f9194e1aae129f9ca6fe39a32d159f', arrowsdk.providers.fuji)

        const nextNearestFriday = moment.utc().add(1, 'week').set('day', 5)

        const readableExpiration = nextNearestFriday.format('MMDDYYYY')
        
        const option: OptionContract = {
            "ticker": Ticker.AVAX,
            "expiration": readableExpiration, // The next nearest friday from today
            "strike": [87.02, 84.0], // Note that the ordering of the strikes is always [long, short] for spreads and always [long, 0] for single calls/puts
            "contractType": ContractType.PUT_SPREAD, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
        }
        
        // Get current price of underlying asset from Binance/CryptoWatch and 12 weeks of price history from CoinGecko.
        option.underlierSpotPrice = await arrowsdk.getUnderlierSpotPrice(option.ticker)
        option.underlierPriceHistory = (await arrowsdk.getUnderlierMarketChart(option.ticker)).priceHistory
        
        // Estimate option price by making API request.
        const optionOrderParams: OptionOrderParams = {
            "quantity": 2.0, // 2.0 contracts
            ...option,
            "orderType": OrderType.LONG_OPEN
        }

        optionOrderParams.thresholdPrice = 1.0

        const deliverOptionParams = await arrowsdk.prepareDeliverOptionParams(optionOrderParams,Version.V4,wallet)
        
        expect(deliverOptionParams).toBeDefined()
    })
})