import arrowsdk from "../src/arrow-sdk"
import { UNSUPPORTED_EXPIRATION_ERROR } from "../src/constants"
import { ethers } from "ethers"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import customParseFormat from 'dayjs/plugin/customParseFormat'
import {
    ContractType,
    OptionContract,
    OptionOrderParams,
    OrderType,
    Ticker,
    Version
} from "../src/types"
import { isFriday } from "../src/utilities"

dayjs.extend(utc)
dayjs.extend(customParseFormat)

describe('Utility function tests', () => {
    test('Expects to return the router contract', async () => {
        const v4Router = await arrowsdk.getRouterContract(Version.V4)
        const v3Router = await arrowsdk.getRouterContract(Version.V3)
        const contestRouter = await arrowsdk.getRouterContract(Version.COMPETITION)

        expect(v4Router.address).toBe('0xa6EA0E47501627a964e11E31D2BD7D40452dff6F')
        expect(v3Router.address).toBe('0x31122CeF9891Ef661C99352266FA0FF0079a0e06')
        expect(contestRouter.address).toBe('0x33D1a0529D0C23f183fF1de346BDcA029dB0046E')
    })

    test('Expects to return the stablecoin contract', async () => {
        const v4Stablecoin = await arrowsdk.getStablecoinContract(Version.V4)
        const v3Stablecoin = await arrowsdk.getStablecoinContract(Version.V3)
        const contestStablecoin = await arrowsdk.getStablecoinContract(Version.COMPETITION)

        expect(v4Stablecoin.address).toBe('0x45ea5d57BA80B5e3b0Ed502e9a08d568c96278F9')
        expect(v3Stablecoin.address).toBe('0x45ea5d57BA80B5e3b0Ed502e9a08d568c96278F9')
        expect(contestStablecoin.address).toBe('0x6b8dA544EB543d7f3B533d79267b778e7427B288')
    })

    test('Expects to return the events contract', async () => {
        const v4EventsContract = await arrowsdk.getStablecoinContract(Version.V4)
        const v3EventsContract = await arrowsdk.getEventsContract(Version.V3)
        const contestEventsContract = await arrowsdk.getEventsContract(Version.COMPETITION)

        expect(v4EventsContract.address).toBe('0x45ea5d57BA80B5e3b0Ed502e9a08d568c96278F9')
        expect(v3EventsContract.address).toBe('0x932BC618C972Ef2703cD66A751747d71e7A1BB3D')
        expect(contestEventsContract.address).toBe('0x4dc28938e5112c5729E582F80363f26982Afcc50')
    })

    test('Expects to return the registry contract', async () => {
        const v4RegistryContract = await arrowsdk.getRegistryContract(Version.V4)
        const v3RegistryContract = await arrowsdk.getRegistryContract(Version.V3)
        const contestRegistryContract = await arrowsdk.getRegistryContract(Version.COMPETITION)

        expect(v4RegistryContract.address).toBe('0x20cee0F261F36A0CBcC3D38511D96C3AE0769706')
        expect(v3RegistryContract.address).toBe('0xe72175c1b3A9A287302276491bfb9ad275842876')
        expect(contestRegistryContract.address).toBe('0x342F0b981a90c9fD70483Bb85CfB897b1A6091Dc')
    })

    test('Computes option chain address', async () => {
        const optionChainAddress = await arrowsdk.computeOptionChainAddress(arrowsdk.Ticker.BTC, '10072022')
        
        expect(typeof(optionChainAddress)).toBe('string')
        expect(optionChainAddress).toBe('0x5c8134cD585431032ae752fbfc8f1508711D8285')
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
            await arrowsdk.getExpirationTimestamp('10042022')
        }).rejects.toThrowError(UNSUPPORTED_EXPIRATION_ERROR)
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
        const wallet = new ethers.Wallet(
            '65acf45f04d6c793712caa5aba61a9e3d2f9194e1aae129f9ca6fe39a32d159f', // Public facing test account
            arrowsdk.providers.fuji
        )

        const nextNearestFriday = dayjs.utc().add(1, 'week').set('day', 5)
        const readableExpiration = nextNearestFriday.format('MMDDYYYY')
        
        const option: OptionContract = {
            ticker: Ticker.AVAX,
            expiration: readableExpiration, // The next nearest friday from today
            strike: [87.02, 84.0], // Note that the ordering of the strikes is always [long, short] for spreads and always [long, 0] for single calls/puts
            contractType: ContractType.PUT_SPREAD, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
        }
        
        // Get current price of underlying asset from Binance/CryptoWatch and 12 weeks of price history from CoinGecko.
        option.spotPrice = await arrowsdk.getUnderlierSpotPrice(option.ticker)
        option.priceHistory = (await arrowsdk.getUnderlierMarketChart(option.ticker)).priceHistory
        
        // Estimate option price by making API request.
        const optionOrderParams: OptionOrderParams = {
            quantity: 2.0, // 2.0 contracts
            ...option,
            orderType: OrderType.LONG_OPEN
        }

        optionOrderParams.thresholdPrice = 1.0

        const deliverOptionParams = await arrowsdk.prepareDeliverOptionParams(optionOrderParams,Version.V4,wallet)
        
        expect(deliverOptionParams).toBeDefined()
    })
})