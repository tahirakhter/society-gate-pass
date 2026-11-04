"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { authApi, EntryLogRecord, VisitTokenRecord } from "@/lib/api";
import { mapTokenStatus, mapVisitTokenToVisitorPass, VisitorPass } from "@/lib/visit-pass-mapper";
import { formatAgentIntent, preserveConversationId } from "@/lib/ai-assistant-state";

const ownerExamplePrompt = "Create pass for Ahmed tomorrow, show my latest pass, or deactivate it";
const adminExamplePrompt = "Show visitors from last week, or show entry logs for today";
const RESULTS_PER_PAGE = 5;

export function AIVisitorPassCard({
  mode = "owner",
  onPassCreated,
}: {
  mode?: "owner" | "admin";
  onPassCreated?: (pass: VisitorPass) => void;
}) {
  const [details, setDetails] = useState("");
  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantMessageTone, setAssistantMessageTone] = useState<"success" | "error">("success");
  const [agentIntent, setAgentIntent] = useState("");
  const [searchResults, setSearchResults] = useState<VisitTokenRecord[]>([]);
  const [passDetails, setPassDetails] = useState<VisitTokenRecord | null>(null);
  const [entryLogResults, setEntryLogResults] = useState<EntryLogRecord[]>([]);
  const [resultsPage, setResultsPage] = useState(1);
  const [conversationId, setConversationId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    const message = details.trim();

    if (!message || sending) {
      return;
    }

    setSending(true);
    setError("");
    setAssistantMessage("");
    setAgentIntent("");
    setSearchResults([]);
    setPassDetails(null);
    setEntryLogResults([]);
    setResultsPage(1);

    try {
      const result = await authApi.sendAiAgent({
        message,
        conversationId: conversationId || undefined,
      });

      setAgentIntent(result.action);

      if (result.status === "ACTION_NOT_ALLOWED") {
        setConversationId(result.conversationId || "");
        setAssistantMessage(result.message);
        setAssistantMessageTone("error");
        setDetails("");
        return;
      }

      if (result.agentIntent === "SEARCH_VISITORS") {
        if (result.status === "HOUSE_NOT_FOUND") {
          setAssistantMessage(result.message || "House was not found.");
          setAssistantMessageTone("error");
          setDetails("");
          return;
        }

        setSearchResults(result.data || []);
        setConversationId(result.conversationId || "");
        setAssistantMessage(`Found ${result.count || 0} visitor records.`);
        setAssistantMessageTone("success");
        setDetails("");
        return;
      }

      if (result.agentIntent === "ENTRY_LOGS") {
        setEntryLogResults(result.data || []);
        setConversationId(result.conversationId || "");
        setAssistantMessage(`Found ${result.count || 0} entry log records.`);
        setAssistantMessageTone("success");
        setDetails("");
        return;
      }

      if (result.agentIntent === "SECURITY_ANALYTICS") {
        setConversationId(result.conversationId || "");
        setAssistantMessage(
          result.summary || result.message || "Security analytics completed.",
        );
        setAssistantMessageTone(result.status === "COMPLETED" ? "success" : "error");
        setDetails("");
        return;
      }

      if (result.agentIntent === "GET_WEATHER") {
        setConversationId(result.conversationId || "");
        setAssistantMessage(result.message);
        setAssistantMessageTone(result.status === "COMPLETED" ? "success" : "error");
        setDetails("");
        return;
      }

      if (result.agentIntent === "CHECK_PASS_STATUS" || result.agentIntent === "SHOW_PASS_DETAILS") {
        setConversationId(result.conversationId || "");
        setAssistantMessage(result.message);
        setAssistantMessageTone(result.status === "COMPLETED" ? "success" : "error");
        setPassDetails(result.pass || null);
        setDetails("");
        return;
      }

      if (result.agentIntent === "UNKNOWN") {
        setConversationId(
          preserveConversationId(conversationId, result.conversationId),
        );
        setAssistantMessage(result.message);
        setAssistantMessageTone("error");
        return;
      }

      if (result.agentIntent === "DEACTIVATE_PASS") {
        setConversationId(result.conversationId || "");
        setAssistantMessage(result.message);
        setAssistantMessageTone(result.status === "COMPLETED" ? "success" : "error");
        if (result.gatePass) {
          onPassCreated?.(mapVisitTokenToVisitorPass(result.gatePass));
        }
        setDetails("");
        return;
      }

      setAssistantMessage(result.message);
      setAssistantMessageTone(result.status === "COMPLETED" ? "success" : "error");

      if (result.status === "COMPLETED" && result.gatePass) {
        onPassCreated?.(mapVisitTokenToVisitorPass(result.gatePass));
        setConversationId(result.conversationId);
        setDetails("");
      } else {
        setConversationId(result.conversationId);
        setDetails("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run AI assistant");
      setAssistantMessage("");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-white p-3 shadow-soft">
      <label htmlFor="ai-pass-details" className="sr-only">
        AI assistant message
      </label>
      <textarea
        id="ai-pass-details"
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        rows={4}
        placeholder={mode === "admin" ? adminExamplePrompt : ownerExamplePrompt}
        className="min-h-28 w-full resize-none rounded-lg border border-border bg-white px-3 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-[#9ca3af] focus:border-[#9ca3af]"
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={!details.trim() || sending}
        className="mt-3 h-10 w-full rounded-lg bg-blue text-sm font-medium text-white transition hover:bg-[#374151] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {sending ? "Thinking..." : conversationId ? "Continue assistant" : "Send to AI assistant"}
      </button>

      {agentIntent ? (
        <p className="mt-3 text-xs font-bold uppercase tracking-normal text-muted">
          Action: {formatAgentIntent(agentIntent)}
        </p>
      ) : null}

      {assistantMessage ? (
        <p
          className={`mt-3 rounded-lg px-4 py-3 text-sm font-semibold ${
            assistantMessageTone === "success"
              ? "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
              : "border border-danger/20 bg-[#FEF2F2] text-danger"
          }`}
        >
          {assistantMessage}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-danger/20 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {searchResults.length > 0 ? (
        <div className="mt-3 space-y-2">
          {searchResults
            .slice((resultsPage - 1) * RESULTS_PER_PAGE, resultsPage * RESULTS_PER_PAGE)
            .map((result) => (
              <VisitorResultCard key={result.id} result={result} />
            ))}
          <ResultPagination page={resultsPage} total={searchResults.length} onPageChange={setResultsPage} />
        </div>
      ) : null}

      {passDetails ? (
        <div className="mt-3">
          <VisitorResultCard result={passDetails} />
        </div>
      ) : null}

      {entryLogResults.length > 0 ? (
        <div className="mt-3 space-y-2">
          {entryLogResults
            .slice((resultsPage - 1) * RESULTS_PER_PAGE, resultsPage * RESULTS_PER_PAGE)
            .map((log) => (
              <EntryLogResultCard key={log.id} log={log} />
            ))}
          <ResultPagination page={resultsPage} total={entryLogResults.length} onPageChange={setResultsPage} />
        </div>
      ) : null}
    </section>
  );
}

function VisitorResultCard({ result }: { result: VisitTokenRecord }) {
  return (
    <article className="rounded-lg border border-border bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{result.visitor.fullName}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">
            {result.visitor.cnic} • {result.carNumber}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={mapTokenStatus(result.status)} />
          <p className="text-xs font-bold text-blue">{formatDate(result.createdAt)}</p>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
        <span>
          {result.house.houseNumber}
          {result.house.block ? ` • Block ${result.house.block}` : ""}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-bold ${
            isExpired(result.expiresAt) ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#DCFCE7] text-[#166534]"
          }`}
        >
          {isExpired(result.expiresAt) ? "Expired" : "Not expired"}
        </span>
        <span>Expires {formatDate(result.expiresAt)}</span>
      </div>
    </article>
  );
}

function EntryLogResultCard({ log }: { log: EntryLogRecord }) {
  return (
    <article className="rounded-lg border border-border bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {log.token?.visitor.fullName || "Unknown visitor"}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-muted">
            {log.token?.house.houseNumber || "No house"} • Scanned by {log.scanner.fullName}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              log.scanStatus === "SUCCESS" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#991B1B]"
            }`}
          >
            {log.scanStatus}
          </span>
          <p className="text-xs font-bold text-blue">{formatDate(log.scannedAt)}</p>
        </div>
      </div>
      {log.failureReason ? <p className="mt-1 text-xs font-semibold text-danger">{log.failureReason}</p> : null}
    </article>
  );
}

function ResultPagination({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const maxPage = Math.ceil(total / RESULTS_PER_PAGE);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-soft px-3 py-2">
      <p className="text-xs font-bold text-muted">
        {(page - 1) * RESULTS_PER_PAGE + 1}-{Math.min(page * RESULTS_PER_PAGE, total)} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-8 rounded-md border border-border bg-white px-3 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(maxPage, page + 1))}
          disabled={page === maxPage}
          className="h-8 rounded-md border border-border bg-white px-3 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function isExpired(dateValue: string) {
  return new Date(dateValue) < new Date();
}
