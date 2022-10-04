import arrowsdk from "../lib/src/arrow-sdk"
import { Ticker } from "../lib/src/types"

async function main() {
    const res  = arrowsdk.getExpirationTimestamp('10072022')

    console.log(res)
}
main()