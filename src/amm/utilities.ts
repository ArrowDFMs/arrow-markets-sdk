/*****************************
 *          IMPORTS          *
 *****************************/

// Packages
import axios from 'axios'
import { Contract, ethers } from 'ethers'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(utc)
dayjs.extend(customParseFormat)

// Types
import { Currency, OptionOrderParams, OrderType, Version } from './types'

// Constants
import {
  addresses,
  binanceSymbols,
  bytecodeHashes,
  coingeckoIDs,
  DEFAULT_VERSION,
  providers,
  quantityScaleFactor,
  secondsPerDay
} from './constants'

// ABIs
import {
  IArrowEvents,
  IArrowRegistry,
  IArrowRouter,
  IERC20Metadata,
  WrappedAsset
} from '../../abis'
import {
  ContractType,
  OptionStrategyType,
  Ticker
} from '../common/types/option'
import { UNSUPPORTED_VERSION_ERROR } from '../common/exceptions'
import { getExpirationTimestamp } from '../common/utils/time'

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
  const registry = new ethers.Contract(
    await getRouterContract(version, wallet).getRegistryAddress(),
    IArrowRegistry[version],
    wallet
  )
  return registry
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

  const shortAggregatorFactoryAddress =
    await router.getShortAggregatorFactoryAddress()

  // Build salt for

  const salt = ethers.utils.solidityKeccak256(
    ['address', 'string'],
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
) {
  const preparedParams = await Promise.all(
    optionOrderParamsList.map(async optionOrderParams => {
      // Ensure that the payPremium boolean is set for closing short position.
      if (
        optionOrderParams.orderType === OrderType.SHORT_CLOSE &&
        optionOrderParams.payPremium === undefined
      ) {
        throw new Error(
          '`payPremium` boolean parameter must be set for closing a short position'
        )
      }

      // Get stablecoin decimals
      const stablecoinDecimals = await (
        await getStablecoinContract(version, wallet)
      ).decimals()

      const thresholdPrice = ethers.utils.parseUnits(
        optionOrderParams.thresholdPrice!.toFixed(stablecoinDecimals),
        stablecoinDecimals
      )
      // TODO - Handle multiple expitaions (Calendar Spreads)
      const unixExpiration = getExpirationTimestamp(
        optionOrderParams.optionLegs[0].readableExpiration
      ).unixTimestamp
      const strikes = optionOrderParams.optionLegs.map(option => option.strike)
      const bigNumberStrike = strikes.map(strike =>
        ethers.utils.parseUnits(strike.toString(), stablecoinDecimals)
      )
      const formattedStrike = strikes.join('|')
      const intQuantity = optionOrderParams.ratio! * quantityScaleFactor

      // Hash and sign the option order parameters for on-chain verification
      const hashedValues = ethers.utils.solidityKeccak256(
        [
          'string', // ticker - String to indicate a particular asset ("AVAX", "ETH", or "BTC").
          'uint256', // expiration - Date in Unix timestamp. Must be 8:00 AM UTC (e.g. 1643097600 for January 25th, 2022).
          'uint256', // readableExpiration - Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
          'uint256[2]', // strike - Ethers BigNumber versions of the strikes in terms of the stablecoin's decimals (e.g. [ethers.utils.parseUnits(strike, await usdc_e.decimals()), ethers.BigNumber.from(0)]).
          'string', // decimalStrike - String version of the strike that includes the decimal places (e.g. "12.25").
          'uint256', // contractType - 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
          'uint256', // quantity - Integer number of contracts desired in the order. Has to be scaled by supported decimals (10**2).
          'uint256' // thresholdPrice - Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
        ],
        [
          optionOrderParams.ticker,
          unixExpiration,
          optionOrderParams.optionLegs[0].readableExpiration, // Assumes we are only dealing with one expiration
          bigNumberStrike,
          formattedStrike,
          optionOrderParams.strategyType,
          intQuantity,
          thresholdPrice
        ]
      )
      // Note that we are signing a message, not a transaction
      const signature = await wallet.signMessage(
        ethers.utils.arrayify(hashedValues)
      )
      const value = optionOrderParams.thresholdPrice! * optionOrderParams.ratio!
      let amountToApprove: ethers.BigNumber

      if (optionOrderParams.orderType === OrderType.SHORT_OPEN) {
        let diffPrice: number = 0
        if (
          optionOrderParams.strategyType == OptionStrategyType.CALL ||
          optionOrderParams.strategyType == OptionStrategyType.PUT
        ) {
          // Single leg order
          diffPrice = Number(strikes[0])
        } else {
          // Spread order
          diffPrice = Math.abs(Number(strikes[0]) - Number(strikes[1]))
        }
        // TODO Handle other types of orders (IRON CONDOR, BUTTERFLY, etc.)

        amountToApprove = ethers.utils.parseUnits(
          (optionOrderParams.ratio! * diffPrice).toString(),
          stablecoinDecimals
        )
      } else {
        amountToApprove = ethers.BigNumber.from(
          ethers.utils.parseUnits(
            value.toFixed(stablecoinDecimals),
            stablecoinDecimals
          )
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
    })
  )

  return preparedParams
}

/**
 * Given option price, and order type, determines the order fee.
 *
 * @returns The order fee.
 */
export const getOrderFee = async (
  optionPrice: number,
  orderType: OrderType,
  version: Version,
  wallet: ethers.Signer
) => {
  const registry = await getRegistryContract(version, wallet)
  const orderFee =
    optionPrice *
    ((await registry.getFeeRate()) / (await registry.getFeeRateScaleFactor()))
  return orderFee
}
