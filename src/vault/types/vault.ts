import { ethers } from 'ethers'
import { Option, PositionInterface, Ticker } from '../../common/types/option'
import { OrderType, StrategyType } from '../../amm/types'
import { NetworkVersion } from '../../common/types/web3'

export interface OrderVerificationParams {
  quantity: number
  thresholdPrice: number
  vaultAddress: string
}

export interface PreparedVaultBuyOrderParameters {
  contract_address: string
  buyer_address: string
  optionPrice: number
  signature: string
  buyerAddress: string
  quantity: number
  threshold_price: number
  signatureTimestamp: number
}

export interface VaultBuyOrderParametersArgs
  extends Omit<OrderVerificationParams, 'vaultAddress' | 'thresholdPrice'> {
  ticker: Ticker
  expiration: string
  strike: number[]
  contractType: StrategyType
  orderType: OrderType
  thresholdPrice: number
  optionPrice: number
  quantity: number
  signer: ethers.providers.JsonRpcSigner
  network: NetworkVersion
}

export interface GetStrikesArgs {
  vaultAddress: string
  epoch: number
  network: NetworkVersion
}

export interface GetEpochDataArgs {
  vaultAddress: string
  epoch: number
  network: NetworkVersion
}

export interface EpochData {
  startTime: number
  expiration: number
  totalLiquidityAmount: number
  totalOptionQuantity: number
  strikes: number[]
  remainingOptionQuantity: number
  totalOptionQuantitySold: number
  totalEarnedPremiums: number
  totalEarnedFees: number
  totalLiabilities: number
  settlementPrice: number
  singleContractPayoff: number
  isExpired: boolean
  isPayoutInUnderlier?: boolean
}

export interface Vault extends PositionInterface {
  address: string
  expiration: string
  contractsRemaining: number
}
