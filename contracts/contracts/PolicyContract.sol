// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PolicyContract
 * @notice ArcMargin policy enforcement layer on Arc testnet.
 *         The agent calls evaluateAction() before every execution.
 *         Results are emitted as PolicyActionExecuted events.
 */
contract PolicyContract {
    enum ActionType {
        Hold,
        AddCollateral,
        Deleverage,
        Hedge,
        Block
    }

    enum ActionStatus {
        Approved,
        Blocked,
        Simulated
    }

    struct Policy {
        uint8 profile;
        uint256 maxLeverage;
        uint256 minBuffer;
        uint256 maxEmergencySpend;
        uint256 dailySpendCap;
        uint256 spentToday;
        uint256 lastResetTimestamp;
        bool autoHedge;
        bool paused;
    }

    struct ActionRequest {
        ActionType action;
        uint256 leverage;
        uint256 buffer;
        uint256 amount;
        string pair;
        string venue;
    }

    address public owner;
    address public agent;
    Policy public policy;
    uint256 public receiptCount;

    event PolicyActionExecuted(
        uint256 indexed receiptId,
        ActionType action,
        ActionStatus status,
        string pair,
        string venue,
        uint256 amount,
        uint256 bufferBefore,
        uint256 bufferAfter,
        string reason,
        uint256 timestamp
    );

    event PolicyUpdated(uint8 profile, uint256 maxLeverage, uint256 minBuffer);
    event AgentPaused(bool paused);
    event AgentUpdated(address newAgent);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "Not agent");
        _;
    }

    constructor(address _agent) {
        owner = msg.sender;
        agent = _agent;

        policy = Policy({
            profile: 1,
            maxLeverage: 80,
            minBuffer: 100,
            maxEmergencySpend: 500_000_000,
            dailySpendCap: 1_500_000_000,
            spentToday: 0,
            lastResetTimestamp: block.timestamp,
            autoHedge: false,
            paused: false
        });
    }

    function evaluateAction(
        ActionRequest calldata req,
        uint256 bufferBefore,
        uint256 bufferAfter
    ) external onlyAgent returns (bool approved, uint256 receiptId) {
        _resetDailySpendIfNeeded();

        receiptId = ++receiptCount;
        ActionStatus status;
        string memory reason;

        if (policy.paused) {
            status = ActionStatus.Blocked;
            reason = "Agent is paused. No actions taken.";
            approved = false;
        } else if (
            req.action == ActionType.AddCollateral &&
            policy.spentToday + req.amount > policy.dailySpendCap
        ) {
            status = ActionStatus.Blocked;
            reason = "Daily spend cap reached. Action denied.";
            approved = false;
        } else if (
            req.action == ActionType.AddCollateral &&
            req.amount > policy.maxEmergencySpend
        ) {
            status = ActionStatus.Blocked;
            reason = "Amount exceeds max emergency spend per action.";
            approved = false;
        } else if (req.leverage > policy.maxLeverage) {
            status = ActionStatus.Blocked;
            reason = "Requested leverage exceeds policy cap.";
            approved = false;
        } else if (req.action == ActionType.AddCollateral) {
            policy.spentToday += req.amount;
            status = ActionStatus.Approved;
            reason = "Buffer below policy floor. Collateral routed via Arc Gateway.";
            approved = true;
        } else if (req.action == ActionType.Deleverage) {
            status = ActionStatus.Simulated;
            reason = "Leverage exceeded policy during high volatility. Position reduced.";
            approved = true;
        } else if (req.action == ActionType.Hedge) {
            status = ActionStatus.Simulated;
            reason = "Buffer thin, auto-hedge enabled. Protective position opened.";
            approved = true;
        } else {
            status = ActionStatus.Approved;
            reason = "Position within policy envelope. No action required.";
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

    function setProfile(uint8 _profile) external onlyOwner {
        require(_profile <= 2, "Invalid profile");

        if (_profile == 0) {
            policy.maxLeverage = 50;
            policy.minBuffer = 150;
            policy.maxEmergencySpend = 300_000_000;
            policy.dailySpendCap = 800_000_000;
        } else if (_profile == 1) {
            policy.maxLeverage = 80;
            policy.minBuffer = 100;
            policy.maxEmergencySpend = 500_000_000;
            policy.dailySpendCap = 1_500_000_000;
        } else {
            policy.maxLeverage = 120;
            policy.minBuffer = 60;
            policy.maxEmergencySpend = 1_000_000_000;
            policy.dailySpendCap = 3_000_000_000;
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

    function getPolicy() external view returns (Policy memory) {
        return policy;
    }

    function getAgent() external view returns (address) {
        return agent;
    }

    function getDailyCapRemaining() external view returns (uint256) {
        if (policy.spentToday >= policy.dailySpendCap) return 0;
        return policy.dailySpendCap - policy.spentToday;
    }

    function _resetDailySpendIfNeeded() internal {
        if (block.timestamp >= policy.lastResetTimestamp + 1 days) {
            policy.spentToday = 0;
            policy.lastResetTimestamp = block.timestamp;
        }
    }
}
