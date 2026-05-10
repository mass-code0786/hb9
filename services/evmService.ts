import { ethers } from "ethers";
import { getNetworkConfig, type NetworkKey } from "@/lib/networks";
import type { TokenConfig } from "@/lib/tokens";

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

export function getEvmProvider(network: NetworkKey) {
  const config = getNetworkConfig(network);
  if (config.kind !== "evm" || !config.rpcUrl || !config.chainId) {
    throw new Error(`${config.name} is not available for EVM RPC actions.`);
  }
  return new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
}

export async function getEvmBalances(network: NetworkKey, address: string, tokens: TokenConfig[]) {
  const provider = getEvmProvider(network);
  const entries = await Promise.all(
    tokens.map(async (token) => {
      if (token.type === "native") {
        const raw = await provider.getBalance(address);
        return [token.id, ethers.formatUnits(raw, token.decimals)] as const;
      }
      if (token.type === "erc20" && token.contractAddress) {
        const contract = new ethers.Contract(token.contractAddress, ERC20_ABI, provider);
        const raw = (await contract.balanceOf(address)) as bigint;
        return [token.id, ethers.formatUnits(raw, token.decimals)] as const;
      }
      return [token.id, "0"] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function estimateEvmTransfer(network: NetworkKey, from: string, to: string, amount: string, token: TokenConfig) {
  const provider = getEvmProvider(network);
  if (!ethers.isAddress(to)) throw new Error("Enter a valid EVM recipient address.");
  if (!amount || Number(amount) <= 0) throw new Error("Enter a valid amount.");
  const value = ethers.parseUnits(amount, token.decimals);
  if (token.type !== "native" && !token.contractAddress) throw new Error("Token contract address is missing.");
  let gasLimit: bigint;
  if (token.type === "native") {
    gasLimit = await provider.estimateGas({ from, to, value });
  } else {
    const contractAddress = token.contractAddress;
    if (!contractAddress) throw new Error("Token contract address is missing.");
    gasLimit = await new ethers.Contract(contractAddress, ERC20_ABI, provider).transfer.estimateGas(to, value, { from });
  }
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;
  return { gasLimit, gasPrice, fee: ethers.formatEther(gasLimit * gasPrice) };
}

export async function sendEvmTransfer(mnemonic: string, network: NetworkKey, to: string, amount: string, token: TokenConfig) {
  const provider = getEvmProvider(network);
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0/0").connect(provider);
  if (token.type === "native") {
    const tx = await wallet.sendTransaction({ to, value: ethers.parseUnits(amount, token.decimals) });
    return tx.wait();
  }
  if (!token.contractAddress) throw new Error("Token contract address is missing.");
  const contract = new ethers.Contract(token.contractAddress, ERC20_ABI, wallet);
  const tx = await contract.transfer(to, ethers.parseUnits(amount, token.decimals));
  return tx.wait();
}
