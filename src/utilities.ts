/*****************************
 *          IMPORTS          *
 *****************************/

// Packages
import axios from "axios"
import { Contract, ethers } from "ethers"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import customParseFormat from "dayjs/plugin/customParseFormat"

dayjs.extend(utc)
dayjs.extend(customParseFormat)

// Types
import {
    Currency,
    DeliverOptionParams,
    GetUnderlierHistoricalPricesResponse,
    OptionOrderParams,
    OrderType,
    Ticker,
    Version
} from "./types"

// Constants
import {
    addresses,
    binanceSymbols,
    bytecodeHashes,
    coingeckoIDs,
    DEFAULT_VERSION,
    providers,
    quantityScaleFactor,
    secondsPerDay,
    UNSUPPORTED_EXPIRATION_ERROR,
    UNSUPPORTED_VERSION_ERROR
} from "./constants"

// ABIs
import {
    IArrowEvents,
    IArrowRegistry,
    IArrowRouter,
    IERC20Metadata,
    WrappedAsset
} from "../abis"

/***************************************
 *      CONTRACT GETTER FUNCTIONS      *
 ***************************************/

/**
 * Get the router contract from Arrow's contract suite.
 *
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @param wallet Wallet with which you want to connect the instance of the router contract. Default is Fuji provider.
 * @returns Local instance of ethers.Contract for the Arrow router contract.
 */
export function getRouterContract(
    version = DEFAULT_VERSION,
    wallet:
        | ethers.providers.Provider
        | ethers.Wallet
        | ethers.Signer = providers.fuji
) {
    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    const router = new ethers.Contract(
        addresses.fuji.router[version],
        IArrowRouter[version],
        wallet
    )
    return router
}

/**
 * Get the stablecoin contract that is associated with Arrow's contract suite.
 *
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @param wallet Wallet with which you want to connect the instance of the stablecoin contract. Default is Fuji provider.
 * @returns Local instance of ethers.Contract for the stablecoin contract.
 */
export async function getStablecoinContract(
    version = DEFAULT_VERSION,
    wallet:
        | ethers.providers.Provider
        | ethers.Wallet
        | ethers.Signer = providers.fuji
) {
    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    const stablecoin = new ethers.Contract(
        await getRouterContract(version, wallet).getStablecoinAddress(),
        IERC20Metadata,
        wallet
    )
    return stablecoin
}

/**
 * Get the wrapped underlier contract that is associated with Arrow's contract suite.
 *
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @param wallet Wallet with which you want to connect the instance of the stablecoin contract. Default is Fuji provider.
 * @returns Local instance of ethers.Contract for the wrapped underlier contract.
 */
export async function getUnderlierAssetContract(
    ticker: Ticker,
    version = DEFAULT_VERSION,
    wallet:
        | ethers.providers.Provider
        | ethers.Wallet
        | ethers.Signer = providers.fuji
) {
    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR
    const registry = await getRegistryContract(version, wallet)

    const underlierAssetContract = new Contract(
        await registry.getUnderlyingAssetAddress(ticker),
        WrappedAsset,
        wallet
    )
    return underlierAssetContract
}

/**
 * Get the events contract from Arrow's contract suite.
 *
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @param wallet Wallet with which you want to connect the instance of the Arrow events contract. Default is Fuji provider.
 * @returns Local instance of ethers.Contract for the Arrow events contract.
 */
export async function getEventsContract(
    version = DEFAULT_VERSION,
    wallet:
        | ethers.providers.Provider
        | ethers.Wallet
        | ethers.Signer = providers.fuji
) {
    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    const events = new ethers.Contract(
        await getRouterContract(version, wallet).getEventsAddress(),
        IArrowEvents[version],
        wallet
    )
    return events
}

/**
 * Get the registry contract from Arrow's registry suite.
 *
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @param wallet Wallet with which you want to connect the instance of the Arrow registry contract. Default is Fuji provider.
 * @returns Local instance of ethers.Contract for the Arrow registry contract.
 */
export async function getRegistryContract(
    version = DEFAULT_VERSION,
    wallet:
        | ethers.providers.Provider
        | ethers.Wallet
        | ethers.Signer = providers.fuji
) {
    if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

    const registry = new ethers.Contract(
        await getRouterContract(version, wallet).getRegistryAddress(),
        IArrowRegistry[version],
        wallet
    )
    return registry
}

