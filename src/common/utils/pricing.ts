import { BaseArrowAPI } from '../constants/api'
import { binanceSymbols, coingeckoIDs } from '../constants/pricing'
import {
  GetBinanceTickerPriceResponse,
  GetUnderlierHistoricalPricesResponse,
  OptionPricePayload,
  OptionPriceResponse
} from '../types/api'
import { ApplicationVersion } from '../types/general'
import { Currency, Ticker, Option } from '../types/option'
import { NetworkVersion } from '../types/web3'
import { GET, POST } from './axios'

export async function estimateOptionPrice(
  options: Option[],
  network: NetworkVersion
): Promise<OptionPriceResponse> {
  const spotPrice = await getUnderlierSpotPrice(options[0].ticker)
  const { priceHistory } = await getUnderlierMarketChart(options[0].ticker)

  const payload: OptionPricePayload = {
    options: options,
    spot_price: spotPrice,
    price_history: priceHistory.map(entry => entry.price)
  }

  try {
    const apiUrl = BaseArrowAPI[ApplicationVersion.VAULT][network]
    const response = await POST<OptionPricePayload, OptionPriceResponse>(
      `${apiUrl}/option/estimate-price`,
      payload
    )

    return {
      total_position_price: response.data['total_position_price'],
      greeks: response.data['greeks'],
      option_legs_prices: response.data['option_legs_prices']
    }
  } catch (error) {
    console.error(error)

    throw Error('Error estimating option price.')
  }
}

export async function getUnderlierSpotPrice(ticker: Ticker) {
  try {
    const binanceResponse = await GET<GetBinanceTickerPriceResponse>(
      `https://data.binance.com/api/v3/ticker/price`,
      {
        params: {
          symbol: binanceSymbols[ticker]
        }
      }
    )

    try {
      return parseFloat(binanceResponse.data.price.toString())
    } catch {
      throw Error('Could not retrieve underlying spot price from Binance.')
    }
  } catch (binanceError) {
    // If Binance request fails, try on Binance US
    try {
      const binanceUSResponse = await GET<GetBinanceTickerPriceResponse>(
        `https://data.binance.us/api/v3/ticker/price`,
        {
          params: {
            symbol: binanceSymbols[ticker]
          }
        }
      )

      try {
        return parseFloat(binanceUSResponse.data.price.toString())
      } catch {
        throw Error('Could not retrieve underlying spot price from Binance US.')
      }
    } catch (binanceUSError) {
      // If both Binance and Binance US requests fail, use CryptoWatch
      const cryptowatchResponse = await GET<any>(
        `https://api.cryptowat.ch/markets/binance/${binanceSymbols[ticker]}/price`
      )

      try {
        return parseFloat(cryptowatchResponse.data.result.price)
      } catch {
        throw Error(
          'Could not retrieve underlying spot price from CryptoWatch.'
        )
      }
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
    data: { market_caps: marketCaps, prices }
  } = await GET<GetUnderlierHistoricalPricesResponse>(
    `https://api.coingecko.com/api/v3/coins/${underlierID}/market_chart`,
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      params: {
        days,
        vs_currency: currency
      }
    }
  )

  const priceHistory = prices.map(entry => ({
    date: entry[0],
    price: entry[1]
  }))

  return { priceHistory, marketCaps }
}
