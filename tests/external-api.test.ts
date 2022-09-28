import arrowsdk from "../src/arrow-sdk"

describe('External API Request Tests', () => {
    test('Expects to get single spot price', async () => {
        const spotPrice = await arrowsdk.getUnderlierSpotPrice(arrowsdk.Ticker.BTC)

        expect(typeof(spotPrice)).toBe('number')
    })

    test('Expects to get price history', async () => {
        const priceHistory = await arrowsdk.getUnderlierPriceHistory(arrowsdk.Ticker.AVAX)

        expect(typeof(priceHistory[0].price)).toBe('number')
    })

    test('Expects to get price history and market cap', async () => {
        const coinGeckoPriceHistoryAndMarketCapResponse = await arrowsdk.getUnderlierSpotPriceAndPriceHistoryAndMarketCaps(arrowsdk.Ticker.AVAX)
        const keys = Object.keys(coinGeckoPriceHistoryAndMarketCapResponse)

        expect(keys).toContain('priceHistory')
        expect(keys).toContain('marketCaps')

        expect(typeof(coinGeckoPriceHistoryAndMarketCapResponse.priceHistory[0].price)).toBe('number')
        expect(typeof(coinGeckoPriceHistoryAndMarketCapResponse.marketCaps[0][0])).toBe('number')
    })

    test('Excepts to get spot price and historical prices', async () => {
        const {
            spotPrice,
            priceHistory
        } = await arrowsdk.getUnderlierSpotPriceAndPriceHistory(arrowsdk.Ticker.ETH)

        expect(typeof(spotPrice)).toBe('number')
        expect(typeof(priceHistory[0].price)).toBe('number')
    })
})