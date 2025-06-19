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
