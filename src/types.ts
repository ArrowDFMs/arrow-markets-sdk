/*****************************
 *          IMPORTS          *
 *****************************/

import { Greeks, Option, Position } from '@arrow/arrow-common-sdk'
import {
  ContractType,
  Currency,
  Interval,
  OrderType
} from '@arrow-markets/arrow-common-sdk/lib/types/option'
import { ethers } from 'ethers'

/**********************************
 *          USEFUL TYPES          *
 **********************************/

export enum Version {
  V4 = 'v4',
  COMPETITION = 'competition'
}

export enum RecommendationStrategyType {
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

export enum TradingView {
  ADVANCED = 'advanced',
  TARGET = 'target',
  SUPPORT = 'support',
  HEDGE = 'hedge',
  PORTFOLIO = 'portfolio'
}

/**************************************
 *          ARROW INTERFACES          *
 **************************************/

export interface OptionOrderParams extends Position {
  payPremium?: boolean // Set to `True` if the user will pay the premium using stablecoin. Set to `False` to pay the premium using their collateral
  readableExpiration: string // The readable expiration of the option
  orderType: OrderType // OrderType enum that indicates whether this option is a long open, long close, short open, or short close.
  thresholdPrice?: number // The minimum (or maximum) price the user is willing to receive (or pay) for this specific option.
}

export interface DeliverOptionParams extends OptionOrderParams {
  expiration: any
  contractType: any
  quantity: any
  hashedValues: string
  signature: string
  amountToApprove: ethers.BigNumber
  unixExpiration: number // UTC expiration date of option in UNIX timestamp.
  formattedStrike: string // Turns strike[] into formatted string with format like "longStrike|shortStrike".
  bigNumberStrike: ethers.BigNumber[]
  bigNumberThresholdPrice: ethers.BigNumber
}

export interface StrikeGridOption extends Option {
  greeks: Greeks
}

/*******************************************
 *       API REQUEST INTERFACES       *
 *******************************************/

export interface RecommendedPosition extends Position {
  readableExpiration: string
  expirationTimestamp: number
}
export interface GetRecommendedStrategiesResponse {
  strategies: {
    contract_type: ContractType
    expiration: string
    greeks: Greeks
    order_type: OrderType
    price: number
    strike: number[]
  }[][]
}
