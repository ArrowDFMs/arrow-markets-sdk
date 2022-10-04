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

    test.each(versions.slice(1,2))('Expects to submit option order (%p version)', async version => {
        const wallet = new ethers.Wallet(
            '65acf45f04d6c793712caa5aba61a9e3d2f9194e1aae129f9ca6fe39a32d159f', // Public facing test account
            arrowsdk.providers.fuji
        )

        const stablecoin = await arrowsdk.getStablecoinContract(version, wallet)
        
        // Get current price of underlying asset from Binance/CryptoWatch and 12 weeks of price history from CoinGecko.
        option.spotPrice = await arrowsdk.getUnderlierSpotPrice(option.ticker)
        option.priceHistory = (await arrowsdk.getUnderlierMarketChart(option.ticker)).priceHistory
        
        // Estimate option price by making API request.
        const optionOrderParams: OptionOrderParams = {
            quantity: 2.0, // 2.0 contracts
            ...option,
            orderType: OrderType.LONG_OPEN
        }
        const estimatedOptionPrice = await arrowsdk.estimateOptionPrice(optionOrderParams, version)

        // Prepare the order parameters.
        // Below, we set a threshold price for which any higher (for option buy) or lower (for option sell) price will be rejected in the option order.
        // For this example, we choose to set our thresholdPrice to be equal to the estimatedOptionPrice.
        optionOrderParams.thresholdPrice = estimatedOptionPrice

        // Prepare the option order parameters
        const deliverOptionParams: DeliverOptionParams = await arrowsdk.prepareDeliverOptionParams(optionOrderParams, version, wallet)
        
        // Get computed option chain address
        const optionChainAddress = await arrowsdk.computeOptionChainAddress(option.ticker, option.expiration, version)

        // Approval circuit if the order is a "buy" order
        if (deliverOptionParams.orderType === OrderType.LONG_OPEN) {
            // Get user's balance of stablecoin
            const userBalance = await stablecoin.balanceOf(wallet.address)

            // If user's balance is less than the amount required for the approval, throw an error
            if (userBalance.lt(deliverOptionParams.amountToApprove)) {
                throw new Error('You do not have enough stablecoin to pay for your indicated threshold price.')
            }

            // Get the amount that the option chain proxy is currently approved to spend
            let approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
            // If the approved amount is less than the amount required to be approved, ask user to approve the proper amount
            if (approvedAmount.lt(deliverOptionParams.amountToApprove)) {
                // Wait for the approval to be confirmed on-chain
                await (await stablecoin.approve(optionChainAddress, deliverOptionParams.amountToApprove)).wait(3)

                // Get the amount that the option chain proxy is approved to spend now
                approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
                // If the newly approved amount is still less than the amount required to be approved, throw and error
                if (approvedAmount.lt(deliverOptionParams.amountToApprove)) {
                    throw new Error('Approval to option chain failed.')
                }
            }
        }

        // Submit order to API and get response
        const { tx_hash, execution_price } = await arrowsdk.submitOptionOrder(deliverOptionParams, version)
        
        // Expectations
        expect(tx_hash).toBeDefined()
        expect(typeof(tx_hash)).toBe('string')
        expect(execution_price).toBeDefined()
        expect(typeof(execution_price)).toBe('number')
    })
})