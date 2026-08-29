export type DemoStatus = "authorized" | "denied";

export interface ProofReceipt {
  blockHeight: number;
  contractAddress: string;
  executionCommitment: string;
  network: "undeployed";
  nullifier: string;
  policyCommitment: string;
  proofDurationMs: number;
  transactionId: string;
}

export interface RequestField {
  label: string;
  private?: boolean;
  value: string;
}

export interface DemoStep {
  argumentsSummary: string;
  description: string;
  group: "Documents" | "Email" | "Payments";
  hiddenFields: string[];
  id: string;
  label: string;
  policyCheck: string;
  receipt?: ProofReceipt;
  requestFields: RequestField[];
  resultSummary: string;
  status: DemoStatus;
  tool: "documents.read" | "email.send" | "payments.transfer";
}

const CONTRACT =
  "ddbe8f734862392428c7e55194ed00a9ac8d00a99cf41cfe81f27afb345793ac";
const POLICY =
  "0x8b701e17a4e1ae066971baa4aaa90bced67eb127a606c73b532589a77e9eaa99";

export const privatePolicy = [
  {
    label: "Agent",
    note: "Only this principal can open the policy",
    value: "LegalAgent-01",
  },
  {
    label: "Matter scope",
    note: "Document access is resource-bound",
    value: "matter:thompson",
  },
  {
    label: "External email",
    note: "Trusted approval required",
    value: "human approval",
  },
  {
    label: "Payment ceiling",
    note: "Hard maximum; approval cannot override",
    value: "£5,000",
  },
  {
    label: "Approval threshold",
    note: "Higher-value transfers need approval",
    value: "£4,000",
  },
] as const;

