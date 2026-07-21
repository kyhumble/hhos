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

  return (
    <div
      className={`ui-card border-l-4 border-l-brand-500 p-4 shadow-soft transition hover:shadow-card ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
              AI Suggestion
            </span>
            <Badge tone={confidenceTone(conf)}>{pct}% confidence</Badge>
            {suggestion.targetPath ? (
              <span className="ui-chip">{suggestion.targetPath}</span>
            ) : null}
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
            className="text-2xs font-medium text-brand-700 hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide rationale' : 'Why this suggestion?'}
          </button>
          {expanded ? (
            <ul className="mt-1.5 space-y-1 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
              {suggestion.provenance.factors?.map((f, i) => (
                <li key={`f-${i}`}>• {f}</li>
              ))}
              {suggestion.provenance.evidence?.map((e, i) => (
                <li key={`e-${i}`}>• {e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!editing ? (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onAccept?.(suggestion)}
              disabled={suggestion.status !== 'pending'}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditValue(suggestion.content);
                setEditing(true);
              }}
              disabled={suggestion.status !== 'pending'}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReject?.(suggestion)}
              disabled={suggestion.status !== 'pending'}
            >
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
            >
              Save edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        )}
        {suggestion.status !== 'pending' ? (
          <Badge
            tone={
              suggestion.status === 'accepted' || suggestion.status === 'edited'
                ? 'success'
                : 'neutral'
            }
          >
            {suggestion.status}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

export default SuggestionCard;