/****************************************
 *           HELPER FUNCTIONS           *
 ****************************************/

/**
 * Get the current price (in USD) of an underlying asset from Binance or CryptoWatch.
 * If there is a specific timeout code in the return from Binance, try on CryptoWatch.
 * Throw custom error if there is some issue getting the spot price.
 * 
 * @param ticker Ticker of the underlying asset.
 * @returns Spot price of underlying asset specified by ticker.
 */
export async function getUnderlierSpotPrice(ticker: Ticker) {
    // Using Binance API to get latest price
    const binanceResponse = await axios.get(
        `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbols[ticker]}`
    )

    // If Binance tells us we have been making too many requests, use Cryptowatch
    if ("code" in binanceResponse && binanceResponse["data"]["code"] == -1003) {
        // Use CryptoWatch API to get latest price
        const cryptowatchResponse = await axios.get(
            `https://api.cryptowat.ch/markets/binance/${binanceSymbols[ticker]}/price`
        )

        try {
            return parseFloat(cryptowatchResponse["data"]["result"]["price"])
        } catch {
            throw Error("Could not retrieve underlying spot price from Cryptowatch.")
        }
    } else {
        try {
            return parseFloat(binanceResponse["data"]["price"])
        } catch {
            throw Error("Could not retrieve underlying spot price from Binance.")
        }
    }
}

/**
 * Get the price history and market caps for the underlying asset using CoinGecko.
 * 
 * @param ticker Ticker of underlying asset.
 * @param days Number of days worth of historical data to get from CoinGecko. Default is 84 days to match the API.
 * @param currency Currency to which we wish to convert the value. Default is USD to match the API.
 * @returns Price history and market caps of the underlying asset as 2D arrays of dates and values (floats).
 */
 export async function getUnderlierMarketChart(
    ticker: Ticker,
    days = 84,
    currency = Currency.USD
) {
    const underlierID = coingeckoIDs[ticker]

    const {
        data: {
            market_caps: marketCaps,
            prices
        }
    } = await axios.get<GetUnderlierHistoricalPricesResponse>(
        `https://api.coingecko.com/api/v3/coins/${underlierID}/market_chart`,
        {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            params: {
                days,
                vs_currency: currency
            }
        }
    )

    const priceHistory = prices.map((entry) => {
        return {
            date: entry[0],
            price: entry[1]
        }
    })

    return { priceHistory, marketCaps }
}

/**
 * Get the spot price and market chart (refer to getUnderlierMarketChart) for the underlying asset using CoinGecko.
 * 
 * @param ticker Ticker of underlying asset.
 * @param days Number of days worth of historical data to get from CoinGecko. Default is 84 days to match the API.
 * @param currency Currency to which we wish to convert the value. Default is USD to match the API.
 * @returns JSON object that contains the spot price and market chart information of the underlying asset.
 */
export async function getUnderlierSpotPriceAndMarketChart(
    ticker: Ticker,
    days = 84,
    currency = Currency.USD
) {
    const spotPrice = await getUnderlierSpotPrice(ticker)
    const marketChart = await getUnderlierMarketChart(ticker, days, currency)

    return {
        spotPrice,
        marketChart
    }
}

/**
 * Helper function that can be used to check if a version is valid.
 *
 * @param version Type of Version enum.
 * @returns True if version is valid, else false.
 */
export function isValidVersion(version: Version): boolean {
    return Object.values(Version).includes(version)
}

/**
 * Get readable timestamp from millisecond timestamp.
 *
 * @param millisTimestamp Millisecond timestamp in UTC. For example, 1654848000000 for Jun 10 2022 08:00:00.
 * @returns Readable timestamp in the "MMDDYYYY" format.
 */
export function getReadableTimestamp(millisTimestamp: number, includeSlashes = false) {
    return dayjs(millisTimestamp).utc().format(includeSlashes ? 'MM/DD/YYYY' : "MMDDYYYY")
}

/**
 * Get current time in UTC.
 *
 * @returns Object that contains a moment object & unix, millisecond, and readable timestamp representations of the current time.
 */
export function getCurrentTimeUTC() {
    const currentTime = dayjs().utc()

    return {
        dayJsTimestamp: currentTime,
        unixTimestamp: currentTime.unix(),
        millisTimestamp: currentTime.valueOf(),
        readableTimestamp: getReadableTimestamp(currentTime.valueOf())
    }
}

