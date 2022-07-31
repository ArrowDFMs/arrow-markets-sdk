/****************************************
 *           HELPER FUNCTIONS           *
 ****************************************/

import { ethers } from "ethers"
import moment from "moment"
import contract from "./contract"
import { VERSION, UNSUPPORTED_VERSION_ERROR, providers ,bytecodeHashes, urls } from "./constants"
import * as arrow_interface from "./interfaces"
import axios from "axios"

/**
 * Helper function that can be used to convert a limit order string into an order object.
 * 
 * @param optionString string which represents a limit option order 
 * @returns A converted Option object
 */
 export function stringToOption(
    optionString: string,
) {
    console.log('optionString', optionString)
    const finalObj = optionString.split(",")
    const ticker = finalObj[0]
    const readableExpiration = finalObj[1]
    const contractType = finalObj[2]
    const strike = finalObj[3]
    const thresholdPrice = finalObj[4]
    const buyFlag = finalObj[5]
    
    const quantity = finalObj[6]
    const convertedOptionObj: arrow_interface.OptionOrderParams = {
        ticker: ticker,
        expiration: readableExpiration,
        strike: Number(strike),
        quantity: Number(quantity),
        contractType: (contractType === 'CALL' ? 0 : contractType === 'PUT' ? 1 : contractType === 'PUT SPREAD' ? 3 : contractType === 'CALL SPREAD' ? 4 : -1),
        price: Number(thresholdPrice),
        buyFlag: (buyFlag === 'buy' ? true : false),
        limitFlag: true,
        thresholdPrice: Number(thresholdPrice)
    }
    return convertedOptionObj
}


/**
 * Helper function updates one limit order object with the non-null values of the second
 * 
 * @param newOrder option order object that contains the values to update
 * @param orderToUpdate option order object to update
 * @returns An updated Option object
 */
function updateLimitOrder(newOrder: arrow_interface.ModifyOptionOrderParams, orderToUpdate: arrow_interface.OptionOrderParams) {
    const keys: Array<String>  = []
      Object.keys(newOrder).map((key) => {
        keys.push(key)
      });
      let omitNull = (obj: any) => {
        Object.keys(obj).filter(k => obj[k] === null).forEach(k => delete(obj[k]))
        return obj
      }
      const result = { ...omitNull(orderToUpdate), ...omitNull(newOrder) }
      return result
  }

/**
 * Helper function that can be used to check if a version is valid.
 * 
 * @param version Type of VERSION enum.
 * @returns True if version is valid, else false.
 */
function isValidVersion(version: VERSION): boolean {
    return Object.values(VERSION).includes(version)
}

/**
 * Get readable timestamp from millisecond timestamp.
 * 
 * @param millisTimestamp Millisecond timestamp. For example, 1654894800000 for Jun 10 2022 21:00:00
 * @returns Readable timestamp in the "MMDDYYYY" format.
 */
 export function getReadableTimestamp(millisTimestamp: number) {
    return moment(millisTimestamp).format('MMDDYYYY')
}

/**
 * Get current time in UTC.
 * 
 * @returns Object that contains a moment object & unix, millisecond, and readable timestamp representations of the current time
 */
export function getCurrentTimeUTC() {
    const currentTime = moment.utc()
    const utcMillisecondTimestamp = currentTime.valueOf()
    return {
        momentTimestamp: currentTime,
        unixTimestamp: currentTime.unix(),
        millisTimestamp: utcMillisecondTimestamp,
        readableTimestamp: getReadableTimestamp(utcMillisecondTimestamp)
    }
}

/**
 * Get unix, millisecond, and readable UTC timestamps from millisecond timestamp in any other time zone.
 * 
 * @param millisTimestamp Millisecond timestamp. For example, 1654894800000 for Jun 10 2022 21:00:00.
 * @returns Object that contains a moment object & unix, millisecond, and readable UTC timestamp representations of millisTimestamp.
 */
export function getTimeUTC(millisTimestamp: number) {
    const time = moment.utc(millisTimestamp)
    const utcMillisecondTimestamp = time.valueOf()
    return {
        momentTimestamp: time,
        unixTimestamp: time.unix(),
        millisTimestamp: utcMillisecondTimestamp,
        readableTimestamp: getReadableTimestamp(utcMillisecondTimestamp)
    }
}

/**
 * Get unix and millisecond timestamps from readable expiration. This works for any readable timestamp, not just expirations.
 * 
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @returns Object that contains a moment object & unix and millisecond timestamp representations of the readable timestamp.
 */
export function getExpirationTimestamp(readableExpiration: string) {
    const expiration = moment.utc(readableExpiration, 'MMDDYYYY').set('hour', 21)
    return {
        momentTimestamp: expiration,
        unixTimestamp: expiration.unix(),
        millisTimestamp: expiration.valueOf()
    }
}

