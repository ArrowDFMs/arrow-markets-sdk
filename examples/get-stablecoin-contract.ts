import arrowsdk from "../lib/src/arrow-sdk"

async function main() {
    const stablecoin = await arrowsdk.getStablecoinContract(arrowsdk.Version.V3)

    console.log(await stablecoin.name())
}
main()