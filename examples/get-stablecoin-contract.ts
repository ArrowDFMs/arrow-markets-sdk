import arrowsdk from '../arrow-sdk'
import { ethers } from 'ethers'
import { IArrowRouter, IERC20Metadata } from '../abis'

const router = new ethers.Contract(
    arrowsdk.addresses.router,
    IArrowRouter,
    arrowsdk.provider
)

async function main() {
    const stablecoin = new ethers.Contract(
        await router.getStablecoinAddress(),
        IERC20Metadata,
        arrowsdk.provider
    )

    console.log(await stablecoin.name())
}
main()