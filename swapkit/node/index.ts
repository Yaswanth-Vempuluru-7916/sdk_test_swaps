// Install SwapKit SDK: bun add @swapkit/sdk@3.0.0-beta.23

import { createSwapKit } from "@swapkit/sdk";
import {
  Chain,
  AssetValue,
  SwapKitApi,
  FeeOption,
  ProviderName,
} from "@swapkit/sdk";
import dotenv from "dotenv";
dotenv.config();

/* ---------------------- Constants ---------------------- */
// SwapKit API key for authentication with SwapKit services
//Generate here : https://partners.swapkit.dev/api-keys

const SWAPKIT_API = process.env.SWAPKIT_API;
if (!SWAPKIT_API) {
  throw new Error("SWAPKIT_API environment variable is not set.");
}
// seed phrase for wallet connection and transaction signing
const SEED_PHRASE = process.env.SEED_PHRASE;
if (!SEED_PHRASE) {
  throw new Error("SEED_PHRASE environment variable is not set.");
}
// Asset identifier for the token being sold (ARB.USDC on Arbitrum)
const SELL_ASSET = "ARB.USDC-0xaf88d065e77c8cc2239327c5edb3a432268e5831";
// Asset identifier for the token being bought (ARB.USDT on Arbitrum)
const BUY_ASSET = "ARB.USDT-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9";

/* -------------------- Init SDK ------------------------ */
let skClient: ReturnType<typeof createSwapKit> | undefined;

function getSwapKitClient() {
  if (skClient) return skClient;
  // Initialize SwapKit SDK with API keys and integration configurations
  skClient = createSwapKit({
    config: {
      apiKeys: {
        swapKit: SWAPKIT_API,
      },
    },
  });
  return skClient;
}

/* -------------------- Main Logic ---------------------- */
async function main() {
  const client = getSwapKitClient();

  // 1. Connect Wallet
  // Connect keystore wallet using seed phrase for the specified blockchain
  await client.connectKeystore([Chain.Arbitrum], SEED_PHRASE as string);
  
  // Retrieve wallet information including balance for the connected chain
  const wallet = await client.getWalletWithBalance(Chain.Arbitrum);
  console.log("Connected Address:", wallet.address);

  // 2. Get Swap Quote
  // Request swap quote from SwapKit API with trading parameters
  const { routes } = await SwapKitApi.getSwapQuote({
    sellAsset: SELL_ASSET,
    sellAmount: "0.01",
    buyAsset: BUY_ASSET,
    sourceAddress: client.getAddress(Chain.Arbitrum),
    destinationAddress: client.getAddress(Chain.Arbitrum),
    slippage: 3,
    includeTx: true,
  });

  const route = routes[0];
  if (!route) {
    throw new Error("No swap route found.");
  }

  // Create AssetValue object representing the asset and amount to be sold
  const sellValue = AssetValue.from({
    asset: route.sellAsset,
    value: route.sellAmount,
  });

  console.log("Quote Received");
  console.log("Expected Output:", route.expectedBuyAmount);
  console.log("Fees:", route.fees);

  // 3. Check Approval
  // Determine if token approval is needed based on the swap provider
  const needsApproval = ![
    ProviderName.CHAINFLIP,
    ProviderName.CHAINFLIP_STREAMING,
    ProviderName.NEAR,
  ].includes(route.providers[0] as ProviderName);

  if (needsApproval) {
    // Get the contract address that needs approval to spend tokens
    const approvalAddress =
      route.meta?.approvalAddress || route.targetAddress || route.providers?.[0]?.toLowerCase();

    if (!approvalAddress) {
      throw new Error("Approval address is undefined.");
    }

    // Check if the asset is already approved for spending by the contract
    const isApproved = await client.isAssetValueApproved(sellValue, approvalAddress);

    if (!isApproved) {
      // Execute approval transaction to allow contract to spend tokens
      const approvalTx = await client.approveAssetValue(sellValue, approvalAddress);
      console.log("\nApproval TX:", client.getExplorerTxUrl({ txHash: approvalTx, chain: sellValue.chain }));
    } else {
      console.log("\nAlready Approved");
    }
  }

  // 4. Perform Swap
  // Execute the swap transaction using the selected route and fee option
  const swapTx = await client.swap({
    route,
    feeOptionKey: FeeOption.Fast,
  });

  console.log("\nSwap TX:", client.getExplorerTxUrl({ txHash: swapTx, chain: sellValue.chain }));
}

/* -------------------- Execute ---------------------- */
main().catch((err) => {
  console.error("Error:", err);
});