"use client";

import { useState } from "react";
import { FACE_LABELS } from "@/lib/contracts";

export function BidControls({
  currentQuantity,
  currentFace,
  hasBid,
  disabled,
  onBid,
}: {
  currentQuantity: number;
  currentFace: number;
  hasBid: boolean;
  disabled: boolean;
  onBid: (quantity: number, face: number) => void;
}) {
  const minQuantity = hasBid ? currentQuantity : 1;
  const [quantity, setQuantity] = useState(minQuantity + (hasBid ? 1 : 0) || 1);
  const [face, setFace] = useState(hasBid ? currentFace : 2);

  const valid = hasBid
    ? quantity > currentQuantity || (quantity === currentQuantity && face > currentFace)
    : quantity >= 1;

  return (
    <div className="panel rounded-xl p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Place a bid</h3>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Quantity</label>
          <input
            type="number"
            min={1}
            max={40}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-20 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Face</label>
          <select
            value={face}
            onChange={(e) => setFace(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {[1, 2, 3, 4, 5, 6].map((f) => (
              <option key={f} value={f}>
                {f} — {FACE_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => onBid(quantity, face)}
          disabled={disabled || !valid}
          className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
        >
          Bid
        </button>
      </div>
      {!valid && (
        <p className="mt-2 text-xs text-rose-400">
          Must raise the quantity, or match it with a higher face.
        </p>
      )}
    </div>
  );
}
