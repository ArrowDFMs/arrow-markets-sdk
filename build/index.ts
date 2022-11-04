import { Version } from "../src/types"

import ArrowOptionChainProxyV3 from "./v3/ArrowOptionChainProxy.json"
import ArrowOptionChainProxyV4 from "./v4/ArrowOptionChainProxy.json"
import AbstractArrowShortAggregatorV4 from "./v4/AbstractArrowShortAggregator.json"
import ArrowOptionChainProxyCompetition from "./competition/ArrowOptionChainProxy.json"

const ArrowOptionChainProxy: Record<Version, any> = {
    [Version.V3]: ArrowOptionChainProxyV3,
    [Version.V4]: ArrowOptionChainProxyV4,
    [Version.COMPETITION]: ArrowOptionChainProxyCompetition
}

const AbstractArrowShortAggregator: Record<Version, any> = {
    [Version.V3]: AbstractArrowShortAggregatorV4,
    [Version.V4]: AbstractArrowShortAggregatorV4,
    [Version.COMPETITION]: AbstractArrowShortAggregatorV4
}

export { ArrowOptionChainProxy, AbstractArrowShortAggregator }