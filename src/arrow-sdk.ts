import axios from 'axios'
import { ethers } from 'ethers'

import * as constants from './utils/constants'
import contract from './utils/contract'
import * as arrow_interface from './utils/interfaces'
import utilities, { getExpirationTimestamp } from './utils/utilities'


/***************************************
 *           ARROW API CALLS           *
 ***************************************/

/**
 * Get an estimated price for the given option parameters from Arrow's pricing model.
 * 
 * @param option Object containing parameters that define an option on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Float that represents an estimate of the option price using Arrow's pricing model.
 */
export async function estimateOptionPrice(option: arrow_interface.Option, version: constants.VERSION = constants.VERSION.V2) {
    let strike = undefined
    switch(version) {
        case constants.VERSION.V2: 
            strike = option.strike
            break
        case constants.VERSION.V3:
        case constants.VERSION.COMPETITION: 
            strike = (option.strike as number[]).join('|')    
            break
        default:
            throw constants.UNSUPPORTED_VERSION_ERROR
    }

    const estimatedOptionPriceReponse = await axios.post(
        constants.urls.api[version] + '/estimate-option-price',
        {
            "ticker": option.ticker,
            "expiration": option.expiration, // API only takes in readable expirations so it can manually set the expiration at 9:00 PM UTC
            "strike": strike,
            "contract_type": option.contractType,
            "quantity": option.quantity,
            "price_history": option.underlierPriceHistory!
        }
    )
    const estimatedOptionPrice = parseFloat(estimatedOptionPriceReponse.data.option_price.toFixed(6))
    return estimatedOptionPrice
}

/**
 * Get a recommended option from our server given some option parameters and a price forecast.
 * 
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @param forecast Forecasted price of underlying asset.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Option object with optional price and greeks parameters populated.
 */
export async function getRecommendedOption(
    ticker: string,
    readableExpiration: string,
    forecast: number,
    version: constants.VERSION = constants.VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw constants.UNSUPPORTED_VERSION_ERROR

    const recommendedOptionResponse = await axios.get(
        constants.urls.api[version] + `/get-recommended-strike?expiration=${readableExpiration}&forecast=${forecast}&ticker=${ticker}`
    )
    
    const recommendedOption: arrow_interface.Option = {
        ticker: ticker,
        expiration: readableExpiration,
        strike: recommendedOptionResponse.data.strike,
        contractType: recommendedOptionResponse.data.contract_type,
        price: recommendedOptionResponse.data.option_price,
        greeks: recommendedOptionResponse.data.greeks
    }
    return recommendedOption
}

/**
 * Submit an option order to the API to compute the live price and submit a transaction to the blockchain.
 * 
 * @param deliverOptionParams Object containing parameters necessary to create an option order on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Data object from API response that includes transaction hash and per-option execution price of the option transaction.
 */
export async function submitOptionOrder(deliverOptionParams: arrow_interface.DeliverOptionParams, version: constants.VERSION = constants.VERSION.V2) {
    if (!utilities.isValidVersion(version)) throw constants.UNSUPPORTED_VERSION_ERROR
   
    // Submit option order through API
    const orderSubmissionResponse = await axios.post(
        constants.urls.api[version] + '/submit-order',
        {
            buy_flag: deliverOptionParams.buyFlag,
            limit_flag: deliverOptionParams.limitFlag,
            ticker: deliverOptionParams.ticker,
            expiration: deliverOptionParams.expiration, // readableExpiration
            strike: deliverOptionParams.formattedStrike,
            contract_type: deliverOptionParams.contractType,
            quantity: deliverOptionParams.quantity,
            threshold_price: (deliverOptionParams.limitFlag ? deliverOptionParams.thresholdPrice : deliverOptionParams.bigNumberThresholdPrice.toString() ),
            hashed_params: deliverOptionParams.hashedValues,
            signature: deliverOptionParams.signature
        }
    )
    // Return all data from response
    return orderSubmissionResponse.data
}

