import { ethers } from 'ethers'

export const fujiRpcUrl = 'https://api.avax-test.network/ext/bc/C/rpc'
export const mainnetRpcUrl = 'https://api.avax.network/ext/bc/C/rpc'
export const providers: any = {
  fuji: new ethers.providers.JsonRpcProvider(fujiRpcUrl),
  mainnet: new ethers.providers.JsonRpcProvider(mainnetRpcUrl)
}
