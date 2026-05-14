import { expect } from "chai";
import hre from "hardhat";
import { decodeEventLog, getAddress } from "viem";

const ActionType = {
  Hold: 0,
  AddCollateral: 1,
  Deleverage: 2,
  Hedge: 3,
  Block: 4,
} as const;

const ActionStatus = {
  Approved: 0,
  Blocked: 1,
  Simulated: 2,
} as const;

type ActionTypeValue = (typeof ActionType)[keyof typeof ActionType];

function asBigInt(value: bigint | number): bigint {
  return BigInt(value);
}

function request(action: ActionTypeValue, overrides: Record<string, unknown> = {}) {
  return {
    action,
    leverage: 70n,
    buffer: 90n,
    amount: 100_000_000n,
    pair: "ETH-PERP",
    venue: "Hyperliquid",
    ...overrides,
  };
}

async function deployPolicy() {
  const [owner, agent, other, newAgent] = await hre.viem.getWalletClients();
  const policy = await hre.viem.deployContract("PolicyContract", [
    agent.account.address,
  ]);
  const policyAsAgent = await hre.viem.getContractAt(
    "PolicyContract",
    policy.address,
    { client: { wallet: agent } },
  );
  const policyAsOther = await hre.viem.getContractAt(
    "PolicyContract",
    policy.address,
    { client: { wallet: other } },
  );
  const publicClient = await hre.viem.getPublicClient();

  return {
    owner,
    agent,
    other,
    newAgent,
    policy,
    policyAsAgent,
    policyAsOther,
    publicClient,
  };
}

async function getPolicyValues(policy: any) {
  return (await policy.read.getPolicy()) as {
    profile: bigint | number;
    maxLeverage: bigint | number;
    minBuffer: bigint | number;
    maxEmergencySpend: bigint | number;
    dailySpendCap: bigint | number;
    spentToday: bigint | number;
    lastResetTimestamp: bigint | number;
    autoHedge: boolean;
    paused: boolean;
  };
}

async function executeAndReadEvent(policy: any, publicClient: any, actionRequest: any) {
  const hash = await policy.write.evaluateAction([actionRequest, 100n, 120n]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: policy.abi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "PolicyActionExecuted") {
        return decoded.args as Record<string, unknown>;
      }
    } catch {
      // Ignore logs that do not belong to PolicyContract.
    }
  }

  throw new Error("PolicyActionExecuted event not found");
}

