import IERC20Metadata from "./IERC20Metadata.json"

import IArrowEventsV3 from "./v3/IArrowEvents.json"
import IArrowRegistryV3 from "./v3/IArrowRegistry.json"
import IArrowRouterV3 from "./v3/IArrowRouter.json"

import IArrowEventsCompetition from "./competition/IArrowEvents.json"
import ArrowRegistryCompetition from "./competition/ArrowRegistry.json"
import IArrowRouterCompetition from "./competition/IArrowRouter.json"

const IArrowEvents: any = {
    v3: IArrowEventsV3,
    competition: IArrowEventsCompetition,
}
const IArrowRegistry: any = {
    v3: IArrowRegistryV3,
    competition: ArrowRegistryCompetition,
}
const IArrowRouter: any = {
    v3: IArrowRouterV3,
    competition: IArrowRouterCompetition,
}

export { IERC20Metadata, IArrowEvents, IArrowRegistry, IArrowRouter }