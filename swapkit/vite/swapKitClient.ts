import { createSwapKit } from "@swapkit/sdk";

let skClient: ReturnType<typeof createSwapKit> | undefined;
const SWAPKIT_API = import.meta.env.VITE_SWAPKIT_API;
// console.log(`SWAPKIT_API: ${SWAPKIT_API}`);
export const getSwapKitClient = () => {
  if (skClient) {
    return skClient;
  }
  skClient = createSwapKit({
    config: {
      apiKeys: {
        swapKit: SWAPKIT_API,
        // walletConnectProjectId,
        keepKey: localStorage.getItem("keepkeyApiKey") || "1234",
      },
      integrations: {
        keepKey: {
          name: "swapKit-demo-app",
          imageUrl:
            "https://repository-images.githubusercontent.com/587472295/feec8a61-39b2-4615-b293-145e97f49b5a",
          basePath: "http://localhost:1646/spec/swagger.json",
          url: "http://localhost:1646",
        },
        // chainflip: {
        //   brokerUrl: brokerEndpoint || "",
        // },
      },
    },
  });

  return skClient;
};

export type SwapKitClient = ReturnType<typeof getSwapKitClient>;