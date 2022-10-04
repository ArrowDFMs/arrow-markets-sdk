import arrowsdk from "../src/arrow-sdk"
import { UNSUPPORTED_EXPIRATION_ERROR } from "../src/constants"
import { getExpirationTimestamp } from "../src/utilities"

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

    test('Excepts to get current UTC time', async () => {
        const currentTimeUTC = await arrowsdk.getCurrentTimeUTC()

        expect(typeof(currentTimeUTC.millisTimestamp)).toBe('number')
        expect(typeof(currentTimeUTC.readableTimestamp)).toBe('string')
        expect(typeof(currentTimeUTC.unixTimestamp)).toBe('number')
    })

    test('Excepts to get readable timestamp', async () => {
        const readableTimestamp = await arrowsdk.getReadableTimestamp(1664879367000)
        
        expect(typeof(readableTimestamp)).toBe('string')
        expect(readableTimestamp).toBe('10042022')
  
    })

    test('Excepts to get UTC time', async () => {
        const utcTime = await arrowsdk.getTimeUTC(1664879367000)
       
        expect(typeof(utcTime.unixTimestamp)).toBe('number')
        expect(typeof(utcTime.millisTimestamp)).toBe('number')
        expect(typeof(utcTime.readableTimestamp)).toBe('string')
        expect(utcTime.readableTimestamp).toBe('10042022')
        expect(utcTime.unixTimestamp).toBe(1664879367)
        expect(utcTime.millisTimestamp).toBe(1664879367000)
  
    })

    test('Excepts to get expiration timestamp', async () => {
        const validExpiration = await arrowsdk.getExpirationTimestamp('10072022')
        
        expect(typeof(validExpiration.unixTimestamp)).toBe('number')
        expect(typeof(validExpiration.millisTimestamp)).toBe('number')
        expect(validExpiration.unixTimestamp).toBe(1665129600)
        expect(validExpiration.millisTimestamp).toBe(1665129600000)
  
    })

    test('Excepts UNSUPPORTED_EXPIRATION_ERROR when expiration is not a Friday', async () => {
        await expect(async () => { 
            await getExpirationTimestamp('10042022'); 
        }).rejects.toThrowError(UNSUPPORTED_EXPIRATION_ERROR);
    })
})