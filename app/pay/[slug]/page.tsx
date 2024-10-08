"use client";
import WorldIDVerifyButton from "@/components/world-id-verify-button";
import { usePaymentLink } from "@/hooks";
import {
  LIFI_DIAMOND_PROXY,
  RECURRING_PAYMENTS,
  RecurringPayment,
  Token,
  TOKENS,
} from "@/lib/constants";
import { getRoutesResult } from "@/lib/lifi/lifi";
import { calculateTokenAmount } from "@/lib/lifi/utils";
import { BASE_USDC_ADDRESS, chainParser, shortenAddress } from "@/lib/utils";
import { getStepTransaction } from "@lifi/sdk";
import {
  Input,
  Image,
  Button,
  SelectItem,
  Skeleton,
  Select,
} from "@nextui-org/react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  MailIcon,
  StoreIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { injected } from "wagmi/connectors";

export default function PayPage({
  params: { slug },
}: {
  params: { slug: string };
}) {
  const [success, setSuccess] = useState<boolean>(false);
  const { isPending, paymentLink } = usePaymentLink(slug);
  const { connect } = useConnect();
  const { address } = useAccount();
  const [selectedToken, setSelectedToken] = useState<Set<number>>(new Set([]));
  const [email, setEmail] = useState<string>("");
  const [worldIdVerified, setWorldIdVerified] = useState<boolean>(
    !paymentLink || paymentLink?.requiresWorldId ? false : true
  );
  const [loading, setLoading] = useState<boolean>(false);
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const pay = async () => {
    setLoading(true);
    try {
      console.log(walletClient);
      const token = selectedToken.values().next().value;
      console.log(token);

      const [symbol, tokenAddress, chainId, decimals] = token.split("-");

      try {
        await walletClient?.switchChain({
          id: parseInt(chainId),
        });
      } catch (error) {
        await walletClient?.addChain({
          chain: chainParser(parseInt(chainId)),
        });
        await walletClient?.switchChain({
          id: parseInt(chainId),
        });
      }

      const amount = await calculateTokenAmount(
        parseInt(chainId),
        tokenAddress,
        parseFloat(paymentLink?.product.price.toString() || "0")
      );

      const tokenAmount = parseUnits(amount?.toString()!, parseInt(decimals));

      const isBaseUSDC =
        tokenAddress.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() &&
        chainId === "8453";

      const isRecurring = paymentLink?.product.paymentMethod === "RECURRING";

      if (tokenAddress !== "0x0000000000000000000000000000000000000000") {
        const allowance = await publicClient?.readContract({
          abi: erc20Abi,
          address: tokenAddress,
          functionName: "allowance",
          args: [address!, LIFI_DIAMOND_PROXY],
        });

        const totalSupply = await publicClient?.readContract({
          abi: erc20Abi,
          address: tokenAddress,
          functionName: "totalSupply",
        });

        if (
          typeof allowance !== "undefined" &&
          typeof totalSupply !== "undefined" &&
          ((allowance < tokenAmount && !isRecurring) ||
            (allowance < totalSupply && isRecurring))
        ) {
          if (!isBaseUSDC || isRecurring) {
            const approveTx = await walletClient?.writeContract({
              abi: erc20Abi,
              address: tokenAddress,
              functionName: "approve",
              args: [
                LIFI_DIAMOND_PROXY,
                paymentLink?.product.paymentMethod === "RECURRING"
                  ? totalSupply!
                  : tokenAmount,
              ],
            });

            if (approveTx) {
              await publicClient?.waitForTransactionReceipt({
                hash: approveTx,
              });
            }
          }
        }
      }

      if (paymentLink?.product.paymentMethod === "RECURRING") {
        await fetch("/api/public/subscriptions", {
          method: "POST",
          body: JSON.stringify({
            address,
            productId: paymentLink?.product.id,
            tokenAddress,
            tokenAmount: formatUnits(tokenAmount, parseInt(decimals)),
            merchantAddress: paymentLink?.user.smartAccountAddress,
            chainId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });
      } else {
        if (isBaseUSDC) {
          // perform a transfer
          const txHash = await walletClient?.writeContract({
            abi: erc20Abi,
            address: tokenAddress,
            functionName: "transfer",
            args: [paymentLink?.user.smartAccountAddress!, tokenAmount],
          });

          if (txHash) {
            const txReceipt = await publicClient?.waitForTransactionReceipt({
              hash: txHash,
            });

            await fetch("/api/public/transactions", {
              method: "POST",
              body: JSON.stringify({
                userId: paymentLink?.user.id,
                productId: paymentLink?.product.id,
                hash: txReceipt?.transactionHash,
                amount: paymentLink?.product.price,
                fromAddress: address,
                timestamp: new Date().toISOString(),
              }),
              headers: {
                "Content-Type": "application/json",
              },
            });
          }
        } else {
          // call lifi
          const lifiRoute = await getRoutesResult(
            address!,
            paymentLink?.user.smartAccountAddress!,
            parseInt(chainId),
            tokenAddress,
            tokenAmount.toString()
          );

          const res = await getStepTransaction(lifiRoute.steps[0]);

          if (res && res.transactionRequest) {
            const txHash = await walletClient?.sendTransaction({
              to: res.transactionRequest.to,
              value: res.transactionRequest.value
                ? BigInt(res.transactionRequest.value)
                : BigInt(0),
              data: res.transactionRequest.data! as `0x${string}`,
            });

            if (txHash) {
              const txReceipt = await publicClient?.waitForTransactionReceipt({
                hash: txHash,
              });

              await fetch("/api/public/transactions", {
                method: "POST",
                body: JSON.stringify({
                  userId: paymentLink?.user.id,
                  productId: paymentLink?.product.id,
                  hash: txReceipt?.transactionHash,
                  amount: paymentLink?.product.price,
                  fromAddress: address,
                  timestamp: new Date().toISOString(),
                }),
                headers: {
                  "Content-Type": "application/json",
                },
              });
            }
          }
        }
      }
      setSuccess(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (isPending || !paymentLink) {
    return (
      <div className="min-h-screen min-w-screen">
        <div className="grid grid-cols-4 h-screen">
          <div className="col-span-2 bg-gray-50 p-32 h-full flex flex-col items-center justify-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <Skeleton className="bg-gray-300 h-8 w-8 rounded-full" />
              <Skeleton className="bg-gray-300 h-8 w-20 rounded-lg" />
            </div>
            <Skeleton className="h-[250px] *:w-[250px] rounded-lg" />
            <Skeleton className="bg-gray-300 h-12 w-32 rounded-lg" />
            <Skeleton className="bg-gray-300 h-10 w-40 rounded-lg" />
            <Skeleton className="bg-gray-300 h-8 w-20 rounded-lg" />
          </div>
          <div className="col-span-2 bg-white p-4 h-full flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-4">
            <Skeleton className="bg-gray-300 h-12 w-full rounded-lg" />
            <Skeleton className="bg-gray-300 h-8 w-full rounded-lg" />
            <Skeleton className="bg-gray-300 h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-screen">
      <div className="grid grid-cols-4 h-screen">
        <div className="col-span-2 lg:row-span-2 bg-gray-50 p-32 h-full flex flex-col items-center justify-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <div className="rounded-full p-2 shadow-sm bg-white">
              <StoreIcon className="text-gray-400" />
            </div>
            <span className="text-lg font-bold">
              {paymentLink?.user?.companyName ||
                shortenAddress(paymentLink?.user?.address)}
            </span>
          </div>
          <Image
            src={paymentLink?.product.imageUrl}
            width={250}
            height={250}
            className="rounded-lg"
            alt="Product Image"
          />
          <h1 className="text-3xl font-semibold">
            {paymentLink?.product.name}
          </h1>
          <p>{paymentLink?.product.description}</p>
          <h2 className="text-xl font-semibold">
            $
            {parseFloat(paymentLink?.product.price.toString() || "0").toFixed(
              2
            )}{" "}
            {paymentLink?.product.paymentMethod === "RECURRING" && "/ month"}
          </h2>
        </div>
        <div className="col-span-2 lg:row-span-2 bg-white p-4 h-full flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-4">
          {address && !success && (
            <>
              <Input
                autoFocus
                endContent={
                  <MailIcon className="text-2xl text-default-400 pointer-events-none flex-shrink-0" />
                }
                label="Email"
                placeholder="Enter your email"
                variant="bordered"
                isRequired
                value={email}
                onValueChange={setEmail}
              />
              {/* <h3 className="text-lg font-semibold text-start">
                Payment method
              </h3> */}
              {paymentLink?.product.paymentMethod === "RECURRING" ? (
                <Select
                  items={RECURRING_PAYMENTS}
                  variant="bordered"
                  placeholder="Select token and chain"
                  labelPlacement="outside"
                  selectedKeys={selectedToken}
                  onSelectionChange={async (value) => {
                    // @ts-expect-error - Fix this
                    const token = value.values().next().value;
                    const [, , chainId] = token.split("-");

                    try {
                      await walletClient?.switchChain({
                        id: parseInt(chainId),
                      });
                    } catch (error) {
                      await walletClient?.addChain({
                        chain: chainParser(parseInt(chainId)),
                      });
                      await walletClient?.switchChain({
                        id: parseInt(chainId),
                      });
                    }

                    // @ts-expect-error - Fix this
                    setSelectedToken(value);
                  }}
                  isRequired
                >
                  {(payment: RecurringPayment) => (
                    <SelectItem
                      key={`${payment.tokenSymbol}-${payment.tokenAddress}-${payment.chainId}-${payment.tokenDecimals}`}
                      textValue={`${payment.tokenSymbol} (${payment.chainName})`}
                    >
                      <div className="flex gap-2 items-center">
                        <div className="flex flex-col">
                          <span className="text-small">
                            {payment.tokenSymbol} ({payment.chainName})
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  )}
                </Select>
              ) : (
                <Select
                  items={TOKENS}
                  variant="bordered"
                  placeholder="Select token and chain"
                  labelPlacement="outside"
                  selectedKeys={selectedToken}
                  onSelectionChange={async (value) => {
                    // @ts-expect-error - Fix this
                    const token = value.values().next().value;
                    const [, , chainId] = token.split("-");
                    await walletClient?.switchChain({ id: parseInt(chainId) });

                    // @ts-expect-error - Fix this
                    setSelectedToken(value);
                  }}
                  isRequired
                >
                  {(token: Token) => (
                    <SelectItem
                      key={`${token.symbol}-${token.address}-${token.chainId}-${token.decimals}`}
                      textValue={`${token.symbol} (${token.chainName})`}
                    >
                      <div className="flex gap-2 items-center">
                        <div className="flex flex-col">
                          <span className="text-small">
                            {token.symbol} ({token.chainName})
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  )}
                </Select>
              )}
              {paymentLink?.requiresWorldId && (
                <WorldIDVerifyButton
                  productId={paymentLink?.product.id}
                  paymentLinkId={paymentLink?.id}
                  onSuccess={() => {
                    console.log("World ID verified");
                    setWorldIdVerified(true);
                  }}
                  onError={() => {
                    console.error("Error verifying World ID");
                    setWorldIdVerified(false);
                  }}
                />
              )}
              <Button
                color="success"
                className="w-full font-bold"
                isDisabled={
                  !email ||
                  selectedToken.size === 0 ||
                  (paymentLink?.requiresWorldId && !worldIdVerified)
                }
                startContent={<CreditCardIcon />}
                isLoading={loading}
                onClick={pay}
              >
                {paymentLink?.product.paymentMethod === "RECURRING"
                  ? "Subscribe"
                  : "Pay"}
              </Button>
            </>
          )}
          {!address && (
            <Button
              color="primary"
              onClick={() => connect({ connector: injected() })}
            >
              Connect Wallet
            </Button>
          )}
          {success && (
            <>
              <CheckCircle2Icon className="text-emerald-500" size={64} />
              <p className="text-center text-emerald-500 text-2xl">
                Your payment was successful!
              </p>
              <Button
                color="primary"
                as={Link}
                startContent={<ArrowRightIcon size="14" />}
                href={paymentLink?.redirectUrl}
              >
                Continue
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
