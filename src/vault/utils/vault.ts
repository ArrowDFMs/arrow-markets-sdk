import type { BigNumber } from 'ethers'
import { ethers, Contract } from 'ethers'
import {
  ContractType,
  Option,
  OptionStrategyType,
  OrderType,
  StrategyTypeString,
  Strike,
  Ticker
} from '../../common/types/option'
import {
  EpochData,
  GetEpochDataArgs,
  GetStrikesArgs,
  OrderVerificationParams,
  PreparedVaultBuyOrderParameters,
  Vault,
  VaultBuyOrderParametersArgs
} from '../types/vault'
import {
  ArrowVVEngine,
  ArrowVaultEvents,
  VaultFundsManagerABI
} from '../../../abis'
import { StrategyType } from '../../amm/types'
import { NetworkVersion } from '../../common/types/web3'
import {
  VaultEventAddresses,
  VaultUserFundsManager,
  activeVaultAddresses
} from '../constants/vault'
import {
  estimateOptionPrice,
  getUnderlierSpotPrice
} from '../../common/utils/pricing'
import { SmartContractFunctionOptions, SmartContractInfo } from '../types/web3'
import { providers } from '../../common/constants/web3'
import { callSmartContractFunction, checkBalanceAndAllowance } from './web3'
import { GetVaultsResponse, SubmitVaultBuyOrderResponse } from '../types/api'
import { BaseArrowAPI } from '../../common/constants/api'
import { ApplicationVersion } from '../../common/types/general'
import { GET, POST } from '../../common/utils/axios'
import { toRegularNumber } from '../../common/utils/parsing'
import { getTimeUTC } from '../../common/utils/time'
import { OptionPriceResponse } from '../../common/types/api'

/**
 * Prepares the order parameters to be sent to an API, which will then submit it to the smart contract.
 *
 * @param args - The arguments required to prepare the order parameters.
 * @param args.ticker - The ticker of the underlying asset (e.g. ETH, BTC).
 * @param args.expiration - The expiration date of the option as an ISO string.
 * @param args.strike - The strike price of the option.
 * @param args.contractType - The type of the option contract (e.g. CALL, PUT).
 * @param args.orderType - The order type (e.g. LONG_OPEN).
 * @param args.spotPrice - The current spot price of the underlying asset.
 * @param args.priceHistory - The historical price data for the underlying asset.
 * @param args.version - The version of the Arrow API to use.
 * @param args.slippageThreshold - The slippage threshold percentage to be added to the option price.
 * @param args.quantity - The number of options to purchase.
 * @param args.signer - The ethers.Signer instance to sign the message with.
 * @param args.network - The network to use (e.g. mainnet).
 * @returns A promise that resolves to an object containing the prepared order parameters.
 *
 * @throws An error if any step of preparing the order parameters fails.
 */
export async function prepareVaultBuyOrderParameters(
  args: VaultBuyOrderParametersArgs
): Promise<PreparedVaultBuyOrderParameters> {
  try {
    const contractAddress = '0x0' // TODO - PASS IN CONTRACT ADDRESS

    // Build and sign the order data
    const { submittedParams, signature } = await buildAndSignOrderData(
      {
        quantity: args.quantity,
        thresholdPrice: args.thresholdPrice,
        vaultAddress: contractAddress
      },
      args.signer
    )

    const buyOptionInput = {
      ...submittedParams,
      optionPrice: args.optionPrice,
      signature: signature
    }

    // Return the prepared order parameters
    return {
      ...buyOptionInput,
      buyer_address: await args.signer.getAddress(),
      contract_address: contractAddress
    }
  } catch (error) {
    console.error('Error preparing order parameters:', error)
    throw error
  }
}

export async function buildAndSignOrderData(
  params: OrderVerificationParams,
  signer: ethers.providers.JsonRpcSigner
): Promise<{
  submittedParams: {
    buyerAddress: string
    quantity: number
    threshold_price: number
    signatureTimestamp: number
  }
  signature: string
}> {
  // Get scale factors
  const vaultInstance = new Contract(params.vaultAddress, ArrowVVEngine, signer)

  // EIP-712 domain separator
  const chainId = await signer.getChainId()
  const domain = {
    name: 'Arrow',
    version: '1.0',
    chainId: chainId,
    verifyingContract: vaultInstance.address // Address of the contract that will verify the signature
  }

  // EIP-712 typed data structure
  const dataType = {
    Param: [
      { name: 'buyerAddress', type: 'address' },
      { name: 'quantity', type: 'uint256' },
      { name: 'thresholdPrice', type: 'uint256' },
      { name: 'signatureTimestamp', type: 'uint256' }
    ]
  }

  const currentTimestamp = Math.round(new Date().getTime() / 1000)

  const stablecoinDecimals = await vaultInstance.stablecoinDecimals()
  const underlierDecimals = await vaultInstance.underlierDecimals()

  const quantity = ethers.utils.parseUnits(
    params.quantity.toString(),
    underlierDecimals
  )
  const thresholdPrice = ethers.utils.parseUnits(
    params.thresholdPrice.toString(),
    stablecoinDecimals
  )

  const submittedParams = {
    buyerAddress: await signer.getAddress(),
    quantity: quantity,
    thresholdPrice: thresholdPrice,
    signatureTimestamp: currentTimestamp
  }

  // Sign the Typed Data using JsonRpcProvider and signer
  const signature = await signer._signTypedData(
    domain,
    dataType,
    submittedParams
  )

  return {
    submittedParams: {
      buyerAddress: await signer.getAddress(),
      quantity: params.quantity,
      threshold_price: params.thresholdPrice,
      signatureTimestamp: currentTimestamp
    },
    signature
  }
}