/**
 * Compute address of on-chain option chain contract using CREATE2 functionality.
 * 
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable expiration in the "MMDDYYYY" format.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Address of the option chain corresponding to the passed ticker and expiration.
 */
export async function computeOptionChainAddress(
    ticker: string,
    readableExpiration: string,
    version: VERSION = VERSION.V2
): Promise<string> {
    // Get chain factory contract address from router
    const router = contract.getRouterContract(providers.fuji, version)

    let optionChainFactoryAddress = undefined
    switch(version) {
        case VERSION.V2: 
            optionChainFactoryAddress = await router.getChainFactoryAddress()
            break
        case VERSION.V3:
        case VERSION.COMPETITION: 
            optionChainFactoryAddress = await router.getOptionChainFactoryAddress()
            break
        default:
            throw UNSUPPORTED_VERSION_ERROR // Never reached because of the check in `getRouterContract`
    }

    // Build salt for CREATE2
    const salt = ethers.utils.solidityKeccak256(
        ['address', 'string', 'uint256'],
        [optionChainFactoryAddress, ticker, readableExpiration]
    )

    // Compute option chain proxy address using CREATE2
    const optionChainAddress = ethers.utils.getCreate2Address(
        optionChainFactoryAddress,
        salt,
        bytecodeHashes.ArrowOptionChainProxy[version]
    )

    return optionChainAddress
}

/**
 * Help construct DeliverOptionParams object that can be passed to the Arrow API to submit an option order.
 * 
 * @param optionOrderParams Object containing parameters necesssary in computing parameters for submitting an option order.
 * @param wallet Wallet with which you want to submit the option order.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns JSON that contains the variables necessary in completing the option order.
 */
export async function prepareDeliverOptionParams(
    optionOrderParams: arrow_interface.OptionOrderParams,
    wallet: ethers.Wallet | ethers.Signer,
    version: VERSION = VERSION.V2
): Promise<arrow_interface.DeliverOptionParams> {
    // Get stablecoin decimals
    // const stablecoinDecimals = await (await getStablecoinContract(wallet, version)).decimals()
    const stablecoinDecimals = 18

    // Define vars
    const thresholdPrice = ethers.utils.parseUnits(optionOrderParams.thresholdPrice.toString(), stablecoinDecimals)
    const unixExpiration = getExpirationTimestamp(optionOrderParams.expiration).unixTimestamp
    let bigNumberStrike = undefined
    let formattedStrike = undefined
    let strikeType = undefined

    switch(version) {
        case VERSION.V2:
        case VERSION.LOCAL: 
            formattedStrike = (optionOrderParams.strike as number).toFixed(2)
            bigNumberStrike = ethers.utils.parseUnits(formattedStrike, stablecoinDecimals)
            strikeType = 'uint256'
            break
        case VERSION.V3:
        case VERSION.COMPETITION: 
            const strikes = (optionOrderParams.strike as number[]).map(strike => strike.toFixed(2))
            bigNumberStrike = strikes.map(strike => ethers.utils.parseUnits(strike, stablecoinDecimals))
            formattedStrike = strikes.join('|')
            strikeType = 'uint256[2]'
            break
        default:
            throw UNSUPPORTED_VERSION_ERROR // Never reached because of the check in `getStablecoinContract`
    }

    // Hash and sign the option order parameters for on-chain verification
    const hashedValues = ethers.utils.solidityKeccak256(
        [
            'bool', // buy_flag - Boolean to indicate whether this is a buy (true) or sell (false).
            'string', // ticker - String to indicate a particular asset ("AVAX", "ETH", "BTC", or "LINK").
            'uint256', // expiration - Date in Unix timestamp. Must be 9:00 PM UTC (e.g. 1643144400 for January 25th, 2022)
            'uint256', // readableExpiration - Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
            strikeType, // strike - Ethers BigNumber versions of the strikes in terms of the stablecoin's decimals (e.g. [ethers.utils.parseUnits(strike, await usdc_e.decimals()), ethers.BigNumber.from(0)]).
            'string', // decimalStrike - String version of the strike that includes the decimal places (e.g. "12.25").
            'uint256', // contract_type - 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
            'uint256', // quantity - Number of contracts desired in the order.
            'uint256' // threshold_price - Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
        ],
        [
            optionOrderParams.buyFlag,
            optionOrderParams.ticker,
            unixExpiration,
            optionOrderParams.expiration,
            bigNumberStrike,
            formattedStrike,
            optionOrderParams.contractType,
            optionOrderParams.quantity!,
            thresholdPrice
        ]
    )
    // const hashedValues = '0x4df47a57d380bab32b97893b93345361119bf9ada5adc3753ddd4ea30950c7cf'
    const signature = await wallet.signMessage(ethers.utils.arrayify(hashedValues)) // Note that we are signing a message, not a transaction
    // const signature = '0xe2e99241ef985a709208e31896f4412fc6d544468f08097b84159d27d51d5fbb1d3febeac628d7acdedbd5cb6e08ff808908e9e761097b3766a761dc4dcb36681b' // Note that we are signing a message, not a transaction

    // Calculate amount to approve for this order (total = thresholdPrice * quantity)
    const amountToApprove = ethers.BigNumber.from(thresholdPrice).mul(optionOrderParams.quantity!)

    return {
        hashedValues,
        signature,
        amountToApprove,
        ...optionOrderParams,
        unixExpiration,
        formattedStrike,
        bigNumberStrike,
        bigNumberThresholdPrice: thresholdPrice
    }
}

