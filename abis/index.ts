import IERC20Metadata from './IERC20Metadata.json'

import IArrowEventsV2 from './v2/IArrowEvents.json'
import IArrowRegistryV2 from './v2/IArrowRegistry.json'
import IArrowRouterV2 from './v2/IArrowRouter.json'

import IArrowEventsV3 from './v3/IArrowEvents.json'
import IArrowRegistryV3 from './v3/IArrowRegistry.json'
import IArrowRouterV3 from './v3/IArrowRouter.json'

const IArrowEvents = {
    v2: IArrowEventsV2,
    v3: IArrowEventsV3
}
const IArrowRegistry = {
    v2: IArrowRegistryV2,
    v3: IArrowRegistryV3
}
const IArrowRouter = {
    v2: IArrowRouterV2,
    v3: IArrowRouterV3
}

export {
    IERC20Metadata,
    IArrowEvents,
    IArrowRegistry,
    IArrowRouter
}