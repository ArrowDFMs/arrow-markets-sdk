/*****************************
 *          IMPORTS          *
 *****************************/

// Packages
import axios from "axios"
import { ethers } from "ethers"

// Types
import {
    ContractType,
    Currency,
    DeliverOptionParams,
    Greeks,
    Interval,
    OptionContract,
    OptionOrderParams,
    OrderType,
    Ticker,
    Version
} from "./types"

// Constants
import {
    addresses,
    DEFAULT_VERSION,
    providers,
    UNSUPPORTED_VERSION_ERROR,
    urls
} from "./constants"

// Helpers
import {
    computeOptionChainAddress,
    computeShortAggregatorAddress,
    getCurrentTimeUTC,
    getEventsContract,
    getExpirationTimestamp,
    getReadableTimestamp,
    getRegistryContract,
    getRouterContract,
    getUnderlierAssetContract,
    getStablecoinContract,
    getTimeUTC,
    getUnderlierMarketChart,
    getUnderlierSpotPrice,
    getUnderlierSpotPriceAndMarketChart,
    isValidVersion,
    prepareDeliverOptionParams
} from "./utilities"


/***************************************
 *           ARROW API CALLS           *
 ***************************************/

/**
 * Get an estimated price for the given option parameters from Arrow's pricing model.
 *
 * @param option Object containing parameters that define an option on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns Float that represents an estimate of the option price using Arrow's pricing model.
 */
export async function estimateOptionPrice(
    optionOrderParams: OptionOrderParams,
    version = DEFAULT_VERSION
): Promise<number> {
    // Take strike array and convert into string with format "longStrike|shortStrike"
    const strike = optionOrderParams.strike.join("|")

    // Get spot price from optionOrderParams if it is included, otherwise get it from helper function
    let spotPrice = optionOrderParams.spotPrice
    if (spotPrice === undefined) {
        spotPrice = await getUnderlierSpotPrice(optionOrderParams.ticker)
    }

    // Get historical prices from optionOrderParams if they are included, otherwise, get them from helper function
    let priceHistory = optionOrderParams.priceHistory
    if (priceHistory === undefined) {
        const marketChart = await getUnderlierMarketChart(optionOrderParams.ticker)
        priceHistory = marketChart.priceHistory
    }
    
    const estimatedOptionPriceResponse = await axios.post(
        urls.api[version] + "/estimate-option-price",
        {
            order_type: optionOrderParams.orderType,
            ticker: optionOrderParams.ticker,
            expiration: optionOrderParams.expiration, // API only takes in readable expirations so it can manually set the UNIX expiration
            strike: strike,
            contract_type: optionOrderParams.contractType,
            quantity: optionOrderParams.quantity,
            spot_price: spotPrice,
            price_history: priceHistory.map(entry => entry.price)
        }
    )

    return estimatedOptionPriceResponse.data.option_price
}

/**
 * Get an estimated price and the greeks for a given option using Arrow's pricing model.
 *
 * @param option Object containing parameters that define an option on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns JSON object that contains an estimate of the option price using Arrow's pricing model as well as the greeks associated with the specified option.
 */
export async function estimateOptionPriceAndGreeks(
    optionOrderParams: OptionOrderParams,
    version = DEFAULT_VERSION
): Promise<Record<string, any>> {
    // Take strike array and convert into string with format "longStrike|shortStrike"
    const strike = optionOrderParams.strike.join("|")

    // Get spot price from optionOrderParams if it is included, otherwise get it from helper function
    let spotPrice = optionOrderParams.spotPrice
    if (spotPrice === undefined) {
        spotPrice = await getUnderlierSpotPrice(optionOrderParams.ticker)
    }

    // Get historical prices from optionOrderParams if they are included, otherwise, get them from helper function
    let priceHistory = optionOrderParams.priceHistory
    if (priceHistory === undefined) {
        const marketChart = await getUnderlierMarketChart(optionOrderParams.ticker)
        priceHistory = marketChart.priceHistory
    }

    const estimatedOptionPriceResponse = await axios.post(
        urls.api[version] + "/estimate-option-price",
        {
            order_type: optionOrderParams.orderType,
            ticker: optionOrderParams.ticker,
            expiration: optionOrderParams.expiration, // API only takes in readable expirations so it can manually set the UNIX expiration
            strike: strike,
            contract_type: optionOrderParams.contractType,
            quantity: optionOrderParams.quantity,
            spot_price: spotPrice,
            price_history: priceHistory.map(entry => entry.price),
        }
    )

    const estimatedOptionPrice = estimatedOptionPriceResponse.data.option_price
    const greeks: Greeks = estimatedOptionPriceResponse.data.greeks

    return { estimatedOptionPrice, greeks }
}

