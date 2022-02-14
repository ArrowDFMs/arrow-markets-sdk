// We use dotenv to retrieve the PRIVATE_KEY of the account with which the example order will be placed
// but this does not have to be the way that you inject your own private key into this example code.
require('dotenv').config()

import axios from 'axios'
import {
    contracts,
    provider,
    urls
} from '../arrow-sdk'
import { ethers } from 'ethers'
import moment from 'moment'

import { IERC20Metadata } from '../abis'
import { ArrowOptionChainProxy } from '../build'

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)

async function main() {
    // Get stablecoin contract
    const stablecoin = new ethers.Contract(
        await contracts.router.getStablecoinAddress(),
        IERC20Metadata,
        wallet
    )
    // Get decimals for stablecoin
    const decimals = await stablecoin.decimals()

    // A constant indicating how many block confirmations
    // to wait after submitting transactions to the blockchain
    const numBlockConfirmations = 2

    // Calculate a future expiration (as a UNIX timestamp)
    // expirations must always be at 9:00 PM UTC
    const twoWeeksFromNow = moment().utc()
                                    .add(2, 'weeks')
                                    .set('hour', 21)
                                    .set('minute', 0)
                                    .set('second', 0)
                                    .unix()

    // Option order parameters
    const buyFlag = true
    const option = {
        "ticker": "AVAX", // Ticker for Avalanche token
        "expiration": twoWeeksFromNow, // Two weeks from now at 9:00 PM UTC
        "decimalStrike": "87.02", // Strike of $87.02
        "contractType": 0, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
        "quantity": 2 // 2 contracts
    }
    // Convert Unix timestamp to readable date string
    const readableExpiration = moment.utc(option.expiration * 1000).format('MMDDYYYY') // MM is month, DD is day, and YYYY is year

    // Get 12 weeks of price history from CoinGecko
    const cryptoId = 'avalanche-2' // Assuming AVAX ticker. Please refer to CoinGecko's documentation for other IDs
    const priceData = await axios.get(`https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart?vs_currency=usd&days=84`) // 12 weeks * 7 days per week = 84 days
    const priceHistory = priceData.data.prices.map(priceArr => priceArr[1]) // Extract the prices out of the (timestamp, price) tuples

    // Estimate option price by making API request
    const estimatedOptionPriceReponse = await axios.post(urls.api + '/estimate-option-price', {
        "ticker": option.ticker,
        "expiration": readableExpiration, // API only takes in readable expirations so it can manually set the expiration at 9:00 PM UTC
        "strike": option.decimalStrike,
        "contract_type": option.contractType,
        "quantity": option.quantity,
        "price_history": priceHistory
    })
    const estimatedOptionPrice = estimatedOptionPriceReponse.data.option_price
    // Set a threshold price for which any higher (for option buy) or lower (for option sell) price will be rejected in the option order
    // For this example, let's use an ethers BigNumber form of estimatedOptionPrice (estimatedOptionPrice * 10**stablecoinDecimals)
    const thresholdPrice = ethers.utils.parseUnits(estimatedOptionPrice.toString(), decimals)

    // Hash and sign the option order parameters for on-chain verification
    const hashedValues = ethers.utils.solidityKeccak256(
        [
            'bool', // buy_flag - Boolean to indicate whether this is a buy (true) or sell (false).
            'string', // ticker - String to indicate a particular asset ("AVAX", "ETH", "BTC", or "LINK").
            'uint256', // expiration - Date in Unix timestamp. Must be 9:00 PM UTC (e.g. 1643144400 for January 25th, 2022)
            'uint256', // readableExpiration - Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
            'uint256', // strike - Ethers BigNumber version of the strike in terms of the stablecoin's decimals (e.g. ethers.utils.parseUnits(strike, await usdc_e.decimals())).
            'string', // decimalStrike - String version of the strike that includes the decimal places (e.g. "12.25").
            'uint256', // contract_type - 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
            'uint256', // quantity - Number of contracts desired in the order.
            'uint256' // threshold_price - Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
        ],
        [
            buyFlag,
            option.ticker,
            option.expiration,
            readableExpiration,
            ethers.utils.parseUnits(option.decimalStrike, decimals), // option.decimalStrike * 10**stablecoinDecimals
            option.decimalStrike,
            option.contractType,
            option.quantity,
            thresholdPrice
        ]
    )
    const signature = await wallet.signMessage(ethers.utils.arrayify(hashedValues)) // Note that we are signing a message, not a transaction

    // Get chain factory contract address from router
    const chainFactoryAddress = await contracts.router.getChainFactoryAddress()
    // Build salt for CREATE2
    const salt = ethers.utils.solidityKeccak256(
        ['address', 'string', 'uint256'],
        [chainFactoryAddress, option.ticker, readableExpiration]
    )
    // Get bytecode hash from ArrowOptionChainProxy
    const bytecodeHash = ethers.utils.solidityKeccak256(
        ['bytes'],
        [ArrowOptionChainProxy.bytecode]
    )
    // Compute option chain proxy address using CREATE2
    const optionChainAddress = ethers.utils.getCreate2Address(
        chainFactoryAddress,
        salt,
        bytecodeHash
    )
    // Approval circuit if the order is a "buy" order
    if (buyFlag) {
        // Get user's balance of stablecoin
        const userBalance = await stablecoin.balanceOf(wallet.address)
        // Calculate amount to approve for this order (total = thresholdPrice * quantity)
        const amountToApprove = ethers.BigNumber.from(thresholdPrice).mul(option.quantity)

        // If user's balance is less than the amount required for the approval, throw an error
        if (userBalance.lt(amountToApprove)) {
            throw new Error('You do not have enough stablecoin to pay for your indicated threshold price.')
        }

        // Get the amount that the option chain proxy is currently approved to spend
        let approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
        // If the approved amount is less than the amount required to be approved, ask user to approve the proper amount
        if (approvedAmount.lt(amountToApprove)) {
            // Wait for the approval to be confirmed on-chain
            await (await stablecoin.approve(optionChainAddress, amountToApprove)).wait(numBlockConfirmations)

            // Get the amount that the option chain proxy is approved to spend now
            approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
            // If the newly approved amount is still less than the amount required to be approved, throw and error
            if (approvedAmount.lt(amountToApprove)) {
                throw new Error('Approval to option chain failed.')
            }
        }
    }



    // Submit option order through API
    const {
        data: { tx_hash, execution_price }
    } = await axios.post(urls.api + '/submit-order', {
        buy_flag: buyFlag,
        ticker: option.ticker,
        expiration: readableExpiration,
        strike: option.decimalStrike,
        contract_type: option.contractType,
        quantity: option.quantity,
        threshold_price: thresholdPrice.toString(),
        hashed_params: hashedValues,
        signature: signature
    })

    console.log("Transaction hash:", tx_hash) // Transaction has of option order on Arrow
    console.log("Execution price:", execution_price) // The price the user ended up paying for each option in their order
}
main()