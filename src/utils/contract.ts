/***************************************
 *      CONTRACT GETTER FUNCTIONS      *
 ***************************************/

import * as constants from "./constants"
import { ethers } from "ethers"
import utilities from "./utilities"
import { IArrowEvents, IArrowRegistry, IArrowRouter, IERC20Metadata } from "../../abis"

/**
 * Get the router contract from Arrow's contract suite.
 * 
 * @param wallet Wallet with which you want to connect the instance of the router contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Local instance of ethers.Contract for the Arrow router contract.
 */
 export function getRouterContract(
    wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer = constants.providers.fuji,
    version: constants.VERSION = constants.VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw constants.UNSUPPORTED_VERSION_ERROR

    const router = new ethers.Contract(
        constants.addresses.fuji.router[version],
        IArrowRouter[version],
        wallet
    )
    return router
}

/**
 * Get the stablecoin contract that is associated with Arrow's contract suite.
 * 
 * @param wallet Wallet with which you want to connect the instance of the stablecoin contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Local instance of ethers.Contract for the stablecoin contract.
 */
export async function getStablecoinContract(
    wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer = constants.providers.fuji,
    version: constants.VERSION = constants.VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw constants.UNSUPPORTED_VERSION_ERROR

    const stablecoin = new ethers.Contract(
        await getRouterContract(wallet, version).getStablecoinAddress(),
        IERC20Metadata,
        wallet
    )
    return stablecoin
}

/**
 * Get the events contract from Arrow's contract suite.
 * 
 * @param wallet Wallet with which you want to connect the instance of the Arrow events contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Local instance of ethers.Contract for the Arrow events contract.
 */
export async function getEventsContract(
    wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer = constants.providers.fuji,
    version: constants.VERSION = constants.VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw constants.UNSUPPORTED_VERSION_ERROR

    const events = new ethers.Contract(
        await getRouterContract(wallet, version).getEventsAddress(),
        IArrowEvents[version],
        wallet
    )
    return events
}

/**
 * Get the registry contract from Arrow's registry suite.
 * 
 * @param wallet Wallet with which you want to connect the instance of the Arrow registry contract. Default is Fuji provider.
 * @param version Version of Arrow contract suite with which to interact. Default is V2.
 * @returns Local instance of ethers.Contract for the Arrow registry contract.
 */
export async function getRegistryContract(
    wallet: ethers.providers.Provider | ethers.Wallet | ethers.Signer = constants.providers.fuji,
    version: constants.VERSION = constants.VERSION.V2
) {
    if (!utilities.isValidVersion(version)) throw constants.UNSUPPORTED_VERSION_ERROR

    const registry = new ethers.Contract(
        await getRouterContract(wallet, version).getRegistryAddress(),
        IArrowRegistry[version],
        wallet
    )
    return registry
}
const contract = {
    getRouterContract,
    getStablecoinContract,
    getEventsContract,
    getRegistryContract,

}

export default contract