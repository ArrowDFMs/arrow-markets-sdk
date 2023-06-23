import { ApplicationVersion } from '../types/general'
import { NetworkVersion } from '../types/web3'

export const BaseArrowAPI = {
  [ApplicationVersion.VAULT]: {
    [NetworkVersion.Fuji]:
      'https://api-vault-testnet.dev.arrowmarkets.delivery',
    [NetworkVersion.Mainnet]:
      'https://api-vault-mainnet.dev.arrowmarkets.delivery'
  },
  [ApplicationVersion.AMM]: {
    [NetworkVersion.Fuji]: 'https://development-api.arrow.markets/v1',
    [NetworkVersion.Mainnet]: 'https://development-api.arrow.markets/v1'
  },
  [ApplicationVersion.CONTEST]: {
    [NetworkVersion.Fuji]: 'https://competition-v5-api.arrow.markets/v1',
    [NetworkVersion.Mainnet]: 'https://competition-v5-api.arrow.markets/v1'
  }
}
