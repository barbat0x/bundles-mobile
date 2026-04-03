export type SwapExecutionStepKey =
  | "approval_check"
  | "approval_pending"
  | "approval_confirmed"
  | "swap_pending"
  | "swap_submitted"
  | "swap_confirmed";

export type SwapExecutionStepStatus = "pending" | "done" | "failed";

export type SwapExecutionProgressEvent = {
  step: SwapExecutionStepKey;
  status: SwapExecutionStepStatus;
  txHash?: string;
  errorMessage?: string;
};

export type SwapExecutionUiState =
  | { status: "idle" }
  | { status: "preconfirm" }
  | {
      status: "in_progress";
      direction: "buy" | "sell";
      steps: SwapExecutionProgressEvent[];
      txHash?: string;
    }
  | {
      status: "success";
      direction: "buy" | "sell";
      txHash: string;
    }
  | {
      status: "failed";
      direction: "buy" | "sell";
      steps: SwapExecutionProgressEvent[];
      errorMessage: string;
      txHash?: string;
    };
