/**************************************
 *          USEFUL CONSTANTS          *
 **************************************/

import { ethers } from "ethers"
import {
    ArrowOptionChainProxy
} from '../../build'

export const UNSUPPORTED_VERSION_ERROR = new Error("Please select a supported contract version.")

 export enum VERSION {
     LOCAL = 'local',
     V2 = 'v2',
     V3 = 'v3',
     COMPETITION = 'competition'
 }
 
 
 export const urls: any = {
     "api": {
         [VERSION.LOCAL]: 'http://localhost/v1',
         [VERSION.V2]: 'https://fuji-v2-api.arrow.markets/v1',
         [VERSION.V3]: 'https://fuji-v2-api.arrow.markets/v1',
         [VERSION.COMPETITION]: 'https://competition-api.arrow.markets/v1'
     },
     "provider": {
         "fuji": 'https://api.avax-test.network/ext/bc/C/rpc'
     }
 }
 
 export const providers: any = {
     "fuji": new ethers.providers.JsonRpcProvider(urls.provider.fuji)
 }
 
 export const addresses: any = {
     "fuji": {
         "router": {
             [VERSION.V2]: ethers.utils.getAddress("0x28121fb95692a9be3fb1c6891ffee74b88bdfb2b"),
             [VERSION.V3]: ethers.utils.getAddress("0x31122CeF9891Ef661C99352266FA0FF0079a0e06"),
             [VERSION.COMPETITION]: ethers.utils.getAddress("0x3e8a9Ad1336eF8007A416383daD084ef52E8DA86")
         }
     }
 }
 
 export const bytecodeHashes: any = {
     "ArrowOptionChainProxy": {
         [VERSION.V2]: ethers.utils.solidityKeccak256(
             ['bytes'],
             [ArrowOptionChainProxy.v2.bytecode]
         ),
         [VERSION.V3]: ethers.utils.solidityKeccak256(
             ['bytes'],
             [ArrowOptionChainProxy.v3.bytecode]
         ),
         [VERSION.COMPETITION]: ethers.utils.solidityKeccak256(
             ['bytes'],
             [ArrowOptionChainProxy.competition.bytecode]
         )
     }
 }