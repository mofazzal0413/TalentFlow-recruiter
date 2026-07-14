import { useMemo, useState } from "react";
import type { Candidate } from "../types";
import "./CandidateTable.css";

interface CandidateTableProps {
  candidates: Candidate[];
}

type SortKey = "name" | "email" | "status";

export function CandidateTable({ candidates }: CandidateTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [ascending, setAscending] = useState(true);

  const sorted = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const left = a[sortKey] ?? "";
      const right = b[sortKey] ?? "";
      const result = String(left).localeCompare(String(right));
      return ascending ? result : -result;
    });
  }, [candidates, sortKey, ascending]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setAscending(!ascending);
      return;
    }
    setSortKey(key);
    setAscending(true);
  }

  return (
    <div className="candidate-cards-wrap">
      <div className="candidate-cards-toolbar">
        <span className="section-label">Sort by</span>
        <div className="candidate-sort-buttons">
          {(["name", "email", "status"] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`candidate-sort-btn ${sortKey === key ? "candidate-sort-btn--active" : ""}`}
              onClick={() => toggleSort(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
              {sortKey === key ? (ascending ? " ↑" : " ↓") : ""}
            </button>
          ))}
        </div>
      </div>

      <ul className="candidate-cards">
        {sorted.map((candidate, index) => (
          <li
            key={candidate.id}
            className="candidate-card"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="candidate-card-main">
              <span className="candidate-card-name">{candidate.name}</span>
              <span className="badge badge-open">{candidate.status}</span>
            </div>
            <span className="candidate-card-email">{candidate.email}</span>
            {candidate.tags && candidate.tags.length > 0 && (
              <div className="candidate-card-tags">
                {candidate.tags.map((tag) => (
                  <span key={tag} className="candidate-card-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
