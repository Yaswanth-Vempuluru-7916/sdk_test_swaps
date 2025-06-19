
# SwapKit (Browser Environment)

## Installation

```bash
yarn add @swapkit/sdk@3.0.0-beta.23
```

## Setup

```typescript
import { createSwapKit } from "@swapkit/sdk";

let skClient: ReturnType<typeof createSwapKit> | undefined;
const SWAPKIT_API = import.meta.env.VITE_SWAPKIT_API;

export const getSwapKitClient = () => {
  if (skClient) {
    return skClient;
  }
  
  skClient = createSwapKit({
    config: {
      apiKeys: {
        swapKit: SWAPKIT_API,
      },
    },
  });
  
  return skClient;
};

export type SwapKitClient = ReturnType<typeof getSwapKitClient>;
```

## Usage

```typescript
const skClient = getSwapKitClient();
```

## Wallet Connection

```typescript
import { Chain, WalletOption } from "@swapkit/sdk";

// Connect MetaMask wallet
await skClient.connectEVMWallet([Chain.Arbitrum], WalletOption.METAMASK);
```




## Getting Swap Quote

```typescript
import { SwapKitApi } from "@swapkit/sdk";

const { routes } = await SwapKitApi.getSwapQuote({
  sellAsset: "ARB.USDC-0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  sellAmount: "0.01",
  buyAsset: "ARB.USDT-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  sourceAddress: skClient.getAddress(Chain.Arbitrum),
  destinationAddress: skClient.getAddress(Chain.Arbitrum),
  slippage: 3,
  includeTx: true,
});
```

### Quote Parameters

- `sellAsset` (string) - Asset to sell (required)
- `buyAsset` (string) - Asset to buy (required)
- `sellAmount` (string) - Amount to sell (required, must be > 0)
- `sourceAddress` (string) - Source wallet address (optional)
- `destinationAddress` (string) - Destination wallet address (optional)
- `slippage` (number) - Slippage tolerance percentage (optional, default: 3%)
- `includeTx` (boolean) - Include transaction object for EVM (optional)
- `providers` (string[]) - Specific providers to use (optional)
- `affiliate` (string) - Affiliate thorname (optional)
- `affiliateFee` (number) - Affiliate fee in basis points (optional)
- `allowSmartContractSender` (boolean) - Allow smart contract as sender (optional)
- `allowSmartContractReceiver` (boolean) - Allow smart contract as recipient (optional)
- `disableSecurityChecks` (boolean) - Disable security checks (optional)
- `cfBoost` (boolean) - Enable Chainflip boost for BTC (optional)
- `referrer` (string) - Referrer address for referral program (optional)


## Executing Swap

### 1. Create Asset Value

```typescript
import { AssetValue } from "@swapkit/sdk";

 const bestRoute = routes[0];

const sellAsset = AssetValue.from({
  asset: bestRoute.sellAsset,
  value: bestRoute.sellAmount,
});
```

### 2. Check Asset Approval

```typescript
import { ProviderName } from "@swapkit/sdk";

const isApproved = ![ProviderName.CHAINFLIP, ProviderName.CHAINFLIP_STREAMING, ProviderName.NEAR].includes(
  bestRoute.providers[0],
) ? await skClient.isAssetValueApproved(
    sellAsset,
    bestRoute.meta.approvalAddress ||
    bestRoute.targetAddress ||
    bestRoute.providers[0].toLowerCase()
  ) : true;
```

### 3. Approve Asset (if needed)

```typescript
if (!isApproved) {
  console.log(`Approving asset: ${bestRoute.sellAsset}`);
  
  const approvalHash = await skClient.approveAssetValue(
    sellAsset,
    bestRoute.meta.approvalAddress || 
    bestRoute.targetAddress || 
    bestRoute.providers[0].toLowerCase()
  );
  
  console.log(`Asset approved: ${skClient.getExplorerTxUrl({
    txHash: approvalHash, 
    chain: sellAsset.chain 
  })}`);
  
  return;
}
```

### 4. Execute Swap

```typescript
import { FeeOption } from "@swapkit/sdk";

const txHash = await skClient.swap({
  route: bestRoute,
  feeOptionKey: FeeOption.Fast,
});

console.log(`Swap transaction: ${skClient.getExplorerTxUrl({
  txHash, 
  chain: sellAsset.chain 
})}`);

```
## FeeOption Enum
``` bash
export enum FeeOption {
  Average = "average",
  Fast = "fast",
  Fastest = "fastest",
}
```

### Swap Flow Summary

