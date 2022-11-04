/*****************************
 *          IMPORTS          *
 *****************************/

import { ethers } from "ethers"

/**********************************
 *          USEFUL TYPES          *
 **********************************/

export enum Version {
    V3 = "v3",
    V4 = "v4",
    COMPETITION = "competition"
}

export enum Ticker {
    AVAX = "AVAX",
    ETH = "ETH",
    BTC = "BTC"
}

export enum ContractType {
    CALL = 0,
    PUT = 1,
    CALL_SPREAD = 2,
    PUT_SPREAD = 3
}

export enum OrderType {
    LONG_OPEN = 0,
    LONG_CLOSE = 1,
    SHORT_OPEN = 2,
    SHORT_CLOSE = 3
}

export enum Currency {
    USD = "usd",
    EUR = "eur"
}

export enum Interval {
    DAILY = "daily"
}

/**************************************
 *          ARROW INTERFACES          *
 **************************************/

export interface Greeks {
    delta: number; // Sensitivity of an option’s price to changes in the value of the underlying.
    gamma: number; // Change in delta per change in price of the underlying.
    rho: number; // Sensitivity of option prices to changes in interest rates.
    theta: number; // Measures time decay of price of option.
    vega: number; // Change in value from a 1% change in volatility.
}

export interface OptionContract {
    ticker: Ticker; // Ticker enum that denotes a particular asset.
    expiration: string; // Readable expiration date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
    strike: number[]; // Accepts arrays with two values for spreads. Formatted as [longStrike, shortStrike].
    contractType: ContractType; // ContractType enum that indicates whether the option is a call, put, call spread, or put spread.
    price?: number; // Float number that indicates the price of 1 option.
    spotPrice?: number; // Most up-to-date price of underlying asset.
    priceHistory?: {
        date: number;
        price: number;
    }[]; // Prices of underlying asset over some period of history.
    greeks?: Greeks; // Greeks interface that specifies which greeks are tied to this option.
}

export interface OptionOrderParams extends OptionContract {
    payPremium?: boolean | null,
    quantity?: number; // Float number of contracts desired in the order.
    orderType: OrderType // OrderType enum that indicates whether this option is a long open, long close, short open, or short close.
    thresholdPrice?: number; // The minimum (or maximum) price the user is willing to receive (or pay) for this specific option.
}

export interface DeliverOptionParams extends OptionOrderParams {
    hashedValues: string;
    signature: string;
    amountToApprove: ethers.BigNumber;
    unixExpiration: number; // UTC expiration date of option in UNIX timestamp.
    formattedStrike: string; // Turns strike[] into formatted string with format like "longStrike|shortStrike".
    bigNumberStrike: ethers.BigNumber[];
    bigNumberThresholdPrice: ethers.BigNumber;
}

/*******************************************
 *       EXTERNAL REQUEST INTERFACES       *
 *******************************************/

export interface GetUnderlierHistoricalPricesRequest {
    vs_currency: Currency;
    days?: number;
    interval?: Interval;
}

export interface GetUnderlierHistoricalPricesRequest {
    vs_currency: Currency;
    days?: number;
    from?: number;
    to?: number;
    interval?: Interval;
}

export interface GetUnderlierHistoricalPricesResponse {
    market_caps: number[][];
    prices: number[][];
    total_volumes: number[][];
}