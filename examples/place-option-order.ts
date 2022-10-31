// We use dotenv to retrieve the PRIVATE_KEY of the account with which the example order will be placed
// but this does not have to be the way that you choose to inject your own private key into this example code.
import dotenv from "dotenv"
dotenv.config()
import ERC20ABI from '../build/ERC20.json'
// Imports
import {
    ContractType,
    DeliverOptionParams,
    OptionContract,
    OptionOrderParams,
    OrderType,
    Ticker,
    Version
} from "../lib/src/types"
import arrowsdk from "../lib/src/arrow-sdk"
import { ethers } from "ethers"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(utc)
dayjs.extend(customParseFormat)

// Get wallet using private key from .env file
const wallet = new ethers.Wallet('59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', arrowsdk.providers.fuji)

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
        ticker: Ticker.ETH,
        expiration: readableExpiration, // The next nearest friday from today
        strike: [1000,0], // Note that the ordering of the strikes is always [long, short] for spreads and always [long, 0] for single calls/puts
        contractType: ContractType.PUT, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread
    }
    
    // Get current price of underlying asset from Binance/CryptoWatch and 12 weeks of price history from CoinGecko.
    option.spotPrice = await arrowsdk.getUnderlierSpotPrice(option.ticker)
    option.priceHistory = (await arrowsdk.getUnderlierMarketChart(option.ticker)).priceHistory
    
    // Estimate option price by making API request.
    const optionOrderParams: OptionOrderParams = {
        quantity: 1.0, // 2.0 contracts
        ...option,
        orderType: OrderType.SHORT_OPEN
    }
    const estimatedOptionPrice = await arrowsdk.estimateOptionPrice(optionOrderParams, version)
    console.log('optionOrderParams',optionOrderParams)
    console.log('version',version)
    console.log('estimatedOptionPrice is', estimatedOptionPrice)

    // Prepare the order parameters.
    // Below, we set a threshold price for which any higher (for option buy) or lower (for option sell) price will be rejected in the option order.
    // For this example, we choose to set our thresholdPrice to be equal to the estimatedOptionPrice.
    optionOrderParams.thresholdPrice = estimatedOptionPrice - (estimatedOptionPrice * 0.02)

    // Prepare the option order parameters
    const deliverOptionParams: DeliverOptionParams = await arrowsdk.prepareDeliverOptionParams(optionOrderParams, version, wallet)
    console.log('deliverOptionParams', deliverOptionParams)
    // // Get computed option chain address
    const shortAggregatorAddress = await arrowsdk.computeShortAggregatorAddress(option.ticker, version)
    console.log('shortAggregatorAddress',shortAggregatorAddress)
    
    // Approval circuit if the order is a "buy" order
    if (deliverOptionParams.orderType === OrderType.LONG_OPEN || deliverOptionParams.orderType === OrderType.SHORT_OPEN) {
        // Get user's balance of stablecoin
        const userBalance = await stablecoin.balanceOf(wallet.address)
        console.log('stablecoin addrs', stablecoin.address)
       const ausd = new ethers.Contract(
        await stablecoin.address,
        ERC20ABI.abi,
        wallet
      );
    //  await (await ausd.allocateTo(wallet.address, ethers.utils.parseUnits('1000000', await stablecoin.decimals()))).wait(numBlockConfirmations)
     
        console.log('ausd', ausd)
        console.log('userBalance', userBalance)
        console.log('stablecoin', stablecoin.address)
        console.log('to approve', deliverOptionParams.amountToApprove)
        // If user's balance is less than the amount required for the approval, throw an error
        if (userBalance.lt(deliverOptionParams.amountToApprove)) {
            throw new Error('You do not have enough stablecoin to pay for your indicated threshold price.')
        }

        // Get the amount that the option chain proxy is currently approved to spend
        let approvedAmount = await stablecoin.allowance(wallet.address, shortAggregatorAddress)
        console.log('approvedAmount', approvedAmount)
        console.log('Need to approve', (deliverOptionParams.amountToApprove))
        console.log('needs approval ?', approvedAmount.lt(deliverOptionParams.amountToApprove))

        // If the approved amount is less than the amount required to be approved, ask user to approve the proper amount
        if (approvedAmount.lt(deliverOptionParams.amountToApprove)) {
            console.log('In Here')
            // Wait for the approval to be confirmed on-chain
            await (await stablecoin.approve(shortAggregatorAddress, deliverOptionParams.amountToApprove)).wait(numBlockConfirmations)
            
            // Get the amount that the option chain proxy is approved to spend now
            approvedAmount = await stablecoin.allowance(wallet.address, shortAggregatorAddress)
            console.log('new approvedAmount', approvedAmount)
            // If the newly approved amount is still less than the amount required to be approved, throw and error
            if (approvedAmount.lt(ethers.utils.parseUnits((deliverOptionParams.amountToApprove).toString()))) {
                throw new Error('Approval to option chain failed.')
            }
        }
    }
    console.log('about to submit');
    // Submit order to API and get response
    const { tx_hash, execution_price } = await arrowsdk.submitOptionOrder(deliverOptionParams, Version.V4)

    console.log("Transaction hash:", tx_hash) // Transaction has of option order on Arrow
    console.log("Execution price:", execution_price) // The price the user ended up paying for each option in their order
}
main()