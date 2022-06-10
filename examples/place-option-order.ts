// We use dotenv to retrieve the PRIVATE_KEY of the account with which the example order will be placed
// but this does not have to be the way that you choose to inject your own private key into this example code.
require('dotenv').config()

// Imports
import axios from 'axios'
import {
    VERSION,
    Option,
    OptionOrderParams,
    computeOptionChainAddress,
    prepareDeliverOptionParams,
    getStablecoinContract,
    providers,
    estimateOptionPrice,
    submitOptionOrder,
    DeliverOptionParams,
    getCurrentTimeUTC,
    getReadableTimestamp
} from '../lib/src/arrow-sdk'
import { ethers } from 'ethers'

// Get wallet using private key from .env file
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, providers.fuji)

async function main() {
    // Specify version
    const version = VERSION.V3

    // Get stablecoin contract from Arrow
    const stablecoin = await getStablecoinContract(wallet, version)

    // A constant indicating how many block confirmations
    // to wait after submitting transactions to the blockchain
    const numBlockConfirmations = 2

    // Calculate a future expiration (as a UNIX timestamp)
    // expirations must always be at 9:00 PM UTC
    const twoWeeksFromNow = getCurrentTimeUTC().momentTimestamp
                                    .add(2, 'weeks')
                                    .set('hour', 21)
                                    .set('minute', 0)
                                    .set('second', 0)
                                    .unix()
    // Convert Unix timestamp to readable date string for use with Arrow
    const readableExpiration = getReadableTimestamp(twoWeeksFromNow * 1000) // MM is month, DD is day, and YYYY is year

    // Option order parameters
    const buyFlag = true // True if buying, false if selling
    const option: Option = {
        "ticker": "AVAX", // Ticker for Avalanche token
        "expiration": readableExpiration, // Two weeks from now at 9:00 PM UTC
        "strike": [87.02, 0.0], // Long strike of $87.02 (note that the ordering of the strikes in v3 is always [long, short] for spreads and always [long, 0] for naked calls/puts)
        "contractType": 1, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
        "quantity": 2, // 2 contracts
    }

    // Get 12 weeks of price history from CoinGecko
    const cryptoId = 'avalanche-2' // Assuming AVAX ticker. Please refer to CoinGecko's documentation for other IDs
    const priceData = await axios.get(`https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart?vs_currency=usd&days=84`) // 12 weeks * 7 days per week = 84 days
    option.underlierPriceHistory = priceData.data.prices.map((priceArr: number[]) => priceArr[1]) // Extract the prices out of the (timestamp, price) tuples

    // Estimate option price by making API request
    const estimatedOptionPrice = await estimateOptionPrice(option, version)

    // Prepare the order parameters
    const optionOrderParams: OptionOrderParams = {
        buyFlag,
        ...option,

        // Below we set a threshold price for which any higher (for option buy) or lower (for option sell) price will be rejected in the option order
        // For this example, we choose to set our thresholdPrice to be equal to the estimatedOptionPrice
        thresholdPrice: estimatedOptionPrice
    }
    const deliverOptionParams: DeliverOptionParams = await prepareDeliverOptionParams(optionOrderParams, wallet, version)

    // Get computed option chain address
    const optionChainAddress = await computeOptionChainAddress(option.ticker, option.expiration, version)

    // Approval circuit if the order is a "buy" order
    if (deliverOptionParams.buyFlag) {
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
            await (await stablecoin.approve(optionChainAddress, deliverOptionParams.amountToApprove)).wait(numBlockConfirmations)

            // Get the amount that the option chain proxy is approved to spend now
            approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
            // If the newly approved amount is still less than the amount required to be approved, throw and error
            if (approvedAmount.lt(deliverOptionParams.amountToApprove)) {
                throw new Error('Approval to option chain failed.')
            }
        }
    }

    // Submit order to API and get response
    const {
        tx_hash, execution_price
    } = await submitOptionOrder(deliverOptionParams, version)

    console.log("Transaction hash:", tx_hash) // Transaction has of option order on Arrow
    console.log("Execution price:", execution_price) // The price the user ended up paying for each option in their order
}
main()