/*****************************
 *          IMPORTS          *
 *****************************/

// Packages
import axios from 'axios'
import { ethers } from 'ethers'

// Types
import {
  DeliverOptionParams,
  GetRecommendedStrategiesResponse,
  ProtectionType,
  RecommendationStrategyType,
  StrikeGridOption,
  TradingView,
  Version
} from './types'

// Constants
import {
  addresses,
  DEFAULT_VERSION,
  providers,
  UNSUPPORTED_VERSION_ERROR,
  urls
} from './constants'

// Helpers
import {
  computeOptionChainAddress,
  computeShortAggregatorAddress,
  getEventsContract,
  getRegistryContract,
  getRouterContract,
  getUnderlierAssetContract,
  getStablecoinContract,
  isValidVersion,
  prepareDeliverOptionParams
} from './utilities'
import {
  getUnderlierMarketChart,
  getUnderlierSpotPrice
} from '@arrow-markets/arrow-common-sdk/lib/utils/pricing'
import {
  ContractType,
  OrderType,
  PositionStrategy,
  Ticker
} from '@arrow-markets/arrow-common-sdk/lib/types/option'
import { Position } from '@arrow-markets/arrow-common-sdk'
import { getExpirationTimestamp } from '@arrow-markets/arrow-common-sdk/lib/utils/time'
import {
  convertToGeneralPositionType,
  determinePositionStrategyType,
  getOrderTypeFromPositionType
} from '@arrow-markets/arrow-common-sdk/lib/utils/parsing'

/***************************************
 *           ARROW API CALLS           *
 ***************************************/

/**
 * Given a set of option parameters, get an estimated gas price for the transaction.
 *
 * @param orderParameters Array of objects containing parameters that define an option on Arrow.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns JSON object that contains an estimate of the gas price and the amount of AVAX needed for the transaction.
 */
