export enum Ticker {
  AVAX = 'AVAX',
  ETH = 'ETH',
  BTC = 'BTC'
}

export enum Currency {
  USD = 'usd',
  EUR = 'eur'
}

export enum Interval {
  DAILY = 'daily'
}

export type Strike = number[]

export enum ContractType {
  CALL = 0,
  PUT = 1
}

export enum PositionStrategy {
  CALL = 0,
  PUT = 1,
  CALL_SPREAD = 2,
  PUT_SPREAD = 3,
  BUTTERFLY = 4,
  IRON_CONDOR = 5
}

export enum OrderType {
  LONG_OPEN = 0,
  LONG_CLOSE = 1,
  SHORT_OPEN = 2,
  SHORT_CLOSE = 3
}

export interface Greeks {
  delta: number // Sensitivity of an option’s price to changes in the value of the underlying.
  gamma: number // Change in delta per change in price of the underlying.
  rho: number // Sensitivity of option prices to changes in interest rates.
  theta: number // Measures time decay of price of option.
  vega: number // Change in value from a 1% change in volatility.
}

export interface Option {
  ticker: Ticker
  contractType: ContractType
  orderType: OrderType
  strike: number
  price?: number
  readableExpiration: string
  expirationTimestamp: number
  quantity: number
}

export interface PositionInterface {
  symbol?: string
  ticker: Ticker
  optionLegs: Option[]
  strategyType: PositionStrategy
  orderType: OrderType
  ratio: number
  price?: number
  spotPrice?: number
  priceHistory?: {
    date: number
    price: number
  }[]
  greeks?: Greeks
}

export type PositionStrategyType =
  | 'Long Call'
  | 'Short Call'
  | 'Long Put'
  | 'Short Put'
  | 'Call Debit Spread'
  | 'Call Credit Spread'
  | 'Put Debit Spread'
  | 'Put Credit Spread'
  | 'Put Spread'
  | 'Long Iron Condor'
  | 'Short Iron Condor'
  | 'Long Butterfly'
  | 'Short Butterfly'
  | 'Custom'

class Position implements PositionInterface {
  symbol: string
  ticker: Ticker
  optionLegs: Option[]
  ratio: number
  orderType: OrderType
  strategyType: PositionStrategy

  constructor(
    ticker: Ticker,
    optionLegs: Option[],
    strategyType: PositionStrategy,
    ratio: number,
    orderType: OrderType
  ) {
    this.ticker = ticker
    this.optionLegs = optionLegs
    this.ratio = ratio
    this.orderType = orderType
    this.strategyType = strategyType

    const strikes = optionLegs.map(option => option.strike).join('/')
    const contractTypes = optionLegs
      .map(option => option.contractType)
      .join('/')
    const orderTypes = optionLegs.map(option => option.orderType).join('/')

    this.symbol = `${ticker}_${strikes}_${contractTypes}_${orderTypes}`
  }
}
