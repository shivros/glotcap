/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountSecurity from "../accountSecurity.js";
import type * as accountSecurityInternal from "../accountSecurityInternal.js";
import type * as auth from "../auth.js";
import type * as coach from "../coach.js";
import type * as coach_config from "../coach/config.js";
import type * as coach_history from "../coach/history.js";
import type * as coach_prompt from "../coach/prompt.js";
import type * as coach_stream from "../coach/stream.js";
import type * as coach_types from "../coach/types.js";
import type * as corrections from "../corrections.js";
import type * as costs from "../costs.js";
import type * as costs_neutralCostGateway from "../costs/neutralCostGateway.js";
import type * as costs_neutralCostRecorder from "../costs/neutralCostRecorder.js";
import type * as costs_ports from "../costs/ports.js";
import type * as costs_pricingClassifier from "../costs/pricingClassifier.js";
import type * as costs_pricingDefaults from "../costs/pricingDefaults.js";
import type * as costs_pricingPolicy from "../costs/pricingPolicy.js";
import type * as costs_pricingRefreshScope from "../costs/pricingRefreshScope.js";
import type * as costs_providerPolicy from "../costs/providerPolicy.js";
import type * as costs_resilientRecorderAdapter from "../costs/resilientRecorderAdapter.js";
import type * as costs_runtimeFactory from "../costs/runtimeFactory.js";
import type * as costs_structuredOutputCostService from "../costs/structuredOutputCostService.js";
import type * as costs_toolPricingRecovery from "../costs/toolPricingRecovery.js";
import type * as costs_toolUsageCostService from "../costs/toolUsageCostService.js";
import type * as crons from "../crons.js";
import type * as emailChange from "../emailChange.js";
import type * as emailChangeInternal from "../emailChangeInternal.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as learningInsights from "../learningInsights.js";
import type * as learningInsights_normalization from "../learningInsights/normalization.js";
import type * as learningInsights_rules from "../learningInsights/rules.js";
import type * as learningInsights_scoring from "../learningInsights/scoring.js";
import type * as lib_authProviderIds from "../lib/authProviderIds.js";
import type * as lib_emailChangeAdapters from "../lib/emailChangeAdapters.js";
import type * as lib_passwordAuthGateway from "../lib/passwordAuthGateway.js";
import type * as lib_passwordResetAdapters from "../lib/passwordResetAdapters.js";
import type * as lib_requireUserId from "../lib/requireUserId.js";
import type * as logging from "../logging.js";
import type * as mediaTools from "../mediaTools.js";
import type * as mediaTools_application_interfaces from "../mediaTools/application/interfaces.js";
import type * as mediaTools_application_jobService from "../mediaTools/application/jobService.js";
import type * as mediaTools_application_processors from "../mediaTools/application/processors.js";
import type * as mediaTools_application_types from "../mediaTools/application/types.js";
import type * as mediaTools_infrastructure_convexJobStore from "../mediaTools/infrastructure/convexJobStore.js";
import type * as mediaTools_infrastructure_costTrackingTranscriptionProvider from "../mediaTools/infrastructure/costTrackingTranscriptionProvider.js";
import type * as mediaTools_infrastructure_costTrackingTranslationProvider from "../mediaTools/infrastructure/costTrackingTranslationProvider.js";
import type * as mediaTools_infrastructure_inputLoader from "../mediaTools/infrastructure/inputLoader.js";
import type * as mediaTools_infrastructure_openAiTranscriptionProvider from "../mediaTools/infrastructure/openAiTranscriptionProvider.js";
import type * as mediaTools_infrastructure_runtimeFactory from "../mediaTools/infrastructure/runtimeFactory.js";
import type * as mediaTools_infrastructure_translationProviderAdapter from "../mediaTools/infrastructure/translationProviderAdapter.js";
import type * as mediaToolsActions from "../mediaToolsActions.js";
import type * as mediaToolsDomain from "../mediaToolsDomain.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwordResetInternal from "../passwordResetInternal.js";
import type * as sessionAuth from "../sessionAuth.js";
import type * as sessionStateMachine from "../sessionStateMachine.js";
import type * as speaking from "../speaking.js";
import type * as speakingDomain from "../speakingDomain.js";
import type * as speakingPolicy from "../speakingPolicy.js";
import type * as streaming from "../streaming.js";
import type * as stt from "../stt.js";
import type * as taskErrors from "../taskErrors.js";
import type * as translation_service from "../translation_service.js";
import type * as translation_telemetry from "../translation_telemetry.js";
import type * as translations from "../translations.js";
import type * as tts from "../tts.js";
import type * as ttsStream from "../ttsStream.js";
import type * as userPreferences from "../userPreferences.js";
import type * as vocabulary from "../vocabulary.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountSecurity: typeof accountSecurity;
  accountSecurityInternal: typeof accountSecurityInternal;
  auth: typeof auth;
  coach: typeof coach;
  "coach/config": typeof coach_config;
  "coach/history": typeof coach_history;
  "coach/prompt": typeof coach_prompt;
  "coach/stream": typeof coach_stream;
  "coach/types": typeof coach_types;
  corrections: typeof corrections;
  costs: typeof costs;
  "costs/neutralCostGateway": typeof costs_neutralCostGateway;
  "costs/neutralCostRecorder": typeof costs_neutralCostRecorder;
  "costs/ports": typeof costs_ports;
  "costs/pricingClassifier": typeof costs_pricingClassifier;
  "costs/pricingDefaults": typeof costs_pricingDefaults;
  "costs/pricingPolicy": typeof costs_pricingPolicy;
  "costs/pricingRefreshScope": typeof costs_pricingRefreshScope;
  "costs/providerPolicy": typeof costs_providerPolicy;
  "costs/resilientRecorderAdapter": typeof costs_resilientRecorderAdapter;
  "costs/runtimeFactory": typeof costs_runtimeFactory;
  "costs/structuredOutputCostService": typeof costs_structuredOutputCostService;
  "costs/toolPricingRecovery": typeof costs_toolPricingRecovery;
  "costs/toolUsageCostService": typeof costs_toolUsageCostService;
  crons: typeof crons;
  emailChange: typeof emailChange;
  emailChangeInternal: typeof emailChangeInternal;
  emails: typeof emails;
  http: typeof http;
  invites: typeof invites;
  learningInsights: typeof learningInsights;
  "learningInsights/normalization": typeof learningInsights_normalization;
  "learningInsights/rules": typeof learningInsights_rules;
  "learningInsights/scoring": typeof learningInsights_scoring;
  "lib/authProviderIds": typeof lib_authProviderIds;
  "lib/emailChangeAdapters": typeof lib_emailChangeAdapters;
  "lib/passwordAuthGateway": typeof lib_passwordAuthGateway;
  "lib/passwordResetAdapters": typeof lib_passwordResetAdapters;
  "lib/requireUserId": typeof lib_requireUserId;
  logging: typeof logging;
  mediaTools: typeof mediaTools;
  "mediaTools/application/interfaces": typeof mediaTools_application_interfaces;
  "mediaTools/application/jobService": typeof mediaTools_application_jobService;
  "mediaTools/application/processors": typeof mediaTools_application_processors;
  "mediaTools/application/types": typeof mediaTools_application_types;
  "mediaTools/infrastructure/convexJobStore": typeof mediaTools_infrastructure_convexJobStore;
  "mediaTools/infrastructure/costTrackingTranscriptionProvider": typeof mediaTools_infrastructure_costTrackingTranscriptionProvider;
  "mediaTools/infrastructure/costTrackingTranslationProvider": typeof mediaTools_infrastructure_costTrackingTranslationProvider;
  "mediaTools/infrastructure/inputLoader": typeof mediaTools_infrastructure_inputLoader;
  "mediaTools/infrastructure/openAiTranscriptionProvider": typeof mediaTools_infrastructure_openAiTranscriptionProvider;
  "mediaTools/infrastructure/runtimeFactory": typeof mediaTools_infrastructure_runtimeFactory;
  "mediaTools/infrastructure/translationProviderAdapter": typeof mediaTools_infrastructure_translationProviderAdapter;
  mediaToolsActions: typeof mediaToolsActions;
  mediaToolsDomain: typeof mediaToolsDomain;
  passwordReset: typeof passwordReset;
  passwordResetInternal: typeof passwordResetInternal;
  sessionAuth: typeof sessionAuth;
  sessionStateMachine: typeof sessionStateMachine;
  speaking: typeof speaking;
  speakingDomain: typeof speakingDomain;
  speakingPolicy: typeof speakingPolicy;
  streaming: typeof streaming;
  stt: typeof stt;
  taskErrors: typeof taskErrors;
  translation_service: typeof translation_service;
  translation_telemetry: typeof translation_telemetry;
  translations: typeof translations;
  tts: typeof tts;
  ttsStream: typeof ttsStream;
  userPreferences: typeof userPreferences;
  vocabulary: typeof vocabulary;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: Array<string> | string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bcc?: Array<string>;
          bounced?: boolean;
          cc?: Array<string>;
          clicked?: boolean;
          complained: boolean;
          createdAt: number;
          deliveryDelayed?: boolean;
          errorMessage?: string;
          failed?: boolean;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bounced: boolean;
          clicked: boolean;
          complained: boolean;
          deliveryDelayed: boolean;
          errorMessage: string | null;
          failed: boolean;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          bcc?: Array<string>;
          cc?: Array<string>;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
  persistentTextStreaming: {
    lib: {
      addChunk: FunctionReference<
        "mutation",
        "internal",
        { final: boolean; streamId: string; text: string },
        any
      >;
      createStream: FunctionReference<"mutation", "internal", {}, any>;
      getStreamStatus: FunctionReference<
        "query",
        "internal",
        { streamId: string },
        "pending" | "streaming" | "done" | "error" | "timeout"
      >;
      getStreamText: FunctionReference<
        "query",
        "internal",
        { streamId: string },
        {
          status: "pending" | "streaming" | "done" | "error" | "timeout";
          text: string;
        }
      >;
      setStreamStatus: FunctionReference<
        "mutation",
        "internal",
        {
          status: "pending" | "streaming" | "done" | "error" | "timeout";
          streamId: string;
        },
        any
      >;
    };
  };
  neutralCost: {
    aiCosts: {
      addAICost: FunctionReference<
        "action",
        "internal",
        {
          markupMultiplier?: number;
          messageId: string;
          modelId: string;
          providerId: string;
          threadId: string;
          usage: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
        },
        any
      >;
      getAICostByMessageId: FunctionReference<
        "query",
        "internal",
        { messageId: string },
        any
      >;
      getAICostsByThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        Array<{
          _creationTime: number;
          _id: string;
          cost: {
            cachedInputTokensCost?: number;
            completionTokensCost: number;
            promptTokensCost: number;
            reasoningTokensCost?: number;
            totalCost: number;
          };
          costForUser: {
            cachedInputTokensCost?: number;
            completionTokensCost: number;
            promptTokensCost: number;
            reasoningTokensCost?: number;
            totalCost: number;
          };
          messageId: string;
          threadId: string;
          usage: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
        }>
      >;
      getAICostsByUser: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          _creationTime: number;
          _id: string;
          cost: {
            cachedInputTokensCost?: number;
            completionTokensCost: number;
            promptTokensCost: number;
            reasoningTokensCost?: number;
            totalCost: number;
          };
          costForUser: {
            cachedInputTokensCost?: number;
            completionTokensCost: number;
            promptTokensCost: number;
            reasoningTokensCost?: number;
            totalCost: number;
          };
          messageId: string;
          threadId: string;
          usage: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
        }>
      >;
      getTotalAICostsByThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        any
      >;
      getTotalAICostsByUser: FunctionReference<
        "query",
        "internal",
        { userId: string },
        any
      >;
    };
    markup: {
      deleteMarkup: FunctionReference<
        "mutation",
        "internal",
        {
          modelId?: string;
          providerId: string;
          scope: "provider" | "model" | "tool";
          toolId?: string;
        },
        boolean
      >;
      getMarkupMultiplier: FunctionReference<
        "query",
        "internal",
        { modelId?: string; providerId: string; toolId?: string },
        number
      >;
      getMarkupMultiplierById: FunctionReference<
        "query",
        "internal",
        { markupMultiplierId: string },
        any
      >;
      getMarkupMultipliers: FunctionReference<
        "query",
        "internal",
        {},
        {
          modelMarkupMultipliers: Array<{
            markupMultiplier: number;
            modelId: string;
            providerId: string;
          }>;
          providerMultipliers: Array<{
            markupMultiplier: number;
            providerId: string;
          }>;
          toolMarkupMultipliers: Array<{
            markupMultiplier: number;
            providerId: string;
            toolId: string;
          }>;
        }
      >;
      upsertModelMarkup: FunctionReference<
        "mutation",
        "internal",
        {
          markupMultiplier: number;
          modelId: string;
          providerId: string;
          scope: "model";
        },
        string
      >;
      upsertProviderMarkup: FunctionReference<
        "mutation",
        "internal",
        { markupMultiplier: number; providerId: string; scope: "provider" },
        string
      >;
      upsertToolMarkup: FunctionReference<
        "mutation",
        "internal",
        {
          markupMultiplier: number;
          providerId: string;
          scope: "tool";
          toolId: string;
        },
        string
      >;
    };
    pricing: {
      deleteToolPricing: FunctionReference<
        "mutation",
        "internal",
        { modelId?: string; providerId: string },
        any
      >;
      getAllPricing: FunctionReference<"query", "internal", {}, any>;
      getAllToolPricing: FunctionReference<"query", "internal", {}, any>;
      getPricing: FunctionReference<
        "query",
        "internal",
        { modelId: string; providerId: string },
        any
      >;
      getPricingByProvider: FunctionReference<
        "query",
        "internal",
        { providerId: string },
        any
      >;
      getToolPricing: FunctionReference<
        "query",
        "internal",
        { providerId: string; toolId: string },
        any
      >;
      getToolPricingByProvider: FunctionReference<
        "query",
        "internal",
        { providerId: string },
        any
      >;
      searchPricingByModelName: FunctionReference<
        "query",
        "internal",
        { searchTerm: string },
        any
      >;
      updatePricingData: FunctionReference<
        "action",
        "internal",
        { envKeys?: Record<string, string> },
        any
      >;
      updatePricingTable: FunctionReference<
        "mutation",
        "internal",
        {
          pricingData: Array<{
            lastUpdated: number;
            limits: { context: number; output: number };
            modelId: string;
            modelName: string;
            pricing: {
              cache_read?: number;
              cache_write?: number;
              input: number;
              output: number;
              reasoning?: number;
            };
            providerId: string;
            providerName: string;
          }>;
        },
        any
      >;
      upsertToolPricing: FunctionReference<
        "mutation",
        "internal",
        {
          limits?: {
            maxBytesPerRequest?: number;
            maxConcurrentRequests?: number;
            maxRequestsPerDay?: number;
            maxRequestsPerHour?: number;
            maxRequestsPerMinute?: number;
            maxRequestsPerMonth?: number;
            maxRequestsPerSecond?: number;
            maxTokensPerRequest?: number;
          };
          modelId?: string;
          modelName?: string;
          pricing:
            | {
                costPerCredit: number;
                creditTypes?: Record<string, number>;
                currency: string;
                type: "credits";
              }
            | {
                cache_read?: number;
                cache_write?: number;
                currency: string;
                input: number;
                output: number;
                reasoning?: number;
                type: "tokens";
              }
            | {
                costPerRequest: number;
                currency: string;
                requestTypes?: Record<string, number>;
                type: "requests";
              }
            | {
                computeTypes?: Record<string, number>;
                costPerMs: number;
                currency: string;
                tiers?: Record<string, number>;
                type: "compute";
              }
            | {
                costPerByteSecond: number;
                currency: string;
                storageClasses?: Record<string, number>;
                type: "storage";
              }
            | {
                costPerByteIn?: number;
                costPerByteOut?: number;
                currency: string;
                regions?: Record<string, number>;
                type: "bandwidth";
              }
            | {
                costPerUnit: number;
                currency: string;
                type: "units";
                unitType: string;
              }
            | {
                currency: string;
                tiers: Array<{ from: number; rate: number; to?: number }>;
                type: "tiered";
                unitType: string;
              }
            | {
                components: Array<{
                  costPerUnit: number;
                  name: string;
                  unitType: string;
                }>;
                currency: string;
                type: "composite";
              }
            | {
                currency: string;
                data: any;
                description?: string;
                type: "custom";
              };
          providerId: string;
          providerName: string;
        },
        any
      >;
    };
    toolCosts: {
      addToolCost: FunctionReference<
        "action",
        "internal",
        {
          markupMultiplier?: number;
          messageId: string;
          providerId: string;
          threadId: string;
          toolId: string;
          usage:
            | { creditType?: string; credits: number; type: "credits" }
            | {
                cacheReadTokens?: number;
                cacheWriteTokens?: number;
                inputTokens: number;
                outputTokens: number;
                reasoningTokens?: number;
                type: "tokens";
              }
            | { requestType?: string; requests: number; type: "requests" }
            | {
                computeType?: string;
                durationMs: number;
                tier?: string;
                type: "compute";
              }
            | {
                bytes: number;
                durationSeconds?: number;
                storageClass?: string;
                type: "storage";
              }
            | {
                bytesIn?: number;
                bytesOut?: number;
                region?: string;
                type: "bandwidth";
              }
            | {
                metadata?: Record<string, any>;
                type: "units";
                unitType: string;
                units: number;
              }
            | {
                quantity: number;
                tierName?: string;
                type: "tiered";
                unitType: string;
              }
            | {
                components: Array<{
                  cost?: number;
                  name: string;
                  quantity: number;
                  unitType: string;
                }>;
                type: "composite";
              }
            | { data: any; description?: string; type: "custom" };
          userId?: string;
        },
        any
      >;
      getToolCostsByProviderAndTool: FunctionReference<
        "query",
        "internal",
        { providerId: string; toolId?: string },
        any
      >;
      getToolCostsByThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        Array<{
          _creationTime: number;
          _id: string;
          cost: {
            amount: number;
            breakdown?:
              | { costPerCredit: number; credits: number; type: "credits" }
              | {
                  cacheReadTokensCost?: number;
                  cacheWriteTokensCost?: number;
                  inputTokensCost?: number;
                  outputTokensCost?: number;
                  reasoningTokensCost?: number;
                  type: "tokens";
                }
              | { costPerRequest: number; requests: number; type: "requests" }
              | {
                  computeType?: string;
                  costPerMs: number;
                  durationMs: number;
                  type: "compute";
                }
              | {
                  bytes: number;
                  costPerByteSecond: number;
                  durationSeconds: number;
                  type: "storage";
                }
              | {
                  bytesInCost?: number;
                  bytesOutCost?: number;
                  type: "bandwidth";
                }
              | {
                  costPerUnit: number;
                  type: "units";
                  unitType: string;
                  units: number;
                }
              | {
                  effectiveRate: number;
                  quantity: number;
                  tierApplied: string;
                  type: "tiered";
                }
              | {
                  components: Array<{
                    name: string;
                    quantity: number;
                    totalCost: number;
                    unitCost: number;
                  }>;
                  type: "composite";
                }
              | { data: any; type: "custom" };
            currency: string;
          };
          costForUser: {
            amount: number;
            breakdown?:
              | { costPerCredit: number; credits: number; type: "credits" }
              | {
                  cacheReadTokensCost?: number;
                  cacheWriteTokensCost?: number;
                  inputTokensCost?: number;
                  outputTokensCost?: number;
                  reasoningTokensCost?: number;
                  type: "tokens";
                }
              | { costPerRequest: number; requests: number; type: "requests" }
              | {
                  computeType?: string;
                  costPerMs: number;
                  durationMs: number;
                  type: "compute";
                }
              | {
                  bytes: number;
                  costPerByteSecond: number;
                  durationSeconds: number;
                  type: "storage";
                }
              | {
                  bytesInCost?: number;
                  bytesOutCost?: number;
                  type: "bandwidth";
                }
              | {
                  costPerUnit: number;
                  type: "units";
                  unitType: string;
                  units: number;
                }
              | {
                  effectiveRate: number;
                  quantity: number;
                  tierApplied: string;
                  type: "tiered";
                }
              | {
                  components: Array<{
                    name: string;
                    quantity: number;
                    totalCost: number;
                    unitCost: number;
                  }>;
                  type: "composite";
                }
              | { data: any; type: "custom" };
            currency: string;
            markupMultiplier?: number;
          };
          messageId: string;
          providerId: string;
          threadId: string;
          timestamp: number;
          toolId: string;
          usage:
            | { creditType?: string; credits: number; type: "credits" }
            | {
                cacheReadTokens?: number;
                cacheWriteTokens?: number;
                inputTokens: number;
                outputTokens: number;
                reasoningTokens?: number;
                type: "tokens";
              }
            | { requestType?: string; requests: number; type: "requests" }
            | {
                computeType?: string;
                durationMs: number;
                tier?: string;
                type: "compute";
              }
            | {
                bytes: number;
                durationSeconds?: number;
                storageClass?: string;
                type: "storage";
              }
            | {
                bytesIn?: number;
                bytesOut?: number;
                region?: string;
                type: "bandwidth";
              }
            | {
                metadata?: Record<string, any>;
                type: "units";
                unitType: string;
                units: number;
              }
            | {
                quantity: number;
                tierName?: string;
                type: "tiered";
                unitType: string;
              }
            | {
                components: Array<{
                  cost?: number;
                  name: string;
                  quantity: number;
                  unitType: string;
                }>;
                type: "composite";
              }
            | { data: any; description?: string; type: "custom" };
          userId?: string;
        }>
      >;
      getToolCostsByUser: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          _creationTime: number;
          _id: string;
          cost: {
            amount: number;
            breakdown?:
              | { costPerCredit: number; credits: number; type: "credits" }
              | {
                  cacheReadTokensCost?: number;
                  cacheWriteTokensCost?: number;
                  inputTokensCost?: number;
                  outputTokensCost?: number;
                  reasoningTokensCost?: number;
                  type: "tokens";
                }
              | { costPerRequest: number; requests: number; type: "requests" }
              | {
                  computeType?: string;
                  costPerMs: number;
                  durationMs: number;
                  type: "compute";
                }
              | {
                  bytes: number;
                  costPerByteSecond: number;
                  durationSeconds: number;
                  type: "storage";
                }
              | {
                  bytesInCost?: number;
                  bytesOutCost?: number;
                  type: "bandwidth";
                }
              | {
                  costPerUnit: number;
                  type: "units";
                  unitType: string;
                  units: number;
                }
              | {
                  effectiveRate: number;
                  quantity: number;
                  tierApplied: string;
                  type: "tiered";
                }
              | {
                  components: Array<{
                    name: string;
                    quantity: number;
                    totalCost: number;
                    unitCost: number;
                  }>;
                  type: "composite";
                }
              | { data: any; type: "custom" };
            currency: string;
          };
          costForUser: {
            amount: number;
            breakdown?:
              | { costPerCredit: number; credits: number; type: "credits" }
              | {
                  cacheReadTokensCost?: number;
                  cacheWriteTokensCost?: number;
                  inputTokensCost?: number;
                  outputTokensCost?: number;
                  reasoningTokensCost?: number;
                  type: "tokens";
                }
              | { costPerRequest: number; requests: number; type: "requests" }
              | {
                  computeType?: string;
                  costPerMs: number;
                  durationMs: number;
                  type: "compute";
                }
              | {
                  bytes: number;
                  costPerByteSecond: number;
                  durationSeconds: number;
                  type: "storage";
                }
              | {
                  bytesInCost?: number;
                  bytesOutCost?: number;
                  type: "bandwidth";
                }
              | {
                  costPerUnit: number;
                  type: "units";
                  unitType: string;
                  units: number;
                }
              | {
                  effectiveRate: number;
                  quantity: number;
                  tierApplied: string;
                  type: "tiered";
                }
              | {
                  components: Array<{
                    name: string;
                    quantity: number;
                    totalCost: number;
                    unitCost: number;
                  }>;
                  type: "composite";
                }
              | { data: any; type: "custom" };
            currency: string;
            markupMultiplier?: number;
          };
          messageId: string;
          providerId: string;
          threadId: string;
          timestamp: number;
          toolId: string;
          usage:
            | { creditType?: string; credits: number; type: "credits" }
            | {
                cacheReadTokens?: number;
                cacheWriteTokens?: number;
                inputTokens: number;
                outputTokens: number;
                reasoningTokens?: number;
                type: "tokens";
              }
            | { requestType?: string; requests: number; type: "requests" }
            | {
                computeType?: string;
                durationMs: number;
                tier?: string;
                type: "compute";
              }
            | {
                bytes: number;
                durationSeconds?: number;
                storageClass?: string;
                type: "storage";
              }
            | {
                bytesIn?: number;
                bytesOut?: number;
                region?: string;
                type: "bandwidth";
              }
            | {
                metadata?: Record<string, any>;
                type: "units";
                unitType: string;
                units: number;
              }
            | {
                quantity: number;
                tierName?: string;
                type: "tiered";
                unitType: string;
              }
            | {
                components: Array<{
                  cost?: number;
                  name: string;
                  quantity: number;
                  unitType: string;
                }>;
                type: "composite";
              }
            | { data: any; description?: string; type: "custom" };
          userId?: string;
        }>
      >;
      getTotalToolCostsByThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        any
      >;
      getTotalToolCostsByUser: FunctionReference<
        "query",
        "internal",
        { userId: string },
        any
      >;
    };
  };
};