/**
 * Submits an order to the Arrow API for buying an option.
 *
 * @param args - An object containing the required parameters to prepare the order:
 *  - `ticker`: The Ticker of the underlying asset (e.g., AVAX, ETH, BTC).
 *  - `contractType`: The ContractTypeEnum of the option (e.g., CALL, PUT, CALL_SPREAD, PUT_SPREAD).
 *  - `quantity`: The number of options to buy.
 *  - `signer`: The ethers.Signer instance used for signing the order message.
 *  - `network`: The NetworkVersion (e.g., mainnet, testnet) of the target blockchain network.
 *  - `expiration`: The expiration date of the option as a string.
 *  - `strike`: The strike price of the option.
 *  - `orderType`: The OrderType of the option (e.g. LONG_OPEN).
 *  - `spotPrice`: The current spot price of the underlying asset.
 *  - `priceHistory`: An array of historical prices for the underlying asset.
 *  - `slippageThreshold`: The slippage threshold percentage to be used when calculating the threshold price.
 * @param version - The DeploymentVersion of the Arrow API to use (e.g., v1, v2).
 *
 * @returns A Promise that resolves to a SubmitVaultBuyOrderResponse object containing:
 *  - `tx_hash`: The transaction hash of the executed transaction
 *  - `execution_price`: The price the order was executed at
 *
 * @throws An error if the order submission fails.
 */
export async function submitVaultBuyOrder(
  orderParameters: PreparedVaultBuyOrderParameters,
  network: NetworkVersion
): Promise<SubmitVaultBuyOrderResponse> {
  try {
    // Prepare the order parameters
    const apiUrl = BaseArrowAPI[ApplicationVersion.VAULT][network]
    // Submit the order to the Arrow API
    const res = await POST<
      PreparedVaultBuyOrderParameters,
      SubmitVaultBuyOrderResponse
    >(`${apiUrl}/option/buy`, orderParameters)

    // Check if the API response failed
    if (res.status >= 400) {
      const errorMessage = `Failed to submit order: ${res.statusText}`
      console.error(errorMessage)
      throw new Error(errorMessage)
    }

    return res.data
  } catch (error) {
    console.error('Error submitting order:', error)
    throw error
  }
}

/**
 * Settles the option for the specified smart contract vault of the given ticker and contract type for a specific epoch.
 *
 * @param {Ticker} ticker - The asset's ticker, e.g., AVAX, ETH, or BTC.
 * @param {ContractTypeEnum} contractType - The contract type, e.g., Call, Put, CallSpread, or PutSpread.
 * @param {number} epoch - The epoch number for which the options are to be settled.
 * @param {ethers.Signer} signer - A signer object that includes a private key and a connected provider.
 * @param {NetworkVersion} network - The network version to be used, e.g., mainnet or fuji.
 * @returns Resolves when the transaction is complete, and logs the transaction receipt.
 * @throws {Error} Throws an error if there is an issue with calling the settleOption function.
 */
export async function settleVaultOption(
  vaultAddress: string,
  epoch: number,
  signer: ethers.Signer,
  network: NetworkVersion
): Promise<string> {
  try {
    const settleVaultOptionParams: SmartContractFunctionOptions = {
      address: vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'settleOption',
      functionArgs: [epoch],
      signer: signer,
      network: network
    }

    // This will send the transaction to call the settleOption function
    const txReceipt = await callSmartContractFunction(settleVaultOptionParams)

    return txReceipt.transactionHash
  } catch (error) {
    console.error('Error calling settleOption function:', error)
    throw Error('Error calling settleOption function')
  }
}

/**
 * Deposits a specified amount of liquidity into the specified short strategy contract
 * @param {Ticker} ticker - The ticker of the asset being deposited
 * @param {ContractTypeEnum} contractType - The type of contract to deposit liquidity into
 * @param {number} depositAmount - The amount of liquidity to deposit
 * @param {boolean} autoRollover - Flag indicating whether to enable automatic rollover of earnings
 * @param {ethers.Signer} signer - The signer object for the user's wallet
 * @param {NetworkVersion} network - The current network version
 * @returns {Promise<{ transactionHash: string; blockNumber: number }>} - An object containing the transaction hash and block number
 * @throws Will throw an error if the user does not have enough balance or has not approved enough balance for the deposit
 */
export async function depositShortLiquidity(
  vaultAddress: string,
  contractType: OptionStrategyType,
  depositAmount: number,
  autoRollover: boolean,
  signer: ethers.Signer,
  network: NetworkVersion
): Promise<{ transactionHash: string; blockNumber: number }> {
  let castedDepositAmount = ethers.constants.Zero

  const vaultInstance = new Contract(vaultAddress, ArrowVVEngine, signer)

  if (contractType === OptionStrategyType.CALL) {
    const underlierDecimals = await vaultInstance.underlierDecimals()
    castedDepositAmount = ethers.utils.parseUnits(
      depositAmount.toString(),
      underlierDecimals
    )
  } else {
    const stablecoinDecimals = await vaultInstance.stablecoinDecimals()
    castedDepositAmount = ethers.utils.parseUnits(
      depositAmount.toString(),
      stablecoinDecimals
    )
  }
  const hasApprovedEnoughBalance = await checkBalanceAndAllowance(
    vaultAddress,
    contractType,
    depositAmount,
    signer,
    network
  )
  if (!hasApprovedEnoughBalance)
    throw new Error(
      'User has not approved enough balance or does not have enough balance.'
    )

  const depositShortLiquidityParams: SmartContractFunctionOptions = {
    address: vaultAddress,
    abi: ArrowVVEngine,
    functionName: 'depositShortLiquidity',
    functionArgs: [castedDepositAmount, autoRollover],
    signer: signer,
    network: network
  }

  // This will send the transaction to call the depositShortLiquidity function
  const txReceipt = await callSmartContractFunction(depositShortLiquidityParams)

  return {
    transactionHash: txReceipt.transactionHash,
    blockNumber: txReceipt.blockNumber
  }
}

/**
 * Claims funds for a specified epoch from a smart contract vault of the given ticker and contract type.
 *
 * @param {Ticker} ticker - The asset's ticker, e.g., AVAX, ETH, or BTC.
 * @param {ContractTypeEnum} contractType - The contract type, e.g., Call, Put, CallSpread, or PutSpread.
 * @param {number} epoch - The epoch number for which funds will be claimed.
 * @param {ethers.Signer} signer - A signer object that includes a private key and a connected provider.
 * @param {NetworkVersion} network - The network version to be used, e.g., mainnet or fuji.
 * @returns Resolves when the transaction is complete, and logs the transaction receipt.
 * @throws {Error} Throws an error if there is an issue with calling the claim function. // TODO: Gracefully handle error
 */
