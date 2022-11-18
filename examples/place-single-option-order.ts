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
    const version = arrowsdk.Version.COMPETITION

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
    const estimatedOptionPrice = await arrowsdk.estimateOptionPrice(optionOrderParams, version)

    // Prepare the order parameters.
    // Below, we set a threshold price for which any higher (for option buy) or lower (for option sell) price will be rejected in the option order.
    // For this example, we choose to set our thresholdPrice to be equal to the estimatedOptionPrice.
    optionOrderParams.thresholdPrice = estimatedOptionPrice

    // Prepare the option order parameters
    const deliverOptionParams: DeliverOptionParams[] = await arrowsdk.prepareDeliverOptionParams([optionOrderParams], version, wallet)
    
    // Get computed option chain address
    const optionChainAddress = await arrowsdk.computeOptionChainAddress(option.ticker, option.expiration, version)

    // Approval circuit if the order is a "buy" order
    if (deliverOptionParams[0].orderType === OrderType.LONG_OPEN) {
        // Get user's balance of stablecoin
        const userBalance = await stablecoin.balanceOf(wallet.address)

        // If user's balance is less than the amount required for the approval, throw an error
        if (userBalance.lt(deliverOptionParams[0].amountToApprove)) {
            throw new Error('You do not have enough stablecoin to pay for your indicated threshold price.')
        }

        // Get the amount that the option chain proxy is currently approved to spend
        let approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
        // If the approved amount is less than the amount required to be approved, ask user to approve the proper amount
        if (approvedAmount.lt(deliverOptionParams[0].amountToApprove)) {
            // Wait for the approval to be confirmed on-chain
            await (await stablecoin.approve(optionChainAddress, deliverOptionParams[0].amountToApprove)).wait(numBlockConfirmations)

            // Get the amount that the option chain proxy is approved to spend now
            approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
            // If the newly approved amount is still less than the amount required to be approved, throw and error
            if (approvedAmount.lt(deliverOptionParams[0].amountToApprove)) {
                throw new Error('Approval to option chain failed.')
            }
        }
    }

    // Submit order to API and get response
    const { tx_hash, execution_price } = await arrowsdk.submitLongOptionOrder(deliverOptionParams, version)

    console.log("Transaction hash:", tx_hash) // Transaction has of option order on Arrow
    console.log("Execution price:", execution_price) // The price the user ended up paying for each option in their order
}
main()