// We use dotenv to retrieve the PRIVATE_KEY of the account with which the example order will be placed
// but this does not have to be the way that you inject your own private key into this example code.
require('dotenv').config()

import axios from 'axios'
import {
    computeOptionChainAddress,
    prepareDeliverOptionParams,
    getStablecoinContract,
    providers,
    urls,
    settleOptions
} from '../arrow-sdk'
import { ethers } from 'ethers'
import moment from 'moment'

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, providers.fuji)

async function main() {
    // Specify version
    const version = 'v3'

    // Get stablecoin contract from Arrow
    const stablecoin = await getStablecoinContract(wallet, version)

    // A constant indicating how many block confirmations
    // to wait after submitting transactions to the blockchain
    const numBlockConfirmations = 2

    // Calculate a future expiration (as a UNIX timestamp)
    // expirations must always be at 9:00 PM UTC
    const twoWeeksFromNow = moment().utc()
                                    .add(4, 'weeks')
                                    .set('hour', 21)
                                    .set('minute', 0)
                                    .set('second', 0)
                                    .unix()
    // Convert Unix timestamp to readable date string
    const readableExpiration = moment.utc(twoWeeksFromNow * 1000).format('MMDDYYYY') // MM is month, DD is day, and YYYY is year

    // Option order parameters
    const buyFlag = true
    const option = {
        "ticker": "AVAX", // Ticker for Avalanche token
        "expiration": readableExpiration, // Two weeks from now at 9:00 PM UTC
        "strike": [87.02, 88.00], // Strike of $87.02
        "contractType": 2, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
        "quantity": 2, // 2 contracts
        "priceHistory": []
    }

    // Get 12 weeks of price history from CoinGecko
    const cryptoId = 'avalanche-2' // Assuming AVAX ticker. Please refer to CoinGecko's documentation for other IDs
    const priceData = await axios.get(`https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart?vs_currency=usd&days=84`) // 12 weeks * 7 days per week = 84 days
    option.priceHistory = priceData.data.prices.map(priceArr => priceArr[1]) // Extract the prices out of the (timestamp, price) tuples

    // Estimate option price by making API request
    const estimatedOptionPriceReponse = await axios.post(urls.api[version] + '/estimate-option-price', {
        "ticker": option.ticker,
        "expiration": option.expiration, // API only takes in readable expirations so it can manually set the expiration at 9:00 PM UTC
        "strike": option.strike.join('|'),
        "contract_type": option.contractType,
        "quantity": option.quantity,
        "price_history": option.priceHistory
    })
    const estimatedOptionPrice = parseFloat(estimatedOptionPriceReponse.data.option_price.toFixed(6))
    // Set a threshold price for which any higher (for option buy) or lower (for option sell) price will be rejected in the option order
    // For this example, we will use an ethers BigNumber form of estimatedOptionPrice (estimatedOptionPrice * 10**stablecoinDecimals)

    // Hash and sign the option order parameters for on-chain verification
    const optionOrderParams = {
        buyFlag,
        ...option,
        thresholdPrice: estimatedOptionPrice
    }
    const deliverOptionParams = await prepareDeliverOptionParams(optionOrderParams, wallet, version)

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



    // Submit option order through API
    const {
        data: { tx_hash, execution_price }
    } = await axios.post(urls.api[version] + '/submit-order', {
        buy_flag: deliverOptionParams.buyFlag,
        ticker: option.ticker,
        expiration: option.expiration,
        strike: deliverOptionParams.formattedStrike,
        contract_type: option.contractType,
        quantity: option.quantity,
        threshold_price: deliverOptionParams.bigNumberThresholdPrice.toString(),
        hashed_params: deliverOptionParams.hashedValues,
        signature: deliverOptionParams.signature
    })

    console.log("Transaction hash:", tx_hash) // Transaction has of option order on Arrow
    console.log("Execution price:", execution_price) // The price the user ended up paying for each option in their order
}
main()