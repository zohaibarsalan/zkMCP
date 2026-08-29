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
  "f8b331689540875418022de069fc96a1ecca78aec2b033329eb12a7e52b4f267";
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
      blockHeight: 189,
      contractAddress: CONTRACT,
      executionCommitment:
        "0x669e722179bd54ed9dc69eb28ce7026f5a1c085f729a811b11282de103e15755",
      network: "undeployed",
      nullifier:
        "0x79a1a9770c28309a6310862071b34348bb3bc022fafc371600c5c23d54574117",
      policyCommitment: POLICY,
      proofDurationMs: 24_633,
      transactionId:
        "00f1340480d49e47105a9d8df8b86cdcf182f87e04985a1b9f74b6b0419a8bfc5b",
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
      blockHeight: 193,
      contractAddress: CONTRACT,
      executionCommitment:
        "0x49678a40aa7e616fec9050d2ed1af916c358ad76de30d751a1014c7e1c321d34",
      network: "undeployed",
      nullifier:
        "0x034de31a00e621f5558f3cca8926f6653d5cec3b271177daed9c2f70085a61ae",
      policyCommitment: POLICY,
      proofDurationMs: 23_815,
      transactionId:
        "006e0107eac1625c97a3142e41d6499a12e3a4a517a55150d30fe9cbc0024a384a",
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
      blockHeight: 197,
      contractAddress: CONTRACT,
      executionCommitment:
        "0x02acf64bccc9a76ea40e98fa9d41348dfa5a44d561c6289661de1ad9ce024a84",
      network: "undeployed",
      nullifier:
        "0x4f5402392a8e8cfdb95a495e08a8e58eb3e7b1309422572f5573ef8ac526cacb",
      policyCommitment: POLICY,
      proofDurationMs: 24_072,
      transactionId:
        "000e4f931e422c58271f9ad712e2f5c53c7188d8fa4bffd6861d88f178dce5408f",
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
      blockHeight: 201,
      contractAddress: CONTRACT,
      executionCommitment:
        "0x733a6a79992b1ca58092e14821bbf326af3f168908420e4f9ca43a5891c3cb89",
      network: "undeployed",
      nullifier:
        "0x9a7796858ac8e7196fbd95554022f9d6ac9ae8de8ece3d8a19e3962cdb700dfc",
      policyCommitment: POLICY,
      proofDurationMs: 23_920,
      transactionId:
        "00dfea75d18cf1b9a2c2ce7a5330a8ce8f5ec8d597b89cb5c9479b2a595b6de447",
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
  recordedAt: "29 Aug 2026",
  successfulProofs: recordedRun.filter((step) => step.status === "authorized")
    .length,
};
