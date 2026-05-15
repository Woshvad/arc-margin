# ArcMargin — Contract Spec

## Overview

Deploy one Solidity contract to Arc testnet: `PolicyContract.sol`.

This is the core of the product story. Every agent action passes through this contract.
Judges can verify it on testnet.arcscan.app. It is what separates ArcMargin from a UI demo.

---

## Stack

```
Hardhat + TypeScript
viem for deployment scripts
@nomicfoundation/hardhat-toolbox-viem
```

---

## Setup

```bash
cd contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox-viem viem typescript ts-node @types/node dotenv
npx hardhat init  # select: TypeScript project
```

---

## hardhat.config.ts

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    arcTestnet: {
      url: process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      gasPrice: "auto",
    },
  },
};

export default config;
```

---

## contracts/PolicyContract.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PolicyContract
 * @notice ArcMargin policy enforcement layer on Arc testnet.
 *         The agent calls evaluateAction() before every execution.
 *         Results are emitted as PolicyActionExecuted events — the auditable receipt trail.
 */
contract PolicyContract {

    // ─── Types ───────────────────────────────────────────────────────────────

    enum ActionType { Hold, AddCollateral, Deleverage, Hedge, Block }
    enum ActionStatus { Approved, Blocked, Simulated }

    struct Policy {
        uint8   profile;            // 0=Conservative, 1=Balanced, 2=Advanced
        uint256 maxLeverage;        // scaled by 10 (e.g. 80 = 8.0x)
        uint256 minBuffer;          // scaled by 10 (e.g. 100 = 10.0%)
        uint256 maxEmergencySpend;  // USDC, 6 decimals
        uint256 dailySpendCap;      // USDC, 6 decimals
        uint256 spentToday;         // USDC, 6 decimals
        uint256 lastResetTimestamp;
        bool    autoHedge;
        bool    paused;
    }

    struct ActionRequest {
        ActionType  action;
        uint256     leverage;       // scaled by 10
        uint256     buffer;         // scaled by 10
        uint256     amount;         // USDC, 6 decimals
        string      pair;
        string      venue;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    address public owner;
    address public agent;
    Policy  public policy;
    uint256 public receiptCount;

    // ─── Events ──────────────────────────────────────────────────────────────

    event PolicyActionExecuted(
        uint256 indexed receiptId,
        ActionType      action,
        ActionStatus    status,
        string          pair,
        string          venue,
        uint256         amount,
        uint256         bufferBefore,
        uint256         bufferAfter,
        string          reason,
        uint256         timestamp
    );

    event PolicyUpdated(uint8 profile, uint256 maxLeverage, uint256 minBuffer);
    event AgentPaused(bool paused);
    event AgentUpdated(address newAgent);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "Not agent");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _agent) {
        owner = msg.sender;
        agent = _agent;

        // Default: Balanced profile
        policy = Policy({
            profile:            1,
            maxLeverage:        80,
            minBuffer:          100,
            maxEmergencySpend:  500_000_000,   // 500 USDC
            dailySpendCap:      1_500_000_000, // 1500 USDC
            spentToday:         0,
            lastResetTimestamp: block.timestamp,
            autoHedge:          false,
            paused:             false
        });
    }

    // ─── Core: Evaluate Action ────────────────────────────────────────────────

    /**
     * @notice Called by the agent before every execution.
     *         Enforces policy rules, emits a receipt, returns approval status.
     * @return approved  true if the action is permitted
     * @return receiptId the sequential receipt ID
     */
    function evaluateAction(
        ActionRequest calldata req,
        uint256 bufferBefore,
        uint256 bufferAfter
    ) external onlyAgent returns (bool approved, uint256 receiptId) {

        _resetDailySpendIfNeeded();

        receiptId = ++receiptCount;
        ActionStatus status;
        string memory reason;

        // Gate 1: Agent paused
        if (policy.paused) {
            status  = ActionStatus.Blocked;
            reason  = "Agent is paused. No actions taken.";
            approved = false;

        // Gate 2: Daily cap exhausted
        } else if (
            req.action == ActionType.AddCollateral &&
            policy.spentToday + req.amount > policy.dailySpendCap
        ) {
            status  = ActionStatus.Blocked;
            reason  = "Daily spend cap reached. Action denied.";
            approved = false;

        // Gate 3: Amount exceeds per-action emergency limit
        } else if (
            req.action == ActionType.AddCollateral &&
            req.amount > policy.maxEmergencySpend
        ) {
            status  = ActionStatus.Blocked;
            reason  = "Amount exceeds max emergency spend per action.";
            approved = false;

        // Gate 4: Leverage exceeds policy cap
        } else if (req.leverage > policy.maxLeverage) {
            status  = ActionStatus.Blocked;
            reason  = "Requested leverage exceeds policy cap.";
            approved = false;

        // Approved: collateral add
        } else if (req.action == ActionType.AddCollateral) {
            policy.spentToday += req.amount;
            status   = ActionStatus.Approved;
            reason   = "Buffer below policy floor. Collateral routed via Arc Gateway.";
            approved = true;

        // Approved: deleverage
        } else if (req.action == ActionType.Deleverage) {
            status   = ActionStatus.Simulated;
            reason   = "Leverage exceeded policy during high volatility. Position reduced.";
            approved = true;

        // Approved: hedge
        } else if (req.action == ActionType.Hedge) {
            status   = ActionStatus.Simulated;
            reason   = "Buffer thin, auto-hedge enabled. Protective position opened.";
            approved = true;

        // Default: hold
        } else {
            status   = ActionStatus.Approved;
            reason   = "Position within policy envelope. No action required.";
            approved = true;
        }

        emit PolicyActionExecuted(
            receiptId,
            req.action,
            status,
            req.pair,
            req.venue,
            req.amount,
            bufferBefore,
            bufferAfter,
            reason,
            block.timestamp
        );
    }

    // ─── Policy Management ───────────────────────────────────────────────────

    function setProfile(uint8 _profile) external onlyOwner {
        require(_profile <= 2, "Invalid profile");

        if (_profile == 0) {
            // Conservative
            policy.maxLeverage       = 50;
            policy.minBuffer         = 150;
            policy.maxEmergencySpend = 300_000_000;
            policy.dailySpendCap     = 800_000_000;
        } else if (_profile == 1) {
            // Balanced
            policy.maxLeverage       = 80;
            policy.minBuffer         = 100;
            policy.maxEmergencySpend = 500_000_000;
            policy.dailySpendCap     = 1_500_000_000;
        } else {
            // Advanced
            policy.maxLeverage       = 120;
            policy.minBuffer         = 60;
            policy.maxEmergencySpend = 1_000_000_000;
            policy.dailySpendCap     = 3_000_000_000;
        }

        policy.profile = _profile;
        emit PolicyUpdated(policy.profile, policy.maxLeverage, policy.minBuffer);
    }

    function setPaused(bool _paused) external onlyOwner {
        policy.paused = _paused;
        emit AgentPaused(_paused);
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
        emit AgentUpdated(_agent);
    }

    function setAutoHedge(bool _autoHedge) external onlyOwner {
        policy.autoHedge = _autoHedge;
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getPolicy() external view returns (Policy memory) {
        return policy;
    }

    function getDailyCapRemaining() external view returns (uint256) {
        if (policy.spentToday >= policy.dailySpendCap) return 0;
        return policy.dailySpendCap - policy.spentToday;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _resetDailySpendIfNeeded() internal {
        if (block.timestamp >= policy.lastResetTimestamp + 1 days) {
            policy.spentToday         = 0;
            policy.lastResetTimestamp = block.timestamp;
        }
    }
}
```

