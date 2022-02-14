import { ethers } from 'ethers'

import { IArrowRouter } from './abis'

export const apiURL = 'https://fuji-v2-api.arrow.markets/v1'
export const providerURL = 'https://api.avax-test.network/ext/bc/C/rpc'

export const provider = new ethers.providers.JsonRpcProvider(providerURL)

export const routerAddress = ethers.utils.getAddress("0x28121FB95692A9bE3fb1c6891FfEe74B88Bdfb2b")
export const router = new ethers.Contract(
    routerAddress,
    IArrowRouter,
    provider
)

export const contracts = {
    router: router
}

export const urls = {
    api: apiURL,
    provider: providerURL
}

export const addresses = {
    router: routerAddress
}

const arrowsdk = {
    contracts,
    urls,
    addresses,
    provider
}

export default arrowsdk