export const recordedRun: DemoStep[] = [
  {
    argumentsSummary: "Thompson · settlement-offer.pdf",
    description: "The agent requests a document inside its assigned matter.",
    group: "Documents",
    hiddenFields: [
      "matter identifier",
      "document identifier",
      "agent identity",
      "raw tool arguments",
    ],
    id: "document-allowed",
    label: "Read assigned matter",
    policyCheck: "Requested matter matches the private resource scope.",
    receipt: {
      blockHeight: 3187,
      contractAddress: CONTRACT,
      executionCommitment:
        "0x8e855e73bd847db6ddc2bda329cb3a98ec6954fd72908abe3c113dcbe61dd186",
      network: "undeployed",
      nullifier:
        "0xad07ac85f4fe3c1977b3b9060e9a616536e1aa1273bcac044f3aa98072b63de0",
      policyCommitment: POLICY,
      proofDurationMs: 29_628,
      transactionId:
        "00f3ac51f4a5658ffc3432d62cdae2a15c509769afdfb56e641cca5cfda2e21298",
    },
    requestFields: [
      { label: "agent", private: true, value: "LegalAgent-01" },
      { label: "matter", private: true, value: "matter:thompson" },
      { label: "document", private: true, value: "settlement-offer.pdf" },
    ],
    resultSummary: "Document released only after proof finalization.",
    status: "authorized",
    tool: "documents.read",
  },
  {
    argumentsSummary: "Unrelated client · acquisition-notes.pdf",
    description:
      "The same agent attempts to cross its private matter boundary.",
    group: "Documents",
    hiddenFields: [
      "requested matter",
      "allowed matter",
      "agent identity",
      "private rule that failed",
    ],
    id: "document-denied",
    label: "Read unrelated matter",
    policyCheck: "Requested resource does not open the committed matter scope.",
    requestFields: [
      { label: "agent", private: true, value: "LegalAgent-01" },
      { label: "matter", private: true, value: "matter:unrelated-client" },
      { label: "document", private: true, value: "acquisition-notes.pdf" },
    ],
    resultSummary: "Blocked before the upstream document tool executed.",
    status: "denied",
    tool: "documents.read",
  },
  {
    argumentsSummary: "outside-counsel@example.com · settlement proposal",
    description: "An external send requires trusted human approval.",
    group: "Email",
    hiddenFields: [
      "recipient",
      "subject",
      "body",
      "approval policy",
      "agent identity",
    ],
    id: "email-denied",
    label: "Send without approval",
    policyCheck: "Required approval is absent from trusted MCP metadata.",
    requestFields: [
      { label: "agent", private: true, value: "LegalAgent-01" },
      {
        label: "recipient",
        private: true,
        value: "outside-counsel@example.com",
      },
      { label: "approval", private: true, value: "absent" },
    ],
    resultSummary: "Policy denied the action; no email was sent.",
    status: "denied",
    tool: "email.send",
  },
  {
    argumentsSummary: "outside-counsel@example.com · human approved",
    description:
      "Approval arrives through trusted metadata, not agent arguments.",
    group: "Email",
    hiddenFields: [
      "recipient",
      "message content",
      "approval token",
      "agent identity",
      "raw tool arguments",
    ],
    id: "email-approved",
    label: "Send after approval",
    policyCheck: "Trusted human approval satisfies the private email rule.",
    receipt: {
      blockHeight: 3191,
      contractAddress: CONTRACT,
      executionCommitment:
        "0x374c42b97d0e20d559ae754797e00f40078ba76cb483b2f052bddcf2a9adc206",
      network: "undeployed",
      nullifier:
        "0x4fae92d521b56b149878e297498e78406c145a53b51fae9ee573136443ea5b7b",
      policyCommitment: POLICY,
      proofDurationMs: 23_802,
      transactionId:
        "00f726b838d83ac01ae5df43330dc074de8845e112a9f6d4675414d5f21462b7c4",
    },
    requestFields: [
      { label: "agent", private: true, value: "LegalAgent-01" },
      {
        label: "recipient",
        private: true,
        value: "outside-counsel@example.com",
      },
      { label: "approval", private: true, value: "verified" },
    ],
    resultSummary:
      "Email executed only after the authorization transaction landed.",
    status: "authorized",
    tool: "email.send",
  },
  {
    argumentsSummary: "£2,750 · client settlement account",
    description:
      "A payment is checked against hidden numeric policy constraints.",
    group: "Payments",
    hiddenFields: [
      "requested amount",
      "private maximum",
      "approval threshold",
      "recipient",
      "agent identity",
    ],
    id: "payment-allowed",
    label: "Transfer below limit",
    policyCheck:
      "£2,750 is below both the private approval threshold and hard maximum.",
    receipt: {
      blockHeight: 3195,
      contractAddress: CONTRACT,
      executionCommitment:
        "0xef1c6919b1c6158f448902da6de5a166e232222c429cec1f6835b0500e5e07d0",
      network: "undeployed",
      nullifier:
        "0x275b33c1ce1115d01d88d1e69e8ced7b48f699b8ca9c19b7d5863b61097eeb9b",
      policyCommitment: POLICY,
      proofDurationMs: 24_046,
      transactionId:
        "00b4a29f85034bd28b8ddb0fe728d99ac511e5c6306506be9a94ac6830c95d05c3",
    },
    requestFields: [
      { label: "agent", private: true, value: "LegalAgent-01" },
      { label: "amount", private: true, value: "£2,750" },
      { label: "recipient", private: true, value: "client settlement account" },
      { label: "approval", private: true, value: "not required" },
    ],
    resultSummary:
      "Payment executed after Midnight proved the hidden numeric rule.",
    status: "authorized",
    tool: "payments.transfer",
  },
  {
    argumentsSummary: "£4,500 · approval absent",
    description:
      "The amount is under the maximum but crosses a hidden approval threshold.",
    group: "Payments",
    hiddenFields: [
      "requested amount",
      "private approval threshold",
      "approval state",
      "recipient",
    ],
    id: "payment-approval-denied",
    label: "Transfer needs approval",
    policyCheck:
      "£4,500 crosses the private approval threshold; approval is absent.",
    requestFields: [
      { label: "agent", private: true, value: "LegalAgent-01" },
      { label: "amount", private: true, value: "£4,500" },
      { label: "recipient", private: true, value: "client settlement account" },
      { label: "approval", private: true, value: "absent" },
    ],
    resultSummary: "Blocked before the payment tool executed.",
    status: "denied",
    tool: "payments.transfer",
  },
  {
    argumentsSummary: "£4,500 · human approved",
    description: "Trusted approval unlocks the higher-value action.",
    group: "Payments",
    hiddenFields: [
      "requested amount",
      "private maximum",
      "approval threshold",
      "approval token",
      "recipient",
    ],
    id: "payment-approved",
    label: "Transfer with approval",
    policyCheck:
      "The transfer is below the hard maximum and trusted approval is valid.",
    receipt: {
      blockHeight: 3199,
      contractAddress: CONTRACT,
      executionCommitment:
        "0x89d1d410fe2321ef9193a904cfe18addae0860baf7c811cd5c9532e29184c60e",
      network: "undeployed",
      nullifier:
        "0x5de1aa380349c5fc5dbc01040d9fd117d0fd4ed5e3dc2583987e14c6a9be7d90",
      policyCommitment: POLICY,
      proofDurationMs: 23_909,
      transactionId:
        "00c3ddd1aca7df1c9fbfec1cac5e13d9c2f82afe2e9ecabe620b7fb19ca7f43192",
    },
    requestFields: [
      { label: "agent", private: true, value: "LegalAgent-01" },
      { label: "amount", private: true, value: "£4,500" },
      { label: "recipient", private: true, value: "client settlement account" },
      { label: "approval", private: true, value: "verified" },
    ],
    resultSummary: "Payment executed after approval and proof verification.",
    status: "authorized",
    tool: "payments.transfer",
  },
  {
    argumentsSummary: "£8,000 · approval present",
    description: "Approval cannot override the private hard maximum.",
    group: "Payments",
    hiddenFields: [
      "requested amount",
      "private maximum",
      "approval state",
      "recipient",
    ],
    id: "payment-limit-denied",
    label: "Transfer above maximum",
    policyCheck:
      "£8,000 exceeds the hidden hard maximum even though approval is present.",
    requestFields: [
      { label: "agent", private: true, value: "LegalAgent-01" },
      { label: "amount", private: true, value: "£8,000" },
      { label: "recipient", private: true, value: "client settlement account" },
      { label: "approval", private: true, value: "verified" },
    ],
    resultSummary: "Denied by the private policy; no payment was submitted.",
    status: "denied",
    tool: "payments.transfer",
  },
];

export const recordedRunMetadata = {
  blockedCalls: recordedRun.filter((step) => step.status === "denied").length,
  contractAddress: CONTRACT,
  policyCommitment: POLICY,
  recordedAt: "29 Aug 2026 · final verification run",
  successfulProofs: recordedRun.filter((step) => step.status === "authorized")
    .length,
};