export async function claimEpochFunds(
  vaultAddress: string,
  epoch: number,
  signer: ethers.Signer,
  network: NetworkVersion
): Promise<string> {
  try {
    const claimParams: SmartContractFunctionOptions = {
      address: vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'claim',
      functionArgs: [epoch],
      signer: signer,
      network: network
    }

    // This will send the transaction to call the claim function
    const txReceipt = await callSmartContractFunction(claimParams)

    return txReceipt.transactionHash
  } catch (error) {
    throw Error('Unable to claim funds.')
  }
}

/**
 * Retrieves the strike prices for the specified vault and epoch.
 * @param args An object containing the following properties:
 *   - ticker: The asset ticker (e.g., BTC, ETH).
 *   - contractType: The type of the options contract (e.g., Call, Put).
 *   - epoch: The epoch number for which to get the strike prices.
 *   - network: The network to use (e.g., Mainnet).
 * @returns A Promise that resolves to an array of strike prices for the specified vault and epoch.
 * @throws An error if there is a problem retrieving the strike prices.
 */
export async function getVaultStrikes(args: GetStrikesArgs): Promise<Strike> {
  try {
    // Prepare the smart contract function options
    const provider =
      args.network === NetworkVersion.Fuji ? providers.fuji : providers.mainnet

    const getStrikesParams: SmartContractFunctionOptions = {
      address: args.vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'getStrikes',
      functionArgs: [args.epoch],
      signer: provider,
      network: args.network
    }

    // Call the getStrikes function using callSmartContractFunction
    const strikes = await callSmartContractFunction(getStrikesParams)
    const { stablecoinDecimals } = await fetchDecimals(
      args.vaultAddress,
      args.network
    )
    const parsedStrikes = toRegularNumber(strikes, 10 ** stablecoinDecimals) // TODO Update this to use decimals from the contract

    return parsedStrikes
  } catch (error) {
    console.error('Error retrieving strikes:', error)
    throw error
  }
}

export async function computePriceWithTransactionFee(
  price: number,
  vaultAddress: string,
  network: NetworkVersion
): Promise<number> {
  try {
    const provider =
      network === NetworkVersion.Fuji ? providers.fuji : providers.mainnet
    // Prepare the smart contract function options
    const getFeeRatesParams: SmartContractFunctionOptions = {
      address: vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'feeRate',
      functionArgs: [],
      signer: provider,
      network: network
    }

    // Call the getStrikes function using callSmartContractFunction
    const feeRate = await callSmartContractFunction(getFeeRatesParams)
    const { feeRateScaleFactor } = await fetchDecimals(vaultAddress, network)
    const optionFee =
      (price * feeRate.toNumber()) / feeRateScaleFactor.toNumber()

    const computedPrice = Number((price + optionFee).toFixed(2))

    return computedPrice
  } catch (error) {
    console.error('Error retrieving strikes:', error)
    throw error
  }
}

/**
 * Fetches the decimals for the underlier, stablecoin, and option quantity scale factor of a given option contract.
 * @param ticker The ticker symbol of the option contract.
 * @param contractType The type of option contract.
 * @param signer The ethers signer or provider to use for the contract interaction.
 * @param network The Ethereum network ID.
 * @returns An object containing the underlier decimals, stablecoin decimals, and quantity scale factor.
 * @throws If there is an error fetching the decimals.
 */
export async function fetchDecimals(
  vaultAddress: string,
  network: NetworkVersion
): Promise<{
  underlierDecimals: number
  stablecoinDecimals: number
  quantityScaleFactor: number
  feeRateScaleFactor: BigNumber
}> {
  const provider =
    network === NetworkVersion.Fuji ? providers.fuji : providers.mainnet

  const vaultInstance = new Contract(vaultAddress, ArrowVVEngine, provider)

  const [
    underlierDecimals,
    stablecoinDecimals,
    quantityScaleFactor,
    feeRateScaleFactor
  ] = await Promise.all([
    vaultInstance.underlierDecimals(),
    vaultInstance.stablecoinDecimals(),
    vaultInstance.optionQuantityDecimalsScaleFactor(),
    vaultInstance.feeRateScaleFactor()
  ])

  return {
    underlierDecimals,
    stablecoinDecimals,
    quantityScaleFactor,
    feeRateScaleFactor
  }
}

/**
 * Retrieves the strike price, expiration date, and ticker for a given vault contract address.
 *
 * @param {string} vaultAddress - The address of the vault contract to retrieve details for.
 * @param {DeploymentVersion} version - The deployment version of the contract.
 *
 * @returns {Promise<{ strike: number[]; expiration: string; ticker: string }>} - The strike
 * price, expiration date, and ticker for the specified vault contract address.
 *
 * @throws If an error occurs while retrieving the details.
 */
export async function getVaultDetailsByAddress(
  vaultAddress: string,
  network: NetworkVersion
): Promise<{
  strike: number[]
  expiration: number
  ticker: string
  strategyType: OptionStrategyType
}> {
  try {
    const currentEpoch = await getCurrentEpoch(vaultAddress, network)

    const provider =
      network === NetworkVersion.Fuji ? providers.fuji : providers.mainnet

    //Get Strikes
    const getStrikeParams: SmartContractFunctionOptions = {
      address: vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'getStrikes',
      functionArgs: [currentEpoch],
      signer: provider,
      network: network
    }
    const strikes = await callSmartContractFunction(getStrikeParams)

    // Get Decimals
    const { stablecoinDecimals } = await fetchDecimals(vaultAddress, network)
    const parsedStrikes = toRegularNumber(strikes, 10 ** stablecoinDecimals)

    // Get ticker
    const getTickerParams: SmartContractFunctionOptions = {
      address: vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'ticker',
      signer: provider,
      network: network
    }
    const ticker = await callSmartContractFunction(getTickerParams)

    // Get epoch data
    const epochData = await getEpochData({
      vaultAddress,
      epoch: currentEpoch,
      network
    })
    const expiration = epochData.expiration * 1000

    return {
      strike: parsedStrikes,
      expiration,
      ticker,
      strategyType: OptionStrategyType.CALL_SPREAD // TO DO FIX HARD CODE
    }
  } catch (error) {
    console.error('Error retrieving strikes:', error)
    throw error
  }
}