/**
 * Get a recommended option from our server given some option parameters and a price forecast.
 *
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @param forecast Forecasted price of underlying asset.
 * @param spotPrice // Most up-to-date price of underlying asset.
 * @param priceHistory // Prices of underlying asset over some period of history.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns Option object with optional price and greeks parameters populated.
 */

export async function getRecommendedOption(
  ticker: Ticker,
  readableExpiration: string,
  forecast: number,
  spotPrice: number | undefined = undefined,
  priceHistory: number[] | undefined = undefined,
  version = DEFAULT_VERSION
) {
    if (spotPrice === undefined) {
        spotPrice = await getUnderlierSpotPrice(ticker)
    }
    if (priceHistory === undefined) {
        priceHistory = (await getUnderlierMarketChart(ticker)).priceHistory.map(entry => entry.price)
    }

    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    try {
        const recommendedOptionResponse = await axios.post(
            urls.api[version] + "/get-recommended-option",
            {
                ticker: ticker,
                expiration: readableExpiration,
                forecast: forecast,
                spot_price: spotPrice,
                price_history: priceHistory
            }
        )

        const recommendedOption: OptionContract = {
            ticker: ticker,
            expiration: readableExpiration,
            strike: recommendedOptionResponse.data.option.strike,
            contractType: recommendedOptionResponse.data.option.contract_type,
            price: recommendedOptionResponse.data.option.price,
            greeks: recommendedOptionResponse.data.option.greeks
        }

        return recommendedOption
    } catch (error) {
        throw error
    }
}

/**
 * Get a strike grid given some option parameters.
 *
 * @param orderType Type of order the user is placing. 0 for long open, 1 for long close, 2 for short open, 3 for short close.
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @param contractType // 0 for call, 1 for put.
 * @param spotPrice // Most up-to-date price of underlying asset.
 * @param priceHistory // Prices of underlying asset over some period of history.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns Array of Option objects with optional price and greeks parameters populated.
 */
export async function getStrikeGrid(
  orderType: OrderType,
  ticker: Ticker,
  readableExpiration: string,
  contractType: ContractType.CALL | ContractType.PUT,
  spotPrice: number | undefined = undefined,
  priceHistory: number[] | undefined = undefined,
  version = DEFAULT_VERSION
): Promise<OptionContract[]> {
    if (spotPrice === undefined) {
        spotPrice = await getUnderlierSpotPrice(ticker)
    }
    if (priceHistory === undefined) {
        priceHistory = (await getUnderlierMarketChart(ticker)).priceHistory.map(entry => entry.price)
    }

    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    const strikeGridResponse = await axios.post(
        urls.api[version] + "/get-strike-grid",
        {
            order_type: orderType,
            ticker: ticker,
            expiration: readableExpiration,
            contract_type: contractType,
            spot_price: spotPrice,
            price_history: priceHistory
        }
    )

    const strikeGrid: OptionContract[] = []
    for (let i = 0; i < strikeGridResponse.data.options.length; i++) {
        const strikeGridOption = strikeGridResponse.data.options[i]
        const option: OptionContract = {
            ticker: ticker,
            expiration: readableExpiration,
            strike: strikeGridOption.strike,
            contractType: contractType,
            price: strikeGridOption.price,
            greeks: strikeGridOption.greeks
        }
        strikeGrid.push(option)
    }

    return strikeGrid
}

/**
 * Submit an option order to the API to compute the live price and submit a transaction to the blockchain.
 *
 * @param deliverOptionParams Object containing parameters necessary to create an option order on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns Data object from API response that includes transaction hash and per-option execution price of the option transaction.
 */
