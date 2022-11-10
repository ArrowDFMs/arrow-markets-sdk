import { Version } from "../src/types"

import ArrowOptionChainProxyV4 from "./v4/ArrowOptionChainProxy.json"
import ArrowOptionChainProxyCompetition from "./competition/ArrowOptionChainProxy.json"

const ArrowOptionChainProxy: Record<Version, any> = {
    [Version.V4]: ArrowOptionChainProxyV4,
    [Version.COMPETITION]: ArrowOptionChainProxyCompetition
}

export { ArrowOptionChainProxy }