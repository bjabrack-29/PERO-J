import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/Toast";
import { readBets } from "./history";
import type { BetGateway, BetInput, SignedBet } from "./types";
import { useOptimisticBets } from "./useOptimisticBets";

const ADDRESS = "G".padEnd(56, "A");
const INPUT: BetInput = {
  marketId: "next_ledger",
  selection: "yes",
  amount: 2,
  odds: 1.95,
};
const SIGNED: SignedBet = {
  txHash: "a".repeat(64),
  signedXdr: "signed-xdr",
  input: INPUT,
  address: ADDRESS,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createGateway(overrides: Partial<BetGateway> = {}): BetGateway {
  return {
    connect: vi.fn(async () => ADDRESS),
    signBet: vi.fn(async () => SIGNED),
    submitBet: vi.fn(async () => {}),
    waitForConfirmation: vi.fn(async () => ({ ledger: 777 })),
    ...overrides,
  };
}

describe("useOptimisticBets", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function renderUse(gateway: BetGateway) {
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      );
    }
    return renderHook(() => useOptimisticBets({ address: ADDRESS, gateway }), {
      wrapper: Wrapper,
    });
  }

  it("shows the bet and pending odds immediately after signing, then reconciles the confirmation", async () => {
    const sign = deferred<SignedBet>();
    const submit = deferred<void>();
    const confirm = deferred<{ ledger: number }>();
    const gateway = createGateway({
      signBet: vi.fn(() => sign.promise),
      submitBet: vi.fn(() => submit.promise),
      waitForConfirmation: vi.fn(() => confirm.promise),
    });
    const { result } = renderUse(gateway);

    act(() => {
      void result.current.placeBet(INPUT);
    });
    expect(gateway.signBet).toHaveBeenCalledWith(INPUT, ADDRESS);
    expect(result.current.phase).toBe("signing");
    expect(result.current.oddsPreview).toEqual({ odds: 1.95, status: "pending" });

    await act(async () => {
      sign.resolve(SIGNED);
    });
    await waitFor(() => expect(result.current.phase).toBe("submitting"));
    expect(queryClient.getQueryData(["bets", ADDRESS])).toEqual([
      expect.objectContaining({ status: "pending", txHash: SIGNED.txHash, amount: 2 }),
    ]);
    expect(readBets(ADDRESS)).toEqual([
      expect.objectContaining({ status: "pending", txHash: SIGNED.txHash }),
    ]);

    await act(async () => {
      submit.resolve();
    });
    await waitFor(() => expect(result.current.phase).toBe("confirming"));

    await act(async () => {
      confirm.resolve({ ledger: 777 });
    });
    await waitFor(() => expect(result.current.phase).toBe("idle"));
    expect(queryClient.getQueryData(["bets", ADDRESS])).toEqual([
      expect.objectContaining({ status: "confirmed", ledger: 777 }),
    ]);
    expect(readBets(ADDRESS)[0].status).toBe("confirmed");
    expect(result.current.oddsPreview).toEqual({ odds: 1.95, status: "confirmed" });
    expect(screen.getByText("Bet confirmed in ledger 777.")).toBeInTheDocument();
  });

  it("rolls back the optimistic bet and shows an error toast when submission fails", async () => {
    const sign = deferred<SignedBet>();
    const gateway = createGateway({
      signBet: vi.fn(() => sign.promise),
      submitBet: vi.fn(async () => {
        throw new Error("Bet transaction failed on-chain.");
      }),
    });
    const { result } = renderUse(gateway);

    act(() => {
      void result.current.placeBet(INPUT);
    });
    await act(async () => {
      sign.resolve(SIGNED);
    });
    await waitFor(() => expect(gateway.submitBet).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.oddsPreview.status).toBe("failed"));

    expect(queryClient.getQueryData(["bets", ADDRESS])).toEqual([]);
    expect(readBets(ADDRESS)).toEqual([]);
    expect(screen.getByText("Bet transaction failed on-chain.")).toBeInTheDocument();
    expect(result.current.phase).toBe("idle");
  });

  it("ignores repeated submissions while a bet is in flight", async () => {
    const sign = deferred<SignedBet>();
    const gateway = createGateway({ signBet: vi.fn(() => sign.promise) });
    const { result } = renderUse(gateway);

    act(() => {
      void result.current.placeBet(INPUT);
      void result.current.placeBet(INPUT);
    });
    expect(gateway.signBet).toHaveBeenCalledTimes(1);

    await act(async () => {
      sign.resolve(SIGNED);
    });
    await waitFor(() => expect(gateway.waitForConfirmation).toHaveBeenCalledTimes(1));
  });
});
