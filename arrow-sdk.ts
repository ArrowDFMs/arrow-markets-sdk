import axios from 'axios'
import { ethers } from 'ethers'
import moment from 'moment'

import {
    IERC20Metadata,
    IArrowRouter,
    IArrowEvents,
    IArrowRegistry
} from './abis'

import {
    ArrowOptionChainProxy
} from './build'

const UNSUPPORTED_VERSION_ERROR = new Error("Please select a supported contract version (v2 or v3)")

export interface Option {
    ticker: string;
    expiration: string | number;
    strike: number | number[];
    contractType: number;
    quantity: number;
    priceHistory?: number[];
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
    bigNumberStrike: ethers.BigNumber;
    bigNumberThresholdPrice: ethers.BigNumber;
}

export const urls = {
    api: {
        v2: 'https://fuji-v2-api.arrow.markets/v1',
        v3: 'https://fuji-v2-api.arrow.markets/v1'
    },
    provider: {
        fuji: 'https://api.avax-test.network/ext/bc/C/rpc'
    }
}

export const providers = {
    fuji: new ethers.providers.JsonRpcProvider(urls.provider.fuji)
}

export const addresses = {
    fuji: {
        router: {
            v2: ethers.utils.getAddress("0x28121fb95692a9be3fb1c6891ffee74b88bdfb2b"),
            v3: ethers.utils.getAddress("0x31122CeF9891Ef661C99352266FA0FF0079a0e06")
        }
    }
}

export const bytecodeHashes = {
    ArrowOptionChainProxy: {
        v2: ethers.utils.solidityKeccak256(
            ['bytes'],
            [ArrowOptionChainProxy.v2.bytecode]
        ),
        v3: ethers.utils.solidityKeccak256(
            ['bytes'],
            [ArrowOptionChainProxy.v3.bytecode]
        )
    }
}

export async function estimateOptionPrice(option: Option, version='v2') {
    let strike = undefined
    if (version === 'v2') {
        strike = option.strike
    } else if (version === 'v3') {
        strike = (option.strike as number[]).join('|')
    } else {
        throw UNSUPPORTED_VERSION_ERROR
    }

    const estimatedOptionPriceReponse = await axios.post(urls.api[version] + '/estimate-option-price', {
        "ticker": option.ticker,
        "expiration": option.expiration, // API only takes in readable expirations so it can manually set the expiration at 9:00 PM UTC
        "strike": strike,
        "contract_type": option.contractType,
        "quantity": option.quantity,
        "price_history": option.priceHistory!
    })
    const estimatedOptionPrice = parseFloat(estimatedOptionPriceReponse.data.option_price.toFixed(6))
    return estimatedOptionPrice
}

export async function submitOptionOrder(deliverOptionParams: DeliverOptionParams, version='v2') {
    // Submit option order through API
    const {
        data: { tx_hash, execution_price }
    } = await axios.post(urls.api[version] + '/submit-order', {
        buy_flag: deliverOptionParams.buyFlag,
        ticker: deliverOptionParams.ticker,
        expiration: deliverOptionParams.expiration,
        strike: deliverOptionParams.formattedStrike,
        contract_type: deliverOptionParams.contractType,
        quantity: deliverOptionParams.quantity,
        threshold_price: deliverOptionParams.bigNumberThresholdPrice.toString(),
        hashed_params: deliverOptionParams.hashedValues,
        signature: deliverOptionParams.signature
    })
    return [tx_hash, execution_price]
}

export function getRouterContract(
    wallet:ethers.providers.Provider|ethers.Wallet=providers.fuji,
    version='v2'
) {
    const router = new ethers.Contract(
        addresses.fuji.router[version],
        IArrowRouter[version],
        wallet
    )
    return router
}

export async function getStablecoinContract(
    wallet:ethers.providers.Provider|ethers.Wallet=providers.fuji,
    version='v2'
) {
    const stablecoin = new ethers.Contract(
        await getRouterContract(wallet, version).getStablecoinAddress(),
        IERC20Metadata,
        wallet
    )
    return stablecoin
}

