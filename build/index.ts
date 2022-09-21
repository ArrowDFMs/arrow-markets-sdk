import { Version } from "../src/types"

import ArrowOptionChainProxyV3 from "./v3/ArrowOptionChainProxy.json"
import ArrowOptionChainProxyCompetition from "./competition/ArrowOptionChainProxy.json"

const ArrowOptionChainProxy: Record<Version, any> = {
    [Version.V3]: ArrowOptionChainProxyV3,
    [Version.COMPETITION]: ArrowOptionChainProxyCompetition
}

export { ArrowOptionChainProxy }