import axios from 'axios'
import { ethers } from 'ethers'
import moment from 'moment'

import {
    IERC20Metadata,
    IArrowRouter,
    IArrowEvents,
    IArrowRegistry
} from '../abis'

import {
    ArrowOptionChainProxy
} from '../build'

/**************************************
 *             INTERFACES             *
 **************************************/

export interface Greeks {
    delta: number,
    gamma: number,
    theta: number
}

export interface Option {
    ticker: string;
    expiration: string;
    strike: number | number[];
    contractType: number;
    quantity?: number;
    price?: number;
    underlierPriceHistory?: number[];
    greeks?: Greeks;
}

export interface OptionOrderParams extends Option {
    buyFlag: boolean;
    thresholdPrice: number;
}

export interface DeliverOptionParams extends OptionOrderParams {
    hashedValues: string;
    signature: string;
    amountToApprove: ethers.BigNumber;
    unixExpiration: number;
    formattedStrike: string;
    bigNumberStrike: ethers.BigNumber | ethers.BigNumber[];
    bigNumberThresholdPrice: ethers.BigNumber;
}

/**************************************
 *          USEFUL CONSTANTS          *
 **************************************/

const UNSUPPORTED_VERSION_ERROR = new Error("Please select a supported contract version.")

export enum VERSION {
    V2 = 'v2',
    V3 = 'v3',
    COMPETITION = 'competition'
}


export const urls: any = {
    "api": {
        [VERSION.V2]: 'https://fuji-v2-api.arrow.markets/v1',
        [VERSION.V3]: 'https://fuji-v2-api.arrow.markets/v1',
        [VERSION.COMPETITION]: 'https://competition-api.arrow.markets/v1'
    },
    "provider": {
        "fuji": 'https://api.avax-test.network/ext/bc/C/rpc'
    }
}

export const providers: any = {
    "fuji": new ethers.providers.JsonRpcProvider(urls.provider.fuji)
}

export const addresses: any = {
    "fuji": {
        "router": {
            [VERSION.V2]: ethers.utils.getAddress("0x28121fb95692a9be3fb1c6891ffee74b88bdfb2b"),
            [VERSION.V3]: ethers.utils.getAddress("0x31122CeF9891Ef661C99352266FA0FF0079a0e06"),
            [VERSION.COMPETITION]: ethers.utils.getAddress("0x3e8a9Ad1336eF8007A416383daD084ef52E8DA86")
        }
    }
}

export const bytecodeHashes: any = {
    "ArrowOptionChainProxy": {
        [VERSION.V2]: ethers.utils.solidityKeccak256(
            ['bytes'],
            [ArrowOptionChainProxy.v2.bytecode]
        ),
        [VERSION.V3]: ethers.utils.solidityKeccak256(
            ['bytes'],
            [ArrowOptionChainProxy.v3.bytecode]
        ),
        [VERSION.COMPETITION]: ethers.utils.solidityKeccak256(
            ['bytes'],
            [ArrowOptionChainProxy.competition.bytecode]
        )
    }
}

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
export async function estimateOptionPrice(option: Option, version: VERSION = VERSION.V2) {
    let strike = undefined
    switch(version) {
        case VERSION.V2: 
            strike = option.strike
            break
        case VERSION.V3:
        case VERSION.COMPETITION: 
            strike = (option.strike as number[]).join('|')    
            break
        default:
            throw UNSUPPORTED_VERSION_ERROR
    }

    const estimatedOptionPriceReponse = await axios.post(
        urls.api[version] + '/estimate-option-price',
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
    version: VERSION = VERSION.V2
) {
    switch(version) {
        case VERSION.V2:
        case VERSION.V3:
        case VERSION.COMPETITION: 
        const recommendedOptionResponse = await axios.get(
            urls.api[version] + `/get-recommended-strike?expiration=${readableExpiration}&forecast=${forecast}&ticker=${ticker}`
        )
        
        const recommendedOption: Option = {
            ticker: ticker,
            expiration: readableExpiration,
            strike: recommendedOptionResponse.data.strike,
            contractType: recommendedOptionResponse.data.contract_type,
            price: recommendedOptionResponse.data.option_price,
            greeks: recommendedOptionResponse.data.greeks
        }
        return recommendedOption
        default:
            throw UNSUPPORTED_VERSION_ERROR
    }
    
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
    version: VERSION = VERSION.V2
) {
    switch(version) {
        case VERSION.V2:
        case VERSION.V3:
        case VERSION.COMPETITION: 
        const strikeGridResponse = await axios.get(
            urls.api[version] + `/get-strike-grid?ticker=${ticker}&expiration=${readableExpiration}&contract_type=${contractType}`
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
                greeks:  strikeGridOption.greeks
            }
            strikeGrid.push(option)
        }
    
        return strikeGrid
        default:
            throw UNSUPPORTED_VERSION_ERROR
    }

    
}

/**
 * Submit an option order to the API to compute the live price and submit a transaction to the blockchain.
 * 
 * @param deliverOptionParams Object containing parameters necessary to create an option order on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Data object from API response that includes transaction hash and per-option execution price of the option transaction.
 */