export async function prepareOrderModificationParams(
    userAddress: string,
    orderId: string,
    newOrder: arrow_interface.ModifyOptionOrderParams,
    wallet: ethers.Wallet | ethers.Signer,
    version: VERSION
): Promise<void> {
    const getLimitOrderByUserAndIdResponse = await getLimitOrderByUserAndId(userAddress, orderId, version)
    const currentOptionString = getLimitOrderByUserAndIdResponse[userAddress]
    console.log('currentOptionString', currentOptionString)
    const currentOptionObject = utilities.stringToOption(currentOptionString)
    const updatedOderObject = utilities.updateLimitOrder(newOrder, currentOptionObject)
    const stablecoinDecimals = 18
    console.log('newOrder', newOrder, 'currentOptionObject', currentOptionObject)

    // Define vars
    const bigNumberThresholdPrice = ethers.utils.parseUnits(updatedOderObject.thresholdPrice.toString(), stablecoinDecimals)
    const thresholdPrice = updatedOderObject.thresholdPrice
    console.log('thresholdPrice in sdk is', thresholdPrice)
    
    const unixExpiration = getExpirationTimestamp(updatedOderObject.expiration).unixTimestamp
    let bigNumberStrike = undefined
    let formattedStrike = undefined
    let strikeType = undefined

    switch(version) {
        case VERSION.V2:
        case VERSION.LOCAL: 
            formattedStrike = (updatedOderObject.strike as number).toFixed(2)
            bigNumberStrike = ethers.utils.parseUnits(formattedStrike, stablecoinDecimals)
            strikeType = 'uint256'
            break
        case VERSION.V3:
        case VERSION.COMPETITION: 
            const strikes = (updatedOderObject.strike as number[]).map(strike => strike.toFixed(2))
            bigNumberStrike = strikes.map(strike => ethers.utils.parseUnits(strike, stablecoinDecimals))
            formattedStrike = strikes.join('|')
            strikeType = 'uint256[2]'
            break
        default:
            throw UNSUPPORTED_VERSION_ERROR // Never reached because of the check in `getStablecoinContract`
    }

    // Hash and sign the option order parameters for on-chain verification
    const hashedValues = ethers.utils.solidityKeccak256(
        [
            'bool', // buy_flag - Boolean to indicate whether this is a buy (true) or sell (false).
            'string', // ticker - String to indicate a particular asset ("AVAX", "ETH", "BTC", or "LINK").
            'uint256', // expiration - Date in Unix timestamp. Must be 9:00 PM UTC (e.g. 1643144400 for January 25th, 2022)
            'uint256', // readableExpiration - Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
            strikeType, // strike - Ethers BigNumber versions of the strikes in terms of the stablecoin's decimals (e.g. [ethers.utils.parseUnits(strike, await usdc_e.decimals()), ethers.BigNumber.from(0)]).
            'string', // decimalStrike - String version of the strike that includes the decimal places (e.g. "12.25").
            'uint256', // contract_type - 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
            'uint256', // quantity - Number of contracts desired in the order.
            'uint256' // threshold_price - Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
        ],
        [
            updatedOderObject.buyFlag,
            updatedOderObject.ticker,
            unixExpiration,
            updatedOderObject.expiration,
            bigNumberStrike,
            formattedStrike,
            updatedOderObject.contractType,
            updatedOderObject.quantity!,
            thresholdPrice
        ]
    )
    const signature = await wallet.signMessage(ethers.utils.arrayify(hashedValues)) // Note that we are signing a message, not a transaction

    // Calculate amount to approve for this order (total = thresholdPrice * quantity)
    console.log('updatedOderObject',updatedOderObject)
    const amountToApprove = ethers.BigNumber.from(bigNumberThresholdPrice).mul(updatedOderObject.quantity!)
    return {
        orderId,
        hashedValues,
        signature,
        amountToApprove,
        ...updatedOderObject,
        thresholdPrice,
        unixExpiration,
        formattedStrike,
        bigNumberStrike,
        bigNumberThresholdPrice: bigNumberThresholdPrice
    }
}


