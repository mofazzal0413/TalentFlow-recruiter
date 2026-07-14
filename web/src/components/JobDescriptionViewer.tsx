import "./JobDescriptionViewer.css";

interface JobDescriptionViewerProps {
  description: string;
}

type DescriptionBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; intro?: string; items: string[] };

function isBulletLine(line: string): boolean {
  return /^[-•*]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[-•*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}

function parseDescription(description: string): DescriptionBlock[] {
  const blocks = description.split("\n\n").map((b) => b.trim()).filter(Boolean);
  const result: DescriptionBlock[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const bulletLines = lines.filter(isBulletLine);
    if (bulletLines.length === lines.length) {
      result.push({
        type: "list",
        items: bulletLines.map(stripBullet),
      });
      continue;
    }

    if (bulletLines.length > 0 && lines[0] && !isBulletLine(lines[0])) {
      result.push({
        type: "list",
        intro: lines[0],
        items: lines.slice(1).filter(isBulletLine).map(stripBullet),
      });
      continue;
    }

    result.push({ type: "paragraph", text: block });
  }

  return result;
}

export function JobDescriptionViewer({ description }: JobDescriptionViewerProps) {
  const blocks = parseDescription(description);

  return (
    <div className="job-description-viewer">
      <h2 className="section-label job-description-viewer__heading">Description</h2>
      <div className="job-description-viewer__body" tabIndex={0}>
        {blocks.map((block, index) => {
          if (block.type === "list") {
            return (
              <div key={index} className="job-description-viewer__block">
                {block.intro && <p>{block.intro}</p>}
                <ul>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          }
          return (
            <p key={index} className="job-description-viewer__block">
              {block.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
