import { ethers, providers } from 'ethers'
import { NetworkVersion } from '../../common/types/web3'
import { Ticker } from '../../common/types/option'
import { RecommendationStrategy } from '../../amm/types'

export interface SmartContractFunctionOptions {
  address: string
  abi: any[]
  functionName: string
  functionArgs?: any[]
  signer?: ethers.Signer | providers.JsonRpcSigner
  network: NetworkVersion
}

export interface SmartContractInfo {
  ticker: Ticker
  strategyType: RecommendationStrategy
  strike?: number[]
  epoch?: number
  contractsRemaining: number
  expiration?: number // milliseconds
  addresses: Record<string, string>
  abi: any[]
}
