/** Renders the small subset of markdown the LLM actually produces in answers
 * (bold via **text**, numbered/bulleted lines) — not a full markdown parser,
 * just enough that responses don't show literal asterisks in the chat UI. */
export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {renderInlineBold(line)}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function renderInlineBold(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}
