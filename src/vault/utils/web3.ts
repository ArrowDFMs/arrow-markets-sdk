import { Contract, ethers } from 'ethers'
import { SmartContractFunctionOptions } from '../types/web3'
import {
  StablecoinAddresses,
  VaultUserFundsManager,
  WrappedAssets
} from '../constants/vault'
import { NetworkVersion } from '../../common/types/web3'
import { PositionStrategy, Ticker } from '../../common/types/option'
import { getVaultDetailsByAddress } from './vault'
import { IERC20Metadata } from '../../../abis'

/**
 * Calls a smart contract function, either read-only or requiring a transaction.
 *
 * @param options - An object containing the necessary information to call the smart contract function.
 * @param options.contractIdentifier - An object containing the contract information, including name, addresses, and ABI.
 * @param options.contractIdentifier.name - The name of the contract.
 * @param options.contractIdentifier.addresses - A dictionary mapping network names to contract addresses.
 * @param options.contractIdentifier.abi - The contract's ABI as an array.
 * @param options.functionName - The name of the function to call.
 * @param options.functionArgs - An array containing the arguments to pass to the function (default: []).
 * @param options.signer - An ethers.js signer object (required for non-read-only functions).
 * @param options.version - The version of the network to use (e.g., Network.Mainnet, Network.Fuji).
 *
 * @returns A promise that resolves to the result of the smart contract function call.
 *          If the function is read-only, it returns the return value(s) of the function.
 *          If the function requires a transaction, it returns the transaction receipt.
 *
 * @throws Will throw an error if the function is not found in the ABI or if a signer is required but not provided.
 */
export async function callSmartContractFunction(
  options: SmartContractFunctionOptions
): Promise<any> {
  const { functionName, functionArgs = [], signer } = options
  // Create a contract instance
  const contract = new Contract(
    options.address,
    options.abi,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    signer!
  )

  // Check if the function exists in the ABI
  const functionFragment = contract.interface.getFunction(functionName)
  if (!functionFragment) {
    throw new Error(
      `Function "${functionName}" not found in the smart contract ABI.`
    )
  }
  // Check if the function is read-only or requires a signer
  const isReadOnly =
    functionFragment.stateMutability === 'view' ||
    functionFragment.stateMutability === 'pure'

  // Call the smart contract function
  if (isReadOnly) {
    return await contract[functionName](...functionArgs)
  } else {
    if (!signer) {
      throw new Error('A signer is required to call a non-read-only function.')
    }
    const tx = await contract[functionName](...functionArgs)
    const blockConfirmations = 3
    const txReceipt = await tx.wait(blockConfirmations)
    // const txReceipt = waitTransaction(provider, tx.hash)

    return txReceipt
  }
}

/**
 * Checks if the user has enough balance and allowance for a given ticker and amount.
 *
 * @param ticker - The ticker of the token.
 * @param contractType - The type of the contract (Call, Call Spread, etc.).
 * @param amount - The amount of tokens to check.
 * @param signer - The signer used to sign the transaction.
 * @param network - The Ethereum network to use.
 * @returns True if the user has approved enough balance or false if not.
 */
export async function checkBalanceAndAllowance(
  vaultAddress: string,
  strategyType: PositionStrategy,
  amount: number,
  signer: ethers.Signer,
  network: NetworkVersion
): Promise<boolean> {
  let tokenAddress
  let decimals

  /*
      COULD JUST BE THIS:
        if (
          contractType === ContractTypeEnum.CALL ||
          contractType === ContractTypeEnum.CALL_SPREAD
        ) {
          try {
            tokenAddress = WrappedAssets[network][ticker]
          } catch (err) {
            throw new Error('Invalid ticker')
          }
        } else { // contractType == ContractTypeEnum.PUT || contractType == ContractTypeEnum.PUT_SPREAD
          tokenAddress = StablecoinAddresses[network]
        }

        const tokenContract = new Contract(tokenAddress, IERC20MetadataAbi, signer)
        const decimals = await tokenContract.decimals()

        ...
    */
  const vaultDetails = await getVaultDetailsByAddress(vaultAddress, network)

  if (strategyType === PositionStrategy.CALL) {
    if (vaultDetails.ticker === Ticker.ETH) {
      tokenAddress = WrappedAssets[network]['ETH']
      decimals = 18 // TODO: We have to check to make sure this is valid on mainnet
    } else if (vaultDetails.ticker === Ticker.BTC) {
      tokenAddress = WrappedAssets[network]['BTC']
      decimals = 8 // TODO: We have to check to make sure this is valid on mainnet
    } else {
      throw new Error('Invalid ticker')
    }
  } else {
    tokenAddress = StablecoinAddresses[network]
    decimals = 6 // TODO: We have to check to make sure this is valid on mainnet
  }
  const bnAmount = ethers.utils.parseUnits(amount.toString(), decimals)
  const tokenContract = new Contract(tokenAddress, IERC20Metadata, signer)

  const balance = await tokenContract.balanceOf(signer.getAddress())
  if (balance.lt(bnAmount)) {
    return false
  }
  const allowance = await tokenContract.allowance(
    signer.getAddress(),
    VaultUserFundsManager[network]
  )

  if (allowance.lt(bnAmount)) {
    return false
  }

  return true
}
