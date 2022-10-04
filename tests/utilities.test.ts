import arrowsdk from "../src/arrow-sdk"
import { ethers } from "ethers"
import moment from "moment"
import { UNSUPPORTED_EXPIRATION_ERROR } from "../src/constants"
import { ContractType, OptionContract, OptionOrderParams, OrderType, Ticker, Version } from "../src/types"
import { isFriday } from "../src/utilities"

describe('Utility function tests', () => {
    test('Expects to return the router contract', async () => {
        const v4Router = await arrowsdk.getRouterContract(Version.V4)
        const v3Router = await arrowsdk.getRouterContract(Version.V3)
        const contestRouter = await arrowsdk.getRouterContract(Version.COMPETITION)

        expect(v4Router.address).toBe('0x0004C98F75A4e6824EC1B4eB285ff18D0b7257C4')
        expect(v3Router.address).toBe('0x31122CeF9891Ef661C99352266FA0FF0079a0e06')
        expect(contestRouter.address).toBe('0xD0890Cc0B2F5Cd6DB202378C35F39Db3EB0A4b0C')
    })

    test('Expects to return the stablecoin contract', async () => {
        const v4Stablecoin = await arrowsdk.getStablecoinContract(Version.V4)
        const v3Stablecoin = await arrowsdk.getStablecoinContract(Version.V3)
        const contestStablecoin = await arrowsdk.getStablecoinContract(Version.COMPETITION)

        expect(v4Stablecoin.address).toBe('0x7CE8C01897a055665B78315894b82DeE3C86823f')
        expect(v3Stablecoin.address).toBe('0x45ea5d57BA80B5e3b0Ed502e9a08d568c96278F9')
        expect(contestStablecoin.address).toBe('0x2bFCf0aa3776Bb285860Ae595C7BE5C6Fea4Ca8e')
    })

    test('Expects to return the events contract', async () => {
        const v4EventsContract = await arrowsdk.getStablecoinContract(Version.V4)
        const v3EventsContract = await arrowsdk.getEventsContract(Version.V3)
        const contestEventsContract = await arrowsdk.getEventsContract(Version.COMPETITION)

        expect(v4EventsContract.address).toBe('0x7CE8C01897a055665B78315894b82DeE3C86823f')
        expect(v3EventsContract.address).toBe('0x932BC618C972Ef2703cD66A751747d71e7A1BB3D')
        expect(contestEventsContract.address).toBe('0x6E43C4568B8a82a083F45ee7e78b89775C16FEd8')
    })

    test('Expects to return the registry contract', async () => {
        const v4RegistryContract = await arrowsdk.getRegistryContract(Version.V4)
        const v3RegistryContract = await arrowsdk.getRegistryContract(Version.V3)
        const contestRegistryContract = await arrowsdk.getRegistryContract(Version.COMPETITION)

        expect(v4RegistryContract.address).toBe('0xD11dBc6022A9E299b6FBCC17706fc89753CCafa1')
        expect(v3RegistryContract.address).toBe('0xe72175c1b3A9A287302276491bfb9ad275842876')
        expect(contestRegistryContract.address).toBe('0xA8C72D5a00C020DF52A3Dbc22CcA0a918fc9594f')
    })

    test('Computes option chain address', async () => {
        const optionChainAddress = await arrowsdk.computeOptionChainAddress(arrowsdk.Ticker.BTC, '10072022')
        
        expect(typeof(optionChainAddress)).toBe('string')
        expect(optionChainAddress).toBe('0x2967bb4fa8e6744E1c9C4131705795A29c00caBB')
    })

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

    test('Expects to get current UTC time', async () => {
        const currentTimeUTC = await arrowsdk.getCurrentTimeUTC()

        expect(typeof(currentTimeUTC.millisTimestamp)).toBe('number')
        expect(typeof(currentTimeUTC.readableTimestamp)).toBe('string')
        expect(typeof(currentTimeUTC.unixTimestamp)).toBe('number')
    })

    test('Expects to get readable timestamp', async () => {
        const readableTimestamp = await arrowsdk.getReadableTimestamp(1664879367000)
        
        expect(typeof(readableTimestamp)).toBe('string')
        expect(readableTimestamp).toBe('10042022')
  
    })

    test('Expects to get UTC time', async () => {
        const utcTime = await arrowsdk.getTimeUTC(1664879367000)
       
        expect(typeof(utcTime.unixTimestamp)).toBe('number')
        expect(typeof(utcTime.millisTimestamp)).toBe('number')
        expect(typeof(utcTime.readableTimestamp)).toBe('string')
        expect(utcTime.readableTimestamp).toBe('10042022')
        expect(utcTime.unixTimestamp).toBe(1664879367)
        expect(utcTime.millisTimestamp).toBe(1664879367000)
  
    })

    test('Expects to get expiration timestamp', async () => {
        const validExpiration = await arrowsdk.getExpirationTimestamp('10072022')
        
        expect(typeof(validExpiration.unixTimestamp)).toBe('number')
        expect(typeof(validExpiration.millisTimestamp)).toBe('number')
        expect(validExpiration.unixTimestamp).toBe(1665129600)
        expect(validExpiration.millisTimestamp).toBe(1665129600000)
  
    })

    test('Expects UNSUPPORTED_EXPIRATION_ERROR when expiration is not a Friday', async () => {
        await expect(async () => { 
            await arrowsdk.getExpirationTimestamp('10042022'); 
        }).rejects.toThrowError(UNSUPPORTED_EXPIRATION_ERROR);
    })

    test('Expects to determine if timestamp is a Friday', async () => {
        const notFriday = isFriday(1665052167)
        const friday = isFriday(1665138567)
        
        expect(notFriday).toBe(false)
        expect(friday).toBe(true)

    })

    test('Expects to determine if version is valid', async () => {
        const valid = arrowsdk.isValidVersion(Version.V3)
        const invalid = arrowsdk.isValidVersion('INVALID' as Version)
        
        expect(invalid).toBe(false)
        expect(valid).toBe(true)

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
            "contract_type": ContractType.PUT_SPREAD, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
        }
        
        // Get current price of underlying asset from Binance/CryptoWatch and 12 weeks of price history from CoinGecko.
        option.spot_price = await arrowsdk.getUnderlierSpotPrice(option.ticker)
        option.price_history = (await arrowsdk.getUnderlierMarketChart(option.ticker)).priceHistory
        
        // Estimate option price by making API request.
        const optionOrderParams: OptionOrderParams = {
            "quantity": 2.0, // 2.0 contracts
            ...option,
            "order_type": OrderType.LONG_OPEN
        }

        optionOrderParams.thresholdPrice = 1.0

        const deliverOptionParams = await arrowsdk.prepareDeliverOptionParams(optionOrderParams,Version.V4,wallet)
        
        expect(deliverOptionParams).toBeDefined()
    })

})