/**
 * Retrieves epoch data from the vault smart contract for a given ticker, contract type, and epoch number.
 *
 * @param args An object containing the following properties:
 *  - ticker (Ticker): The ticker symbol for the underlying asset.
 *  - contractType (ContractTypeEnum): The type of the contract (CALL, PUT, etc.).
 *  - epoch (number): The epoch number for which to retrieve the epoch data.
 *  - network (NetworkVersion): The network on which the vault smart contract is deployed.
 *
 * @returns A Promise that resolves to an EpochData object containing the following properties:
 *  - startTime (number): The start time of the epoch.
 *  - aggregationPeriodEnd (number): The end of the aggregation period for the epoch.
 *  - expiration (number): The expiration time of the epoch.
 *  - totalLiquidityAmount (number): The total amount of liquidity for the epoch.
 *  - totalOptionQuantity (number): The total quantity of options for the epoch.
 *  - remainingOptionQuantity (number): The remaining quantity of options for the epoch.
 *  - totalOptionQuantitySold (number): The total quantity of options sold for the epoch.
 *  - totalEarnedPremiums (number): The total earned premiums for the epoch.
 *  - totalEarnedFees (number): The total earned fees for the epoch.
 *  - totalLiabilities (number): The total liabilities for the epoch.
 *  - settlementPrice (number): The settlement price for the epoch.
 *  - singleContractPayoff (number): The single contract payoff for the epoch.
 *  - isExpired (boolean): Whether the epoch is expired or not.
 *  - isPayoutInUnderlier (boolean): Whether the payout is in the underlying asset.
 *
 * @throws An error if there is an issue retrieving the epoch data.
 */
export async function getEpochData(args: GetEpochDataArgs): Promise<EpochData> {
  try {
    const provider =
      args.network === NetworkVersion.Fuji ? providers.fuji : providers.mainnet

    const getEpochDataParams: SmartContractFunctionOptions = {
      address: args.vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'getEpochData',
      functionArgs: [args.epoch],
      signer: provider,
      network: args.network
    }
    const latestVaultCheckpointIndexParams: SmartContractFunctionOptions = {
      address: args.vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'latestVaultCheckpointIndex',
      functionArgs: [args.epoch],
      signer: provider,
      network: args.network
    }

    const epochDataArray = await callSmartContractFunction(getEpochDataParams)
    const latestVaultCheckpointIndex = await callSmartContractFunction(
      latestVaultCheckpointIndexParams
    )

    const vaultCheckpointParams: SmartContractFunctionOptions = {
      address: args.vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'vaultCheckpoint',
      functionArgs: [args.epoch, latestVaultCheckpointIndex],
      signer: provider,
      network: args.network
    }

    const vaultCheckpoint = await callSmartContractFunction(
      vaultCheckpointParams
    )

    const { quantityScaleFactor, stablecoinDecimals, underlierDecimals } =
      await fetchDecimals(args.vaultAddress, args.network)

    const epochData: EpochData = {
      startTime: epochDataArray[0],
      expiration: epochDataArray[1],
      totalLiquidityAmount: Number(
        ethers.utils.formatUnits(epochDataArray[2], underlierDecimals)
      ),
      totalEarnedFees: Number(
        ethers.utils.formatUnits(epochDataArray[3], stablecoinDecimals)
      ),
      totalLiabilities: Number(
        ethers.utils.formatUnits(epochDataArray[4], stablecoinDecimals)
      ),
      settlementPrice: Number(
        ethers.utils.formatUnits(epochDataArray[5], stablecoinDecimals)
      ),
      singleContractPayoff: toRegularNumber(
        epochDataArray[6],
        stablecoinDecimals
      ),
      strikes: toRegularNumber(epochDataArray[7], stablecoinDecimals),
      isExpired: epochDataArray[8],
      totalOptionQuantity: toRegularNumber(
        vaultCheckpoint[1],
        quantityScaleFactor
      ),
      remainingOptionQuantity: Number(
        (vaultCheckpoint[3] / quantityScaleFactor).toFixed(2)
      ),
      totalOptionQuantitySold: toRegularNumber(
        vaultCheckpoint[2],
        quantityScaleFactor
      ),
      totalEarnedPremiums: Number(
        ethers.utils.formatUnits(vaultCheckpoint[0], stablecoinDecimals)
      )
    }

    return epochData
  } catch (error) {
    console.error('Error retrieving epoch data:', error)
    throw error
  }
}

export function getContractTypeFromDB(
  contractType: string
): OptionStrategyType | undefined {
  switch (contractType) {
    case 'CALL':
      return OptionStrategyType.CALL
    case 'PUT':
      return OptionStrategyType.PUT
    case 'CALL_SPREAD':
      return OptionStrategyType.CALL_SPREAD
    case 'PUT_SPREAD':
      return OptionStrategyType.PUT_SPREAD
    case 'IRON_CONDOR':
      return OptionStrategyType.IRON_CONDOR
    case 'BUTTERFLY':
      return OptionStrategyType.BUTTERFLY
    default:
      return undefined
  }
}

/**
 * Retrieves an array of SmartContractInfo objects that match the specified ticker.
 * @async
 * @function
 * @param {Ticker} ticker - The ticker to search for.
 * @param {DeploymentVersion} version - The version of the deployment (e.g., "mainnet" or "fuji").
 * @returns {Promise<SmartContractInfo[]>} An array of SmartContractInfo objects.
 * @throws {Error} If the retrieval fails for any reason.
 */