export async function getEventsContract(
    wallet:ethers.providers.Provider|ethers.Wallet=providers.fuji,
    version='v2'
) {
    const events = new ethers.Contract(
        await getRouterContract(wallet, version).getEventsAddress(),
        IArrowEvents[version],
        wallet
    )
    return events
}

export async function getRegistryContract(
    wallet:ethers.providers.Provider|ethers.Wallet=providers.fuji,
    version='v2'
) {
    const registry = new ethers.Contract(
        await getRouterContract(wallet, version).getRegistryAddress(),
        IArrowRegistry[version],
        wallet
    )
    return registry
}

export async function computeOptionChainAddress(ticker, readableExpiration, version='v2') {
    // Get chain factory contract address from router
    const router = getRouterContract(providers.fuji, version)
    let optionChainFactoryAddress = undefined
    if (version === 'v2') {
        optionChainFactoryAddress = await router.getChainFactoryAddress()
    } else if (version === 'v3' || version === 'competition') {
        optionChainFactoryAddress = await router.getOptionChainFactoryAddress()
    } else {
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

export async function prepareDeliverOptionParams(optionOrderParams: OptionOrderParams, wallet, version='v2'): Promise<DeliverOptionParams> {
    // Get stablecoin decimals
    const stablecoinDecimals = await (await getStablecoinContract(wallet, version)).decimals()

    // Define vars
    const thresholdPrice = ethers.utils.parseUnits(optionOrderParams.thresholdPrice.toString(), stablecoinDecimals)
    const unixExpiration = moment.utc(optionOrderParams.expiration, 'MMDDYYYY').add(21, 'hours').unix()
    let bigNumberStrike = undefined
    let formattedStrike = undefined
    let strikeType = undefined
    if (version === 'v2') {
        bigNumberStrike = ethers.utils.parseUnits(optionOrderParams.strike.toString(), stablecoinDecimals)
        formattedStrike = optionOrderParams.strike.toString()
        strikeType = 'uint256'
    } else if (version === 'v3') {
        bigNumberStrike = [
            ethers.utils.parseUnits(optionOrderParams.strike[0].toString(), stablecoinDecimals),
            ethers.utils.parseUnits(optionOrderParams.strike[1].toString(), stablecoinDecimals)
        ]
        formattedStrike = (optionOrderParams.strike as number[]).join('|')
        strikeType = 'uint256[2]'
    } else {
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
            optionOrderParams.quantity,
            thresholdPrice
        ]
    )
    const signature = await wallet.signMessage(ethers.utils.arrayify(hashedValues)) // Note that we are signing a message, not a transaction

    // Calculate amount to approve for this order (total = thresholdPrice * quantity)
    const amountToApprove = ethers.BigNumber.from(thresholdPrice).mul(optionOrderParams.quantity)

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

export async function settleOptions(wallet, owner, ticker, expiration, version='v2') {
    const router = getRouterContract(wallet, version)
    if (version === 'v2') {
        try {
            await router.callStatic.settleOption(owner, ticker, expiration)
            await router.settleOption(owner, ticker, expiration)
        } catch(err) {
            throw new Error("Settlement call would fail on chain")
        }
    } else if (version === 'v3') {
        try {
            await router.callStatic.settleOptions(owner, ticker, expiration)
            await router.settleOptions(owner, ticker, expiration)
        } catch(err) {
            throw new Error("Settlement call would fail on chain")
        }
    } else {
        throw UNSUPPORTED_VERSION_ERROR
    }
}

const arrowsdk = {
    // Variables
    urls,
    providers,
    addresses,

    // API functions
    estimateOptionPrice,
    submitOptionOrder,

    // Blockchain functions
    getRouterContract,
    getStablecoinContract,
    getEventsContract,
    getRegistryContract,
    computeOptionChainAddress,
    prepareDeliverOptionParams
}

export default arrowsdk