1. **Asset Creation** - Create AssetValue from route data
2. **Approval Check** - Check if asset needs approval (skip for Chainflip/Near)
3. **Asset Approval** - Approve asset spending if required
4. **Swap Execution** - Execute swap with selected fee option
5. **Transaction Tracking** - Get explorer URL for transaction
## Complete Example

### swapKitClient.ts

```typescript
import { createSwapKit } from "@swapkit/sdk";

let skClient: ReturnType<typeof createSwapKit> | undefined;
const SWAPKIT_API = import.meta.env.VITE_SWAPKIT_API;
// console.log(`SWAPKIT_API: ${SWAPKIT_API}`);
export const getSwapKitClient = ({
  // walletConnectProjectId,
  // brokerEndpoint,
}: {
  // walletConnectProjectId?: string
  // brokerEndpoint?: string;
} = {}) => {
  if (skClient) {
    return skClient;
  }
  skClient = createSwapKit({
    config: {
      apiKeys: {
        swapKit: SWAPKIT_API,
        // walletConnectProjectId,
      },

    },
  });

  return skClient;
};

export type SwapKitClient = ReturnType<typeof getSwapKitClient>;
```

### app.tsx

```typescript
import { useState } from "react";
import { getSwapKitClient } from "./swapKitClient";
import {
  AssetValue,
  Chain,
  FeeOption,
  ProviderName,
  SwapKitApi,
  WalletOption,
  type QuoteResponseRoute,
} from "@swapkit/sdk";
import "./App.css"
const App = () => {
  const [skClient] = useState(() =>
    getSwapKitClient()
  );

  const [route, setRoute] = useState<QuoteResponseRoute  | null>(null);
  const [sellAssetValue, setSellAssetValue] = useState<AssetValue | null>(null);

  const handleConnectWallet = async () => {
    try {
      await skClient.connectEVMWallet([Chain.Arbitrum], WalletOption.METAMASK);
      console.log("Wallet connected!");
      const walletWithBalance = await skClient.getWalletWithBalance(Chain.Arbitrum);
      console.log(`Address: ${walletWithBalance.address}`);
      console.log(`Balance: ${walletWithBalance.balance}`);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  const handleGetQuote = async () => {
    const { routes } = await SwapKitApi.getSwapQuote({
      sellAsset: "ARB.USDC-0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      sellAmount: "0.01",
      buyAsset: "ARB.USDT-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      sourceAddress: skClient.getAddress(Chain.Arbitrum),
      destinationAddress: skClient.getAddress(Chain.Arbitrum),
      slippage: 3,
      includeTx: true,
    });

    console.log("routes : ",routes);

    const bestRoute = routes[0];
    const sellValue = AssetValue.from({
      asset: bestRoute.sellAsset,
      value: bestRoute.sellAmount,
    });

    setRoute(bestRoute);
    setSellAssetValue(sellValue);

    console.log("✅ Quote Received");
    console.log("Expected Output:", bestRoute.expectedBuyAmount);
    console.log("Fees:", bestRoute.fees);
  };

  const handleApprove = async () => {
    if (!route || !sellAssetValue) return;

    const needsApproval = ![
      ProviderName.CHAINFLIP,
      ProviderName.CHAINFLIP_STREAMING,
      ProviderName.NEAR,
    ].includes(route.providers[0]);

    if (!needsApproval) {
      console.log("✅ No approval needed");
      return;
    }

    const isApproved = await skClient.isAssetValueApproved(
      sellAssetValue,
      route.meta.approvalAddress || route.targetAddress || route.providers[0].toLowerCase()
    );

    if (!isApproved) {
      const approvalHash = await skClient.approveAssetValue(
        sellAssetValue,
        route.meta.approvalAddress || route.targetAddress || route.providers[0].toLowerCase()
      );
      console.log(`📝 Approved: ${skClient.getExplorerTxUrl({ txHash: approvalHash, chain: sellAssetValue.chain })}`);
    } else {
      console.log("✅ Already approved");
    }
  };

  const handleSwap = async () => {
    if (!route || !sellAssetValue) return;

    const txHash = await skClient.swap({
      route: route,
      feeOptionKey: FeeOption.Fast,
    });

    console.log(`🔁 Swap Successful: ${skClient.getExplorerTxUrl({ txHash, chain: sellAssetValue.chain })}`);
  };

  return (
   <div className="container">
  <button onClick={handleConnectWallet}>🔌 Connect Wallet</button>
  <button onClick={handleGetQuote}>✅ Get Quote</button>
  <button onClick={handleApprove}>📝 Approve Asset</button>
  <button onClick={handleSwap}>🔁 Perform Swap</button>
</div>
  );
};

export default App;


```

## Environment Variables

- `VITE_SWAPKIT_API` - SwapKit API key (generate at https://partners.swapkit.dev/api-keys)

