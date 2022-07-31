import * as arrowsdk from '../lib/src/arrow-sdk'

async function main() {
    const stablecoin = await arrowsdk.default.contract.getStablecoinContract(arrowsdk.default.constants.providers.fuji, arrowsdk.default.constants.VERSION.V3)

    console.log(await stablecoin.name())
}
main()