/**
 * Submit an option order to the API to compute the live price and submit a transaction to the blockchain.
 * 
 * @param deliverOptionParams Object containing parameters necessary to create an option order on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Data object from API response that includes transaction hash and per-option execution price of the option transaction.
 */
 export async function cancelOptionOrder(userAddress: string, orderId: string, version: constants.VERSION = constants.VERSION.V2) {
    if (!utilities.isValidVersion(version)) throw constants.UNSUPPORTED_VERSION_ERROR
   
    // Cancel option order through API
    const cancelOrderResponse = await axios.delete(
        constants.urls.api[version] + `/cancel-order?user_address=${userAddress}&order_id=${orderId}`
    )
    // Return all data from response
    return cancelOrderResponse.data
}

/**
 * Get a strike grid given some option parameters.
 * 
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @param contractType // 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Array of Option objects with optional price and greeks parameters populated.
 */
 export async function getStrikeGrid(
    ticker: string,
    readableExpiration: string,
    contractType: number,
    version: constants.VERSION = constants.VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw constants.UNSUPPORTED_VERSION_ERROR

    const strikeGridResponse = await axios.get(
        constants.urls.api[version] + `/get-strike-grid?ticker=${ticker}&expiration=${readableExpiration}&contract_type=${contractType}`
    )

    const strikeGrid = []
    for (let i = 0; i < strikeGridResponse.data.options.length; i++) {
        const strikeGridOption = strikeGridResponse.data.options[i]
        const option: arrow_interface.Option = {
            ticker: ticker,
            expiration: readableExpiration,
            strike: strikeGridOption.strike,
            contractType: contractType,
            price: strikeGridOption.price,
            greeks:  strikeGridOption.greeks
        }
        strikeGrid.push(option)
    }

    return strikeGrid    
}

/**
 * Get an active limit order by user address and order id 
 * 
 * @param user_address The wallet address of the user 
 * @param order_id The unique identifier of the option order
 * @returns A Limit Order Object.
 */


 /**
 * Submit a Modify option limit order request to the API
 * 
 * @param order_id The unique order id of the order to modify
 * @param modifyDeliverOptionParams ModifyDeliverOptionParams That contains the non null parameters to update 
 * @returns The modified order id and the new limit order
 */
export async function modifyLimitOrder(order_id: string, modifyDeliverOptionParams: arrow_interface.ModifyDeliverOptionParams, version: constants.VERSION = constants.VERSION.V2) {
    if (!utilities.isValidVersion(version)) throw constants.UNSUPPORTED_VERSION_ERROR

    // Submit option order through API
    const modifyLimitOrderResponse = await axios.post(
        constants.urls.api[version] + '/modify-order',
        {
            order_id: order_id,
            buy_flag: modifyDeliverOptionParams.buyFlag,
            limit_flag: modifyDeliverOptionParams.limitFlag,
            ticker: modifyDeliverOptionParams.ticker,
            expiration: modifyDeliverOptionParams.expiration, // readableExpiration
            strike: modifyDeliverOptionParams.formattedStrike,
            contract_type: modifyDeliverOptionParams.contractType,
            quantity: modifyDeliverOptionParams.quantity,
            threshold_price: modifyDeliverOptionParams.bigNumberThresholdPrice.toString(),
            hashed_params: modifyDeliverOptionParams.hashedValues,
            signature: modifyDeliverOptionParams.signature
        }
    )
    // Return all data from response
    return modifyLimitOrderResponse.data
}



/**************************************
 *           DEFAULT EXPORT           *
 **************************************/

const arrowsdk = {
    // Variables
    constants,

    //Interfaces
    arrow_interface,

    // API functions
    estimateOptionPrice,
    getRecommendedOption,
    getStrikeGrid,
    submitOptionOrder, // Smoke tested 
    modifyLimitOrder, //WIP
    cancelOptionOrder, // Smoke tested - G2G

    // Blockchain functions
    contract,

    //Utils
    utilities
}

export default arrowsdk