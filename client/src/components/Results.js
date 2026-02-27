import React from 'react';
import './Results.css';

function getRatingColor(score) {
  if (score >= 8) return '#33cc33';
  if (score >= 5) return '#ffcc00';
  if (score >= 3) return '#ff9800';
  return '#e94560';
}

function Results({ results, ratings }) {
  if (!results) {
    return (
      <div className="results">
        <h2>Round Over</h2>
        <p className="no-votes">No votes were cast this round.</p>
      </div>
    );
  }

  const { winners, scores } = results;

  // Sort scoreboard descending
  const scoreboard = Object.entries(scores)
    .sort(([, a], [, b]) => b.score - a.score);

  const ratingEntries = Object.entries(ratings || {});

  return (
    <div className="results">
      <h2>Round Results</h2>

      {winners && winners.length > 0 && (
        <div className="winner-section">
          <div className="trophy">&#127942;</div>
          <h3>{winners.length === 1 ? 'Round Winner!' : "It's a Tie!"}</h3>
          <div className="winner-cards">
            {winners.map((w) => (
              <div key={w.socketId} className="winner-card">
                <div
                  className="winner-avatar"
                  style={{ backgroundColor: w.avatar?.color || '#444' }}
                >
                  <span className="winner-avatar-emoji">
                    {w.avatar?.emoji || '\u{1F464}'}
                  </span>
                </div>
                <span className="winner-name">{w.username}</span>
                <span className="winner-votes">
                  {w.votes} vote{w.votes !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ratingEntries.length > 0 && (
        <div className="ratings-section">
          <h3>Drawing Ratings</h3>
          <div className="ratings-grid">
            {ratingEntries
              .sort(([, a], [, b]) => b.score - a.score)
              .map(([id, rating]) => (
                <div key={id} className="rating-card">
                  <div className="rating-header">
                    <span className="rating-player">{rating.username}</span>
                    <span
                      className="rating-score"
                      style={{ color: getRatingColor(rating.score) }}
                    >
                      {rating.score}/10
                    </span>
                  </div>
                  <div className="rating-label" style={{ color: getRatingColor(rating.score) }}>
                    {rating.label}
                  </div>
                  <div className="rating-breakdown">
                    <div className="breakdown-row">
                      <span>Effort</span>
                      <div className="breakdown-bar">
                        <div
                          className="breakdown-fill"
                          style={{ width: `${(rating.breakdown.effort / 10) * 100}%`, background: getRatingColor(rating.breakdown.effort) }}
                        />
                      </div>
                    </div>
                    <div className="breakdown-row">
                      <span>Coverage</span>
                      <div className="breakdown-bar">
                        <div
                          className="breakdown-fill"
                          style={{ width: `${(rating.breakdown.coverage / 10) * 100}%`, background: getRatingColor(rating.breakdown.coverage) }}
                        />
                      </div>
                    </div>
                    <div className="breakdown-row">
                      <span>Colors</span>
                      <div className="breakdown-bar">
                        <div
                          className="breakdown-fill"
                          style={{ width: `${(rating.breakdown.colorVariety / 10) * 100}%`, background: getRatingColor(rating.breakdown.colorVariety) }}
                        />
                      </div>
                    </div>
                    <div className="breakdown-row">
                      <span>Detail</span>
                      <div className="breakdown-bar">
                        <div
                          className="breakdown-fill"
                          style={{ width: `${(rating.breakdown.detail / 10) * 100}%`, background: getRatingColor(rating.breakdown.detail) }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="rating-bonus">+{Math.round(rating.score * 10)} pts</div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="scoreboard">
        <h3>Scoreboard</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {scoreboard.map(([, player], i) => (
              <tr key={player.username + i} className={i === 0 ? 'first-place' : ''}>
                <td>{i + 1}</td>
                <td>
                  <span
                    className="scoreboard-avatar"
                    style={{ backgroundColor: player.avatar?.color || '#444' }}
                  >
                    {player.avatar?.emoji || ''}
                  </span>
                  {player.username}
                </td>
                <td>{player.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Results;