export async function getVaultsByTicker(
  ticker: Ticker,
  network: NetworkVersion,
  orderType: OrderType
): Promise<(Vault | undefined)[]> {
  const apiUrl = BaseArrowAPI[ApplicationVersion.VAULT][network]
  const getVaultsResponse = await GET<GetVaultsResponse[]>(`${apiUrl}/vault/`)

  const vaultsFromAPI = getVaultsResponse.data.filter(
    (contract: { ticker: Ticker; address: any }) =>
      contract.ticker === ticker &&
      activeVaultAddresses.includes(contract.address)
  )

  const parsedVaultContracts = await Promise.all(
    vaultsFromAPI.map(async vault => {
      const contractTypeFromDB = getContractTypeFromDB(vault.contract_type)!

      const currentEpoch = await getCurrentEpoch(vault.address, network)

      const strikes = await getVaultStrikes({
        vaultAddress: vault.address,
        epoch: currentEpoch,
        network: network
      })

      // DETERMINE STRATEGY TYPE AND SPLIT LEGS ACCORDINGLY
      if (contractTypeFromDB === OptionStrategyType.CALL_SPREAD) {
        const largerStrike = Math.max(...strikes)
        const smallerStrike = Math.min(...strikes)
        // CALL CREDIT SPREAD  BUY > SELL
        // CALL DEBIT SPREAD BUY < SELL
        if (orderType === OrderType.LONG_OPEN) {
          let longSideVaultLegs: Option[] = [
            {
              contractType: ContractType.CALL,
              orderType: OrderType.LONG_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: smallerStrike,
              quantity: 1
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.SHORT_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: largerStrike,
              quantity: 1
            }
          ]

          const vaultPrice = await estimateOptionPrice(
            longSideVaultLegs,
            network
          )

          longSideVaultLegs = updatePricesFromApiResponse(
            vaultPrice,
            longSideVaultLegs
          )

          const longVault: Vault = {
            strategyType: OptionStrategyType.CALL_SPREAD,
            orderType: OrderType.LONG_OPEN,
            optionLegs: longSideVaultLegs,
            address: vault.address,
            price: vaultPrice.total_position_price,
            expiration: getTimeUTC(vault.expiration * 1000).readableTimestamp,
            contractsRemaining: 0,
            ticker: ticker,
            ratio: 1
          }

          return longVault
        } else if (orderType === OrderType.SHORT_OPEN) {
          let shortSideVaultLegs: Option[] = [
            {
              contractType: ContractType.CALL,
              orderType: OrderType.LONG_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: largerStrike,
              quantity: 1
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.SHORT_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: smallerStrike,
              quantity: 1
            }
          ]
          const vaultPrice = await estimateOptionPrice(
            shortSideVaultLegs,
            network
          )

          shortSideVaultLegs = updatePricesFromApiResponse(
            vaultPrice,
            shortSideVaultLegs
          )

          const shortVault: Vault = {
            strategyType: OptionStrategyType.CALL_SPREAD,
            orderType: OrderType.SHORT_OPEN,
            optionLegs: shortSideVaultLegs,
            address: vault.address,
            price: vaultPrice.total_position_price,
            expiration: getTimeUTC(vault.expiration * 1000).readableTimestamp,
            contractsRemaining: 0,
            ticker: ticker,
            ratio: 1
          }

          return shortVault
        }
      } else if (contractTypeFromDB === OptionStrategyType.PUT_SPREAD) {
        const largerStrike = Math.max(...strikes)
        const smallerStrike = Math.min(...strikes)
        // PUT DEBIT SPREAD BUY > SELL
        // PUT CREDIT SPREAD BUY < SELL
        // TO DO FINISH THIS LOGIC
      } else if (contractTypeFromDB === OptionStrategyType.IRON_CONDOR) {
        const leg1Strike = strikes[0]
        const leg2Strike = strikes[1]
        const leg3Strike = strikes[2]
        const leg4Strike = strikes[3]

        if (orderType === OrderType.LONG_OPEN) {
          let longSideVaultLegs: Option[] = [
            {
              contractType: ContractType.PUT,
              orderType: OrderType.LONG_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg2Strike,
              quantity: 1
            },
            {
              contractType: ContractType.PUT,
              orderType: OrderType.SHORT_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg1Strike,
              quantity: 1
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.LONG_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg3Strike,
              quantity: 1
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.SHORT_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg4Strike,
              quantity: 1
            }
          ]

          const vaultPrice = await estimateOptionPrice(
            longSideVaultLegs,
            network
          )

          longSideVaultLegs = updatePricesFromApiResponse(
            vaultPrice,
            longSideVaultLegs
          )

          const longVault: Vault = {
            strategyType: OptionStrategyType.IRON_CONDOR,
            optionLegs: longSideVaultLegs,
            address: vault.address,
            price: vaultPrice.total_position_price,
            ticker: ticker,
            expiration: getTimeUTC(vault.expiration * 1000).readableTimestamp,
            contractsRemaining: 0,
            orderType: OrderType.LONG_OPEN,
            ratio: 1
          }

          return longVault
        } else if (orderType === OrderType.SHORT_OPEN) {
          let shortSideVaultLegs: Option[] = [
            {
              contractType: ContractType.PUT,
              orderType: OrderType.LONG_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg1Strike,
              quantity: 1
            },
            {
              contractType: ContractType.PUT,
              orderType: OrderType.SHORT_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg2Strike,
              quantity: 1
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.SHORT_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg3Strike,
              quantity: 1
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.LONG_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg4Strike,
              quantity: 1
            }
          ]

          const vaultPrice = await estimateOptionPrice(
            shortSideVaultLegs,
            network
          )

          shortSideVaultLegs = updatePricesFromApiResponse(
            vaultPrice,
            shortSideVaultLegs
          )

          const shortVault: Vault = {
            strategyType: OptionStrategyType.IRON_CONDOR,
            optionLegs: shortSideVaultLegs,
            address: vault.address,
            price: vaultPrice.total_position_price,
            expiration: getTimeUTC(vault.expiration * 1000).readableTimestamp,
            contractsRemaining: 0,
            ticker: ticker,
            orderType: OrderType.SHORT_OPEN,
            ratio: 1
          }

          return shortVault
        }
      } else if (contractTypeFromDB === OptionStrategyType.BUTTERFLY) {
        const leg1Strike = strikes[0]
        const leg2Strike = strikes[1]
        const leg3Strike = strikes[2]
        if (orderType === OrderType.LONG_OPEN) {
          let longSideVaultLegs: Option[] = [
            {
              contractType: ContractType.CALL,
              orderType: OrderType.LONG_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg1Strike,
              quantity: 1
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.SHORT_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg2Strike,
              quantity: 2
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.LONG_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg3Strike,
              quantity: 1
            }
          ]

          const vaultPrice = await estimateOptionPrice(
            longSideVaultLegs,
            network
          )

          longSideVaultLegs = updatePricesFromApiResponse(
            vaultPrice,
            longSideVaultLegs
          )

          const longVault: Vault = {
            strategyType: OptionStrategyType.BUTTERFLY,
            optionLegs: longSideVaultLegs,
            address: vault.address,
            price: vaultPrice.total_position_price,
            expiration: getTimeUTC(vault.expiration * 1000).readableTimestamp,
            contractsRemaining: 0,
            ticker: ticker,
            orderType: OrderType.LONG_OPEN,
            ratio: 1
          }

          return longVault
        } else if (orderType === OrderType.SHORT_OPEN) {
          let shortSideVaultLegs: Option[] = [
            {
              contractType: ContractType.CALL,
              orderType: OrderType.SHORT_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg1Strike,
              quantity: 1
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.LONG_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg2Strike,
              quantity: 2
            },
            {
              contractType: ContractType.CALL,
              orderType: OrderType.SHORT_OPEN,
              readableExpiration: getTimeUTC(vault.expiration * 1000)
                .readableTimestamp,
              expirationTimestamp: getTimeUTC(vault.expiration * 1000)
                .unixTimestamp,
              ticker: ticker,
              strike: leg3Strike,
              quantity: 1
            }
          ]

          const vaultPrice = await estimateOptionPrice(
            shortSideVaultLegs,
            network
          )

          shortSideVaultLegs = updatePricesFromApiResponse(
            vaultPrice,
            shortSideVaultLegs
          )

          const shortVault: Vault = {
            strategyType: OptionStrategyType.BUTTERFLY,
            optionLegs: shortSideVaultLegs,
            address: vault.address,
            price: vaultPrice.total_position_price,
            orderType: OrderType.SHORT_OPEN,
            ticker: ticker,
            expiration: getTimeUTC(vault.expiration * 1000).readableTimestamp,
            contractsRemaining: 0,
            ratio: 1
          }

          return shortVault
        }
      }
    })
  )

  return parsedVaultContracts
}

