import IERC20Metadata from './amm/IERC20Metadata.json'
import WrappedAsset from './amm/WrappedAsset.json'
import { Version } from '../src/amm/types'

import IArrowEventsV4 from './amm/IArrowEvents.json'
import IArrowRegistryV4 from './amm/IArrowRegistry.json'
import IArrowRouterV4 from './amm/IArrowRouter.json'

import IArrowEventsCompetition from './competition/IArrowEvents.json'
import ArrowRegistryCompetition from './competition/ArrowRegistry.json'
import IArrowRouterCompetition from './competition/IArrowRouter.json'

const IArrowEvents: any = {
  v4: IArrowEventsV4,
  competition: IArrowEventsCompetition
}
const IArrowRegistry: any = {
  v4: IArrowRegistryV4,
  competition: ArrowRegistryCompetition
}
const IArrowRouter: any = {
  v4: IArrowRouterV4,
  competition: IArrowRouterCompetition
}

import ArrowOptionChainProxyV4 from '../abis/amm/ArrowOptionChainProxy.json'
import ArrowOptionChainProxyCompetition from '../abis/competition/ArrowOptionChainProxy.json'

const ArrowOptionChainProxy: Record<Version, any> = {
  [Version.V4]: ArrowOptionChainProxyV4,
  [Version.COMPETITION]: ArrowOptionChainProxyCompetition
}

// Vault ABIS
import ArrowVVEngine from '../abis/vault/AbstractArrowVVEngine.json'
import VaultFundsManagerABI from '../abis/vault/ArrowFundsManager.json'
import ArrowVaultEvents from '../abis/vault/ArrowVaultEvents.json'

export {
  IERC20Metadata,
  WrappedAsset,
  IArrowEvents,
  IArrowRegistry,
  IArrowRouter,
  ArrowOptionChainProxy,
  ArrowVaultEvents,
  VaultFundsManagerABI,
  ArrowVVEngine
}
