import arrowsdk from "../src/arrow-sdk"

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

    test('Expects to get spot price and historical prices', async () => {
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
})