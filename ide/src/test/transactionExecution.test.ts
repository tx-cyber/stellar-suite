import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  walletServiceSignTransaction,
  transactionSign,
  toXdr,
  fromSecret,
  fromXDR,
} = vi.hoisted(() => {
  const transactionSign = vi.fn();
  const toXdr = vi.fn(() => "SIGNED_LOCAL_XDR");

  return {
    walletServiceSignTransaction: vi.fn(),
    transactionSign,
    toXdr,
    fromSecret: vi.fn(() => ({ secret: "SLOCAL" })),
    fromXDR: vi.fn(() => ({
      sign: transactionSign,
      toXDR: toXdr,
    })),
  };
});

vi.mock("@/wallet/WalletService", () => ({
  WalletService: {
    signTransaction: walletServiceSignTransaction,
  },
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Keypair: {
    fromSecret,
  },
  TransactionBuilder: {
    fromXDR,
  },
  contract: {
    Client: {
      from: vi.fn(),
    },
  },
}));

vi.mock("@stellar/stellar-sdk/rpc", () => ({
  Api: {
    GetTransactionStatus: {
      NOT_FOUND: "NOT_FOUND",
      SUCCESS: "SUCCESS",
      FAILED: "FAILED",
    },
  },
  Server: vi.fn(),
}));

vi.mock("@/utils/XdrValidator", () => ({
  assertValidTransactionEnvelopeXdr: vi.fn((xdr, passphrase) => {
    fromXDR(xdr, passphrase);
    return {
      transaction: {
        sign: transactionSign,
        toXDR: toXdr,
      },
    };
  }),
}));

import {
  createWalletSigningDelegator,
  DEFAULT_TRANSACTION_POLL_INTERVAL_MS,
  pollTransactionStatus,
} from "@/lib/transactionExecution";

describe("createWalletSigningDelegator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs locally with the active keypair identity", async () => {
    const signTransaction = createWalletSigningDelegator({
      activeContext: { type: "local-keypair", publicKey: "GLOCAL" },
      activeIdentity: {
        nickname: "Local",
        publicKey: "GLOCAL",
        secretKey: "SLOCAL",
      },
      webWalletPublicKey: null,
      walletType: null,
      networkPassphrase: "Test Network",
    });

    const result = await signTransaction("UNSIGNED_XDR");

    expect(fromXDR).toHaveBeenCalledWith("UNSIGNED_XDR", "Test Network");
    expect(fromSecret).toHaveBeenCalledWith("SLOCAL");
    expect(transactionSign).toHaveBeenCalledTimes(1);
    expect(result).toBe("SIGNED_LOCAL_XDR");
  });

  it("delegates browser wallet signing to WalletService", async () => {
    walletServiceSignTransaction.mockResolvedValue("SIGNED_WALLET_XDR");

    const signTransaction = createWalletSigningDelegator({
      activeContext: { type: "web-wallet" },
      activeIdentity: null,
      webWalletPublicKey: "GWALLET",
      walletType: "freighter",
      networkPassphrase: "Test Network",
    });

    const result = await signTransaction("UNSIGNED_XDR");

    expect(walletServiceSignTransaction).toHaveBeenCalledWith("freighter", "UNSIGNED_XDR", {
      networkPassphrase: "Test Network",
      address: "GWALLET",
    });
    expect(result).toBe("SIGNED_WALLET_XDR");
  });
});

describe("pollTransactionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("polls until the transaction reaches SUCCESS", async () => {
    const getTransaction = vi
      .fn()
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "SUCCESS", resultXdr: "RESULT" });
    const onUpdate = vi.fn();

    const result = await pollTransactionStatus({
      server: { getTransaction },
      hash: "abc123",
      intervalMs: 1,
      timeoutMs: DEFAULT_TRANSACTION_POLL_INTERVAL_MS,
      onUpdate,
    });

    expect(getTransaction).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ status: "SUCCESS", resultXdr: "RESULT" });
  });
});
