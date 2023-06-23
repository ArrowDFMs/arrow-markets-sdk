import { Ticker } from '../../common/types/option'
import { NetworkVersion } from '../../common/types/web3'

export const VaultUserFundsManager = {
  [NetworkVersion.Fuji]: '0xFfED1D29d7fCEB773b8E2E6e927eda0A5ac582eF',
  [NetworkVersion.Mainnet]: '0x22005E0bdd24B1ca4BC35795e7216c9581ec793C'
}

export const WrappedAssets = {
  [NetworkVersion.Fuji]: {
    [Ticker.ETH]: '0x4f5003fd2234df46fb2ee1531c89b8bdcc372255',
    [Ticker.BTC]: '0x385104afa0bfdac5a2bce2e3fae97e96d1cb9160',
    [Ticker.AVAX]: '0x0'
  },
  [NetworkVersion.Mainnet]: {
    [Ticker.ETH]: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
    [Ticker.BTC]: '0x152b9d0FdC40C096757F570A51E494bd4b943E50',
    [Ticker.AVAX]: '0x0'
  }
}

export const StablecoinAddresses = {
  [NetworkVersion.Fuji]: '0x45ea5d57ba80b5e3b0ed502e9a08d568c96278f9',
  [NetworkVersion.Mainnet]: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
}

export const VaultEventAddresses = {
  [NetworkVersion.Fuji]: '0xCfEfa868e151cF8979Abb9680B181223f209696e',
  [NetworkVersion.Mainnet]: '0xc50576CC1E79773C8bC8B84Ba48c03f577b87005'
}

export const activeVaultAddresses: string[] = [
  '0xDCa3Cb0C6Cd932F1DfeE8d304d0202a56f1D56b0',
  '0xBcFD41A5E9697e8F508DDcB6eD5F8235Cfd3B913',
  '0x16A20Bdf7f61A121c7A83b69eE67Dd9D0d7D59A8'
]
