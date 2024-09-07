"use client";

import { NextUIProvider } from "@nextui-org/react";
import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextUIProvider>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
        config={{
          appearance: {
            theme: "light",
            accentColor: "#676FFF",
          },
          embeddedWallets: {
            createOnLogin: "all-users",
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <main className="h-full">{children}</main>
        </QueryClientProvider>
      </PrivyProvider>
    </NextUIProvider>
  );
}