/**
 * Get unix, millisecond, and readable UTC timestamps from millisecond timestamp in any other time zone.
 *
 * @param millisTimestamp Millisecond timestamp in UTC. For example, 1654848000000 for Jun 10 2022 08:00:00.
 * @returns JSON object that contains a moment object as well as unix, millisecond, and readable UTC timestamp representations of millisTimestamp.
 */
export function getTimeUTC(millisTimestamp: number) {
    const time = dayjs(millisTimestamp) 
    const utcMillisecondTimestamp = time.valueOf()

    return {
        dayJsTimestamp: time,
        unixTimestamp: time.unix(),
        millisTimestamp: utcMillisecondTimestamp,
        readableTimestamp: getReadableTimestamp(utcMillisecondTimestamp)
    }
}

/**
 * Get unix and millisecond timestamps from readable expiration. This works for any readable timestamp, not just expirations.
 *
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @returns JSON object that contains a moment object as well as unix and millisecond timestamp representations of the readable timestamp.
 */
export function getExpirationTimestamp(readableExpiration: string): Record<string, any> {
    const expiration = dayjs.utc(readableExpiration, 'MMDDYYYY').hour(8)
    
    if (!isFriday(expiration.unix())) throw UNSUPPORTED_EXPIRATION_ERROR

    return {
        dayJsTimestamp: expiration,
        unixTimestamp: expiration.unix(),
        millisTimestamp: expiration.valueOf()
    }
}

/**
 * Checks if a UNIX timestamp is a Friday (specifically, in the timezone from which the timestamp came).
 *
 * @param unixTimestamp UNIX timestamp.
 * @returns True if is a Friday, else returns False.
 */
export function isFriday(unixTimestamp: number): boolean {
    const dayOfTheWeek =
        (Math.floor(unixTimestamp / secondsPerDay) + 4) % 7
    return dayOfTheWeek === 5
}

/**
 * Compute address of on-chain option chain contract using CREATE2 functionality.
 *
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable expiration in the "MMDDYYYY" format.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @param wallet Wallet with which you want to connect the instance of the Arrow registry contract. Default is Fuji provider.
 * @returns Address of the option chain corresponding to the passed ticker and expiration.
 */
