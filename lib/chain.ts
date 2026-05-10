import { ethers } from "ethers";
import { BSC_CHAIN_ID, BSC_RPC_URL, USDT_ABI, USDT_CONTRACT } from "@/lib/config";

export function getProvider() {
  return new ethers.JsonRpcProvider(BSC_RPC_URL, BSC_CHAIN_ID);
}

export async function getBalances(address: string) {
  const provider = getProvider();
  const [bnbRaw, usdtDecimals, usdtRaw] = await Promise.all([
    provider.getBalance(address),
    new ethers.Contract(USDT_CONTRACT, USDT_ABI, provider).decimals() as Promise<number>,
    new ethers.Contract(USDT_CONTRACT, USDT_ABI, provider).balanceOf(address) as Promise<bigint>
  ]);

  return {
    bnb: ethers.formatEther(bnbRaw),
    usdt: ethers.formatUnits(usdtRaw, usdtDecimals)
  };
}

export async function estimateBnbGas(from: string, to: string, amount: string) {
  const provider = getProvider();
  const value = ethers.parseEther(amount);
  const gasLimit = await provider.estimateGas({ from, to, value });
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;
  return { gasLimit, gasPrice, fee: ethers.formatEther(gasLimit * gasPrice) };
}

export async function estimateUsdtGas(from: string, to: string, amount: string) {
  const provider = getProvider();
  const contract = new ethers.Contract(USDT_CONTRACT, USDT_ABI, provider);
  const decimals = await contract.decimals() as number;
  const gasLimit = await contract.transfer.estimateGas(to, ethers.parseUnits(amount, decimals), { from });
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;
  return { gasLimit, gasPrice, fee: ethers.formatEther(gasLimit * gasPrice), decimals };
}

export async function sendBnb(mnemonic: string, to: string, amount: string) {
  // Self-custody boundary: signing happens in-browser from the decrypted mnemonic.
  // The mnemonic must never leave the client or be logged.
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0/0").connect(getProvider());
  const tx = await wallet.sendTransaction({ to, value: ethers.parseEther(amount) });
  return tx.wait();
}

export async function sendUsdt(mnemonic: string, to: string, amount: string) {
  // Self-custody boundary: token transfers are signed locally with ethers.js.
  const provider = getProvider();
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0/0").connect(provider);
  const contract = new ethers.Contract(USDT_CONTRACT, USDT_ABI, wallet);
  const decimals = await contract.decimals() as number;
  const tx = await contract.transfer(to, ethers.parseUnits(amount, decimals));
  return tx.wait();
}
