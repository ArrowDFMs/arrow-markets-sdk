# Arrow API

Arrow Markets has an API for interacting with its contract suite. This is due to the fact that we compute an option's price off-chain and therefore must pass it securely as a part of the transaction parameters. The transaction must be submitted by the deployer of the contracts.

There is an `arrow-sdk.ts` file in the repository that contains useful variables, objects, and functions, such as the API URL and the router contract. For reference, the scripts contained within the `./examples` folder make use of that file.

## API URLs

The API can be accessed via `https://fuji-v3-api.arrow.markets/v1/<ENDPOINT>` or `https://competition-v2-api.arrow.markets/v1/<ENDPOINT>`\
The Fuji test network can be accessed via `https://api.avax-test.network/ext/bc/C/rpc`

## Endpoints

Estimate Option Price: `/estimate-option-price`\
`POST` request\
\
Inputs:
```
Body: {
    "order_type", // 0 for open long, 1 for close long, 2 for open short, and 3 for close short.
    "ticker", // String to indicate a particular asset ("AVAX", "ETH", "BTC", or "LINK").
    "expiration", // Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
    "strike", // Price at which contract becomes active at expiration.
    "contract_type", // 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
    "quantity", // Number of contracts desired in the order.
    "spot_price", // Current price of underlying assetas number. We recommend requesting this data from https://api.binance.com/api/v3/ticker/price?symbol={binance_symbol}.
    "price_history" // Price history of underlying asset in an array. We recommend requesting this data from https://api.coingecko.com/api/v3/coins/{crypto_id}/market_chart?vs_currency=usd&days=84.
}
```
Outputs:
```
{
    "option_price", // Current price of the option contract given the data from the "price_history" input.
    "greeks": {
        "delta", // Sensitivity of an option’s price to changes in the value of the underlying.
        "gamma", // Change in delta per change in price of the underlying.
        "theta", // Measures time decay of price of option.
        "rho", // Sensitivity of option prices to changes in interest rates.
        "vega" // Change in value from a 1% change in volatility.
    }
}
```
\
Get Recommended Option: `/get-recommended-option`\
Note: This currently only works with the speculation workflow. Hedging workflow is coming soon.\
`GET` request\
\
Inputs:
```
Params: {
    "ticker", // String to indicate a particular asset ("AVAX", "ETH", or "BTC").
    "expiration", // Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
    "forecast" // Forecasted price of the underlying asset (e.g. we might expect AVAX to reach $115, so we would pass 115).
    "spot_price" // Current price of underlying assetas number.
    "price_history" // Price history of underlying asset in an array.
}
```
Outputs:
```
{
    "option": {
        "strike" // Price at which contract becomes active at expiration.
        "price", // Current price of the option contract.
        "contract_type", // 0 for call, 1 for put, 2 for call spread, and 3 for put spread. 
        "greeks": {
            "delta", // Sensitivity of an option’s price to changes in the value of the underlying.
            "gamma", // Change in delta per change in price of the underlying.
            "theta", // Measures time decay of price of option.
            "rho", // Sensitivity of option prices to changes in interest rates.
            "vega" // Change in value from a 1% change in volatility.
        },
    }
}
```
\
Submit Order: `/submit-order`\
`POST` request
```
Body: {
    "order_type", // 0 for open long, 1 for close long, 2 for open short, and 3 for close short.
    "ticker", // String to indicate a particular asset ("AVAX", "ETH", or "BTC").
    "expiration", // Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
    "strike", // Price at which contract becomes active at expiration.
    "contract_type", // 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
    "quantity", // Number of contracts desired in the order.
    "threshold_price", // Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
    "hashed_params", // Stringified hash of parameters.
    "signature" // User's signature of the hashed parameters.
}
```
Note: For ease of use, we may update the `threshold_price` parameter to ask for a javascript number instead of a parsed ethers BigNumber.\
\
Outputs:
```
{
    "tx_hash", // Hash of the transaction that was submitted upon successful API request.
    "execution_price" // Price that the user was charged per option contract in the order.
}

```
\
Submit Order: `/open-short-position`\
`POST` request
```
Body: {
    "order_type", // 0 for open long, 1 for close long, 2 for open short, and 3 for close short.
    "ticker", // String to indicate a particular asset ("AVAX", "ETH", or "BTC").
    "expiration", // Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
    "strike", // Price at which contract becomes active at expiration.
    "contract_type", // 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
    "quantity", // Number of contracts desired in the order.
    "threshold_price", // Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
    "hashed_params", // Stringified hash of parameters.
    "signature" // User's signature of the hashed parameters.
}
```
\
Outputs:
```
{
    "tx_hash", // Hash of the transaction that was submitted upon successful API request.
    "execution_price" // Price that the user was charged per option contract in the order.
}

```
\
Submit Order: `/close-short-position`\
`POST` request
```
Body: {
    "pay_premium", // true if the user plans on paying the premium using their stablecoin, false if the user wants to pay using their collateral 
    "order_type", // 0 for open long, 1 for close long, 2 for open short, and 3 for close short.
    "ticker", // String to indicate a particular asset ("AVAX", "ETH", or "BTC").
    "expiration", // Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
    "strike", // Price at which contract becomes active at expiration.
    "contract_type", // 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
    "quantity", // Number of contracts desired in the order.
    "threshold_price", // Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
    "hashed_params", // Stringified hash of parameters.
    "signature" // User's signature of the hashed parameters.
}
```
\
Outputs:
```
{
    "tx_hash", // Hash of the transaction that was submitted upon successful API request.
    "execution_price" // Price that the user was charged per option contract in the order.
}
```

