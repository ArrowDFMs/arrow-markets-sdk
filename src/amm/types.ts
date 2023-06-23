/*****************************
 *          IMPORTS          *
 *****************************/

import { ethers } from 'ethers'
import {
  ContractType,
  Greeks,
  Option,
  PositionInterface,
  Strike,
  Ticker
} from '../common/types/option'

/**********************************
 *          USEFUL TYPES          *
 **********************************/

export enum Version {
  V4 = 'v4',
  COMPETITION = 'competition'
}

export enum RecommendationStrategy {
  SUPPORT = 0,
  RESISTANCE = 1,
  TARGET = 2,
  BREAK_OUT_BREAK_DOWN = 3,
  PROTECT = 4
}

export enum ProtectionType {
  FULL = 0,
  PARTIAL = 1
}

export enum OrderType {
  LONG_OPEN = 0,
  LONG_CLOSE = 1,
  SHORT_OPEN = 2,
  SHORT_CLOSE = 3
}

export enum Currency {
  USD = 'usd',
  EUR = 'eur'
}

export enum TradingView {
  ADVANCED = 'advanced',
  TARGET = 'target',
  SUPPORT = 'support',
  HEDGE = 'hedge',
  PORTFOLIO = 'portfolio'
}

export enum Interval {
  DAILY = 'daily'
}

/**************************************
 *          ARROW INTERFACES          *
 **************************************/

export interface OptionOrderParams extends PositionInterface {
  payPremium?: boolean // Set to `True` if the user will pay the premium using stablecoin. Set to `False` to pay the premium using their collateral
  thresholdPrice?: number // The minimum (or maximum) price the user is willing to receive (or pay) for this specific option.
}

export interface DeliverOptionParams extends OptionOrderParams {
  hashedValues: string
  signature: string
  amountToApprove: ethers.BigNumber
  unixExpiration: number // UTC expiration date of option in UNIX timestamp.
  formattedStrike: string // Turns strike[] into formatted string with format like "longStrike|shortStrike".
  bigNumberStrike: ethers.BigNumber[]
  bigNumberThresholdPrice: ethers.BigNumber
}

export interface StrikeGridOption {
  ticker: Ticker
  expiration: string
  strike: number
  contractType: ContractType
  price: number
  greeks: Greeks
}

export interface GetRecommendedStrategiesResponse {
  strategies: StrategyLeg[][]
}

export interface StrategyLeg {
  strike: Strike
  price: number
  expiration: string
  contractType: ContractType
  orderType: OrderType
  greeks: Greeks
}