function updatePricesFromApiResponse(
  apiResponse: OptionPriceResponse,
  vaultLegs: Option[]
): Option[] {
  for (const leg of vaultLegs) {
    const matchingApiResponse = apiResponse.option_legs_prices.find(
      (apiLeg: any) =>
        apiLeg.contractType === leg.contractType &&
        apiLeg.orderType === leg.orderType &&
        apiLeg.strike === leg.strike
    )

    if (matchingApiResponse) {
      leg.price = matchingApiResponse.price / leg.quantity
    }
  }

  return vaultLegs
}

export function getVaultEventsContract(
  network: NetworkVersion,
  signer: ethers.Signer
): Contract {
  return new Contract(VaultEventAddresses[network], ArrowVaultEvents, signer)
}

/**
 * Calculates the expected premium for a given option position, based on the current spot price.
 *
 * @param ticker The ticker symbol of the underlying asset.
 * @param optionType The type of option position
 * @param collateral The amount of collateral held for the position.
 * @param optionPrice The current price of the option.
 * @param strike The strike price(s) of the option.
 * @returns A promise that resolves to the expected premium (in percentage) of the option position.
 */
export async function calculateExpectedPremium(
  ticker: Ticker,
  optionType: OptionStrategyType,
  collateral: number,
  optionPrice: number,
  strike: number[]
): Promise<number> {
  const spotPrice = await getUnderlierSpotPrice(ticker)
  const numerator =
    optionPrice * calculateMaxContracts(optionType, strike, collateral)
  const expectedPremium = (numerator / spotPrice) * 100

  return expectedPremium
}

/**
 * Calculates the maximum number of option contracts that can be sold based on a collateral amount.
 *
 * @param optionType A string representing the type of option ("call", "put", "call spread", or "put spread").
 * @param strike An array of two numbers representing the strike prices of the option spread.
 * @param collateral A number representing the collateral amount available for selling options.
 * @returns The maximum number of option contracts that can be sold as a whole number.
 */
export function calculateMaxContracts(
  strategyType: OptionStrategyType,
  strike: number[],
  collateral: number
): number {
  let maxLoss: number
  // Higher strike / Spread * Collateral = Max Contracts
  if (strategyType === OptionStrategyType.CALL) {
    maxLoss = 1
  } else if (strategyType === OptionStrategyType.PUT) {
    maxLoss = strike[0]
  } else if (strategyType === OptionStrategyType.PUT_SPREAD) {
    if (!Array.isArray(strike) || strike.length !== 2) {
      throw new Error('Strike must be an array of two numbers.')
    }

    const largerStrike = Math.max(...strike)
    const smallerStrike = Math.min(...strike)
    maxLoss = largerStrike - smallerStrike
  } else if (strategyType === OptionStrategyType.CALL_SPREAD) {
    if (!Array.isArray(strike) || strike.length !== 2) {
      throw new Error('Strike must be an array of two numbers.')
    }

    const largerStrike = Math.max(...strike)
    const smallerStrike = Math.min(...strike)
    maxLoss = largerStrike - smallerStrike

    return (largerStrike / maxLoss) * collateral
  } else {
    throw new Error('Invalid option type.')
  }

  return collateral / maxLoss
}

/**
 * Gets the remaining number of option contracts available for a given ticker and contract type for the current epoch.
 * @param ticker The ticker of the option contract
 * @param contractType The type of the option contract
 * @param version The deployment version of the smart contract
 * @returns The number of remaining contracts available
 */
export async function getRemainingNumberOfContracts(
  vaultAddress: string,
  network: NetworkVersion
): Promise<number> {
  const currentEpoch = await getCurrentEpoch(vaultAddress, network)
  const epochData = await getEpochData({
    vaultAddress,
    epoch: currentEpoch,
    network: network
  })

  return epochData.remainingOptionQuantity
}

/**
 * Retrieves the current epoch value from the specified smart contract.
 *
 * @param {SmartContractInfo} contractIdentifier - The smart contract identifier containing:
 *   - ticker {Ticker} - The asset's ticker.
 *   - addresses {Record<string, string>} - An object mapping network names to contract addresses.
 *   - abi {any[]} - The contract's ABI (Application Binary Interface).
 * @returns {Promise<number>} A promise that resolves to the current epoch value as a regular number.
 * @throws Will throw an error if the function call to the smart contract fails.
 */
