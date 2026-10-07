import React from 'react';
import { X } from 'lucide-react';
import type { JourneyCheckIssue } from './core/journeyCheck';

interface HomeJourneyCheckProps {
  issues: JourneyCheckIssue[];
  onResolve: (
    issueId: string,
    resolution: 'self_drive' | 'local_transport' | 'later',
  ) => void;
  onClose: () => void;
}

export const HomeJourneyCheck: React.FC<HomeJourneyCheckProps> = ({
  issues,
  onResolve,
  onClose,
}) => (
  <div
    className="vela-journey-check-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Journey Check"
  >
    <div className="vela-journey-check-modal">
      <button
        type="button"
        className="vela-journey-check-close"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={17} />
      </button>
      <small>JOURNEY CHECK</small>
      <h2>出发前，把行程接起来。</h2>
      <p>
        Vela 检查了各段目的地之间是否有交通衔接。没有记录的段落，可以现在指定方式，也可以稍后处理。
      </p>
      <div className="vela-journey-check-list">
        {issues.map((issue) => (
          <div className="vela-journey-check-item" key={issue.id}>
            <strong>
              {issue.from} → {issue.to}
            </strong>
            <span>这两站之间没有明确的行程衔接</span>
            <div>
              <button
                type="button"
                onClick={() => onResolve(issue.id, 'self_drive')}
              >
                🚗 自驾
              </button>
              <button
                type="button"
                onClick={() => onResolve(issue.id, 'local_transport')}
              >
                🚕 当地交通
              </button>
              <button
                type="button"
                onClick={() => onResolve(issue.id, 'later')}
              >
                ⏳ 稍后
              </button>
            </div>
          </div>
        ))}
      </div>
      {!issues.length && (
        <div className="vela-journey-check-done">
          ✓ 行程衔接已经处理好了。
        </div>
      )}
      <button
        type="button"
        className="vela-journey-check-dismiss"
        onClick={onClose}
      >
        先看看，不处理
      </button>
    </div>
  </div>
);
