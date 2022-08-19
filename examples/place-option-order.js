"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
// We use dotenv to retrieve the PRIVATE_KEY of the account with which the example order will be placed
// but this does not have to be the way that you choose to inject your own private key into this example code.
require('dotenv').config();
// Imports
var axios_1 = require("axios");
var arrow_sdk_1 = require("../lib/src/arrow-sdk");
var ethers_1 = require("ethers");
var moment = require("moment");
// Get wallet using private key from .env file
var wallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, arrow_sdk_1.providers.fuji);
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var version, stablecoin, numBlockConfirmations, resultDate, today, readableExpiration, buyFlag, option, cryptoId, priceData, binanceSymbol, binanceResponse, spotPrice, estimatedOptionPrice, optionOrderParams, deliverOptionParams, optionChainAddress, userBalance, approvedAmount, _a, tx_hash, execution_price;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    version = arrow_sdk_1.VERSION.V3;
                    return [4 /*yield*/, (0, arrow_sdk_1.getStablecoinContract)(wallet, version)
                        // A constant indicating how many block confirmations
                        // to wait after submitting transactions to the blockchain
                    ];
                case 1:
                    stablecoin = _b.sent();
                    numBlockConfirmations = 2;
                    resultDate = new Date();
                    today = new Date();
                    resultDate.setDate(today.getDate() + (7 + 5 - today.getDay()) % 7);
                    readableExpiration = moment.utc(resultDate).format('MMDDYYYY');
                    buyFlag = true // True if buying, false if selling
                    ;
                    option = {
                        "ticker": "AVAX",
                        "expiration": readableExpiration,
                        "strike": [87.02, 84.0],
                        "contractType": 3,
                        "quantity": 2
                    };
                    cryptoId = 'avalanche-2' // Assuming AVAX ticker. Please refer to CoinGecko's documentation for other IDs
                    ;
                    return [4 /*yield*/, axios_1["default"].get("https://api.coingecko.com/api/v3/coins/".concat(cryptoId, "/market_chart?vs_currency=usd&days=84"))]; // 12 weeks * 7 days per week = 84 days
                case 2:
                    priceData = _b.sent() // 12 weeks * 7 days per week = 84 days
                    ;
                    option.underlierPriceHistory = priceData.data.prices.map(function (priceArr) { return priceArr[1]; }); // Extract the prices out of the (timestamp, price) tuples
                    binanceSymbol = 'AVAXUSDT';
                    return [4 /*yield*/, axios_1["default"].get("https://api.binance.com/api/v3/ticker/price?symbol=".concat(binanceSymbol))];
                case 3:
                    binanceResponse = _b.sent();
                    spotPrice = binanceResponse.data.price;
                    option.spotPrice = spotPrice;
                    return [4 /*yield*/, (0, arrow_sdk_1.estimateOptionPrice)(option, version)
                        // Prepare the order parameters
                    ];
                case 4:
                    estimatedOptionPrice = _b.sent();
                    optionOrderParams = __assign(__assign({ buyFlag: buyFlag }, option), { 
                        // Below we set a threshold price for which any higher (for option buy) or lower (for option sell) price will be rejected in the option order
                        // For this example, we choose to set our thresholdPrice to be equal to the estimatedOptionPrice
                        thresholdPrice: estimatedOptionPrice });
                    return [4 /*yield*/, (0, arrow_sdk_1.prepareDeliverOptionParams)(optionOrderParams, wallet, version)
                        // Get computed option chain address
                    ];
                case 5:
                    deliverOptionParams = _b.sent();
                    return [4 /*yield*/, (0, arrow_sdk_1.computeOptionChainAddress)(option.ticker, option.expiration, version)
                        // Approval circuit if the order is a "buy" order
                    ];
                case 6:
                    optionChainAddress = _b.sent();
                    if (!deliverOptionParams.buyFlag) return [3 /*break*/, 12];
                    return [4 /*yield*/, stablecoin.balanceOf(wallet.address)
                        // If user's balance is less than the amount required for the approval, throw an error
                    ];
                case 7:
                    userBalance = _b.sent();
                    // If user's balance is less than the amount required for the approval, throw an error
                    if (userBalance.lt(deliverOptionParams.amountToApprove)) {
                        throw new Error('You do not have enough stablecoin to pay for your indicated threshold price.');
                    }
                    return [4 /*yield*/, stablecoin.allowance(wallet.address, optionChainAddress)
                        // If the approved amount is less than the amount required to be approved, ask user to approve the proper amount
                    ];
                case 8:
                    approvedAmount = _b.sent();
                    if (!approvedAmount.lt(deliverOptionParams.amountToApprove)) return [3 /*break*/, 12];
                    return [4 /*yield*/, stablecoin.approve(optionChainAddress, deliverOptionParams.amountToApprove)];
                case 9: 
                // Wait for the approval to be confirmed on-chain
                return [4 /*yield*/, (_b.sent()).wait(numBlockConfirmations)
                    // Get the amount that the option chain proxy is approved to spend now
                ];
                case 10:
                    // Wait for the approval to be confirmed on-chain
                    _b.sent();
                    return [4 /*yield*/, stablecoin.allowance(wallet.address, optionChainAddress)
                        // If the newly approved amount is still less than the amount required to be approved, throw and error
                    ];
                case 11:
                    // Get the amount that the option chain proxy is approved to spend now
                    approvedAmount = _b.sent();
                    // If the newly approved amount is still less than the amount required to be approved, throw and error
                    if (approvedAmount.lt(deliverOptionParams.amountToApprove)) {
                        throw new Error('Approval to option chain failed.');
                    }
                    _b.label = 12;
                case 12: return [4 /*yield*/, (0, arrow_sdk_1.submitOptionOrder)(deliverOptionParams, version)];
                case 13:
                    _a = _b.sent(), tx_hash = _a.tx_hash, execution_price = _a.execution_price;
                    console.log("Transaction hash:", tx_hash); // Transaction has of option order on Arrow
                    console.log("Execution price:", execution_price); // The price the user ended up paying for each option in their order
                    return [2 /*return*/];
            }
        });
    });
}
main();