export async function computeOptionChainAddress(
    ticker: Ticker,
    readableExpiration: string,
    version = DEFAULT_VERSION,
    wallet:
        | ethers.providers.Provider
        | ethers.Wallet
        | ethers.Signer = providers.fuji
): Promise<string> {
    // Get local instance of router contract
    const router = getRouterContract(version, wallet)

    const optionChainFactoryAddress = await router.getOptionChainFactoryAddress()

    // Build salt for CREATE2

    const salt = ethers.utils.solidityKeccak256(
        ["address", "string", "uint256"],
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
 * Compute address of on-chain short aggregator contract using CREATE2 functionality.
 *
 * @param ticker Ticker of the underlying asset.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @param wallet Wallet with which you want to connect the instance of the Arrow registry contract. Default is Fuji provider.
 * @returns Address of the short aggregator corresponding to the passed ticker.
 */
export async function computeShortAggregatorAddress(
    ticker: Ticker,
    version = DEFAULT_VERSION,
    wallet:
        | ethers.providers.Provider
        | ethers.Wallet
        | ethers.Signer = providers.fuji
): Promise<string> {
    // Get local instance of router contract
    const router = getRouterContract(version, wallet)
    
    const shortAggregatorFactoryAddress = await router.getShortAggregatorFactoryAddress()
   
    // Build salt for 
    
    const salt = ethers.utils.solidityKeccak256(
        ["address", "string"],
        [shortAggregatorFactoryAddress, ticker]
    )

    // Compute option chain proxy address using 
    
    const shortAggregatorAddress = ethers.utils.getCreate2Address(
        shortAggregatorFactoryAddress,
        salt,
        bytecodeHashes.ArrowOptionChainProxy[version]
    )

    return shortAggregatorAddress
}

/**
 * Help construct DeliverOptionParams object that can be passed to the Arrow API to submit an option order.
 *
 * @param optionOrderParams Object containing parameters necesssary in computing parameters for submitting an option order.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @param wallet Wallet with which you want to submit the option order.
 * @returns JSON that contains the variables necessary in completing the option order.
 */
export async function prepareDeliverOptionParams(
    optionOrderParamsList: OptionOrderParams[],
    version = DEFAULT_VERSION,
    wallet: ethers.Wallet | ethers.Signer
){
     const preparedParams = await Promise.all(optionOrderParamsList.map(async optionOrderParams => {
        // Ensure that the payPremium boolean is set for closing short position.
        if (
            optionOrderParams.orderType === OrderType.SHORT_CLOSE &&
            optionOrderParams.payPremium === undefined
        ) {
            throw new Error('`payPremium` boolean parameter must be set for closing a short position')
        }

        // Get stablecoin decimals
        const stablecoinDecimals = await (
            await getStablecoinContract(version, wallet)
        ).decimals()

        const thresholdPrice = ethers.utils.parseUnits(
            optionOrderParams.thresholdPrice!.toFixed(stablecoinDecimals),
            stablecoinDecimals
        )
        const unixExpiration = getExpirationTimestamp(
            optionOrderParams.expiration
        ).unixTimestamp
        const strikes = optionOrderParams.strike.map(
            (strike) => strike.toFixed(2)
        )
        const bigNumberStrike = strikes.map((strike) =>
            ethers.utils.parseUnits(strike, stablecoinDecimals)
        )
        const formattedStrike = strikes.join("|")
        const intQuantity = optionOrderParams.quantity! * quantityScaleFactor   
            
         // Hash and sign the option order parameters for on-chain verification
        const hashedValues = ethers.utils.solidityKeccak256(
            [
                "bool",       // buyFlag - Boolean to indicate whether this is a buy (true) or sell (false).
                "string",     // ticker - String to indicate a particular asset ("AVAX", "ETH", or "BTC").
                "uint256",    // expiration - Date in Unix timestamp. Must be 8:00 AM UTC (e.g. 1643097600 for January 25th, 2022).
                "uint256",    // readableExpiration - Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
                "uint256[2]", // strike - Ethers BigNumber versions of the strikes in terms of the stablecoin's decimals (e.g. [ethers.utils.parseUnits(strike, await usdc_e.decimals()), ethers.BigNumber.from(0)]).
                "string",     // decimalStrike - String version of the strike that includes the decimal places (e.g. "12.25").
                "uint256",    // contractType - 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
                "uint256",    // quantity - Integer number of contracts desired in the order. Has to be scaled by supported decimals (10**2).
                "uint256"     // thresholdPrice - Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
            ],
            [
                optionOrderParams.orderType === OrderType.LONG_OPEN ||  optionOrderParams.orderType == OrderType.SHORT_OPEN,
                optionOrderParams.ticker,
                unixExpiration,
                optionOrderParams.expiration,
                bigNumberStrike,
                formattedStrike,
                optionOrderParams.contractType,
                intQuantity,
                thresholdPrice
            ]
        )
        // Note that we are signing a message, not a transaction
        const signature = await wallet.signMessage(
            ethers.utils.arrayify(hashedValues)
        )
        const value = optionOrderParams.thresholdPrice! * optionOrderParams.quantity!
        let amountToApprove: ethers.BigNumber

        if(optionOrderParams.orderType === OrderType.SHORT_OPEN) {
            let diffPrice: number = 0
            if (optionOrderParams.contractType == 1 || optionOrderParams.contractType == 0){
                // put
                diffPrice = Number(optionOrderParams.strike[0])
            }
            else if (optionOrderParams.contractType == 2){
                // call spread
                diffPrice = Math.abs(Number(optionOrderParams.strike[1]) - Number(optionOrderParams.strike[0]))
            }
            else if (optionOrderParams.contractType == 3){
                // put spread
                diffPrice = Math.abs(Number(optionOrderParams.strike[0]) - Number(optionOrderParams.strike[1]))
            }
            amountToApprove = ethers.utils.parseUnits(
                (
                    optionOrderParams.quantity! * diffPrice).toString(),
                    stablecoinDecimals
                )
        } else {
            amountToApprove = ethers.BigNumber.from
            (
                ethers.utils.parseUnits(value.toFixed(stablecoinDecimals), stablecoinDecimals)
            )
        }
   
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
    }))
    
    return preparedParams
}