export async function estimateGasPrice(
  orderParameters: DeliverOptionParams[],
  version: Version
): Promise<Record<string, number>> {
  const params: any[] = []
  orderParameters.map(order => {
    params.push({
      order_type: order.orderType,
      ticker: order.ticker,
      expiration: order.readableExpiration,
      strike: order.formattedStrike,
      contract_type: order.strategyType,
      quantity: order.ratio,
      threshold_price: order.bigNumberThresholdPrice.toString(),
      hashed_params: order.hashedValues,
      signature: order.signature
    })
  })

  const estimateGasPriceResponse: any = await axios.post(
    urls.api[version] + '/estimate-gas',
    {
      params: params
    }
  )

  return {
    estimated_gas: estimateGasPriceResponse.data.estimated_gas,
    avax_needed: estimateGasPriceResponse.data.avax_needed
  }
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
  strategyType: RecommendationStrategyType,
  readableExpiration: string,
  forecast: number,
  spotPrice: number | undefined = undefined,
  priceHistory: number[] | undefined = undefined,
  version = DEFAULT_VERSION
): Promise<Position[]> {
  if (spotPrice === undefined) {
    spotPrice = await getUnderlierSpotPrice(ticker)
  }
  if (priceHistory === undefined) {
    priceHistory = (await getUnderlierMarketChart(ticker)).priceHistory.map(
      entry => entry.price
    )
  }

  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

  try {
    const recommendedOptionResponse =
      await axios.post<GetRecommendedStrategiesResponse>(
        urls.api[version] + '/get-recommended-option',
        {
          ticker: ticker,
          strategy_type: strategyType,
          expiration: readableExpiration,
          forecast: forecast,
          spot_price: spotPrice,
          price_history: priceHistory
        }
      )
    const parsedRecommendedPositions: Position[] = []
    recommendedOptionResponse.data.strategies.map(recommendedPositions => {
      const parsedOptionLegs = recommendedPositions.map(option => {
        return {
          ticker: ticker,
          readableExpiration: option.expiration,
          expirationTimestamp: getExpirationTimestamp(option.expiration)
            .unixExpiration,
          strike: option.strike[0],
          price: option.price,
          contractType: option.contract_type,
          orderType: option.order_type,
          quantity: 1
        }
      })
      const positionType = determinePositionStrategyType(parsedOptionLegs)
      const recommendedPosition: Position = {
        ticker: ticker,
        optionLegs: parsedOptionLegs,
        strategyType: convertToGeneralPositionType(positionType),
        orderType: getOrderTypeFromPositionType(positionType),
        ratio: 1
      }
      parsedRecommendedPositions.push(recommendedPosition)
    })

    return parsedRecommendedPositions
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
  strategyType: RecommendationStrategyType,
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
    priceHistory = (await getUnderlierMarketChart(ticker)).priceHistory.map(
      entry => entry.price
    )
  }

  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

  try {
    const recommendedOptionResponse =
      await axios.post<GetRecommendedStrategiesResponse>(
        urls.api[version] + '/get-recommended-option',
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
    const parsedRecommendedPositions: Position[] = []
    recommendedOptionResponse.data.strategies.map(recommendedPositions => {
      const parsedOptionLegs = recommendedPositions.map(option => {
        return {
          ticker: ticker,
          readableExpiration: option.expiration,
          expirationTimestamp: getExpirationTimestamp(option.expiration)
            .unixExpiration,
          strike: option.strike[0],
          price: option.price,
          contractType: option.contract_type,
          orderType: option.order_type,
          quantity: 1
        }
      })
      const positionType = determinePositionStrategyType(parsedOptionLegs)
      const recommendedPosition: Position = {
        ticker: ticker,
        optionLegs: parsedOptionLegs,
        strategyType: convertToGeneralPositionType(positionType),
        orderType: getOrderTypeFromPositionType(positionType),
        ratio: 1
      }
      parsedRecommendedPositions.push(recommendedPosition)
    })

    return parsedRecommendedPositions
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
): Promise<StrikeGridOption[]> {
  if (spotPrice === undefined) {
    spotPrice = await getUnderlierSpotPrice(ticker)
  }
  if (priceHistory === undefined) {
    priceHistory = (await getUnderlierMarketChart(ticker)).priceHistory.map(
      entry => entry.price
    )
  }

  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

  const strikeGridResponse = await axios.post(
    urls.api[version] + '/get-strike-grid',
    {
      order_type: orderType,
      ticker: ticker,
      expiration: readableExpiration,
      contract_type: contractType,
      spot_price: spotPrice,
      price_history: priceHistory
    }
  )

  const strikeGrid: StrikeGridOption[] = []
  for (let i = 0; i < strikeGridResponse.data.options.length; i++) {
    const strikeGridOption = strikeGridResponse.data.options[i]
    const option: StrikeGridOption = {
      ticker: ticker,
      readableExpiration: readableExpiration,
      strike: strikeGridOption.strike,
      contractType: contractType,
      price: strikeGridOption.price,
      greeks: strikeGridOption.greeks,
      orderType: orderType,
      expirationTimestamp:
        getExpirationTimestamp(readableExpiration).unixExpiration,
      quantity: 0
    }
    strikeGrid.push(option)
  }

  return strikeGrid
}

/**
 * Submit multiple option orders to the API to compute the live price and submit a transaction to the blockchain.
 *
 * @param deliverOptionParams[] Array of objects containing parameters necessary to create an option order on Arrow.
 * @param tradingView A string that indicates the trading view from which the order was submitted.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns Data object from API response that includes transaction hash and per-option execution price of the option transaction.
 */
export async function submitLongOptionOrder(
  deliverOptionParams: DeliverOptionParams[],
  tradingView: TradingView | undefined = undefined,
  version = DEFAULT_VERSION
) {
  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

  // Submit multiple option orders through API
  let params: any[] = []

  deliverOptionParams.map(order => {
    params.push({
      ticker: order.ticker,
      expiration: order.expiration,
      strike: order.formattedStrike,
      contract_type: order.contractType,
      quantity: order.quantity,
      threshold_price: order.bigNumberThresholdPrice.toString(),
      hashed_params: order.hashedValues,
      signature: order.signature,
      view: tradingView
    })
  })

  const apiEndPoint =
    deliverOptionParams[0].orderType === OrderType.LONG_OPEN
      ? '/open-long-position'
      : '/close-long-position'
  const orderSubmissionResponse = await axios.post(
    urls.api[version] + apiEndPoint,
    {
      params: params!
    }
  )

  // Return all data from response
  return orderSubmissionResponse.data
}

/**
 * Submit a short option order to the API to compute the live price and submit a transaction to the blockchain.
 *
 * @param deliverOptionParams Object containing parameters necessary to create an option order on Arrow.
 * @param tradingView A string that indicates the trading view from which the order was submitted.
 * @param version Version of Arrow contract suite with which to interact. Default is V4.
 * @returns Data object from API response that includes transaction hash and per-option execution price of the option transaction.
 */
export async function submitShortOptionOrder(
  deliverOptionParams: DeliverOptionParams[],
  tradingView: TradingView | undefined = undefined,
  version = DEFAULT_VERSION
) {
  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR

  // Submit multiple option orders through API
  let params: any[] = []

  deliverOptionParams.map(order => {
    params.push({
      ticker: order.ticker,
      expiration: order.expiration,
      strike: order.formattedStrike,
      contract_type: order.contractType,
      quantity: order.quantity,
      threshold_price: order.bigNumberThresholdPrice.toString(),
      hashed_params: order.hashedValues,
      signature: order.signature,
      view: tradingView
    })
  })

  const orderEndpoint =
    deliverOptionParams[0].orderType === 2
      ? '/open-short-position'
      : '/close-short-position'
  const orderSubmissionResponse = await axios.post(
    urls.api[version] + orderEndpoint,
    {
      params: params
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
    await router.callStatic.settleOptions(owner, ticker, readableExpiration)
  } catch (err) {
    throw new Error('Settlement call would fail on chain.')
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
  Version,

  // API functions
  estimateGasPrice,
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
