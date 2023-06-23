import { ContractType, OrderType, Ticker } from '../../common/types/option'

export type GetVaultsResponse = {
  address: string
  expiration: number
  ticker: Ticker
  contract_type: string
}

export interface SubmitVaultBuyOrderResponse {
  tx_hash: string
  execution_price: number
}