export async function submitOptionOrder(
    deliverOptionParams: DeliverOptionParams,
    version = DEFAULT_VERSION
) {
    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR
    
    if(
        deliverOptionParams.orderType === OrderType.SHORT_CLOSE && 
        deliverOptionParams.payPremium === undefined
    ) {
        throw new Error('Must provide all of the order parameters')
    }

    if(
        deliverOptionParams.orderType === OrderType.SHORT_CLOSE || 
        deliverOptionParams.orderType === OrderType.SHORT_OPEN
    ) {
        const orderEndpoint = deliverOptionParams.orderType === 2 ? "/open-short-position" : "/close-short-position"
        const orderSubmissionResponse = await axios.post(
            urls.api[version] + orderEndpoint,
            {   
                pay_premium: deliverOptionParams.payPremium,
                order_type: deliverOptionParams.orderType,
                ticker: deliverOptionParams.ticker,
                expiration: deliverOptionParams.expiration,
                strike: deliverOptionParams.formattedStrike,
                contract_type: deliverOptionParams.contractType,
                quantity: deliverOptionParams.quantity,
                threshold_price: deliverOptionParams.bigNumberThresholdPrice.toString(),
                hashed_params: deliverOptionParams.hashedValues,
                signature: deliverOptionParams.signature
            }
        )
        return orderSubmissionResponse.data
    } else {
        // Submit option order through API
        const orderSubmissionResponse = await axios.post(
            urls.api[version] + "/submit-order",
            {
                order_type: deliverOptionParams.orderType,
                ticker: deliverOptionParams.ticker,
                expiration: deliverOptionParams.expiration,
                strike: deliverOptionParams.formattedStrike,
                contract_type: deliverOptionParams.contractType,
                quantity: deliverOptionParams.quantity,
                threshold_price: deliverOptionParams.bigNumberThresholdPrice.toString(),
                hashed_params: deliverOptionParams.hashedValues,
                signature: deliverOptionParams.signature
            }
        )
        // Return all data from response
        return orderSubmissionResponse.data
    }
}

/***************************************
 *       CONTRACT FUNCTION CALLS       *
 ***************************************/

/**
 * Call smart contract function to settle options for a specific option chain on Arrow.
 *
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable expiration in the "MMDDYYYY" format.
 * @param owner Address of the option owner for whom you are settling.
 * @param wallet Wallet with which you want to call the option settlement function.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 */
export async function settleOptions(
  ticker: Ticker,
  readableExpiration: string,
  owner: string,
  wallet: ethers.Wallet | ethers.Signer,
  version = DEFAULT_VERSION
) {
    const router = getRouterContract(version, wallet)

    try {
        await router.callStatic.settleOptions(
            owner,
            ticker,
            readableExpiration
        )
    } catch (err) {
        throw new Error("Settlement call would fail on chain.")
    }

    // Send function call on-chain after `callStatic` success
    await router.settleOptions(owner, ticker, readableExpiration)
}

/***************************************
 *           DEFAULT EXPORTS           *
 ***************************************/

const arrowsdk = {
    // Variables
    urls,
    providers,
    addresses,

    // Enums
    ContractType,
    Currency,
    Interval,
    OrderType,
    Ticker,
    Version,

    // Helper functions
    isValidVersion,
    getCurrentTimeUTC,
    getExpirationTimestamp,
    getReadableTimestamp,
    getTimeUTC,
    getUnderlierMarketChart,
    getUnderlierSpotPrice,
    getUnderlierSpotPriceAndMarketChart,

    // API functions
    estimateOptionPrice,
    estimateOptionPriceAndGreeks,
    getRecommendedOption,
    getStrikeGrid,
    submitOptionOrder,

    // Blockchain functions
    computeOptionChainAddress,
    computeShortAggregatorAddress,
    getEventsContract,
    getRegistryContract,
    getRouterContract,
    getUnderlierAssetContract,
    getStablecoinContract,
    prepareDeliverOptionParams,
    settleOptions
}

export default arrowsdk