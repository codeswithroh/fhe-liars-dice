export default function RulesPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-50">Rules &amp; privacy</h1>
        <p className="mt-2 text-sm text-slate-400">Casual mode. No wagers, no timers, no penalties — just the bluff.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-100">How a table plays</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
          <li>2 or more players join a table and each gets 5 dice.</li>
          <li>The host starts the game; the contract rolls everyone&apos;s dice as encrypted values.</li>
          <li>Players take turns making public bids: a quantity and a face, e.g. &quot;six 4s&quot;.</li>
          <li>Each new bid must raise the quantity, or match the quantity with a higher face.</li>
          <li>Instead of bidding, the current player can challenge the last bid.</li>
          <li>
            A challenge counts every die across every active player&apos;s hand that matches the bid&apos;s face — a
            face of <strong className="text-slate-100">1 is always wild</strong> and counts toward any bid that
            isn&apos;t itself about 1s.
          </li>
          <li>If the true count meets or beats the bid, the bid was good and the challenger is eliminated. Otherwise the bidder is eliminated and the bid was a lie.</li>
          <li>Every hand from that round is revealed so the table can see the proof, then the survivors roll fresh hands for a new round.</li>
          <li>Last player standing wins the table.</li>
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-100">What CoFHE hides</h2>
        <div className="panel rounded-xl p-5">
          <p className="text-sm leading-relaxed text-slate-300">
            Dice are generated and stored as <strong className="text-cyan-300">encrypted values</strong> by the
            smart contract itself using Fhenix CoFHE&apos;s <code className="text-cyan-300">FHE.randomEuint8()</code>.
            No plaintext die value is ever written to storage or emitted in an event while a round is active — not
            to other players, not to an indexer, and not to the contract&apos;s own operator. Only the owning
            wallet can unseal its own hand off-chain, by signing a CoFHE permit.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            When a challenge happens, the contract counts matches <strong className="text-cyan-300">homomorphically</strong>
            {" "}— entirely over encrypted values — and only ever decrypts a single boolean: was the bid&apos;s
            quantity met? The actual count is never revealed, before or after the challenge.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-100">What stays public</h2>
        <div className="panel rounded-xl p-5">
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-300">
            <li>Table membership, host, and turn order</li>
            <li>Every bid — its quantity, face, and bidder</li>
            <li>Who challenged whom, and the resulting good/lie verdict</li>
            <li>Who was eliminated, and each round&apos;s hands once revealed after that round&apos;s challenge</li>
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Known tradeoffs (MVP)</h2>
        <div className="panel rounded-xl p-5 text-sm leading-relaxed text-slate-400">
          <p>
            Die faces are derived as <code className="text-slate-300">FHE.randomEuint8() % 6 + 1</code>. Since 256
            isn&apos;t evenly divisible by 6, faces 1–4 land very slightly more often than 5–6 — a small,
            documented bias acceptable for a casual MVP.
          </p>
          <p className="mt-2">
            This is an MVP/prototype and has not been audited. Casual mode only: no wagers, ranked play, timers,
            or tournaments yet.
          </p>
        </div>
      </section>
    </div>
  );
}
