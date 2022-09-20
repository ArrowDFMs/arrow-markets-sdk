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
    Option,
    OrderType,
    Ticker,
    Version
} from "./types"

// Constants
import {
    addresses,
    providers,
    UNSUPPORTED_VERSION_ERROR,
    urls
} from "./constants"

// Helpers
import {
    computeOptionChainAddress,
    getCurrentTimeUTC,
    getEventsContract,
    getExpirationTimestamp,
    getReadableTimestamp,
    getRegistryContract,
    getRouterContract,
    getStablecoinContract,
    getTimeUTC,
    getUnderlierPriceAndHistory,
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
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns Float that represents an estimate of the option price using Arrow's pricing model.
 */
export async function estimateOptionPrice(
    option: Option,
    version = Version.V3
): Promise<number> {
    // Take strike array and convert into string with format "longStrike|shortStrike"
    const strike = option.strike.join("|")

    const {
        priceHistory,
        spotPrice
    } = await getUnderlierPriceAndHistory(option.ticker)

    const estimatedOptionPriceResponse = await axios.post(
        urls.api[version] + "/estimate-option-price",
        {
            order_type: option.orderType,
            ticker: option.ticker,
            expiration: option.expiration, // API only takes in readable expirations so it can manually set the UNIX expiration
            strike: strike,
            contract_type: option.contractType,
            quantity: option.quantity,
            price_history: priceHistory,
            spot_price: spotPrice
        }
    )

    const estimatedOptionPrice = parseFloat(
        estimatedOptionPriceResponse.data.option_price.toFixed(6)
    )

    return estimatedOptionPrice
}

/**
 * Get an estimated price and the greeks for a given option using Arrow's pricing model.
 *
 * @param option Object containing parameters that define an option on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns JSON object that contains an estimate of the option price using Arrow's pricing model as well as the greeks associated with the specified option.
 */
export async function estimateOptionPriceAndGreeks(
    option: Option,
    version = Version.V3
): Promise<Record<string, any>> {
    // Take strike array and convert into string with format "longStrike|shortStrike"
    const strike = option.strike.join("|")

    const {
        priceHistory,
        spotPrice
    } = await getUnderlierPriceAndHistory(option.ticker)

    const estimatedOptionPriceResponse = await axios.post(
        urls.api[version] + "/estimate-option-price",
        {
            order_type: option.orderType,
            ticker: option.ticker,
            expiration: option.expiration, // API only takes in readable expirations so it can manually set the UNIX expiration
            strike: strike,
            contract_type: option.contractType,
            quantity: option.quantity,
            spot_price: spotPrice,
            price_history: priceHistory,
        }
    )

    const estimatedOptionPrice = parseFloat(
        estimatedOptionPriceResponse.data.option_price.toFixed(6)
    )
    const greeks: Greeks = estimatedOptionPriceResponse.data.greeks

    return { estimatedOptionPrice, greeks }
}

/**
 * Get a recommended option from our server given some option parameters and a price forecast.
 *
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @param forecast Forecasted price of underlying asset.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns Option object with optional price and greeks parameters populated.
 */

export async function getRecommendedOption(
  ticker: Ticker,
  readableExpiration: string,
  forecast: number,
  version = Version.V3
) {
    const {
        spotPrice,
        priceHistory
    } = await getUnderlierPriceAndHistory(ticker)

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

        const recommendedOption: Option = {
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
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @param contractType // 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns Array of Option objects with optional price and greeks parameters populated.
 */
export async function getStrikeGrid(
  order_type: number,
  ticker: Ticker,
  readableExpiration: string,
  contractType: number,
  version = Version.V3
) {
    const {
        spotPrice,
        priceHistory
    } = await getUnderlierPriceAndHistory(ticker)

    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    const strikeGridResponse = await axios.post(
        urls.api[version] + "/get-strike-grid",
        {
            order_type: order_type,
            ticker: ticker,
            expiration: readableExpiration,
            contract_type: contractType,
            spot_price: spotPrice,
            price_history: priceHistory
        }
    )

    const strikeGrid = []
    for (let i = 0; i < strikeGridResponse.data.options.length; i++) {
        const strikeGridOption = strikeGridResponse.data.options[i]
        const option: Option = {
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
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns Data object from API response that includes transaction hash and per-option execution price of the option transaction.
 */
export async function submitOptionOrder(
    deliverOptionParams: DeliverOptionParams,
    version = Version.V3
) {
    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

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

/***************************************
 *       CONTRACT FUNCTION CALLS       *
 ***************************************/

/**
 * Call smart contract function to settle options for a specific option chain on Arrow.
 *
 * @param wallet Wallet with which you want to call the option settlement function.
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable expiration in the "MMDDYYYY" format.
 * @param owner Address of the option owner for whom you are settling.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 */
export async function settleOptions(
  wallet: ethers.Wallet | ethers.Signer,
  ticker: Ticker,
  readableExpiration: string,
  owner = undefined,
  version = Version.V3
) {
    const router = getRouterContract(wallet, version)

    switch (version) {
        case Version.V3:
        case Version.COMPETITION:
            try {
                await router.callStatic.settleOptions(
                    owner,
                    ticker,
                    readableExpiration
                )
                await router.settleOptions(owner, ticker, readableExpiration)
            } catch (err) {
                throw new Error("Settlement call would fail on chain.")
            }
            break
        default:
            throw UNSUPPORTED_VERSION_ERROR // Never reached because of the check in `getRouterContract`
    }
}

/***************************************
 *           DEFAULT EXPORTS           *
 ***************************************/

const arrowsdk = {
    // Variables
    urls,
    providers,
    addresses,

    // Types
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
    getUnderlierPriceAndHistory,

    // API functions
    estimateOptionPrice,
    getRecommendedOption,
    getStrikeGrid,
    submitOptionOrder,

    // Blockchain functions
    computeOptionChainAddress,
    getEventsContract,
    getRegistryContract,
    getRouterContract,
    getStablecoinContract,
    prepareDeliverOptionParams,
    settleOptions
}

export default arrowsdk