export async function submitOptionOrder(deliverOptionParams: DeliverOptionParams, version: VERSION = VERSION.V2) {
    switch(version) {
        case VERSION.V2:
        case VERSION.V3:
        case VERSION.COMPETITION: 
        // Submit option order through API
        const orderSubmissionResponse = await axios.post(
            urls.api[version] + '/submit-order',
            {
                buy_flag: deliverOptionParams.buyFlag,
                ticker: deliverOptionParams.ticker,
                expiration: deliverOptionParams.expiration, // readableExpiration
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

        default:
            throw UNSUPPORTED_VERSION_ERROR
    }
}

/***************************************
 *      CONTRACT GETTER FUNCTIONS      *
 ***************************************/

/**
 * Get the router contract from Arrow's contract suite.
 * 
 * @param wallet Wallet with which you want to connect the instance of the router contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Local instance of ethers.Contract for the Arrow router contract.
 */
export function getRouterContract(
    wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer = providers.fuji,
    version: VERSION = VERSION.V2
) {
    switch(version) {
        case VERSION.V2:
        case VERSION.V3:
        case VERSION.COMPETITION: 
            const router = new ethers.Contract(
                addresses.fuji.router[version],
                IArrowRouter[version],
                wallet
            )
            return router
        default:
            throw UNSUPPORTED_VERSION_ERROR
    }
    
}

/**
 * Get the stablecoin contract that is associated with Arrow's contract suite.
 * 
 * @param wallet Wallet with which you want to connect the instance of the stablecoin contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Local instance of ethers.Contract for the stablecoin contract.
 */
export async function getStablecoinContract(
    wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer = providers.fuji,
    version: VERSION = VERSION.V2
) {
    switch(version) {
        case VERSION.V2:
        case VERSION.V3:
        case VERSION.COMPETITION: 
            const stablecoin = new ethers.Contract(
                await getRouterContract(wallet, version).getStablecoinAddress(),
                IERC20Metadata,
                wallet
            )
            return stablecoin
        default:
            throw UNSUPPORTED_VERSION_ERROR
    }    
}

/**
 * Get the events contract from Arrow's contract suite.
 * 
 * @param wallet Wallet with which you want to connect the instance of the Arrow events contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Local instance of ethers.Contract for the Arrow events contract.
 */
export async function getEventsContract(
    wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer = providers.fuji,
    version: VERSION = VERSION.V2
) {
    switch(version) {
        case VERSION.V2:
        case VERSION.V3:
        case VERSION.COMPETITION: 
            const events = new ethers.Contract(
                await getRouterContract(wallet, version).getEventsAddress(),
                IArrowEvents[version],
                wallet
            )
            return events
        default:
            throw UNSUPPORTED_VERSION_ERROR
    }
}

/**
 * Get the registry contract from Arrow's registry suite.
 * 
 * @param wallet Wallet with which you want to connect the instance of the Arrow registry contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Local instance of ethers.Contract for the Arrow registry contract.
 */
export async function getRegistryContract(
    wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer = providers.fuji,
    version: VERSION = VERSION.V2
) {
    switch(version) {
        case VERSION.V2:
        case VERSION.V3:
        case VERSION.COMPETITION: 
            const registry = new ethers.Contract(
                await getRouterContract(wallet, version).getRegistryAddress(),
                IArrowRegistry[version],
                wallet
            )
            return registry
        default:
            throw UNSUPPORTED_VERSION_ERROR
    }
}

/****************************************
 *           HELPER FUNCTIONS           *
 ****************************************/

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
 * @returns Object that contains a moment object & unix, millisecond, and readable timestamp representations of the current time.
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
 * @param millisTimestamp Millisecond timestamp. For example, 1654894800000 for Jun 10 2022 21:00:00
 * @returns Object that contains a moment object & unix, millisecond, and readable UTC timestamp representations of millisTimestamp
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
    const router = getRouterContract(providers.fuji, version)

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
            throw UNSUPPORTED_VERSION_ERROR
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
    optionOrderParams: OptionOrderParams,
    wallet: ethers.Wallet | ethers.Signer,
    version: VERSION = VERSION.V2
): Promise<DeliverOptionParams> {
    // Get stablecoin decimals
    const stablecoinDecimals = await (await getStablecoinContract(wallet, version)).decimals()

    // Define vars
    const thresholdPrice = ethers.utils.parseUnits(optionOrderParams.thresholdPrice.toString(), stablecoinDecimals)
    const unixExpiration = getExpirationTimestamp(optionOrderParams.expiration).unixTimestamp
    let bigNumberStrike = undefined
    let formattedStrike = undefined
    let strikeType = undefined

    switch(version) {
        case VERSION.V2: 
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
            throw UNSUPPORTED_VERSION_ERROR
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
    const signature = await wallet.signMessage(ethers.utils.arrayify(hashedValues)) // Note that we are signing a message, not a transaction

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
    const router = getRouterContract(wallet, version)

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
            throw UNSUPPORTED_VERSION_ERROR
    }
}

/**************************************
 *           DEFAULT EXPORT           *
 **************************************/

const arrowsdk = {
    // Variables
    VERSION,
    urls,
    providers,
    addresses,

    // Helper functions
    getReadableTimestamp,
    getCurrentTimeUTC,
    getTimeUTC,
    getExpirationTimestamp,

    // API functions
    estimateOptionPrice,
    getRecommendedOption,
    getStrikeGrid,
    submitOptionOrder,

    // Blockchain functions
    getRouterContract,
    getStablecoinContract,
    getEventsContract,
    getRegistryContract,
    computeOptionChainAddress,
    prepareDeliverOptionParams,
    settleOptions
}

export default arrowsdk