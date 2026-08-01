/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agentActions from "../agentActions.js";
import type * as agentActions_mutations_approveAndExecute from "../agentActions/mutations/approveAndExecute.js";
import type * as agentActions_mutations_complete from "../agentActions/mutations/complete.js";
import type * as agentActions_mutations_decide from "../agentActions/mutations/decide.js";
import type * as agentActions_mutations_propose from "../agentActions/mutations/propose.js";
import type * as agentActions_mutations_updateArgs from "../agentActions/mutations/updateArgs.js";
import type * as agentActions_queries_get from "../agentActions/queries/get.js";
import type * as agentActions_queries_list from "../agentActions/queries/list.js";
import type * as agentActions_queries_recent from "../agentActions/queries/recent.js";
import type * as agentChats from "../agentChats.js";
import type * as agentChats_mutations_append from "../agentChats/mutations/append.js";
import type * as agentChats_mutations_appendActionUpdate from "../agentChats/mutations/appendActionUpdate.js";
import type * as agentChats_mutations_remove from "../agentChats/mutations/remove.js";
import type * as agentChats_queries_get from "../agentChats/queries/get.js";
import type * as agentChats_queries_getForOwner from "../agentChats/queries/getForOwner.js";
import type * as agentChats_queries_list from "../agentChats/queries/list.js";
import type * as agentLogs from "../agentLogs.js";
import type * as agentPrompts from "../agentPrompts.js";
import type * as agentPrompts_mutations_activate from "../agentPrompts/mutations/activate.js";
import type * as agentPrompts_mutations_create from "../agentPrompts/mutations/create.js";
import type * as agentPrompts_queries_getActive from "../agentPrompts/queries/getActive.js";
import type * as agentPrompts_queries_list from "../agentPrompts/queries/list.js";
import type * as agentRuns from "../agentRuns.js";
import type * as agentRuns_mutations_begin from "../agentRuns/mutations/begin.js";
import type * as agentRuns_mutations_cancel from "../agentRuns/mutations/cancel.js";
import type * as agentRuns_mutations_finish from "../agentRuns/mutations/finish.js";
import type * as agentRuns_queries_status from "../agentRuns/queries/status.js";
import type * as aiCredentials from "../aiCredentials.js";
import type * as aiCredentials_actions_setKey from "../aiCredentials/actions/setKey.js";
import type * as aiCredentials_mutations_upsert from "../aiCredentials/mutations/upsert.js";
import type * as aiCredentials_providers from "../aiCredentials/providers.js";
import type * as aiCredentials_queries_getForOwner from "../aiCredentials/queries/getForOwner.js";
import type * as aiCredentials_queries_getStatus from "../aiCredentials/queries/getStatus.js";
import type * as audiobook from "../audiobook.js";
import type * as bookAudio from "../bookAudio.js";
import type * as bookAudio_mutations_replace from "../bookAudio/mutations/replace.js";
import type * as bookAudio_mutations_setStatus from "../bookAudio/mutations/setStatus.js";
import type * as bookAudio_queries_listForBook from "../bookAudio/queries/listForBook.js";
import type * as bookBlocks from "../bookBlocks.js";
import type * as bookBlocks_mutations_setBlocks from "../bookBlocks/mutations/setBlocks.js";
import type * as bookBlocks_queries_listByBook from "../bookBlocks/queries/listByBook.js";
import type * as bookVariants from "../bookVariants.js";
import type * as bookVariants_mutations_create from "../bookVariants/mutations/create.js";
import type * as bookVariants_mutations_update from "../bookVariants/mutations/update.js";
import type * as bookVariants_queries_list from "../bookVariants/queries/list.js";
import type * as books from "../books.js";
import type * as books_mutations_create from "../books/mutations/create.js";
import type * as books_mutations_setStatus from "../books/mutations/setStatus.js";
import type * as books_mutations_update from "../books/mutations/update.js";
import type * as books_queries_catalog from "../books/queries/catalog.js";
import type * as books_queries_getAnyBySlug from "../books/queries/getAnyBySlug.js";
import type * as books_queries_getById from "../books/queries/getById.js";
import type * as books_queries_getBySlug from "../books/queries/getBySlug.js";
import type * as books_queries_listAll from "../books/queries/listAll.js";
import type * as books_queries_listLive from "../books/queries/listLive.js";
import type * as books_queries_salesCounts from "../books/queries/salesCounts.js";
import type * as books_queries_salesSummary from "../books/queries/salesSummary.js";
import type * as categories from "../categories.js";
import type * as categories_mutations_create from "../categories/mutations/create.js";
import type * as categories_queries_list from "../categories/queries/list.js";
import type * as dashboard from "../dashboard.js";
import type * as entitlements from "../entitlements.js";
import type * as entitlements_lib from "../entitlements/lib.js";
import type * as entitlements_mutations_grant from "../entitlements/mutations/grant.js";
import type * as entitlements_mutations_revoke from "../entitlements/mutations/revoke.js";
import type * as entitlements_queries_isOwned from "../entitlements/queries/isOwned.js";
import type * as entitlements_queries_listForUser from "../entitlements/queries/listForUser.js";
import type * as fxRates from "../fxRates.js";
import type * as fxRates_mutations_remove from "../fxRates/mutations/remove.js";
import type * as fxRates_mutations_upsert from "../fxRates/mutations/upsert.js";
import type * as fxRates_queries_list from "../fxRates/queries/list.js";
import type * as http from "../http.js";
import type * as imageMutations from "../imageMutations.js";
import type * as images from "../images.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_books from "../lib/books.js";
import type * as lib_firecrawl from "../lib/firecrawl.js";
import type * as lib_openrouter from "../lib/openrouter.js";
import type * as lib_paystack_client from "../lib/paystack/client.js";
import type * as lib_paystack_verify from "../lib/paystack/verify.js";
import type * as lib_sales from "../lib/sales.js";
import type * as lib_secrets from "../lib/secrets.js";
import type * as openrouterUsage from "../openrouterUsage.js";
import type * as payments from "../payments.js";
import type * as payments_actions_startCheckout from "../payments/actions/startCheckout.js";
import type * as payments_actions_syncFromGateway from "../payments/actions/syncFromGateway.js";
import type * as payments_mutations_createPendingOrder from "../payments/mutations/createPendingOrder.js";
import type * as payments_mutations_reconcile from "../payments/mutations/reconcile.js";
import type * as payments_mutations_refund from "../payments/mutations/refund.js";
import type * as payments_queries_orderStatus from "../payments/queries/orderStatus.js";
import type * as promoteOwner from "../promoteOwner.js";
import type * as seed from "../seed.js";
import type * as social from "../social.js";
import type * as socialActions from "../socialActions.js";
import type * as storeSettings from "../storeSettings.js";
import type * as storeSettings_mutations_setBaseCurrency from "../storeSettings/mutations/setBaseCurrency.js";
import type * as storeSettings_queries_get from "../storeSettings/queries/get.js";
import type * as translate from "../translate.js";
import type * as users from "../users.js";
import type * as users_mutations_upsertFromClerk from "../users/mutations/upsertFromClerk.js";
import type * as users_queries_getViewer from "../users/queries/getViewer.js";
import type * as variantBlocks from "../variantBlocks.js";
import type * as variantBlocks_mutations_setBlocks from "../variantBlocks/mutations/setBlocks.js";
import type * as variantBlocks_queries_listByVariant from "../variantBlocks/queries/listByVariant.js";
import type * as voices from "../voices.js";
import type * as voices_actions_sync from "../voices/actions/sync.js";
import type * as voices_mutations_replaceAll from "../voices/mutations/replaceAll.js";
import type * as voices_queries_list from "../voices/queries/list.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agentActions: typeof agentActions;
  "agentActions/mutations/approveAndExecute": typeof agentActions_mutations_approveAndExecute;
  "agentActions/mutations/complete": typeof agentActions_mutations_complete;
  "agentActions/mutations/decide": typeof agentActions_mutations_decide;
  "agentActions/mutations/propose": typeof agentActions_mutations_propose;
  "agentActions/mutations/updateArgs": typeof agentActions_mutations_updateArgs;
  "agentActions/queries/get": typeof agentActions_queries_get;
  "agentActions/queries/list": typeof agentActions_queries_list;
  "agentActions/queries/recent": typeof agentActions_queries_recent;
  agentChats: typeof agentChats;
  "agentChats/mutations/append": typeof agentChats_mutations_append;
  "agentChats/mutations/appendActionUpdate": typeof agentChats_mutations_appendActionUpdate;
  "agentChats/mutations/remove": typeof agentChats_mutations_remove;
  "agentChats/queries/get": typeof agentChats_queries_get;
  "agentChats/queries/getForOwner": typeof agentChats_queries_getForOwner;
  "agentChats/queries/list": typeof agentChats_queries_list;
  agentLogs: typeof agentLogs;
  agentPrompts: typeof agentPrompts;
  "agentPrompts/mutations/activate": typeof agentPrompts_mutations_activate;
  "agentPrompts/mutations/create": typeof agentPrompts_mutations_create;
  "agentPrompts/queries/getActive": typeof agentPrompts_queries_getActive;
  "agentPrompts/queries/list": typeof agentPrompts_queries_list;
  agentRuns: typeof agentRuns;
  "agentRuns/mutations/begin": typeof agentRuns_mutations_begin;
  "agentRuns/mutations/cancel": typeof agentRuns_mutations_cancel;
  "agentRuns/mutations/finish": typeof agentRuns_mutations_finish;
  "agentRuns/queries/status": typeof agentRuns_queries_status;
  aiCredentials: typeof aiCredentials;
  "aiCredentials/actions/setKey": typeof aiCredentials_actions_setKey;
  "aiCredentials/mutations/upsert": typeof aiCredentials_mutations_upsert;
  "aiCredentials/providers": typeof aiCredentials_providers;
  "aiCredentials/queries/getForOwner": typeof aiCredentials_queries_getForOwner;
  "aiCredentials/queries/getStatus": typeof aiCredentials_queries_getStatus;
  audiobook: typeof audiobook;
  bookAudio: typeof bookAudio;
  "bookAudio/mutations/replace": typeof bookAudio_mutations_replace;
  "bookAudio/mutations/setStatus": typeof bookAudio_mutations_setStatus;
  "bookAudio/queries/listForBook": typeof bookAudio_queries_listForBook;
  bookBlocks: typeof bookBlocks;
  "bookBlocks/mutations/setBlocks": typeof bookBlocks_mutations_setBlocks;
  "bookBlocks/queries/listByBook": typeof bookBlocks_queries_listByBook;
  bookVariants: typeof bookVariants;
  "bookVariants/mutations/create": typeof bookVariants_mutations_create;
  "bookVariants/mutations/update": typeof bookVariants_mutations_update;
  "bookVariants/queries/list": typeof bookVariants_queries_list;
  books: typeof books;
  "books/mutations/create": typeof books_mutations_create;
  "books/mutations/setStatus": typeof books_mutations_setStatus;
  "books/mutations/update": typeof books_mutations_update;
  "books/queries/catalog": typeof books_queries_catalog;
  "books/queries/getAnyBySlug": typeof books_queries_getAnyBySlug;
  "books/queries/getById": typeof books_queries_getById;
  "books/queries/getBySlug": typeof books_queries_getBySlug;
  "books/queries/listAll": typeof books_queries_listAll;
  "books/queries/listLive": typeof books_queries_listLive;
  "books/queries/salesCounts": typeof books_queries_salesCounts;
  "books/queries/salesSummary": typeof books_queries_salesSummary;
  categories: typeof categories;
  "categories/mutations/create": typeof categories_mutations_create;
  "categories/queries/list": typeof categories_queries_list;
  dashboard: typeof dashboard;
  entitlements: typeof entitlements;
  "entitlements/lib": typeof entitlements_lib;
  "entitlements/mutations/grant": typeof entitlements_mutations_grant;
  "entitlements/mutations/revoke": typeof entitlements_mutations_revoke;
  "entitlements/queries/isOwned": typeof entitlements_queries_isOwned;
  "entitlements/queries/listForUser": typeof entitlements_queries_listForUser;
  fxRates: typeof fxRates;
  "fxRates/mutations/remove": typeof fxRates_mutations_remove;
  "fxRates/mutations/upsert": typeof fxRates_mutations_upsert;
  "fxRates/queries/list": typeof fxRates_queries_list;
  http: typeof http;
  imageMutations: typeof imageMutations;
  images: typeof images;
  "lib/auth": typeof lib_auth;
  "lib/books": typeof lib_books;
  "lib/firecrawl": typeof lib_firecrawl;
  "lib/openrouter": typeof lib_openrouter;
  "lib/paystack/client": typeof lib_paystack_client;
  "lib/paystack/verify": typeof lib_paystack_verify;
  "lib/sales": typeof lib_sales;
  "lib/secrets": typeof lib_secrets;
  openrouterUsage: typeof openrouterUsage;
  payments: typeof payments;
  "payments/actions/startCheckout": typeof payments_actions_startCheckout;
  "payments/actions/syncFromGateway": typeof payments_actions_syncFromGateway;
  "payments/mutations/createPendingOrder": typeof payments_mutations_createPendingOrder;
  "payments/mutations/reconcile": typeof payments_mutations_reconcile;
  "payments/mutations/refund": typeof payments_mutations_refund;
  "payments/queries/orderStatus": typeof payments_queries_orderStatus;
  promoteOwner: typeof promoteOwner;
  seed: typeof seed;
  social: typeof social;
  socialActions: typeof socialActions;
  storeSettings: typeof storeSettings;
  "storeSettings/mutations/setBaseCurrency": typeof storeSettings_mutations_setBaseCurrency;
  "storeSettings/queries/get": typeof storeSettings_queries_get;
  translate: typeof translate;
  users: typeof users;
  "users/mutations/upsertFromClerk": typeof users_mutations_upsertFromClerk;
  "users/queries/getViewer": typeof users_queries_getViewer;
  variantBlocks: typeof variantBlocks;
  "variantBlocks/mutations/setBlocks": typeof variantBlocks_mutations_setBlocks;
  "variantBlocks/queries/listByVariant": typeof variantBlocks_queries_listByVariant;
  voices: typeof voices;
  "voices/actions/sync": typeof voices_actions_sync;
  "voices/mutations/replaceAll": typeof voices_mutations_replaceAll;
  "voices/queries/list": typeof voices_queries_list;
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

export declare const components: {};
