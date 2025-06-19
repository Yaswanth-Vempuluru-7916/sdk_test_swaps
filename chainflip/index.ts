/**
 * @installation
 * 
 * yarn add @chainflip/sdk
 * 
 * Environment Variables:
 * - SECRET_KEY: Private key of the user wallet (in .env)
 * - ALCHEMY_TOKEN  (in .env)
 */

import { Assets, Chains, SwapSDK } from "@chainflip/sdk/swap";
import { JsonRpcProvider, Wallet } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function main() {

  // 1. Initialize SwapSDK: specify network (e.g., 'perseverance' testnet , 'mainnet' for mainnet) and enabled features like DCA
  const options = {
    network: "perseverance" as const, // Testnet network identifier
    enabledFeatures: { dca: true },   // opt into dollar-cost averaging support - allows for multiple smaller swaps over time
  };
  const swapSDK = new SwapSDK(options);

  // 2. Setup Ethereum and Arbitrum Sepolia providers via external utility
  // Note: Both providers are needed for cross-chain balance checking and transaction execution
  const { ethProvider, arbProvider } = initializeProviders(
    `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_TOKEN}`,
    `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_TOKEN}`
  );

  // 3. Create a wallet using private key and attach to Ethereum provider
  // Wallet needs to be connected to the source chain provider for transaction signing
  const wallet = new Wallet(process.env.SECRET_KEY!, ethProvider);

  // 4. Log current balances for both chains (in wei)
  const { ethBalance, arbBalance } = await getBalances(wallet, ethProvider, arbProvider);
  console.log(`ETH Sepolia Balance: ${ethBalance} wei`);
  console.log(`ETH Arbitrum Sepolia Balance: ${arbBalance} wei`);
  console.log(`Wallet Address : ${wallet.address}`);

  // 5. Get swap quote using getQuoteV2 – here swapping ETH on Ethereum to ETH on Arbitrum
  // getQuoteV2 returns multiple quote types (REGULAR, DCA) with different pricing and execution strategies
  const { quotes } = await swapSDK.getQuoteV2({
    srcChain: Chains.Ethereum,        // Source blockchain
    srcAsset: Assets.ETH,            // Asset to swap from
    destChain: Chains.Arbitrum,      // Destination blockchain
    destAsset: Assets.ETH,           // Asset to swap to
    isVaultSwap: true,               // Use vault swap method (recommended for EVM chains)
    amount: (0.04e18).toString(),    // Amount in smallest unit (wei for ETH) - 0.04 ETH
  });

  // 6. Choose the standard (REGULAR) quote variant
  // REGULAR quotes provide immediate execution, while DCA quotes split the swap over time
  const quote = quotes.find((quote) => quote.type === "REGULAR");
  console.log("quote : ", JSON.stringify(quote, null, 2));
  if (!quote) throw new Error("No REGULAR quote found.");

  // 7. Prepare vault swap transaction data via encodeVaultSwapData
  // This creates the transaction calldata needed to interact with Chainflip's vault contracts
  const transactionData = await swapSDK.encodeVaultSwapData({
    quote,                           // The selected quote object
    srcAddress: wallet.address,      // Source wallet address (where funds come from)
    destAddress: wallet.address,     // Destination address (where swapped funds go)
    fillOrKillParams: {              // Protection parameters for the swap
      slippageTolerancePercent: quote.recommendedSlippageTolerancePercent, // Use recommended slippage from quote
      refundAddress: wallet.address, // Address to refund to if swap fails
      retryDurationBlocks: 100,      // Time limit: 100 blocks * 6 seconds = 10 minutes before refund
    },
    // Optional parameters:
    // brokerCommissionBps: number,   // Broker commission in basis points (1 bp = 0.01%)
    // affiliateBrokers: Array,       // Array of affiliate broker addresses and commissions
  });
  console.log("transactionData", transactionData);

  // 8. Sign & send the transaction if on Ethereum-compatible chain
  // Execute the vault swap by sending transaction to the vault contract
  if (transactionData.chain === "Ethereum" || transactionData.chain === "Arbitrum") {
    const tx = await wallet.sendTransaction({
      to: transactionData.to,        // Vault contract address
      data: transactionData.calldata, // Encoded function call data
      value: transactionData.value,   // ETH amount to send (for native ETH swaps)
    });

    // Wait for transaction confirmation
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction receipt is null");
    console.log("receipt", receipt);
    //!NOTE: COPY THE RECEIPT HASH FROM THE CONSOLE FOR TRACKING THE TRANSACTION STATUS
    console.log("RECEIPT HASH : ", receipt.hash);

    // Check swap status using transaction hash as identifier
    // Status tracking allows monitoring of cross-chain swap progress
    const status = await swapSDK.getStatusV2({
      id: receipt.hash,  // Transaction hash is used as the swap identifier
    });
    console.log("status", status);

  } else {
    // Non-EVM chains require different transaction handling (e.g., Bitcoin, Solana)
    console.error(`Unsupported chain for EVM transaction: ${transactionData.chain}`);
  }

  // 9. Optionally check swap status by manual transaction hash
  // Useful for tracking previously initiated swaps
  const status = await swapSDK.getStatusV2({
    // id: "0x42ae0b9cfefc45141bb234d45159d6451f18d7548e762edf435acb4ab7ed73c9",
    id: "0xf8053b21444a25058bedb7627c3d1d09d7b14241d1d0ed39eba9328ff2db43da",
  });
  console.log("status", status);
}

main();

// Utility function to create RPC providers for multiple chains
export function initializeProviders(ethProviderUrl: string, arbProviderUrl: string): {
  ethProvider: JsonRpcProvider;
  arbProvider: JsonRpcProvider;
} {
  const ethProvider = new JsonRpcProvider(ethProviderUrl);
  const arbProvider = new JsonRpcProvider(arbProviderUrl);
  return { ethProvider, arbProvider };
}

// Utility function to fetch native token balances from multiple chains
export async function getBalances(wallet: Wallet, ethProvider: JsonRpcProvider, arbProvider: JsonRpcProvider): Promise<{
  ethBalance: string;
  arbBalance: string;
}> {
  if (!wallet.provider) {
    throw new Error("Wallet provider is null");
  }

  // Get native token balances in wei
  const ethBalance = await ethProvider.getBalance(wallet.address);
  const arbBalance = await arbProvider.getBalance(wallet.address);

  return {
    ethBalance: ethBalance.toString(), // Convert BigNumber to string
    arbBalance: arbBalance.toString(), // Convert BigNumber to string
  };
}