describe("PolicyContract", function () {
  it("sets constructor defaults and exposes policy views", async function () {
    const { owner, agent, policy } = await deployPolicy();

    expect(await policy.read.owner()).to.equal(getAddress(owner.account.address));
    expect(await policy.read.agent()).to.equal(getAddress(agent.account.address));
    expect(await policy.read.getAgent()).to.equal(getAddress(agent.account.address));

    const values = await getPolicyValues(policy);
    expect(asBigInt(values.profile)).to.equal(1n);
    expect(asBigInt(values.maxLeverage)).to.equal(80n);
    expect(asBigInt(values.minBuffer)).to.equal(100n);
    expect(asBigInt(values.maxEmergencySpend)).to.equal(500_000_000n);
    expect(asBigInt(values.dailySpendCap)).to.equal(1_500_000_000n);
    expect(asBigInt(values.spentToday)).to.equal(0n);
    expect(values.autoHedge).to.equal(false);
    expect(values.paused).to.equal(false);
    expect(await policy.read.getDailyCapRemaining()).to.equal(1_500_000_000n);
  });

  it("updates profile values for conservative, balanced, and advanced modes", async function () {
    const { policy } = await deployPolicy();

    const profiles = [
      {
        id: 0,
        maxLeverage: 50n,
        minBuffer: 150n,
        maxEmergencySpend: 300_000_000n,
        dailySpendCap: 800_000_000n,
      },
      {
        id: 1,
        maxLeverage: 80n,
        minBuffer: 100n,
        maxEmergencySpend: 500_000_000n,
        dailySpendCap: 1_500_000_000n,
      },
      {
        id: 2,
        maxLeverage: 120n,
        minBuffer: 60n,
        maxEmergencySpend: 1_000_000_000n,
        dailySpendCap: 3_000_000_000n,
      },
    ];

    for (const profile of profiles) {
      await policy.write.setProfile([profile.id]);
      const values = await getPolicyValues(policy);

      expect(asBigInt(values.profile)).to.equal(BigInt(profile.id));
      expect(asBigInt(values.maxLeverage)).to.equal(profile.maxLeverage);
      expect(asBigInt(values.minBuffer)).to.equal(profile.minBuffer);
      expect(asBigInt(values.maxEmergencySpend)).to.equal(profile.maxEmergencySpend);
      expect(asBigInt(values.dailySpendCap)).to.equal(profile.dailySpendCap);
    }
  });

  it("updates pause, auto-hedge, and agent settings", async function () {
    const { newAgent, policy } = await deployPolicy();

    await policy.write.setPaused([true]);
    await policy.write.setAutoHedge([true]);
    await policy.write.setAgent([newAgent.account.address]);

    const values = await getPolicyValues(policy);
    expect(values.paused).to.equal(true);
    expect(values.autoHedge).to.equal(true);
    expect(await policy.read.agent()).to.equal(getAddress(newAgent.account.address));
    expect(await policy.read.getAgent()).to.equal(getAddress(newAgent.account.address));
  });

  it("enforces onlyOwner, onlyAgent, and profile validation", async function () {
    const { policy, policyAsOther } = await deployPolicy();

    await expect(policyAsOther.write.setPaused([true])).to.be.rejectedWith("Not owner");
    await expect(policyAsOther.write.evaluateAction([
      request(ActionType.Hold),
      100n,
      120n,
    ])).to.be.rejectedWith("Not agent");
    await expect(policy.write.setProfile([3])).to.be.rejectedWith("Invalid profile");
  });

  it("approves add collateral and increments spentToday", async function () {
    const { policy, policyAsAgent, publicClient } = await deployPolicy();

    const event = await executeAndReadEvent(
      policyAsAgent,
      publicClient,
      request(ActionType.AddCollateral, { amount: 100_000_000n }),
    );
    const values = await getPolicyValues(policy);

    expect(event.status).to.equal(ActionStatus.Approved);
    expect(asBigInt(values.spentToday)).to.equal(100_000_000n);
  });

  it("blocks actions when paused, caps are exceeded, or leverage is too high", async function () {
    const { policy, policyAsAgent, publicClient } = await deployPolicy();

    await policy.write.setPaused([true]);
    const paused = await executeAndReadEvent(
      policyAsAgent,
      publicClient,
      request(ActionType.Hold),
    );
    expect(paused.status).to.equal(ActionStatus.Blocked);

    await policy.write.setPaused([false]);
    await policy.write.setProfile([2]);

    const dailyCap = await executeAndReadEvent(
      policyAsAgent,
      publicClient,
      request(ActionType.AddCollateral, { amount: 3_000_000_001n }),
    );
    expect(dailyCap.status).to.equal(ActionStatus.Blocked);

    const maxSpend = await executeAndReadEvent(
      policyAsAgent,
      publicClient,
      request(ActionType.AddCollateral, { amount: 1_000_000_001n }),
    );
    expect(maxSpend.status).to.equal(ActionStatus.Blocked);

    const maxLeverage = await executeAndReadEvent(
      policyAsAgent,
      publicClient,
      request(ActionType.Hold, { leverage: 121n }),
    );
    expect(maxLeverage.status).to.equal(ActionStatus.Blocked);
  });

  it("emits simulated statuses for deleverage and hedge while approving hold", async function () {
    const { policyAsAgent, publicClient } = await deployPolicy();

    const deleverage = await executeAndReadEvent(
      policyAsAgent,
      publicClient,
      request(ActionType.Deleverage),
    );
    const hedge = await executeAndReadEvent(
      policyAsAgent,
      publicClient,
      request(ActionType.Hedge),
    );
    const hold = await executeAndReadEvent(
      policyAsAgent,
      publicClient,
      request(ActionType.Hold),
    );

    expect(deleverage.status).to.equal(ActionStatus.Simulated);
    expect(hedge.status).to.equal(ActionStatus.Simulated);
    expect(hold.status).to.equal(ActionStatus.Approved);
  });
});
