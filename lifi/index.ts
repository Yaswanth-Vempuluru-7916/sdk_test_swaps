/**
 * @installation
 * 
 * yarn add @lifi/sdk
 * 
 * @fileoverview
 * Script to fetch swap routes using LiFi SDK and execute a token swap
 * on the Arbitrum chain using a private wallet key.
 * 
 * Functionality:
 * - Connects wallet using a private key
 * - Sets up LiFi config for EVM-compatible chains
 * - Fetches swap route from LiFi API
 * - Executes the swap route
 * 
 * Environment Variables:
 * - PRIVATE_KEY: Private key of the user wallet (in .env)
 */

import { createConfig, EVM, executeRoute, getRoutes, getToken } from '@lifi/sdk'
import type { Chain } from 'viem'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum, mainnet, optimism, polygon, scroll, base } from 'viem/chains'
import dotenv from 'dotenv'

dotenv.config()

async function main() {
  // Load wallet private key securely from .env file
  const privateKey = process.env.PRIVATE_KEY!
  const account = privateKeyToAccount(privateKey as `0x${string}`)

  console.log('Account address:', account.address)

  // Define a list of supported chains for switching during swaps
  const chains = [arbitrum, mainnet, optimism, polygon, scroll, base]

  // Initialize a Viem wallet client for mainnet (can be replaced by any default chain)
  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http(),  
  })



  // Configure LiFi SDK for EVM chains with custom wallet client and chain switcher
  createConfig({
    integrator: 'Lifi_test',  // Identifier for analytics purposes
    providers: [
      EVM({
        getWalletClient: async () => client,

        // Dynamically switch chains using Viem when swap route spans multiple chains
        switchChain: async (chainId) =>
          createWalletClient({
            account,
            chain: chains.find((chain) => chain.id == chainId) as Chain,
            transport: http(),
          }),
      }),
    ],
  })

 
  /**
   * -----------------------------------------------
   * Swap Route Fetch + Execution 
   * -----------------------------------------------
   * Step 1: Fetch optimal swap route using getRoutes()
   * Step 2: Execute route using executeRoute()
   */
  
  const result = await getRoutes({
    fromChainId: 42161, // Source chain (Arbitrum)
    toChainId: 42161,   // Destination chain (same for same-chain swap)
    fromTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
    toTokenAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',   // USDT on Arbitrum
    fromAmount: '10000',  // Amount in smallest unit (i.e., 0.01 USDC if 6 decimals)
    fromAddress : account.address, // Sender's address (signer)
    toAddress : account.address,   // Receiver's address (self in this case)
    options : {
      order : "RECOMMENDED", // Strategy to choose route (RECOMMENDED , FASTEST, SAFEST, CHEAPEST)
      slippage : 0.03        // Acceptable slippage percentage (3%)
    }
  })

  const route = result.routes[0]; // Pick the first (best) route
  console.log(`result : ${JSON.stringify(route, null, 2)}`); // Log full route details
  


  // Execute the selected swap route
  const executedRoute = await executeRoute(route, {
    updateRouteHook(route) {
      // Optional: Hook to receive real-time updates during execution
    console.log(route)
    },
  });

  console.log(`executed route : \n ${JSON.stringify(executedRoute, null, 2)}`);

}

main()