/**************************************
 *         Limit Order Functions      *
 **************************************/

/**
 * Get all of the active limit orders of the given user 
 * 
 * @param user_address Wallet address of the user
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Array of Limit Order Objects.
 */
 export async function getLimitOrdersByUser(
    user_address: string,
    version: VERSION = VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    const getLimitOrdersByUserResponse = await axios.get(
        urls.api[version] + `/limit-orders?user_address=${user_address}`
    )
    
    // TODO Write a function that converts the returned value in to an array of limit order objects 
    return getLimitOrdersByUserResponse.data    
}


/**
 * Get all of the active buy limit orders of the given option chain 
 * 
 * @param ticker The ticker of the option
 * @param readableExpiration The readable expiration of the option
 * @param contractType The contract type of the option. Ex. 0 = Call 1 = Put
 * @param formattedStrike The strike price of the option
 * @returns Array of Limit Order Objects.
 */
 export async function getBuyLimitOrders(
    ticker: string, 
    readableExpiration: string,
    contractType: number,
    formattedStrike: string,
    version: VERSION = VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    // TODO handle if contract type is a spread?
    const getBuyLimitOrdersResponse = await axios.get(
        urls.api[version] + `/get-buy-limits?ticker=${ticker}&expiration=${readableExpiration}&contract_type=${contractType == 0 ? 'CALL' : contractType == 1? 'PUT': 'SPREAD'}&strike=${formattedStrike}`
    )

    return getBuyLimitOrdersResponse.data.active_buy_limits    
}

/**
 * Get all of the active sell limit orders of the given option chain 
 * 
 * @param ticker The ticker of the option
 * @param readableExpiration The readable expiration of the option
 * @param contractType The contract type of the option. Ex. 0 = Call 1 = Put
 * @param formattedStrike The strike price of the option
 * @returns Array of Limit Order Objects.
 */
 export async function getSellLimitOrders(
    ticker: string, 
    readableExpiration: string,
    contractType: number,
    formattedStrike: string,
    version: VERSION = VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    // TODO handle if contract type is a spread?
    const getSellLimitOrdersResponse = await axios.get(
        urls.api[version] + `/get-sell-limits?ticker=${ticker}&expiration=${readableExpiration}&contract_type=${contractType == 0 ? 'CALL' : contractType == 1? 'PUT': 'SPREAD'}&strike=${formattedStrike}`
    )

    return getSellLimitOrdersResponse.data.active_sell_limits 
}

/**
 * Get an active limit order by user address and order id 
 * 
 * @param user_address The wallet address of the user 
 * @param order_id The unique identifier of the option order
 * @returns A Limit Order Object.
 */
 export async function getLimitOrderByUserAndId(
    user_address: string, 
    order_id: string,
    version: VERSION = VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    // TODO handle if contract type is a spread?
    const getLimitOrderByUserAndIdResponse = await axios.get(
        urls.api[version] + `/get-limit-order?user_address=${user_address}&order_id=${order_id}`
    )
    
    // TODO Write a function that converts the returned value in to an array of limit order objects 
    return getLimitOrderByUserAndIdResponse.data    
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
 * @param owner Address of the option owner for whom you are settling. This is only required for 'v3'.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 */
export async function settleOptions(
    wallet: ethers.Wallet|ethers.Signer,
    ticker: string,
    readableExpiration: string,
    owner = undefined,
    version: VERSION = VERSION.V2
) {
    const router = contract.getRouterContract(wallet, version)

    switch(version) {
        case VERSION.V2: 
            try {
                await router.callStatic.settleOption(ticker, readableExpiration)
                await router.settleOption(ticker, readableExpiration)
            } catch(err) {
                throw new Error("Settlement call would fail on chain.")
            }    
            break
        case VERSION.V3:
        case VERSION.COMPETITION: 
            try {
                await router.callStatic.settleOptions(owner, ticker, readableExpiration)
                await router.settleOptions(owner, ticker, readableExpiration)
            } catch(err) {
                throw new Error("Settlement call would fail on chain.")
            }
            break
        default:
            throw UNSUPPORTED_VERSION_ERROR // Never reached because of the check in `getRouterContract`
    }
}

const utilities = {
    isValidVersion,
    getReadableTimestamp,
    getCurrentTimeUTC,
    getTimeUTC,
    getExpirationTimestamp,
    updateLimitOrder,
    stringToOption,
    computeOptionChainAddress,
    getLimitOrderByUserAndId, // smoke tested - G2G
    getSellLimitOrders, // Smoke tested - TODO remove user hashed params and signature from order object (API side)
    getBuyLimitOrders, // Smoke tested - TODO remove user hashed params and signature from order object (API side)
    getLimitOrdersByUser, // Smoke tested - G2G
    prepareOrderModificationParams, // WIP - remove comments hashed params and signature before merging function

}


export default utilities