export async function getCurrentEpoch(
  vaultAddress: string,
  network: NetworkVersion
): Promise<number> {
  try {
    const provider =
      network === NetworkVersion.Mainnet ? providers.mainnet : providers.fuji
    // his is hardcoded for now under the assumption that the epoch will be the same for all contracts
    const currentEpochParams: SmartContractFunctionOptions = {
      address: vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'currentEpoch',
      functionArgs: [],
      signer: provider,
      network: network
    }

    const epoch = await callSmartContractFunction(currentEpochParams)

    return epoch.toNumber()
  } catch (error) {
    console.error('Error retrieving current epoch:', error)
    throw error
  }
}

export async function toggleAutoRolloverStatus(
  vaultAddress: string,
  network: NetworkVersion,
  signer: ethers.Signer
): Promise<string> {
  try {
    const toggleAutoRolloverStatusParams: SmartContractFunctionOptions = {
      address: vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'toggleAutoRolloverStatus',
      functionArgs: [],
      signer: signer,
      network: network
    }

    const tx_hash = await callSmartContractFunction(
      toggleAutoRolloverStatusParams
    )

    return tx_hash
  } catch (error) {
    console.error('Error toggling auto rollover:', error)
    throw error
  }
}

export async function getAutoRolloverStatus(
  vaultAddress: string,
  accountAddress: string,
  network: NetworkVersion
): Promise<boolean> {
  try {
    const provider =
      network === NetworkVersion.Mainnet ? providers.mainnet : providers.fuji

    const autoRolloverStatusParams: SmartContractFunctionOptions = {
      address: vaultAddress,
      abi: ArrowVVEngine,
      functionName: 'autoRollover',
      functionArgs: [accountAddress],
      signer: provider,
      network: network
    }

    const autoRolloverStatus = await callSmartContractFunction(
      autoRolloverStatusParams
    )

    return autoRolloverStatus as boolean
  } catch (error) {
    console.error('Error getting auto rollover status:', error)
    throw error
  }
}

/**
 * Deposits gas into the user's funds manager vault to be used for executing future trades
 *
 * @param beneficiary The address of the user whose gas vault is being funded
 * @param amount The amount of AVAX to deposit into the gas vault
 * @param signer The Ethereum signer to use for signing the transaction
 * @param version The deployment version of the funds manager
 */
export async function depositGasIntoVault(
  amountToDeposit: BigNumber,
  beneficiary: string,
  signer: ethers.Signer,
  network: NetworkVersion
) {
  const contract = new Contract(
    VaultUserFundsManager[network],
    VaultFundsManagerABI,
    signer
  )

  // Gets the total AVAX has already deposited in the gas manager
  const gasPaid: ethers.BigNumber = await contract.gasPaid(beneficiary)

  // Gets teh networks current gas price
  const gasPrice = await providers[network].getGasPrice()

  // Gets the user's AVAX balance
  const userAvaxBalance: ethers.BigNumber = await providers[network].getBalance(
    beneficiary
  )

  // Calculate the estimated gas fee based on the gas price and the default gas limit of 21000
  const gasFee = gasPrice.mul(ethers.BigNumber.from(21000))

  if (userAvaxBalance.lte(amountToDeposit.add(gasFee))) {
    const requiredAvaxBalance = amountToDeposit.add(gasFee).sub(userAvaxBalance)
    throw new Error(
      `You do not have enough AVAX to cover transaction fees. You need at least ${ethers.utils.formatEther(
        requiredAvaxBalance
      )} AVAX.`
    )
  }

  if (gasPaid.gt(amountToDeposit)) {
    return
  }

  const transaction = await (
    await contract.depositGas(beneficiary, {
      value: amountToDeposit
    })
  ).wait(3)

  return transaction.hash
}

export async function getEarnedPremium(
  vaultAddress: string,
  epoch: number,
  address: string,
  network: NetworkVersion
) {
  const provider =
    network === NetworkVersion.Mainnet ? providers.mainnet : providers.fuji

  const epochData = await getEpochData({
    vaultAddress,
    epoch: epoch,
    network: network
  })

  const vaultInstance = new Contract(vaultAddress, ArrowVVEngine, provider)
  const { quantityScaleFactor } = await fetchDecimals(vaultAddress, network)

  const providedOptionQuantities =
    (await vaultInstance.providedOptionQuantities(epoch, address)) /
    quantityScaleFactor

  const totalOptionQuantity = epochData.totalOptionQuantity

  const totalPremiumEarned = epochData.totalEarnedPremiums

  return (providedOptionQuantities / totalOptionQuantity) * totalPremiumEarned
}

export async function getHistoricalReturn(
  vaultAddress: string,
  strategyType: StrategyType,
  network: NetworkVersion
) {
  const currentEpoch = await getCurrentEpoch(vaultAddress, network)
  let twoEpochsAgo = currentEpoch - 2
  let previousEpoch = currentEpoch - 1

  if (currentEpoch == 1) return undefined

  if (currentEpoch == 2) {
    previousEpoch = 1
    twoEpochsAgo = 1
  }

  const twoEpochsAgoData = await getEpochData({
    vaultAddress,
    epoch: twoEpochsAgo,
    network: network
  })

  const previousEpochData = await getEpochData({
    vaultAddress,
    epoch: previousEpoch,
    network: network
  })

  const previousEpochStrikes = await getVaultStrikes({
    vaultAddress: vaultAddress,
    epoch: previousEpoch,
    network: network
  })

  const payOff = 1 // TO DO USE THE PAY OFF FUNCTION USED TO CHART THE GRAPH ON THE FRONT END

  const denominator = previousEpochData.isPayoutInUnderlier
    ? previousEpochData.totalLiquidityAmount * twoEpochsAgoData.settlementPrice
    : previousEpochData.totalLiquidityAmount

  const historicalReturn =
    (previousEpochData.totalEarnedPremiums -
      previousEpochData.totalOptionQuantitySold * payOff) /
    denominator

  return Number(historicalReturn.toFixed(2))
}

