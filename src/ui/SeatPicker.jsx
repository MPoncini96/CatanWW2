import { useState } from 'react';
import { PLAYERS } from '../game/players.js';

/**
 * Taking a seat.
 *
 * No password yet — you say who you are and the table believes you. A seat
 * already held cannot be taken, which stops two people being Germany by
 * accident, but it is not security and is not pretending to be.
 */
export function SeatPicker({ seats, onClaim, error }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(null);
  const taken = new Map((seats ?? []).map((s) => [s.power, s]));

  const claim = async (power) => {
    setBusy(power);
    try {
      await onClaim(power, name.trim());
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="gate">
      <div className="gate__card">
        <h2>Which nation are you playing?</h2>
        <p className="gate__note">
          One game, eight seats. There are no passwords yet, so pick the one you agreed on.
        </p>

        <label className="gate__name">
          <span>Your name</span>
          <input
            type="text"
            value={name}
            maxLength={24}
            placeholder="optional"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="gate__seats">
          {PLAYERS.map((player) => {
            const seat = taken.get(player.id);
            const isTaken = seat?.taken;
            return (
              <button
                key={player.id}
                type="button"
                className={`gate__seat${isTaken ? ' is-taken' : ''}`}
                disabled={isTaken || busy !== null}
                onClick={() => claim(player.id)}
              >
                <i style={{ background: player.color }} />
                <span className="gate__seatName">{player.name}</span>
                <em>{isTaken ? (seat.name ? `taken · ${seat.name}` : 'taken') : 'open'}</em>
              </button>
            );
          })}
        </div>

        {error && <p className="gate__error">{error}</p>}
      </div>
    </div>
  );
}
