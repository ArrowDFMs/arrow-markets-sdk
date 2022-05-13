import IERC20Metadata from './IERC20Metadata.json'

import IArrowEventsV2 from './v2/IArrowEvents.json'
import IArrowRegistryV2 from './v2/IArrowRegistry.json'
import IArrowRouterV2 from './v2/IArrowRouter.json'

import IArrowEventsV3 from './v3/IArrowEvents.json'
import IArrowRegistryV3 from './v3/IArrowRegistry.json'
import IArrowRouterV3 from './v3/IArrowRouter.json'

import IArrowEventsCompetition from './competition/IArrowEvents.json'
import IArrowRegistryCompetition from './competition/IArrowRegistry.json'
import IArrowRouterCompetition from './competition/IArrowRouter.json'

const IArrowEvents : any = {
    "v2": IArrowEventsV2,
    "v3": IArrowEventsV3,
    "competition": IArrowEventsCompetition
}
const IArrowRegistry : any = {
    "v2": IArrowRegistryV2,
    "v3": IArrowRegistryV3,
    "competition": IArrowRegistryCompetition
}
const IArrowRouter : any = {
    "v2": IArrowRouterV2,
    "v3": IArrowRouterV3,
    "competition": IArrowRouterCompetition
}

export {
    IERC20Metadata,
    IArrowEvents,
    IArrowRegistry,
    IArrowRouter
}