export function getSpreadStrikes(
  strikes: number[],
  strategyType: OptionStrategyType,
  orderType: OrderType
) {
  const sortedStrikes = strikes.sort((a, b) => a - b)
  const validateLength = (minLength: number) => {
    if (sortedStrikes.length < minLength) {
      return null
    }
  }

  const createLeg = (
    strike: number,
    type: OptionStrategyType,
    orderType: OrderType
  ) => ({
    strike,
    type,
    orderType
  })

  // TO DO USE THE ORDER TYPE TO DETERMINE IF LONG/SHORT
  switch (strategyType) {
    case OptionStrategyType.CALL_SPREAD:
      // SHORT CALL SPREAD
      if (orderType === OrderType.SHORT_OPEN || OrderType.SHORT_CLOSE) {
        validateLength(2)

        return [
          createLeg(
            sortedStrikes[1],
            OptionStrategyType.CALL,
            OrderType.LONG_OPEN
          ), // LONG LEG
          createLeg(
            sortedStrikes[0],
            OptionStrategyType.CALL,
            OrderType.SHORT_OPEN
          ) // SHORT LEG
        ]
      } else {
        validateLength(2)

        return [
          createLeg(
            sortedStrikes[0],
            OptionStrategyType.CALL,
            OrderType.LONG_OPEN
          ), // LONG LEG
          createLeg(
            sortedStrikes[1],
            OptionStrategyType.CALL,
            OrderType.SHORT_OPEN
          ) // SHORT LEG
        ]
      }

    case OptionStrategyType.PUT_SPREAD:
      if (orderType === OrderType.LONG_OPEN || OrderType.LONG_CLOSE) {
        validateLength(2)

        return [
          createLeg(
            sortedStrikes[1],
            OptionStrategyType.PUT,
            OrderType.LONG_OPEN
          ), // LONG LEG
          createLeg(
            sortedStrikes[0],
            OptionStrategyType.PUT,
            OrderType.SHORT_OPEN
          ) // SHORT LEG
        ]
      } else {
        validateLength(2)

        return [
          createLeg(
            sortedStrikes[0],
            OptionStrategyType.PUT,
            OrderType.LONG_OPEN
          ), // LONG lEG
          createLeg(
            sortedStrikes[1],
            OptionStrategyType.PUT,
            OrderType.SHORT_OPEN
          ) // SHORT LEG
        ]
      }

    case OptionStrategyType.IRON_CONDOR:
      if (orderType === OrderType.LONG_OPEN || OrderType.LONG_CLOSE) {
        validateLength(4)

        return [
          createLeg(
            sortedStrikes[0],
            OptionStrategyType.PUT,
            OrderType.SHORT_OPEN
          ), // SHORT PUT
          createLeg(
            sortedStrikes[1],
            OptionStrategyType.PUT,
            OrderType.LONG_OPEN
          ), // LONG PUT
          createLeg(
            sortedStrikes[2],
            OptionStrategyType.CALL,
            OrderType.LONG_OPEN
          ), // LONG CALL
          createLeg(
            sortedStrikes[3],
            OptionStrategyType.CALL,
            OrderType.SHORT_OPEN
          ) // SHORT CALL
        ]
      } else {
        validateLength(4)

        return [
          createLeg(
            sortedStrikes[0],
            OptionStrategyType.PUT,
            OrderType.LONG_OPEN
          ), // LONG PUT
          createLeg(
            sortedStrikes[1],
            OptionStrategyType.PUT,
            OrderType.SHORT_OPEN
          ), // SHORT PUT
          createLeg(
            sortedStrikes[2],
            OptionStrategyType.CALL,
            OrderType.SHORT_OPEN
          ), // SHORT CALL
          createLeg(
            sortedStrikes[3],
            OptionStrategyType.CALL,
            OrderType.LONG_OPEN
          ) // LONG CALL
        ]
      }

    case OptionStrategyType.BUTTERFLY:
      if (orderType === OrderType.LONG_CLOSE || OrderType.LONG_OPEN) {
        validateLength(3)

        return [
          createLeg(
            sortedStrikes[0],
            OptionStrategyType.CALL,
            OrderType.LONG_OPEN
          ), // LONG CAL
          createLeg(
            sortedStrikes[1],
            OptionStrategyType.CALL,
            OrderType.SHORT_OPEN
          ), // SHORT CALL
          createLeg(
            sortedStrikes[2],
            OptionStrategyType.CALL,
            OrderType.LONG_OPEN
          ) // LONG CALL
        ]
      } else {
        validateLength(3)

        return [
          createLeg(
            sortedStrikes[0],
            OptionStrategyType.CALL,
            OrderType.SHORT_OPEN
          ), // SHORT CALL
          createLeg(
            sortedStrikes[1],
            OptionStrategyType.CALL,
            OrderType.LONG_OPEN
          ), // LONG CALL
          createLeg(
            sortedStrikes[2],
            OptionStrategyType.CALL,
            OrderType.SHORT_OPEN
          ) // SHORT CALL
        ]
      }

    default:
      return null
  }
}

export function convertVaultStrategyTypeToString(
  strategyType: OptionStrategyType,
  orderType: OrderType
): StrategyTypeString {
  switch (strategyType) {
    case OptionStrategyType.CALL:
      return orderType === OrderType.LONG_OPEN ||
        orderType === OrderType.LONG_CLOSE
        ? 'Long Call'
        : 'Short Call'
    case OptionStrategyType.PUT:
      return orderType === OrderType.LONG_OPEN ||
        orderType === OrderType.LONG_CLOSE
        ? 'Long Put'
        : 'Short Put'
    case OptionStrategyType.CALL_SPREAD:
      return orderType === OrderType.LONG_OPEN ||
        orderType === OrderType.LONG_CLOSE
        ? 'Call Debit Spread'
        : 'Call Credit Spread'
    case OptionStrategyType.PUT_SPREAD:
      return orderType === OrderType.LONG_OPEN ||
        orderType === OrderType.LONG_CLOSE
        ? 'Put Debit Spread'
        : 'Put Credit Spread'
    case OptionStrategyType.IRON_CONDOR:
      return orderType === OrderType.LONG_OPEN ||
        orderType === OrderType.LONG_CLOSE
        ? 'Long Iron Condor'
        : 'Short Iron Condor'
    case OptionStrategyType.BUTTERFLY:
      return orderType === OrderType.LONG_OPEN ||
        orderType === OrderType.LONG_CLOSE
        ? 'Long Butterfly'
        : 'Short Butterfly'
    default:
      return 'Custom'
  }
}
