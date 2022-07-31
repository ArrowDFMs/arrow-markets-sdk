/**************************************
 *             INTERFACES             *
 **************************************/

import { ethers } from "ethers";

 export interface Greeks {
    delta: number,
    gamma: number,
    theta: number
}

export interface Option {
    ticker: string;
    expiration: string;
    strike: number | number[];
    contractType: number;
    quantity?: number;
    price?: number;
    underlierPriceHistory?: number[];
    greeks?: Greeks;
}

export interface ModifyOption {
    ticker?: string;
    expiration?: string;
    strike?: number | number[];
    contractType?: number;
    quantity?: number;
    price?: number;
    underlierPriceHistory?: number[];
    greeks?: Greeks;
}

export interface OptionOrderParams extends Option {
    buyFlag: boolean;
    limitFlag: boolean;
    thresholdPrice: number;
}

export interface ModifyOptionOrderParams extends ModifyOption {
    buyFlag?: boolean;
    limitFlag?: boolean;
    thresholdPrice?: number;
}

export interface DeliverOptionParams extends OptionOrderParams {
    hashedValues: string;
    signature: string;
    amountToApprove: ethers.BigNumber;
    unixExpiration: number;
    formattedStrike: string;
    bigNumberStrike: ethers.BigNumber | ethers.BigNumber[];
    bigNumberThresholdPrice: ethers.BigNumber;
}

export interface ModifyDeliverOptionParams extends ModifyOptionOrderParams {
    hashedValues: string;
    signature: string;
    amountToApprove: ethers.BigNumber;
    unixExpiration: number;
    formattedStrike: string;
    bigNumberStrike: ethers.BigNumber | ethers.BigNumber[];
    bigNumberThresholdPrice: ethers.BigNumber;
}