# Arrow Contracts

There are several smart contracts that comprise the Arrow Markets smart contract suite, however, due to the architecture of the deployment, only a few are necessary for developing composable products and features.

The important contracts are the ArrowRouter, ArrowRegistry, and ArrowEvents contracts.

## Arrow Event Specifications

Developers may find it useful to access logs from the Arrow Events contract. Standard events filters from `web3.py`, `web3.js` and `ethers.js` can be used.

The most relevant events are likely the `NewLiabilityCreation`, `NewLiabilityDestruction`, `NewShortPositionCreation` and `NewShortPositionDestruction` events. The rest of the events can be found in the `IArrowEvents.json` ABI files.

The NewLiabilityCreation, NewLiabilityDestruction, NewShortPositionCreation, and NewShortPositionDestruction events look as follows:
```
{
    "ownerAddress": address, // Indexed address of the owner of the new liability
    "optionAddress": address, // Indexed address of the on-chain option contract
    "hashedTicker": string, // Indexed string to indicate a particular asset ("AVAX", "ETH", "BTC", or "LINK").
    "ticker": string // String to indicate a particular asset ("AVAX", "ETH", "BTC", or "LINK").
    "expiration": uint256, // Date in Unix timestamp. Must be 9:00 PM UTC (e.g. 1643144400 for January 25th, 2022)
    "readableExpiration": uint256, // Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
    "decimalStrike": string, // String version of the strike that includes the decimal places (e.g. "12.25").
    "contractType": uint256, // 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
    "quantity": uint256, // Number of contracts desired in the order.
    "optionPrice": uint256 // Price paid or received for each of the option contracts.
}
```

# Examples

## Getting Stablecoin Contract From Router Contract

The code below is an example of how to access contract addresses through the Arrow router contract. The code is available in `./examples/get-stablecoin-contract.ts` as well.

```javascript
import arrowsdk from "../lib/src/arrow-sdk"

async function main() {
    const version = arrowsdk.Version.V3
    const stablecoin = await arrowsdk.getStablecoinContract(version)
}
main()
```

## Submitting Option Order Through API

The code below is used to place an order on the Arrow platform. There are several steps outlined for this. For the full script, please refer to `./examples/place-option-order.ts`\
\
Step 1: Prepare the `deliverOption()` function call parameters. This includes hashing the option parameters and having the user sign the hash.

```javascript
const deliverOptionParams: DeliverOptionParams[] = await arrowsdk.prepareDeliverOptionParams(optionOrderParams, version, wallet)
```

