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
    GetRecommendedStrategiesResponse,
    Greeks,
    Interval,
    OptionContract,
    OptionOrderParams,
    OrderType,
    ProtectionType,
    StrategyType,
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
    prepareDeliverOptionParams,
    getReadableContractType
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
 * Get a recommended options from our server given some option parameters and a price forecast.
 *
 * @param ticker Ticker of the underlying asset.
 * @param strategyType: The type of user strategy,
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @param forecast Forecasted price of underlying asset.
 * @param spotPrice Most up-to-date price of underlying asset.
 * @param priceHistory Prices of underlying asset over some period of history.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns An array of recommended options.
 */

export async function getRecommendedStrategies(
  ticker: Ticker,
  strategyType: StrategyType,
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
        const recommendedOptionResponse = await axios.post<GetRecommendedStrategiesResponse>(
            urls.api[version] + "/get-recommended-option",
            {
                ticker: ticker,
                strategy_type: strategyType,
                expiration: readableExpiration,
                forecast: forecast,
                spot_price: spotPrice,
                price_history: priceHistory
            }
        )
        const parsedOptions = recommendedOptionResponse.data.strategies.map(optionSet => {
            return optionSet.map(option => {
                return {
                    ticker: ticker,
                    expiration: option.expiration,
                    strike: option.strike,
                    price: option.price,
                    type: getReadableContractType(option.contract_type, option.order_type),
                    orderType: option.order_type
                }
            })
        })
        return parsedOptions
    } catch (error) {
        throw error
    }
}

/**
 * Get a hedging strategy from our server given a lower price bound, an upper price bound, and a protection type.
 *
 * @param ticker Ticker of the underlying asset.
 * @param strategyType: The type of user strategy,
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @param lowerBound The lower price bound a user wants to protect against.
 * @param upperBound The upper price bound a user wants to protect against.
 * @param protectionType The type of protection a user wants to use (Full or Partial)
 * @param spotPrice  Most up-to-date price of underlying asset.
 * @param priceHistory Prices of underlying asset over some period of history.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns An array of recommended options.
 */

export async function getHedgingStrategy(
  ticker: Ticker,
  strategyType: StrategyType,
  readableExpiration: string,
  lowerBound: number,
  upperBound: number | undefined = undefined,
  protectionType: ProtectionType | undefined = undefined,
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
        const recommendedOptionResponse = await axios.post<GetRecommendedStrategiesResponse>(
            urls.api[version] + "/get-recommended-option",
            {
                ticker: ticker,
                strategy_type: strategyType,
                expiration: readableExpiration,
                lower_bound: lowerBound,
                upper_bound: upperBound,
                protection_type: protectionType, 
                spot_price: spotPrice,
                price_history: priceHistory
            }
        )
         const parsedOptions = recommendedOptionResponse.data.strategies.map(optionSet => {
            return optionSet.map(option => {
                return {
                    ticker: ticker,
                    expiration: option.expiration,
                    strike: option.strike,
                    price: option.price,
                    type: getReadableContractType(option.contract_type, option.order_type),
                    orderType: option.order_type
                }
            })
        })
        return parsedOptions
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
 * Submit multiple option orders to the API to compute the live price and submit a transaction to the blockchain.
 *
 * @param deliverOptionParams[] Array of objects containing parameters necessary to create an option order on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns Data object from API response that includes transaction hash and per-option execution price of the option transaction.
 */
export async function submitLongOptionOrder(
    deliverOptionParams: DeliverOptionParams[],
    version = DEFAULT_VERSION
) {
    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    // Submit multiple option orders through API
    let params: any[] = []
    
    deliverOptionParams.map(order => {
        params.push(
        {
            'ticker': order.ticker,
            'expiration': order.expiration,
            'strike': order.formattedStrike,
            'contract_type': order.contractType,
            'quantity': order.quantity,
            'threshold_price': order.bigNumberThresholdPrice.toString(),
            'hashed_params': order.hashedValues,
            'signature': order.signature
        })
    })

    const apiEndPoint = deliverOptionParams[0].orderType === OrderType.LONG_OPEN ? '/open-long-position' : '/close-long-position'
    const orderSubmissionResponse = await axios.post(
        urls.api[version] + apiEndPoint,
        {
            'params': params!
        }
    )

    // Return all data from response
    return orderSubmissionResponse.data
}

/**
 * Submit a short option order to the API to compute the live price and submit a transaction to the blockchain.
 *
 * @param deliverOptionParams Object containing parameters necessary to create an option order on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns Data object from API response that includes transaction hash and per-option execution price of the option transaction.
 */
export async function submitShortOptionOrder(
    deliverOptionParams: DeliverOptionParams[],
    version = DEFAULT_VERSION
) {
    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    // Submit multiple option orders through API
    let params: any[] = []

    deliverOptionParams.map(order => {
        params.push(
        {
            'ticker': order.ticker,
            'expiration': order.expiration,
            'strike': order.formattedStrike,
            'contract_type': order.contractType,
            'quantity': order.quantity,
            'threshold_price': order.bigNumberThresholdPrice.toString(),
            'hashed_params': order.hashedValues,
            'signature': order.signature
        })
    })

    const orderEndpoint = deliverOptionParams[0].orderType === 2 ? "/open-short-position" : "/close-short-position"
    const orderSubmissionResponse = await axios.post(
        urls.api[version] + orderEndpoint,
        {   
            'params': params
        }
    )

    return orderSubmissionResponse.data
    
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
    getRecommendedStrategies,
    getHedgingStrategy,
    getStrikeGrid,
    submitLongOptionOrder,
    submitShortOptionOrder,

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