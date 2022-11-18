// We use dotenv to retrieve the PRIVATE_KEY of the account with which the example order will be placed
// but this does not have to be the way that you choose to inject your own private key into this example code.
import dotenv from "dotenv"
dotenv.config()

// Imports
import {
    ContractType,
    DeliverOptionParams,
    OptionContract,
    OptionOrderParams,
    OrderType,
    Ticker
} from "../lib/src/types"
import arrowsdk from "../lib/src/arrow-sdk"
import { ethers } from "ethers"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(utc)
dayjs.extend(customParseFormat)

// Get wallet using private key from .env file
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, arrowsdk.providers.fuji)

async function main() {
    // Specify version
    const version = arrowsdk.Version.V4

    // Get stablecoin contract from Arrow
    const stablecoin = await arrowsdk.getStablecoinContract(version, wallet)

    // A constant indicating how many block confirmations
    // to wait after submitting transactions to the blockchain
    const numBlockConfirmations = 2

    // Calculate a future expiration (as a UNIX timestamp).
    // Expirations must always be a Friday.
    const nextNearestFriday = dayjs.utc().add(1, 'week').set('day', 5)
    const readableExpiration = nextNearestFriday.format('MMDDYYYY')

    // Option order parameters
    const first_option: OptionContract = {
        ticker: Ticker.AVAX,
        expiration: readableExpiration, // The next nearest friday from today
        strike: [25.0, 0], // Note that the ordering of the strikes is always [long, short] for spreads and always [long, 0] for single calls/puts
        contractType: ContractType.CALL, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
    }
    
    // Get current price of underlying asset from Binance/CryptoWatch and 12 weeks of price history from CoinGecko.
    first_option.spotPrice = await arrowsdk.getUnderlierSpotPrice(first_option.ticker)
    first_option.priceHistory = (await arrowsdk.getUnderlierMarketChart(first_option.ticker)).priceHistory

    // Estimate option price by making API request.
    const first_optionOrderParams: OptionOrderParams = {
        quantity: 2.0, // 2.0 contracts
        ...first_option,
        orderType: OrderType.LONG_OPEN
    }

    // Option order parameters
    const second_option: OptionContract = {
        ticker: Ticker.AVAX,
        expiration: readableExpiration, // The next nearest friday from today
        strike: [87.02, 84.0], // Note that the ordering of the strikes is always [long, short] for spreads and always [long, 0] for single calls/puts
        contractType: ContractType.PUT_SPREAD, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
    }
    
    // Get current price of underlying asset from Binance/CryptoWatch and 12 weeks of price history from CoinGecko.
    second_option.spotPrice = await arrowsdk.getUnderlierSpotPrice(second_option.ticker)
    second_option.priceHistory = (await arrowsdk.getUnderlierMarketChart(second_option.ticker)).priceHistory
    
    // Estimate option price by making API request.
    const second_optionOrderParams: OptionOrderParams = {
        quantity: 2.0, // 2.0 contracts
        ...second_option,
        orderType: OrderType.LONG_OPEN
    }
    const firstOptionPrice = await arrowsdk.estimateOptionPrice(first_optionOrderParams, version)
    const secondOptionPrice = await arrowsdk.estimateOptionPrice(second_optionOrderParams, version)

    // Prepare the order parameters.
    // Below, we set a threshold price for which any higher (for option buy) or lower (for option sell) price will be rejected in the option order.
    // For this example, we choose to set our thresholdPrice to be equal to the estimatedOptionPrice.
    first_optionOrderParams.thresholdPrice = firstOptionPrice
    second_optionOrderParams.thresholdPrice = secondOptionPrice

    // Prepare the option order parameters
    const deliverOptionParams: DeliverOptionParams[] = await arrowsdk.prepareDeliverOptionParams([first_optionOrderParams,second_optionOrderParams], version, wallet)
    
    // Get computed option chain address

    // Approval circuit if the order is a "buy" order
    await Promise.all(
        await deliverOptionParams.map(async order =>  {
            const optionChainAddress = await arrowsdk.computeOptionChainAddress(order.ticker, order.expiration, version)

            if (
                order.orderType === OrderType.LONG_OPEN
            ) {
                    // Get user's balance of stablecoin
                    const userBalance = await stablecoin.balanceOf(wallet.address)

                    // If user's balance is less than the amount required for the approval, throw an error
                    if (userBalance.lt(order.amountToApprove)) {
                        throw new Error('You do not have enough stablecoin to pay for your indicated threshold price.')
                    }

                    // Get the amount that the option chain proxy is currently approved to spend
                    let approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
                    // If the approved amount is less than the amount required to be approved, ask user to approve the proper amount
                    if (
                        approvedAmount.lt(order.amountToApprove)
                    ) {
                        // Wait for the approval to be confirmed on-chain
                        await (await stablecoin.approve(optionChainAddress, order.amountToApprove)).wait(numBlockConfirmations)

                        // Get the amount that the option chain proxy is approved to spend now
                        approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
                        // If the newly approved amount is still less than the amount required to be approved, throw and error
                        if (approvedAmount.lt(order.amountToApprove)) {
                            throw new Error('Approval to option chain failed.')
                        }
                    }
                }
            }
        )
    )

    // Submit order to API and get response
    const { tx_hash, execution_price } = await arrowsdk.submitLongOptionOrder(deliverOptionParams, version)

    console.log("Transaction hash:", tx_hash) // Transaction has of option order on Arrow
    console.log("Execution price:", execution_price) // The price the user ended up paying for each option in their order
}
main()