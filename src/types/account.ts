import type {
  AccountType,
  PipelineStage,
  AccountSource,
} from "@prisma/client";

export interface AccountInput {
  name: string;
  addressLine?: string | null;
  city?: string;
  state?: string;
  zip?: string | null;
  phone?: string | null;
  accountType?: AccountType;
  pipelineStage?: PipelineStage;
  source?: AccountSource;
}

export interface AccountListItem {
  id: string;
  name: string;
  accountType: AccountType;
  pipelineStage: PipelineStage;
  addressLine: string | null;
  city: string;
  state: string;
  zip: string | null;
  lastInteractionDate: string | null;
  nextActionDate: string | null;
}

export interface AccountDetail extends AccountListItem {
  phone: string | null;
  source: AccountSource;
  contacts: {
    id: string;
    name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
  }[];
  interactions: {
    id: string;
    date: string;
    type: "VISIT" | "CALL" | "EMAIL";
    notes: string | null;
    nextAction: string | null;
    nextActionDate: string | null;
  }[];
}

export interface ContactInput {
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface InteractionInput {
  date: string;
  type: "VISIT" | "CALL" | "EMAIL";
  notes?: string | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
}

export interface ProspectDraftListItem {
  id: string;
  subject: string;
  body: string;
  recipientEmail: string | null;
  account: {
    id: string;
    name: string;
    addressLine: string | null;
    city: string;
    state: string;
    zip: string | null;
  };
}
