/* Lumina / HHOS — HITL AI Suggestion Card
 * Calm, transparent presentation of AI assistance.
 * Always requires explicit human action. Never auto-applies clinical content.
 */

'use client';

import type { AISuggestion } from '@hhos/shared';
import { useState } from 'react';
import { Badge, Button } from './ui';

type Props = {
  suggestion: AISuggestion;
  onAccept?: (s: AISuggestion) => void;
  onEdit?: (s: AISuggestion, newContent: string) => void;
  onReject?: (s: AISuggestion) => void;
  className?: string;
};

function confidenceTone(c: number): 'success' | 'brand' | 'warn' | 'danger' {
  if (c >= 0.85) return 'success';
  if (c >= 0.7) return 'brand';
  if (c >= 0.5) return 'warn';
  return 'danger';
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onEdit,
  onReject,
  className = '',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(suggestion.content);

  const conf = suggestion.provenance.confidence;
  const pct = Math.round(conf * 100);
  const done = suggestion.status !== 'pending';

  if (done) {
    return (
      <div
        className={`rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3 shadow-soft ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink-700">{suggestion.title}</span>
              <Badge
                tone={
                  suggestion.status === 'accepted' || suggestion.status === 'edited'
                    ? 'success'
                    : 'neutral'
                }
              >
                {suggestion.status}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-ink-500">
              {suggestion.humanEdit || suggestion.content}
            </p>
          </div>
          <span className="text-2xs text-ink-400">{pct}% conf</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-teal-100 bg-white p-4 shadow-calm ring-1 ring-teal-50/80 transition hover:shadow-card ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wide text-teal-700/80">
              AI Suggestion
            </span>
            <Badge tone={confidenceTone(conf)}>{pct}% confidence</Badge>
            {suggestion.targetPath ? (
              <span className="ui-chip font-mono">{suggestion.targetPath}</span>
            ) : null}
            <span className="text-2xs capitalize text-ink-400">
              {suggestion.type.replace(/_/g, ' ')}
            </span>
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-ink-900">{suggestion.title}</h3>
          {!editing ? (
            <p className="mt-1.5 text-sm leading-relaxed text-ink-700 whitespace-pre-wrap">
              {suggestion.content}
            </p>
          ) : (
            <textarea
              className="ui-input mt-2 min-h-[5rem] w-full"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
            />
          )}
        </div>
      </div>

      {(suggestion.provenance.factors?.length || suggestion.provenance.evidence?.length) ? (
        <div className="mt-3">
          <button
            type="button"
            className="text-2xs font-medium text-teal-700 hover:text-teal-800 hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide rationale' : 'Why this suggestion?'}
          </button>
          {expanded ? (
            <ul className="mt-1.5 space-y-1 rounded-lg bg-teal-50/60 px-3 py-2 text-xs text-ink-600 ring-1 ring-teal-100/80">
              {suggestion.provenance.factors?.map((f, i) => (
                <li key={`f-${i}`}>• {f}</li>
              ))}
              {suggestion.provenance.evidence?.map((e, i) => (
                <li key={`e-${i}`}>• {e}</li>
              ))}
              <li className="pt-0.5 text-ink-400">model {suggestion.provenance.modelVersion}</li>
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
        {!editing ? (
          <>
            <Button size="sm" variant="primary" onClick={() => onAccept?.(suggestion)}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditValue(suggestion.content);
                setEditing(true);
              }}
            >
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onReject?.(suggestion)}>
              Reject
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                onEdit?.(suggestion, editValue);
                setEditing(false);
              }}
              disabled={!editValue.trim()}
            >
              Save edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default SuggestionCard;
