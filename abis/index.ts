import IERC20Metadata from "./IERC20Metadata.json"


import IArrowEventsV4 from "./v4/IArrowEvents.json"
import IArrowRegistryV4 from "./v4/IArrowRegistry.json"
import IArrowRouterV4 from "./v4/IArrowRouter.json"

import IArrowEventsCompetition from "./competition/IArrowEvents.json"
import ArrowRegistryCompetition from "./competition/ArrowRegistry.json"
import IArrowRouterCompetition from "./competition/IArrowRouter.json"

const IArrowEvents: any = {
    v4: IArrowEventsV4,
    competition: IArrowEventsCompetition,
}
const IArrowRegistry: any = {
    v4: IArrowRegistryV4,
    competition: ArrowRegistryCompetition,
}
const IArrowRouter: any = {
    v4: IArrowRouterV4,
    competition: IArrowRouterCompetition,
}

export { IERC20Metadata, IArrowEvents, IArrowRegistry, IArrowRouter }