Inside `prepareDeliverOptionParams()` we can see how the hash and signature are produced
```javascript
// Hash and sign the option order parameters for on-chain verification
const hashedValues = ethers.utils.solidityKeccak256(
    [
        "bool",       // buyFlag - Boolean to indicate whether this is a buy (true) or sell (false).
        "string",     // ticker - String to indicate a particular asset ("AVAX", "ETH", or "BTC").
        "uint256",    // expiration - Date in Unix timestamp. Must be 8:00 AM UTC (e.g. 1643097600 for January 25th, 2022).
        "uint256",    // readableExpiration - Date in "MMDDYYYY" format (e.g. "01252022" for January 25th, 2022).
        "uint256[2]", // strike - Ethers BigNumber versions of the strikes in terms of the stablecoin's decimals (e.g. [ethers.utils.parseUnits(strike, await usdc_e.decimals()), ethers.BigNumber.from(0)]).
        "string",     // decimalStrike - String version of the strike that includes the decimal places (e.g. "12.25").
        "uint256",    // contractType - 0 for call, 1 for put, 2 for call spread, and 3 for put spread.
        "uint256",    // quantity - Integer number of contracts desired in the order. Has to be scaled by supported decimals (10**2).
        "uint256"     // thresholdPrice - Indication of the price the user is willing to pay (e.g. ethers.utils.parseUnits(priceWillingToPay, await usdc_e.decimals()).toString()).
    ],
    [
        optionOrderParams.orderType === OrderType.LONG_OPEN,
        optionOrderParams.ticker,
        unixExpiration,
        optionOrderParams.expiration,
        bigNumberStrike,
        formattedStrike,
        optionOrderParams.contractType,
        intQuantity,
        thresholdPrice
    ]
)
const signature = await wallet.signMessage(ethers.utils.arrayify(hashedValues)) // Note that we are signing a message, not a transaction
```

Step 2: Approval to option chain proxy.

Because we deal in ERC20s, we require a user to allow the option chain contract to spend their stablecoin with an `approve()` function call. This must be done before submitting the request to the API to ensure that the transaction will succeed. Since the option chain proxy may not have been deployed yet, we must use `CREATE2` to compute the address for the option chain contract as follows:
```javascript
// Get computed option chain address
const optionChainAddress = await arrowsdk.computeOptionChainAddress(option.ticker, option.expiration, version)

// Approval circuit if the order is a "buy" order
if (deliverOptionParams.orderType === OrderType.LONG_OPEN) {
    // Get user's balance of stablecoin
    const userBalance = await stablecoin.balanceOf(wallet.address)

    // If user's balance is less than the amount required for the approval, throw an error
    if (userBalance.lt(deliverOptionParams.amountToApprove)) {
        throw new Error('You do not have enough stablecoin to pay for your indicated threshold price.')
    }

    // Get the amount that the option chain proxy is currently approved to spend
    let approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
    // If the approved amount is less than the amount required to be approved, ask user to approve the proper amount
    if (approvedAmount.lt(deliverOptionParams.amountToApprove)) {
        // Wait for the approval to be confirmed on-chain
        await (await stablecoin.approve(optionChainAddress, deliverOptionParams.amountToApprove)).wait(numBlockConfirmations)

        // Get the amount that the option chain proxy is approved to spend now
        approvedAmount = await stablecoin.allowance(wallet.address, optionChainAddress)
        // If the newly approved amount is still less than the amount required to be approved, throw and error
        if (approvedAmount.lt(deliverOptionParams.amountToApprove)) {
            throw new Error('Approval to option chain failed.')
        }
    }
}
```
Step 3: Submit long option order request to API.

The `tx_hash` and `execution_price` parameters will be populated if the API call is successful. In the case where the API call is unsuccessful, more details are provided by the response from axios, so make sure you use a try-catch block.
```javascript
// Submit order to API and get response
try {
    const {tx_hash, execution_price} = await arrowsdk.submitLongOptionOrder(deliverOptionParams, version)
} catch(err) {
    console.log(err)
}
```