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

describe('Arrow API Request Tests', () => {
    const nextNearestFriday = dayjs.utc().add(1, 'week').set('day', 5)
    const readableExpiration = nextNearestFriday.format('MMDDYYYY')

    test('Expects to estimate option price', async () => {
        // Option order parameters
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

        const estimatedOptionPrice = await arrowsdk.estimateOptionPrice(optionOrderParams, Version.V4)

        expect(typeof(estimatedOptionPrice)).toBe('number')
    })
    
    // test('Expects to get recommended option', async () => {
    //     const recommendedOption = await arrowsdk.getRecommendedOption(Ticker.AVAX, readableExpiration, 20)
        
    //     expect(recommendedOption).toBeDefined()
    // })

    // test('Expects to get strike grid', async () => {
    //     const strikeGrid = await arrowsdk.getStrikeGrid(0,Ticker.AVAX, readableExpiration, 0)
        
    //     expect(strikeGrid).toBeDefined()
    // })

    // test('Expects to submit option order', async () => {
    //     const wallet = new ethers.Wallet(
    //         '65acf45f04d6c793712caa5aba61a9e3d2f9194e1aae129f9ca6fe39a32d159f', // Public facing test account
    //         arrowsdk.providers.fuji
    //     )
    //     const version = Version.V4

    //     const stablecoin = await arrowsdk.getStablecoinContract(version, wallet)

    //     // Option order parameters
    //     const option: OptionContract = {
    //         ticker: Ticker.AVAX,
    //         expiration: readableExpiration, // The next nearest friday from today
    //         strike: [87.02, 84.0], // Note that the ordering of the strikes is always [long, short] for spreads and always [long, 0] for single calls/puts
    //         contractType: ContractType.PUT_SPREAD, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
    //     }
        
    //     // Get current price of underlying asset from Binance/CryptoWatch and 12 weeks of price history from CoinGecko.
    //     option.spotPrice = await arrowsdk.getUnderlierSpotPrice(option.ticker)
    //     option.priceHistory = (await arrowsdk.getUnderlierMarketChart(option.ticker)).priceHistory
        
    //     // Estimate option price by making API request.
    //     const optionOrderParams: OptionOrderParams = {
    //         quantity: 2.0, // 2.0 contracts
    //         ...option,
    //         orderType: OrderType.LONG_OPEN
    //     }
    //     const estimatedOptionPrice = await arrowsdk.estimateOptionPrice(optionOrderParams, version)

    //     // Prepare the order parameters.
    //     // Below, we set a threshold price for which any higher (for option buy) or lower (for option sell) price will be rejected in the option order.
    //     // For this example, we choose to set our thresholdPrice to be equal to the estimatedOptionPrice.
    //     optionOrderParams.thresholdPrice = estimatedOptionPrice

    //     // Prepare the option order parameters
    //     const deliverOptionParams: DeliverOptionParams = await arrowsdk.prepareDeliverOptionParams(optionOrderParams, version, wallet)
        
    //     // Get computed option chain address
    //     const optionChainAddress = await arrowsdk.computeOptionChainAddress(option.ticker, option.expiration, version)

    //     // Approval circuit if the order is a "buy" order
    //     if (deliverOptionParams.orderType === OrderType.LONG_OPEN) {
    //         // Get user's balance of stablecoin
    //         const userBalance = await stablecoin.balanceOf(wallet.address)

    //         // If user's balance is less than the amount required for the approval, throw an error
    //         if (userBalance.lt(deliverOptionParams.amountToApprove)) {
    //             throw new Error('You do not have enough stablecoin to pay for your indicated threshold price.')
    //         }

    //         // Get the amount that the option chain proxy is currently approved to spend
    //         let approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
    //         // If the approved amount is less than the amount required to be approved, ask user to approve the proper amount
    //         if (approvedAmount.lt(deliverOptionParams.amountToApprove)) {
    //             // Wait for the approval to be confirmed on-chain
    //             await (await stablecoin.approve(optionChainAddress, deliverOptionParams.amountToApprove)).wait(3)

    //             // Get the amount that the option chain proxy is approved to spend now
    //             approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
    //             // If the newly approved amount is still less than the amount required to be approved, throw and error
    //             if (approvedAmount.lt(deliverOptionParams.amountToApprove)) {
    //                 throw new Error('Approval to option chain failed.')
    //             }
    //         }
    //     }

    //     // Submit order to API and get response
    //     const { tx_hash, execution_price } = await arrowsdk.submitOptionOrder(deliverOptionParams, version)
        
    //     // Expectations
    //     expect(tx_hash).toBeDefined()
    //     expect(typeof(tx_hash)).toBe('string')
    //     expect(execution_price).toBeDefined()
    //     expect(typeof(execution_price)).toBe('string')
    // })
})