import { PROPOSAL_METADATA_LIMITS } from "@/lib/proposal-metadata";
import type {
  ProposalMetadataDraft,
  ProposalMetadataErrors,
  ProposalMetadataField,
} from "@/lib/proposal-metadata";

export function ProposalMetadataFields({
  value,
  errors,
  onChange,
}: {
  value: ProposalMetadataDraft;
  errors: ProposalMetadataErrors;
  onChange: (field: ProposalMetadataField, value: string) => void;
}) {
  return (
    <div className="mt-3 grid gap-4">
      <ProposalField
        id="proposal-title"
        label="Title"
        help="A concise decision title shown in proposal lists."
        value={value.title}
        error={errors.title}
        maxLength={PROPOSAL_METADATA_LIMITS.title}
        onChange={(next) => onChange("title", next)}
      />
      <ProposalField
        id="proposal-summary"
        label="Summary"
        help="One short explanation of the requested decision."
        value={value.summary}
        error={errors.summary}
        maxLength={PROPOSAL_METADATA_LIMITS.summary}
        multiline
        rows={2}
        onChange={(next) => onChange("summary", next)}
      />
      <ProposalField
        id="proposal-body"
        label="Body"
        help="Describe the motivation, execution plan, and expected outcome."
        value={value.body}
        error={errors.body}
        maxLength={PROPOSAL_METADATA_LIMITS.body}
        multiline
        rows={6}
        onChange={(next) => onChange("body", next)}
      />
      <ProposalField
        id="proposal-discussion-url"
        label="Discussion link"
        optional
        help="Optional HTTPS link to the public discussion."
        value={value.discussionUrl ?? ""}
        error={errors.discussionUrl}
        maxLength={PROPOSAL_METADATA_LIMITS.discussionUrl}
        inputMode="url"
        placeholder="https://forum.example.org/t/proposal"
        onChange={(next) => onChange("discussionUrl", next)}
      />
      {errors.envelope && (
        <p role="alert" className="text-xs text-rose-300">
          {errors.envelope}
        </p>
      )}
    </div>
  );
}

function ProposalField({
  id,
  label,
  optional = false,
  help,
  value,
  error,
  maxLength,
  multiline = false,
  rows,
  inputMode,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  optional?: boolean;
  help: string;
  value: string;
  error?: string;
  maxLength: number;
  multiline?: boolean;
  rows?: number;
  inputMode?: "url";
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;
  const className =
    "mt-1 box-border w-full min-w-0 rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600";
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-300">
        {label}{" "}
        <span className="text-slate-500">
          ({optional ? "optional" : "required"})
        </span>
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={rows}
          required={!optional}
          maxLength={maxLength}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className={`${className} resize-y`}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          value={value}
          required={!optional}
          maxLength={maxLength}
          inputMode={inputMode}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className={className}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <div className="mt-1 flex items-start justify-between gap-3 text-xs">
        <p id={`${id}-help`} className="text-slate-500">
          {help}
        </p>
        <span className="shrink-0 text-slate-600" aria-label={`${label} character count`}>
          {Array.from(value).length}/{maxLength}
        </span>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
