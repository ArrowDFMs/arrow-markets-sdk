import { BigNumber } from 'ethers'
import { ContractType, Option, OrderType } from '../types/option'

/**
 * TODO FINISH THIS LOGIC
 *
 * @returns The readable contract type.
 */
export const getReadableContractType = (options: Option[]) => {
  //TO DO FINISH THIS LOGIC
}

/**
 * Converts a BigNumber or an array of BigNumbers to regular numbers, scaled down by the specified factor.
 *
 * @param {BigNumber | BigNumber[]} input - The BigNumber or array of BigNumbers to be converted.
 * @param {number} [scale=0] - The scaling factor (default is 6, which divides input by 10^6).
 * @returns {number | number[]} The converted regular number or an array of converted regular numbers.
 */
export function toRegularNumber(
  input: BigNumber | BigNumber[],
  scale = 0
): any {
  const scaleDown = (bigNumber: BigNumber) => bigNumber.div(scale).toNumber()

  if (Array.isArray(input)) {
    return input.map(scaleDown)
  } else {
    return scaleDown(input)
  }
}
