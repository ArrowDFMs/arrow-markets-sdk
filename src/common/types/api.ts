import { ContractType, Currency, Interval, Option, OrderType } from './option'

export interface OptionPricePayload {
  options: Option[]
  spot_price?: number
  price_history?: number[]
}

export interface OptionPriceResponse {
  option_legs_prices: {
    strike: number
    contractType: ContractType
    orderType: OrderType
    price: number
  }[]
  total_position_price: number
  greeks: {
    delta: number
    gamma: number
    theta: number
    vega: number
    rho: number
  }
}

export type GetBinanceTickerPriceResponse = {
  price: number
  code: number
}

export interface GetUnderlierHistoricalPricesRequest {
  vs_currency: Currency
  days?: number
  from?: number
  to?: number
  interval?: Interval
}

export interface GetUnderlierHistoricalPricesResponse {
  market_caps: number[][]
  prices: number[][]
  total_volumes: number[][]
}

export interface GeoLocationData {
  data: {
    ip: string
    country: string
  }
}
