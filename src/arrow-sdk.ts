import axios from "axios";
import { ethers } from "ethers";
import * as moment from "moment";
// import moment from "moment";

import {
  IERC20Metadata,
  IArrowRouter,
  IArrowEvents,
  IArrowRegistry
} from "../abis";

import { ArrowOptionChainProxy } from "../build";

/**************************************
 *             INTERFACES             *
 **************************************/

export interface Greeks {
  delta: number,
  gamma: number,
  rho: number,
  theta: number,
  vega: number,
}

export interface Option {
  order_type?: ORDER_TYPE;
  ticker: string;
  expiration: string;
  strike: number | number[];
  contractType: number;
  quantity?: number;
  price?: number;
  underlierPriceHistory?: number[];
  greeks?: Greeks;
  spotPrice?: number;
}

export interface OptionOrderParams extends Option {
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

export interface GetUnderlierHistoricalPricesRequest {
  vs_currency: "usd" | "eur";
  days?: number;
  interval?: "daily";
}

export interface GetUnderlierHistoricalPricesRequest {
  vs_currency: "usd" | "eur";
  days?: number;
  from?: number;
  to?: number;
  interval?: "daily";
}

export interface GetUnderlierHistoricalPricesResponse {
  market_caps: number[][];
  prices: number[][];
  total_volumes: number[][];
}

/**************************************
 *          USEFUL CONSTANTS          *
 **************************************/

const UNSUPPORTED_VERSION_ERROR = new Error(
  "Please select a supported contract version."
);

const UNSUPPORTED_EXPIRATION_ERROR = new Error(
  "Please select a Friday expiration date."
);

export enum VERSION {
  V3 = "v3",
  COMPETITION = "competition",
}

export enum ORDER_TYPE {
  LONG_OPEN = 0,
  LONG_CLOSE = 1,
  SHORT_OPEN = 2,
  SHORT_CLOSE = 3,
}

export const urls: any = {
  api: {
    [VERSION.V3]: "https://fuji-v3-api.arrow.markets/v1/",
    [VERSION.COMPETITION]: "https://competition-v2-api.arrow.markets/v1",
  },
  provider: {
    fuji: "https://api.avax-test.network/ext/bc/C/rpc",
  },
};

export const providers: any = {
  fuji: new ethers.providers.JsonRpcProvider(urls.provider.fuji),
};

export const addresses: any = {
  fuji: {
    router: {
      [VERSION.V3]: ethers.utils.getAddress(
        "0x31122CeF9891Ef661C99352266FA0FF0079a0e06"
      ),
      [VERSION.COMPETITION]: ethers.utils.getAddress(
        "0xD0890Cc0B2F5Cd6DB202378C35F39Db3EB0A4b0C"
      ),
    },
  },
};

export const bytecodeHashes: any = {
  ArrowOptionChainProxy: {
    [VERSION.V3]: ethers.utils.solidityKeccak256(
      ["bytes"],
      [ArrowOptionChainProxy.v3.bytecode]
    ),
    [VERSION.COMPETITION]: ethers.utils.solidityKeccak256(
      ["bytes"],
      [ArrowOptionChainProxy.competition.bytecode]
    ),
  },
};

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
  version: VERSION = VERSION.V3
) {
  const strike = (option.strike as number[]).join("|");

  const { priceHistory: price_history, currentPrice } =
    await getUnderlierPriceAndHistory(option.ticker);

  const estimatedOptionPriceResponse = await axios.post(
    urls.api[version] + "/estimate-option-price",
    {
      order_type: option.order_type,
      ticker: option.ticker,
      expiration: option.expiration, // API only takes in readable expirations so it can manually set the expiration at 9:00 PM UTC
      strike: strike,
      contract_type: option.contractType,
      quantity: option.quantity,
      price_history: price_history,
      spot_price: currentPrice,
    }
  );
  const estimatedOptionPrice = parseFloat(
    estimatedOptionPriceResponse.data.option_price.toFixed(6)
  );
  const greeks: Greeks = estimatedOptionPriceResponse.data.greeks;

  return { estimatedOptionPrice, greeks };
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
  ticker: string,
  readableExpiration: string,
  forecast: number,
  version: VERSION = VERSION.V3
) {
  const { currentPrice, priceHistory } = await getUnderlierPriceAndHistory(
    ticker
  );

  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR;

  try {
    const recommendedOptionResponse = await axios.post(
      urls.api[version] + "/get-recommended-option",
      {
        ticker: ticker,
        expiration: readableExpiration,
        forecast: forecast,
        spot_price: currentPrice,
        price_history: priceHistory,
      }
    );

    const recommendedOption: Option = {
      ticker: ticker,
      expiration: readableExpiration,
      strike: recommendedOptionResponse.data.option.strike,
      contractType: recommendedOptionResponse.data.option.contract_type,
      price: recommendedOptionResponse.data.option.price,
      greeks: recommendedOptionResponse.data.option.greeks,
    };

    return recommendedOption;
  } catch (error) {
    throw error;
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
  ticker: string,
  readableExpiration: string,
  contractType: number,
  version: VERSION = VERSION.V3
) {
  //TO DO Get HISTORICAL PRICE IF PRICE HISTORY IS NULL
  const { currentPrice, priceHistory } = await getUnderlierPriceAndHistory(
    ticker
  );
  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR;

  const strikeGridResponse = await axios.post(
    urls.api[version] + "/get-strike-grid",
    {
      order_type: order_type,
      ticker: ticker,
      expiration: readableExpiration,
      contract_type: contractType,
      price_history: priceHistory,
      spot_price: currentPrice,
    }
  );
  const strikeGrid = [];
  for (let i = 0; i < strikeGridResponse.data.options.length; i++) {
    const strikeGridOption = strikeGridResponse.data.options[i];
    const option: Option = {
      ticker: ticker,
      expiration: readableExpiration,
      strike: strikeGridOption.strike,
      contractType: contractType,
      price: strikeGridOption.price,
      greeks: strikeGridOption.greeks,
    };
    strikeGrid.push(option);
  }

  return strikeGrid;
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
  version: VERSION = VERSION.V3
) {
  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR;

  // Submit option order through API
  const orderSubmissionResponse = await axios.post(
    urls.api[version] + "/submit-order",
    {
      order_type: deliverOptionParams.order_type,
      ticker: deliverOptionParams.ticker,
      expiration: deliverOptionParams.expiration, // readable expiration
      strike: deliverOptionParams.formattedStrike,
      contract_type: deliverOptionParams.contractType,
      quantity: deliverOptionParams.quantity,
      threshold_price: deliverOptionParams.bigNumberThresholdPrice.toString(),
      hashed_params: deliverOptionParams.hashedValues,
      signature: deliverOptionParams.signature,
    }
  );
  // Return all data from response
  return orderSubmissionResponse.data;
}

/***************************************
 *      CONTRACT GETTER FUNCTIONS      *
 ***************************************/

/**
 * Get the router contract from Arrow's contract suite.
 *
 * @param wallet Wallet with which you want to connect the instance of the router contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns Local instance of ethers.Contract for the Arrow router contract.
 */
export function getRouterContract(
  wallet:
    | ethers.providers.Provider
    | ethers.Wallet
    | ethers.Signer = providers.fuji,
  version: VERSION = VERSION.V3
) {
  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR;

  const router = new ethers.Contract(
    addresses.fuji.router[version],
    IArrowRouter[version],
    wallet
  );
  return router;
}

/**
 * Get the stablecoin contract that is associated with Arrow's contract suite.
 *
 * @param wallet Wallet with which you want to connect the instance of the stablecoin contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns Local instance of ethers.Contract for the stablecoin contract.
 */
export async function getStablecoinContract(
  wallet:
    | ethers.providers.Provider
    | ethers.Wallet
    | ethers.Signer = providers.fuji,
  version: VERSION = VERSION.V3
) {
  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR;

  const stablecoin = new ethers.Contract(
    await getRouterContract(wallet, version).getStablecoinAddress(),
    IERC20Metadata,
    wallet
  );
  return stablecoin;
}

/**
 * Get the events contract from Arrow's contract suite.
 *
 * @param wallet Wallet with which you want to connect the instance of the Arrow events contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns Local instance of ethers.Contract for the Arrow events contract.
 */
export async function getEventsContract(
  wallet:
    | ethers.providers.Provider
    | ethers.Wallet
    | ethers.Signer = providers.fuji,
  version: VERSION = VERSION.V3
) {
  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR;

  const events = new ethers.Contract(
    await getRouterContract(wallet, version).getEventsAddress(),
    IArrowEvents[version],
    wallet
  );
  return events;
}

/**
 * Get the registry contract from Arrow's registry suite.
 *
 * @param wallet Wallet with which you want to connect the instance of the Arrow registry contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns Local instance of ethers.Contract for the Arrow registry contract.
 */
export async function getRegistryContract(
  wallet:
    | ethers.providers.Provider
    | ethers.Wallet
    | ethers.Signer = providers.fuji,
  version: VERSION = VERSION.V3
) {
  if (!isValidVersion(version)) throw UNSUPPORTED_VERSION_ERROR;

  const registry = new ethers.Contract(
    await getRouterContract(wallet, version).getRegistryAddress(),
    IArrowRegistry[version],
    wallet
  );
  return registry;
}

/****************************************
 *           HELPER FUNCTIONS           *
 ****************************************/

export async function getUnderlierPriceAndHistory(ticker: string) {
  try {
    const days = 84;
    const underlierId = getUnderlierId(ticker);
    const {
      data: { market_caps, prices },
    } = await axios.get<GetUnderlierHistoricalPricesResponse>(
      `https://api.coingecko.com/api/v3/coins/${underlierId}/market_chart`,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        params: {
          days,
          vs_currency: "usd",
        },
      }
    );
    const priceHistory = prices.map((entry) => entry[1]);
    const currentPrice = priceHistory[priceHistory.length - 1];

    return {
      priceHistory: priceHistory,
      currentPrice: currentPrice,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Helper function that can be used to check if a version is valid.
 *
 * @param version Type of VERSION enum.
 * @returns True if version is valid, else false.
 */
function isValidVersion(version: VERSION): boolean {
  return Object.values(VERSION).includes(version);
}

export const getUnderlierId = (ticker: string) => {
  switch (ticker) {
    case "AVAX":
      return "avalanche-2";
    case "ETH":
      return "ethereum";
    case "BTC":
      return "bitcoin";
  }
};

/**
 * Get readable timestamp from millisecond timestamp.
 *
 * @param millisTimestamp Millisecond timestamp. For example, 1654848000000 for Jun 10 2022 08:00:00
 * @returns Readable timestamp in the "MMDDYYYY" format.
 */
export function getReadableTimestamp(millisTimestamp: number) {
  return moment.utc(millisTimestamp).format("MMDDYYYY");
}

/**
 * Get current time in UTC.
 *
 * @returns Object that contains a moment object & unix, millisecond, and readable timestamp representations of the current time
 */
export function getCurrentTimeUTC() {
  const currentTime = moment.utc();
  const utcMillisecondTimestamp = currentTime.valueOf();
  return {
    momentTimestamp: currentTime,
    unixTimestamp: currentTime.unix(),
    millisTimestamp: utcMillisecondTimestamp,
    readableTimestamp: getReadableTimestamp(utcMillisecondTimestamp),
  };
}

/**
 * Get unix, millisecond, and readable UTC timestamps from millisecond timestamp in any other time zone.
 *
 * @param millisTimestamp Millisecond timestamp. For example, 1654848000000 for Jun 10 2022 08:00:00.
 * @returns Object that contains a moment object & unix, millisecond, and readable UTC timestamp representations of millisTimestamp.
 */
export function getTimeUTC(millisTimestamp: number) {
  const time = moment.utc(millisTimestamp);
  const utcMillisecondTimestamp = time.valueOf();
  return {
    momentTimestamp: time,
    unixTimestamp: time.unix(),
    millisTimestamp: utcMillisecondTimestamp,
    readableTimestamp: getReadableTimestamp(utcMillisecondTimestamp),
  };
}

/**
 * Get unix and millisecond timestamps from readable expiration. This works for any readable timestamp, not just expirations.
 *
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @returns Object that contains a moment object & unix and millisecond timestamp representations of the readable timestamp.
 */
export function getExpirationTimestamp(readableExpiration: string) {
  const expiration = moment.utc(readableExpiration, "MMDDYYYY").set("hour", 8);
  if (isFriday(expiration.unix())) {
    return {
      momentTimestamp: expiration,
      unixTimestamp: expiration.unix(),
      millisTimestamp: expiration.valueOf(),
    };
  } else {
    throw UNSUPPORTED_EXPIRATION_ERROR;
  }
}

/**
 * Checks if a unix expiration is a Friday
 *
 * @param unixExpiration Unix expiration timestamp
 * @returns True if is a Friday, else returns False
 */
export function isFriday(unixExpiration: number) {
  const dayOfTheWeek: number =
    (Math.floor(unixExpiration / (60 * 60 * 24)) + 4) % 7;
  return dayOfTheWeek === 5;
}

/**
 * Compute address of on-chain option chain contract using CREATE2 functionality.
 *
 * @param ticker Ticker of the underlying asset.
 * @param readableExpiration Readable expiration in the "MMDDYYYY" format.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns Address of the option chain corresponding to the passed ticker and expiration.
 */
export async function computeOptionChainAddress(
  ticker: string,
  readableExpiration: string,
  version: VERSION = VERSION.V3
): Promise<string> {
  // Get chain factory contract address from router
  const router = getRouterContract(providers.fuji, version);

  let optionChainFactoryAddress = undefined;
  switch (version) {
    case VERSION.V3:
    case VERSION.COMPETITION:
      optionChainFactoryAddress = await router.getOptionChainFactoryAddress();
      break;
    default:
      throw UNSUPPORTED_VERSION_ERROR; // Never reached because of the check in `getRouterContract`
  }

  // Build salt for CREATE2
  const salt = ethers.utils.solidityKeccak256(
    ["address", "string", "uint256"],
    [optionChainFactoryAddress, ticker, readableExpiration]
  );

  // Compute option chain proxy address using CREATE2
  const optionChainAddress = ethers.utils.getCreate2Address(
    optionChainFactoryAddress,
    salt,
    bytecodeHashes.ArrowOptionChainProxy[version]
  );

  return optionChainAddress;
}

/**
 * Help construct DeliverOptionParams object that can be passed to the Arrow API to submit an option order.
 *
 * @param optionOrderParams Object containing parameters necesssary in computing parameters for submitting an option order.
 * @param wallet Wallet with which you want to submit the option order.
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 * @returns JSON that contains the variables necessary in completing the option order.
 */
export async function prepareDeliverOptionParams(
  optionOrderParams: OptionOrderParams,
  wallet: ethers.Wallet | ethers.Signer,
  version: VERSION = VERSION.V3
): Promise<DeliverOptionParams> {
  // Get stablecoin decimals
  const stablecoinDecimals = await (
    await getStablecoinContract(wallet, version)
  ).decimals();

  // Define vars
  const thresholdPrice = ethers.utils.parseUnits(
    optionOrderParams.thresholdPrice.toString(),
    stablecoinDecimals
  );
  const unixExpiration = getExpirationTimestamp(
    optionOrderParams.expiration
  ).unixTimestamp;
  let bigNumberStrike = undefined;
  let formattedStrike = undefined;
  let strikeType = undefined;

  switch (version) {
    case VERSION.V3:
    case VERSION.COMPETITION:
      const strikes = (optionOrderParams.strike as number[]).map((strike) =>
        strike.toFixed(2)
      );
      bigNumberStrike = strikes.map((strike) =>
        ethers.utils.parseUnits(strike, stablecoinDecimals)
      );
      formattedStrike = strikes.join("|");
      strikeType = "uint256[2]";
      break;
    default:
      throw UNSUPPORTED_VERSION_ERROR; // Never reached because of the check in `getStablecoinContract`
  }

  // Hash and sign the option order parameters for on-chain verification
  const hashedValues = ethers.utils.solidityKeccak256(
    [
      "bool", // buy_flag - Boolean to indicate whether this is a buy (true) or sell (false).
      "string", // ticker - String to indicate a particular asset ("AVAX", "ETH", or "BTC").
      "uint256", // expiration - Date in Unix timestamp. Must be 9:00 PM UTC (e.g. 1643144400 for January 25th, 2022)
      "uint256", // readableExpiration - Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
      strikeType, // strike - Ethers BigNumber versions of the strikes in terms of the stablecoin's decimals (e.g. [ethers.utils.parseUnits(strike, await usdc_e.decimals()), ethers.BigNumber.from(0)]).
      "string", // decimalStrike - String version of the strike that includes the decimal places (e.g. "12.25").
      "uint256", // contract_type - 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
      "uint256", // quantity - Number of contracts desired in the order.
      "uint256", // threshold_price - Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
    ],
    [
      [ORDER_TYPE.LONG_OPEN, ORDER_TYPE.SHORT_OPEN].includes(
        optionOrderParams.order_type!
      ),
      optionOrderParams.ticker,
      unixExpiration,
      optionOrderParams.expiration,
      bigNumberStrike,
      formattedStrike,
      optionOrderParams.contractType,
      optionOrderParams.quantity!,
      thresholdPrice,
    ]
  );
  const signature = await wallet.signMessage(
    ethers.utils.arrayify(hashedValues)
  ); // Note that we are signing a message, not a transaction

  // Calculate amount to approve for this order (total = thresholdPrice * quantity)
  const amountToApprove = ethers.BigNumber.from(thresholdPrice).mul(
    optionOrderParams.quantity!
  );

  return {
    hashedValues,
    signature,
    amountToApprove,
    ...optionOrderParams,
    unixExpiration,
    formattedStrike,
    bigNumberStrike,
    bigNumberThresholdPrice: thresholdPrice,
  };
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
 * @param version Version of Arrow contract suite with which to interact. Default is V3.
 */
export async function settleOptions(
  wallet: ethers.Wallet | ethers.Signer,
  ticker: string,
  readableExpiration: string,
  owner = undefined,
  version: VERSION = VERSION.V3
) {
  const router = getRouterContract(wallet, version);

  switch (version) {
    case VERSION.V3:
    case VERSION.COMPETITION:
      try {
        await router.callStatic.settleOptions(
          owner,
          ticker,
          readableExpiration
        );
        await router.settleOptions(owner, ticker, readableExpiration);
      } catch (err) {
        throw new Error("Settlement call would fail on chain.");
      }
      break;
    default:
      throw UNSUPPORTED_VERSION_ERROR; // Never reached because of the check in `getRouterContract`
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
  isValidVersion,
  getReadableTimestamp,
  getCurrentTimeUTC,
  getTimeUTC,
  getExpirationTimestamp,
  getUnderlierPriceAndHistory,

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
  settleOptions,
};

export default arrowsdk;