---

## scripts/deploy.ts

```typescript
import { viem } from "hardhat";

async function main() {
  const [deployer] = await viem.getWalletClients();
  console.log("Deploying from:", deployer.account.address);

  // The agent wallet address comes from Circle Wallets setup (see agent spec)
  // Set AGENT_WALLET_ADDRESS in .env before deploying
  const agentAddress = process.env.AGENT_WALLET_ADDRESS;
  if (!agentAddress) throw new Error("AGENT_WALLET_ADDRESS not set in .env");

  const policyContract = await viem.deployContract("PolicyContract", [agentAddress]);

  console.log("PolicyContract deployed to:", policyContract.address);
  console.log("Set POLICY_CONTRACT_ADDRESS=" + policyContract.address + " in agent/.env");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

### Deploy Command

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network arcTestnet
```

---

## Verify Deployment

After deployment, confirm on the Arc testnet explorer:
`https://testnet.arcscan.app/address/<POLICY_CONTRACT_ADDRESS>`

The contract should appear with the `PolicyActionExecuted` event ABI visible.

---

## Acceptance Criteria

- [ ] `PolicyContract.sol` compiles without errors
- [ ] Contract deploys to Arc testnet (chain ID 5042002)
- [ ] Contract address visible on testnet.arcscan.app
- [ ] `evaluateAction()` can be called by the agent wallet
- [ ] `PolicyActionExecuted` events appear in the explorer after agent cycles
- [ ] `setProfile()` changes policy values correctly
- [ ] `getDailyCapRemaining()` returns correct remaining USDC
