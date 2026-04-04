import { useState, useRef, useEffect } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const AVATARS = ["🐉","⚡","🌀","🔥","💀","🌊","🗡️","🛡️","👁️","🦅","🐍","🌑","⚗️","🎴","🏆","🌌","🐺","🦁","🐲","🦋"];

const DECK_SUGGESTIONS = [
  "Blue-Eyes White Dragon","Dark Magician","Eldlich","Tearlaments","Purrely",
  "Rescue-Ace","Labrynth","Snake-Eye","Fiendsmith","Branded Despia",
  "Yubel","Vanquish Soul","Melodious","Tenpai Dragon","Ryzeal",
  "Superheavy Samurai","Centur-Ion","Voiceless Voice","Swordsoul","Floowandereeze",
  "Runick","Kashtira","Spright","Ishizu Tear","Mathmech",
  "Chaos Thunder Dragon","HERO","Drytron","Virtual World","Prank-Kids",
  "Adamancipator","Ancient Warriors","Buster Blader","Crystal Beast","Cubic",
  "Danger!","Dark World","Dinosaur","Exodia","Gladiator Beast",
  "Gouki","Infernoid","Invoked","Lunalight","Madolche",
  "Marincess","Metaphys","Numeron","Orcust","Pendulum Magician",
  "Plunder Patroll","Salamangreat","Shaddoll","Sky Striker","True Draco",
  "Witch","World Chalice","Zoodiac","Nekroz","Igknight",
];

const ROUND_STRUCTURE = {
  local:    { swiss: 4,  topCut: 8,  bo: 3, label: "LOCAL",    icon: "🏠", desc: "4 round Swiss + Top 8" },
  regional: { swiss: 9,  topCut: 32, bo: 3, label: "REGIONAL", icon: "🏟️", desc: "9 round Swiss + Top 32" },
  quick:    { swiss: 0,  topCut: 0,  bo: 1, label: "QUICK",    icon: "⚡", desc: "Eliminazione diretta • Best-of-1" },
};

function generateId() { return Math.random().toString(36).slice(2,9); }

function calcStandings(players) {
  return [...players].sort((a,b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.owp !== a.owp) return b.owp - a.owp;
    return b.gwp - a.gwp;
  });
}

function computeTiebreakers(players, matches) {
  return players.map(p => {
    const opponentIds = matches
      .filter(m => m.completed && (m.p1Id === p.id || m.p2Id === p.id) && m.p2Id !== "BYE")
      .map(m => m.p1Id === p.id ? m.p2Id : m.p1Id);
    const opponents = players.filter(op => opponentIds.includes(op.id));
    const owp = opponents.length
      ? opponents.reduce((s, op) => {
          const t = op.wins + op.losses;
          return s + (t ? Math.max(op.wins / t, 1/3) : 1/3);
        }, 0) / opponents.length
      : 0;
    const totalGames = p.gameWins + p.gameLosses + p.gameDraws;
    const gwp = totalGames ? Math.max(p.gameWins / totalGames, 1/3) : 0;
    return { ...p, owp, gwp };
  });
}

function swissPair(players, pastMatches) {
  const sorted = calcStandings(players);
  const paired = new Set();
  const pairs = [];
  for (let i = 0; i < sorted.length; i++) {
    if (paired.has(sorted[i].id)) continue;
    let found = false;
    for (let j = i + 1; j < sorted.length; j++) {
      if (paired.has(sorted[j].id)) continue;
      const alreadyPlayed = pastMatches.some(
        m => (m.p1Id === sorted[i].id && m.p2Id === sorted[j].id) ||
             (m.p2Id === sorted[i].id && m.p1Id === sorted[j].id)
      );
      if (!alreadyPlayed) {
        pairs.push({ p1Id: sorted[i].id, p2Id: sorted[j].id });
        paired.add(sorted[i].id); paired.add(sorted[j].id);
        found = true; break;
      }
    }
    if (!found && !paired.has(sorted[i].id)) {
      pairs.push({ p1Id: sorted[i].id, p2Id: "BYE" });
      paired.add(sorted[i].id);
    }
  }
  return pairs;
}

function buildQuickBracket(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push({
      p1Id: shuffled[i].id,
      p2Id: i + 1 < shuffled.length ? shuffled[i+1].id : "BYE",
    });
  }
  return pairs;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState("regional");
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [phase, setPhase] = useState("swiss");
  const [champion, setChampion] = useState(null);
  const [newName, setNewName] = useState("");
  const [newDeck, setNewDeck] = useState("");
  const [newAvatar, setNewAvatar] = useState(AVATARS[0]);
  const [deckOpen, setDeckOpen] = useState(false);
  const [activeMatch, setActiveMatch] = useState(null);
  const [notif, setNotif] = useState(null);
  const [tab, setTab] = useState("matches");
  const deckRef = useRef(null);

  const cfg = ROUND_STRUCTURE[mode];
  const totalSwissRounds = cfg.swiss;
  const topCutSize = cfg.topCut;
  const bestOf = cfg.bo;

  const notify = (msg, type = "info") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3200);
  };

  useEffect(() => {
    const h = (e) => { if (deckRef.current && !deckRef.current.contains(e.target)) setDeckOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filteredDecks = DECK_SUGGESTIONS.filter(d =>
    newDeck.trim() && d.toLowerCase().includes(newDeck.toLowerCase())
  ).slice(0, 8);

  const addPlayer = () => {
    const name = newName.trim();
    const deck = newDeck.trim() || "Deck Personalizzato";
    if (!name) return;
    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      notify("Nome già in uso!", "error"); return;
    }
    setPlayers(prev => [...prev, {
      id: generateId(), name, avatar: newAvatar, deck,
      points: 0, wins: 0, losses: 0, draws: 0,
      gameWins: 0, gameLosses: 0, gameDraws: 0,
      owp: 0, gwp: 0,
    }]);
    setNewName(""); setNewDeck("");
    setNewAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    setDeckOpen(false);
  };

  const removePlayer = (id) => setPlayers(prev => prev.filter(p => p.id !== id));

  const startTournament = () => {
    if (players.length < 4) { notify("Minimo 4 giocatori!", "error"); return; }
    if (mode === "quick") {
      const pairs = buildQuickBracket(players);
      const ms = pairs.map(pair => ({
        id: generateId(), round: 1, phase: "quick",
        p1Id: pair.p1Id, p2Id: pair.p2Id,
        p1Games: 0, p2Games: 0, completed: false, winner: null,
      }));
      setMatches(ms); setCurrentRound(1); setPhase("quick");
    } else {
      const pairs = swissPair(players, []);
      const ms = pairs.map(pair => ({
        id: generateId(), round: 1, phase: "swiss",
        p1Id: pair.p1Id, p2Id: pair.p2Id,
        p1Games: 0, p2Games: 0, completed: false, winner: null,
      }));
      setMatches(ms); setCurrentRound(1); setPhase("swiss");
    }
    setScreen("tournament"); setTab("matches");
  };

  const submitResult = (matchId, result) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const isBye = match.p2Id === "BYE";
    let winner = null, p1pts = 0, p2pts = 0;

    if (isBye) { winner = match.p1Id; p1pts = 3; }
    else if (bestOf === 1) {
      if (result.p1Games > result.p2Games) { winner = match.p1Id; p1pts = 3; }
      else { winner = match.p2Id; p2pts = 3; }
    } else {
      if (result.p1Games > result.p2Games) { winner = match.p1Id; p1pts = 3; }
      else if (result.p2Games > result.p1Games) { winner = match.p2Id; p2pts = 3; }
      else { p1pts = 1; p2pts = 1; }
    }

    const updatedMatch = { ...match, ...result, completed: true, winner };
    const updatedPlayers = players.map(p => {
      if (p.id === match.p1Id) {
        const isWin = winner === p.id, isLoss = !!(winner && winner !== p.id), isDraw = !winner && !isBye;
        return { ...p, points: p.points + p1pts,
          wins: p.wins + (isWin ? 1 : 0), losses: p.losses + (isLoss ? 1 : 0), draws: p.draws + (isDraw ? 1 : 0),
          gameWins: p.gameWins + (result.p1Games || 0), gameLosses: p.gameLosses + (result.p2Games || 0),
        };
      }
      if (p.id === match.p2Id && !isBye) {
        const isWin = winner === p.id, isLoss = !!(winner && winner !== p.id), isDraw = !winner;
        return { ...p, points: p.points + p2pts,
          wins: p.wins + (isWin ? 1 : 0), losses: p.losses + (isLoss ? 1 : 0), draws: p.draws + (isDraw ? 1 : 0),
          gameWins: p.gameWins + (result.p2Games || 0), gameLosses: p.gameLosses + (result.p1Games || 0),
        };
      }
      return p;
    });

    setMatches(prev => prev.map(m => m.id === matchId ? updatedMatch : m));
    setPlayers(updatedPlayers);
    setActiveMatch(null);
  };

  const curPhase = mode === "quick" ? "quick" : phase;
  const currentPhaseMatches = matches.filter(m => m.round === currentRound && m.phase === curPhase);
  const roundComplete = currentPhaseMatches.length > 0 && currentPhaseMatches.every(m => m.completed);
  const swissComplete = phase === "swiss" && currentRound >= totalSwissRounds && roundComplete;

  const advanceRound = () => {
    if (!roundComplete) { notify("Completa tutti i match prima!", "error"); return; }

    if (mode === "quick" || phase === "topcut") {
      const winners = currentPhaseMatches.map(m => m.winner).filter(Boolean);
      if (winners.length === 1) {
        setChampion(players.find(p => p.id === winners[0]));
        setScreen("results"); return;
      }
      const next = currentRound + 1;
      const newMs = [];
      for (let i = 0; i < winners.length; i += 2) {
        newMs.push({
          id: generateId(), round: next, phase: curPhase,
          p1Id: winners[i], p2Id: winners[i+1] || "BYE",
          p1Games: 0, p2Games: 0, completed: false, winner: null,
        });
      }
      setMatches(prev => [...prev, ...newMs]);
      setCurrentRound(next);
      notify(mode === "quick" ? `Round ${next}!` : `Top Cut Round ${next}!`, "success");
      return;
    }

    if (swissComplete) {
      const withTB = computeTiebreakers(players, matches);
      setPlayers(withTB);
      const qualified = calcStandings(withTB).slice(0, topCutSize);
      const topMs = [];
      for (let i = 0; i < qualified.length / 2; i++) {
        topMs.push({
          id: generateId(), round: 1, phase: "topcut",
          p1Id: qualified[i].id, p2Id: qualified[qualified.length - 1 - i].id,
          p1Games: 0, p2Games: 0, completed: false, winner: null,
        });
      }
      setMatches(prev => [...prev, ...topMs]);
      setPhase("topcut"); setCurrentRound(1); setScreen("topcut");
      notify(`Top ${topCutSize} al via!`, "success");
      return;
    }

    const next = currentRound + 1;
    const updated = computeTiebreakers(players, matches);
    setPlayers(updated);
    const pairs = swissPair(updated, matches);
    const newMs = pairs.map(pair => ({
      id: generateId(), round: next, phase: "swiss",
      p1Id: pair.p1Id, p2Id: pair.p2Id,
      p1Games: 0, p2Games: 0, completed: false, winner: null,
    }));
    setMatches(prev => [...prev, ...newMs]);
    setCurrentRound(next);
    notify(`Round ${next} iniziato!`, "success");
  };

  const getPlayer = (id) => players.find(p => p.id === id);
  const standings = calcStandings(computeTiebreakers(players, matches));

  const resetAll = () => {
    setPlayers([]); setMatches([]); setCurrentRound(1);
    setPhase("swiss"); setChampion(null); setScreen("home");
    setNewName(""); setNewDeck(""); setNewAvatar(AVATARS[0]);
  };

  const headerLabel = () => {
    if (mode === "quick") return `⚡ QUICK — Round ${currentRound}`;
    if (phase === "swiss") return `SWISS ROUND ${currentRound}/${totalSwissRounds}`;
    return `🏆 TOP ${topCutSize} — Round ${currentRound}`;
  };

  const advBtnLabel = () => {
    if (mode === "quick") {
      const w = currentPhaseMatches.map(m => m.winner).filter(Boolean);
      return w.length === 1 ? "🏆 MOSTRA CAMPIONE" : `⚡ ROUND ${currentRound + 1}`;
    }
    if (phase === "topcut") {
      const w = currentPhaseMatches.map(m => m.winner).filter(Boolean);
      return w.length === 1 ? "🏆 MOSTRA CAMPIONE" : "⚡ AVANZA BRACKET";
    }
    return swissComplete ? `🏆 AVVIA TOP ${topCutSize}` : `⚡ ROUND ${currentRound + 1}`;
  };

  return (
    <div style={S.root}>
      <style>{css}</style>

      {notif && (
        <div style={{ ...S.notif, background: notif.type === "error" ? "#5c1010" : notif.type === "success" ? "#0b4a36" : "#1a1a3a" }}>
          {notif.msg}
        </div>
      )}

      {/* ══ HOME ══ */}
      {screen === "home" && (
        <div style={S.homeWrap}>
          <div style={S.homeBg} />
          <div style={S.homeInner}>
            <div style={S.homeGlow} />
            <div style={S.logoRow}>
              <span style={S.logoYu}>YU</span><span style={S.logoDash}>-GI-OH!</span>
            </div>
            <p style={S.logoSub}>TOURNAMENT MANAGER</p>
            <p style={S.logoCap}>Swiss System • Top Cut • Eliminazione Diretta</p>
            <div style={S.modeGrid}>
              {Object.entries(ROUND_STRUCTURE).map(([key, v]) => (
                <button key={key} onClick={() => setMode(key)}
                  style={{ ...S.modeCard, ...(mode === key ? S.modeCardOn : {}) }}>
                  <span style={S.modeIcon}>{v.icon}</span>
                  <span style={S.modeLabel}>{v.label}</span>
                  <span style={S.modeDesc}>{v.desc}</span>
                  {mode === key && <span style={S.modeTick}>✓</span>}
                </button>
              ))}
            </div>
            {mode === "quick" && (
              <div style={S.quickInfo}>
                ⚡ Bracket casuale, Best-of-1, niente Swiss — ideale per serate veloci
              </div>
            )}
            <button style={S.bigBtn} onClick={() => setScreen("setup")}>CREA TORNEO ➤</button>
          </div>
        </div>
      )}

      {/* ══ SETUP ══ */}
      {screen === "setup" && (
        <div style={S.page}>
          <header style={S.hdr}>
            <button style={S.backBtn} onClick={() => setScreen("home")}>← HOME</button>
            <h2 style={S.hdrTitle}>ISCRIZIONE GIOCATORI</h2>
            <span style={{ ...S.badge, ...(mode === "quick" ? S.badgeQuick : {}) }}>{cfg.label} • {cfg.desc}</span>
          </header>

          <div style={S.setupGrid}>
            <div style={S.panel}>
              <h3 style={S.panelTitle}>➕ NUOVO DUELLIST</h3>

              <div style={S.fg}>
                <label style={S.lbl}>NOME DUELLIST</label>
                <input style={S.inp} value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Es. Yugi Muto" onKeyDown={e => e.key === "Enter" && addPlayer()} />
              </div>

              <div style={S.fg}>
                <label style={S.lbl}>AVATAR</label>
                <div style={S.avatarGrid}>
                  {AVATARS.map(av => (
                    <button key={av} onClick={() => setNewAvatar(av)}
                      style={{ ...S.avBtn, ...(newAvatar === av ? S.avBtnOn : {}) }}>{av}</button>
                  ))}
                </div>
              </div>

              <div style={{ ...S.fg, position: "relative" }} ref={deckRef}>
                <label style={S.lbl}>
                  DECK <span style={S.lblHint}>(scrivi liberamente o scegli dalla lista)</span>
                </label>
                <div style={S.deckRow}>
                  <input style={{ ...S.inp, flex: 1 }}
                    value={newDeck}
                    onChange={e => { setNewDeck(e.target.value); setDeckOpen(true); }}
                    onFocus={() => setDeckOpen(true)}
                    placeholder="Nome del tuo deck…" />
                  {newDeck && (
                    <button style={S.clearBtn} onClick={() => { setNewDeck(""); setDeckOpen(false); }}>✕</button>
                  )}
                </div>
                {deckOpen && filteredDecks.length > 0 && (
                  <div style={S.suggest}>
                    {filteredDecks.map(d => (
                      <div key={d} className="sug-item" style={S.suggestItem}
                        onMouseDown={() => { setNewDeck(d); setDeckOpen(false); }}>
                        🃏 {d}
                      </div>
                    ))}
                  </div>
                )}
                {!newDeck && (
                  <div>
                    <p style={S.quickPickLabel}>Popolari:</p>
                    <div style={S.quickPickRow}>
                      {DECK_SUGGESTIONS.slice(0, 12).map(d => (
                        <button key={d} className="qpick" style={S.quickPick} onClick={() => setNewDeck(d)}>{d}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button style={S.bigBtn} onClick={addPlayer}>AGGIUNGI DUELLIST</button>
            </div>

            <div style={S.panel}>
              <h3 style={S.panelTitle}>👥 ISCRITTI ({players.length})</h3>
              {players.length === 0
                ? <p style={S.empty}>Nessun giocatore registrato.</p>
                : (
                  <div style={S.pList}>
                    {players.map((p, i) => (
                      <div key={p.id} style={S.pCard}>
                        <span style={S.pSeed}>#{i + 1}</span>
                        <span style={S.pAv}>{p.avatar}</span>
                        <div style={S.pInfo}>
                          <span style={S.pName}>{p.name}</span>
                          <span style={S.pDeck}>🃏 {p.deck}</span>
                        </div>
                        <button style={S.rmBtn} onClick={() => removePlayer(p.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              <div style={{ marginTop: 14 }}>
                {players.length >= 4
                  ? <button style={S.bigBtn} onClick={startTournament}>AVVIA TORNEO ▶</button>
                  : players.length > 0
                  ? <p style={S.warn}>Aggiungi ancora {4 - players.length} giocatore/i</p>
                  : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOURNAMENT ══ */}
      {(screen === "tournament") && (
        <div style={S.page}>
          <header style={S.hdr}>
            <button style={S.backBtn} onClick={() => setScreen("setup")}>← SETUP</button>
            <h2 style={S.hdrTitle}>{headerLabel()}</h2>
            <span style={{ ...S.badge, ...(mode === "quick" ? S.badgeQuick : {}) }}>
              {cfg.label} • BO{bestOf}
            </span>
          </header>

          {mode !== "quick" && (
            <div style={S.tabs}>
              {["matches", "standings"].map(t => (
                <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }} onClick={() => setTab(t)}>
                  {t === "matches" ? "🎴 MATCH" : "📊 CLASSIFICA"}
                </button>
              ))}
            </div>
          )}

          {(tab === "matches" || mode === "quick") && (
            <div style={S.mList}>
              {mode === "quick" && (
                <div style={S.quickBanner}>
                  <span>⚡ QUICK — Eliminazione Diretta • Best-of-1</span>
                  <span style={{ fontWeight: 700 }}>Round {currentRound}</span>
                </div>
              )}
              {currentPhaseMatches.map(m => (
                <MatchCard key={m.id} match={m} getPlayer={getPlayer}
                  isQuick={mode === "quick"}
                  onSelect={() => !m.completed && setActiveMatch(m)} />
              ))}
              {roundComplete && (
                <button style={{ ...S.bigBtn, margin: "16px auto", display: "block" }} onClick={advanceRound}>
                  {advBtnLabel()}
                </button>
              )}
            </div>
          )}
          {tab === "standings" && mode !== "quick" && <StandingsTable standings={standings} />}
        </div>
      )}

      {/* ══ TOP CUT ══ */}
      {screen === "topcut" && (
        <div style={S.page}>
          <header style={S.hdr}>
            <div />
            <h2 style={S.hdrTitle}>🏆 TOP {topCutSize} — Round {currentRound}</h2>
            <span style={S.badge}>ELIMINAZIONE DIRETTA</span>
          </header>
          <div style={S.topInfoBar}>Best-of-3 • 50 min per match • Regole ufficiali Konami</div>
          <div style={S.mList}>
            {currentPhaseMatches.map(m => (
              <MatchCard key={m.id} match={m} getPlayer={getPlayer} isTopCut
                onSelect={() => !m.completed && setActiveMatch(m)} />
            ))}
            {roundComplete && (
              <button style={{ ...S.bigBtn, margin: "16px auto", display: "block" }} onClick={advanceRound}>
                {advBtnLabel()}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ RESULTS ══ */}
      {screen === "results" && champion && (
        <div style={S.resultsWrap}>
          <div style={S.resultsBg} />
          <div style={S.champCard}>
            <div style={S.champGlow} />
            <p style={S.champEyebrow}>🏆 CAMPIONE DEL TORNEO 🏆</p>
            <div style={S.champAv}>{champion.avatar}</div>
            <h2 style={S.champName}>{champion.name}</h2>
            <p style={S.champDeck}>🃏 {champion.deck}</p>
            <div style={S.statRow}>
              {[["Vittorie", champion.wins], ["Sconfitte", champion.losses], ["Punti", champion.points]].map(([l, v]) => (
                <div key={l} style={S.statBox}>
                  <span style={S.statN}>{v}</span>
                  <span style={S.statL}>{l}</span>
                </div>
              ))}
            </div>
            {mode !== "quick" && (
              <>
                <h3 style={{ ...S.panelTitle, marginTop: 24 }}>CLASSIFICA FINALE</h3>
                <StandingsTable standings={standings} compact />
              </>
            )}
            <button style={{ ...S.bigBtn, marginTop: 24 }} onClick={resetAll}>🔄 NUOVO TORNEO</button>
          </div>
        </div>
      )}

      {/* ══ MATCH MODAL ══ */}
      {activeMatch && (
        <MatchModal match={activeMatch} getPlayer={getPlayer} bestOf={bestOf}
          onSubmit={r => submitResult(activeMatch.id, r)}
          onClose={() => setActiveMatch(null)} />
      )}
    </div>
  );
}

// ─── MATCH CARD ───────────────────────────────────────────────────────────────
function MatchCard({ match, getPlayer, onSelect, isTopCut, isQuick }) {
  const p1 = getPlayer(match.p1Id);
  const isBye = match.p2Id === "BYE";
  const accent = isQuick ? "#f97316" : isTopCut ? "#f0c030" : "#8b5cf6";

  return (
    <div style={{ ...S.matchCard, ...(!match.completed ? { borderColor: `${accent}44` } : S.matchDone) }}
      onClick={onSelect} className={match.completed ? "" : "mc-hover"}>
      {(isTopCut || isQuick) && (
        <div style={{ ...S.mcBadge, color: accent, background: `${accent}18` }}>
          {isQuick ? "⚡ QUICK" : "⚔️ TOP CUT"}
        </div>
      )}
      <div style={S.mcInner}>
        <PSlot player={p1} isWinner={match.winner === match.p1Id} games={match.p1Games} />
        <div style={S.vsCol}>
          {match.completed
            ? <span style={S.scoreText}>{match.p1Games}{!isBye ? ` – ${match.p2Games}` : ""}</span>
            : <span style={{ ...S.vsText, color: accent }}>VS</span>}
          {!match.completed && !isBye && <span style={S.clickHint}>Clicca per risultato</span>}
        </div>
        {isBye
          ? <div style={S.byeBox}><span style={S.byeTxt}>BYE</span></div>
          : <PSlot player={getPlayer(match.p2Id)} isWinner={match.winner === match.p2Id} games={match.p2Games} right />}
      </div>
    </div>
  );
}

function PSlot({ player, isWinner, games, right }) {
  if (!player) return <div style={S.pSlot} />;
  return (
    <div style={{ ...S.pSlot, ...(right ? { alignItems: "flex-end", textAlign: "right" } : {}) }}>
      <span style={S.slotAv}>{player.avatar}</span>
      <span style={{ ...S.slotName, ...(isWinner ? { color: "#f0c030" } : {}) }}>{player.name}</span>
      <span style={S.slotDeck}>{player.deck}</span>
      {isWinner && <span style={S.winTag}>VINCITORE ⭐</span>}
    </div>
  );
}

// ─── MATCH MODAL ──────────────────────────────────────────────────────────────
function MatchModal({ match, getPlayer, onSubmit, onClose, bestOf }) {
  const isQuick = bestOf === 1;
  const [p1G, setP1G] = useState(0);
  const [p2G, setP2G] = useState(0);
  const p1 = getPlayer(match.p1Id);
  const p2 = getPlayer(match.p2Id);

  const valid = isQuick
    ? (p1G === 1 && p2G === 0) || (p1G === 0 && p2G === 1)
    : (p1G === 2 && p2G < 2) || (p2G === 2 && p1G < 2) || (p1G === 1 && p2G === 1);

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <h3 style={S.modalTitle}>{isQuick ? "⚡ QUICK MATCH" : "🎴 RISULTATO MATCH"}</h3>
        <p style={S.modalSub}>{isQuick ? "Best-of-1 • Chi vince avanza" : "Best-of-3 • Inserisci le partite vinte"}</p>

        <div style={S.modalPlayers}>
          <div style={S.mPlayer}><span style={S.mAv}>{p1?.avatar}</span><span style={S.mName}>{p1?.name}</span><span style={S.mDeck}>{p1?.deck}</span></div>
          <span style={{ ...S.vsText, fontSize: 18, color: "#8b5cf6" }}>VS</span>
          <div style={S.mPlayer}><span style={S.mAv}>{p2?.avatar}</span><span style={S.mName}>{p2?.name}</span><span style={S.mDeck}>{p2?.deck}</span></div>
        </div>

        {isQuick ? (
          <div style={S.quickWinPick}>
            <p style={S.qwLabel}>CHI HA VINTO LA PARTITA?</p>
            <div style={{ display: "flex", gap: 12 }}>
              {[{ player: p1, idx: 1, other: 0 }, { player: p2, idx: 2, other: 1 }].map(({ player, idx }) => (
                <button key={idx}
                  style={{ ...S.winPickBtn, ...((idx === 1 ? p1G : p2G) === 1 ? S.winPickOn : {}) }}
                  onClick={() => { if (idx === 1) { setP1G(1); setP2G(0); } else { setP2G(1); setP1G(0); } }}>
                  <span style={{ fontSize: 28 }}>{player?.avatar}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{player?.name}</span>
                  <span style={{ fontSize: 9, color: "#5a607a" }}>{player?.deck}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={S.counters}>
              <Counter label={`Partite di ${p1?.name}`} value={p1G} onChange={v => setP1G(Math.min(2, Math.max(0, v)))} />
              <Counter label={`Partite di ${p2?.name}`} value={p2G} onChange={v => setP2G(Math.min(2, Math.max(0, v)))} />
            </div>
            <p style={S.hint}>Validi: 2-0 • 2-1 • 1-1 (pari) • 1-2 • 0-2</p>
            {!valid && (p1G + p2G > 0) && <p style={S.invalid}>⚠️ Combinazione non valida</p>}
          </>
        )}

        <div style={S.modalBtns}>
          <button style={S.cancelBtn} onClick={onClose}>ANNULLA</button>
          <button
            style={{ ...S.bigBtn, flex: 1, padding: "12px 0", opacity: valid ? 1 : 0.35, cursor: valid ? "pointer" : "not-allowed" }}
            onClick={() => valid && onSubmit({ p1Games: p1G, p2Games: p2G })}>
            CONFERMA ✔
          </button>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, onChange }) {
  return (
    <div style={S.cBlock}>
      <span style={S.cLabel}>{label}</span>
      <div style={S.cRow}>
        <button style={S.cBtn} onClick={() => onChange(value - 1)}>−</button>
        <span style={S.cVal}>{value}</span>
        <button style={S.cBtn} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

// ─── STANDINGS ────────────────────────────────────────────────────────────────
function StandingsTable({ standings, compact }) {
  return (
    <div style={S.tWrap}>
      <table style={S.table}>
        <thead>
          <tr>
            {["#", "Giocatore", "Pts", "V/S/P", ...(!compact ? ["OWP%", "GWP%"] : [])].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((p, i) => (
            <tr key={p.id} style={i % 2 === 0 ? S.trE : S.trO}>
              <td style={S.td}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
              <td style={S.td}><span style={{ marginRight: 6 }}>{p.avatar}</span>{p.name}</td>
              <td style={{ ...S.td, fontWeight: 700, color: "#f0c030" }}>{p.points}</td>
              <td style={S.td}>{p.wins}/{p.losses}/{p.draws}</td>
              {!compact && <><td style={S.td}>{(p.owp * 100).toFixed(1)}%</td><td style={S.td}>{(p.gwp * 100).toFixed(1)}%</td></>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#090912", panel: "#0f0f1e", border: "#1c1c35",
  gold: "#f0c030", goldD: "#a07820",
  accent: "#8b5cf6", orange: "#f97316",
  text: "#e2e8f0", muted: "#5a607a",
};

const S = {
  root: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Cinzel','Palatino Linotype',serif", position: "relative" },
  notif: { position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", padding: "10px 22px", borderRadius: 8, color: "#fff", fontWeight: 700, zIndex: 9999, fontSize: 13, letterSpacing: "0.08em", boxShadow: "0 4px 20px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" },

  homeWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" },
  homeBg: { position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 5%, #1e0a40 0%, #090912 65%)" },
  homeInner: { position: "relative", zIndex: 1, textAlign: "center", padding: "40px 20px", maxWidth: 560, width: "100%" },
  homeGlow: { position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 420, height: 300, background: "radial-gradient(circle, rgba(240,192,48,0.11) 0%, transparent 70%)", pointerEvents: "none" },
  logoRow: { fontSize: "clamp(52px, 11vw, 90px)", fontWeight: 900, letterSpacing: "0.06em", lineHeight: 1, margin: "0 0 4px" },
  logoYu: { color: C.gold, textShadow: "0 0 55px rgba(240,192,48,0.55)" },
  logoDash: { color: "#fff", textShadow: "0 0 20px rgba(255,255,255,0.12)" },
  logoSub: { fontSize: 12, letterSpacing: "0.5em", color: C.accent, margin: "8px 0 3px" },
  logoCap: { color: C.muted, fontSize: 11, margin: "0 0 36px", letterSpacing: "0.04em" },
  modeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 },
  modeCard: { background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 8px", cursor: "pointer", color: C.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, transition: "all 0.2s", position: "relative" },
  modeCardOn: { background: "rgba(240,192,48,0.08)", border: `1px solid ${C.gold}`, color: C.gold },
  modeIcon: { fontSize: 28 },
  modeLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em" },
  modeDesc: { fontSize: 9, color: C.muted, textAlign: "center", lineHeight: 1.4 },
  modeTick: { position: "absolute", top: 6, right: 8, fontSize: 10, color: C.gold },
  quickInfo: { background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.28)", borderRadius: 8, padding: "9px 14px", fontSize: 11, color: C.orange, marginBottom: 22, letterSpacing: "0.04em", lineHeight: 1.5 },
  bigBtn: { background: `linear-gradient(135deg, ${C.gold}, ${C.goldD})`, color: "#000", border: "none", borderRadius: 8, padding: "14px 36px", fontSize: 13, fontWeight: 900, letterSpacing: "0.15em", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(240,192,48,0.28)", transition: "opacity 0.2s" },

  page: { minHeight: "100vh", display: "flex", flexDirection: "column" },
  hdr: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 },
  hdrTitle: { margin: 0, fontSize: "clamp(12px, 2.5vw, 18px)", fontWeight: 700, letterSpacing: "0.08em", color: C.gold },
  backBtn: { background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 11, letterSpacing: "0.05em", fontFamily: "inherit" },
  badge: { background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.32)", color: C.accent, borderRadius: 20, padding: "3px 11px", fontSize: 10, letterSpacing: "0.08em" },
  badgeQuick: { background: "rgba(249,115,22,0.14)", border: "1px solid rgba(249,115,22,0.32)", color: C.orange },

  setupGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, padding: 18, flex: 1, alignContent: "start" },
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 },
  panelTitle: { margin: "0 0 14px", fontSize: 11, letterSpacing: "0.18em", color: C.gold, textTransform: "uppercase" },
  fg: { marginBottom: 14 },
  lbl: { display: "block", fontSize: 10, color: C.muted, letterSpacing: "0.12em", marginBottom: 5 },
  lblHint: { fontStyle: "italic", opacity: 0.65, letterSpacing: "0.03em", fontSize: 9 },
  inp: { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 11px", color: C.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" },
  deckRow: { display: "flex", gap: 6, alignItems: "center" },
  clearBtn: { background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "8px 10px", cursor: "pointer", fontSize: 11 },
  suggest: { position: "absolute", top: "100%", left: 0, right: 0, background: "#12122a", border: `1px solid ${C.border}`, borderRadius: 8, zIndex: 200, boxShadow: "0 10px 36px rgba(0,0,0,0.7)", marginTop: 3, overflow: "hidden" },
  suggestItem: { padding: "9px 12px", fontSize: 12, cursor: "pointer", color: C.text, letterSpacing: "0.03em", transition: "background 0.12s" },
  quickPickLabel: { margin: "8px 0 5px", fontSize: 9, color: C.muted, letterSpacing: "0.1em" },
  quickPickRow: { display: "flex", flexWrap: "wrap", gap: 5 },
  quickPick: { background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 20, padding: "3px 10px", fontSize: 9, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em", transition: "all 0.15s" },
  avatarGrid: { display: "flex", flexWrap: "wrap", gap: 5 },
  avBtn: { fontSize: 18, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 7px", cursor: "pointer", transition: "all 0.15s" },
  avBtnOn: { background: "rgba(240,192,48,0.12)", border: `1px solid ${C.gold}` },
  pList: { maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 },
  pCard: { display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px" },
  pSeed: { fontSize: 10, color: C.muted, minWidth: 22, textAlign: "center" },
  pAv: { fontSize: 22 },
  pInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  pName: { fontSize: 13, fontWeight: 700 },
  pDeck: { fontSize: 10, color: C.muted },
  rmBtn: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#ef4444", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11 },
  empty: { color: C.muted, fontSize: 12, textAlign: "center", padding: "20px 0" },
  warn: { color: "#f59e0b", fontSize: 11, textAlign: "center" },

  tabs: { display: "flex", borderBottom: `1px solid ${C.border}`, background: "rgba(0,0,0,0.22)" },
  tab: { flex: 1, padding: "11px", background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, letterSpacing: "0.1em", fontFamily: "inherit", borderBottom: "2px solid transparent", transition: "all 0.2s" },
  tabOn: { color: C.gold, borderBottom: `2px solid ${C.gold}` },

  mList: { padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 },
  quickBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.22)", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: C.orange, letterSpacing: "0.06em" },
  matchCard: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 14, cursor: "pointer", transition: "all 0.2s", position: "relative", overflow: "hidden" },
  matchDone: { opacity: 0.68, cursor: "default", borderColor: C.border },
  mcBadge: { position: "absolute", top: 7, right: 7, fontSize: 9, borderRadius: 4, padding: "2px 7px", letterSpacing: "0.1em" },
  mcInner: { display: "flex", alignItems: "center", gap: 10 },
  pSlot: { flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 },
  slotAv: { fontSize: 26, lineHeight: 1 },
  slotName: { fontSize: 14, fontWeight: 700 },
  slotDeck: { fontSize: 10, color: C.muted },
  winTag: { fontSize: 9, color: "#10b981", letterSpacing: "0.04em" },
  vsCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 66 },
  vsText: { fontSize: 18, fontWeight: 900, letterSpacing: "0.1em" },
  scoreText: { fontSize: 22, fontWeight: 900, color: C.gold },
  clickHint: { fontSize: 8, color: C.muted, letterSpacing: "0.04em", textAlign: "center" },
  byeBox: { flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center" },
  byeTxt: { fontSize: 16, color: C.muted, letterSpacing: "0.2em" },
  topInfoBar: { padding: "7px 18px", background: "rgba(240,192,48,0.04)", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textAlign: "center", letterSpacing: "0.06em" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 14 },
  modal: { background: "#10101e", border: `1px solid ${C.gold}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 430, boxShadow: "0 0 70px rgba(240,192,48,0.16)" },
  modalTitle: { margin: "0 0 4px", fontSize: 17, letterSpacing: "0.1em", color: C.gold, textAlign: "center" },
  modalSub: { margin: "0 0 18px", fontSize: 10, color: C.muted, textAlign: "center", letterSpacing: "0.06em" },
  modalPlayers: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 16, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 10 },
  mPlayer: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  mAv: { fontSize: 30 },
  mName: { fontSize: 12, fontWeight: 700, textAlign: "center" },
  mDeck: { fontSize: 9, color: C.muted, textAlign: "center" },
  quickWinPick: { textAlign: "center", padding: "4px 0 16px" },
  qwLabel: { margin: "0 0 10px", fontSize: 10, color: C.muted, letterSpacing: "0.12em" },
  winPickBtn: { flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 10px", cursor: "pointer", color: C.text, fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, transition: "all 0.2s" },
  winPickOn: { background: "rgba(240,192,48,0.14)", border: `1px solid ${C.gold}`, color: C.gold },
  counters: { display: "flex", gap: 10, marginBottom: 10 },
  cBlock: { flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px", display: "flex", flexDirection: "column", gap: 7, alignItems: "center" },
  cLabel: { fontSize: 9, color: C.muted, textAlign: "center", letterSpacing: "0.05em" },
  cRow: { display: "flex", alignItems: "center", gap: 10 },
  cBtn: { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, color: C.text, width: 30, height: 30, borderRadius: 6, cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  cVal: { fontSize: 30, fontWeight: 900, color: C.gold, minWidth: 36, textAlign: "center" },
  hint: { fontSize: 9, color: C.muted, textAlign: "center", marginBottom: 3 },
  invalid: { fontSize: 11, color: "#ef4444", textAlign: "center", marginBottom: 6 },
  modalBtns: { display: "flex", gap: 9, marginTop: 14 },
  cancelBtn: { flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "12px", cursor: "pointer", fontSize: 12, fontFamily: "inherit", letterSpacing: "0.05em" },

  tWrap: { padding: 14, overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "9px 11px", textAlign: "left", fontSize: 9, letterSpacing: "0.15em", color: C.muted, borderBottom: `1px solid ${C.border}`, background: "rgba(0,0,0,0.3)" },
  td: { padding: "9px 11px", borderBottom: "1px solid rgba(28,28,53,0.55)" },
  trE: { background: "rgba(255,255,255,0.01)" },
  trO: { background: "rgba(0,0,0,0.15)" },

  resultsWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: 18 },
  resultsBg: { position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 25%, #251500 0%, #090912 55%)" },
  champCard: { position: "relative", zIndex: 1, background: C.panel, border: `2px solid ${C.gold}`, borderRadius: 20, padding: "32px 28px", maxWidth: 500, width: "100%", textAlign: "center", boxShadow: "0 0 90px rgba(240,192,48,0.26)" },
  champGlow: { position: "absolute", top: -50, left: "50%", transform: "translateX(-50%)", width: 280, height: 220, background: "radial-gradient(circle, rgba(240,192,48,0.2) 0%, transparent 70%)", pointerEvents: "none" },
  champEyebrow: { margin: "0 0 14px", fontSize: 11, letterSpacing: "0.2em", color: C.gold },
  champAv: { fontSize: 60, margin: "0 0 10px" },
  champName: { margin: "0 0 5px", fontSize: 26, fontWeight: 900, color: C.gold },
  champDeck: { color: C.muted, fontSize: 12, marginBottom: 18 },
  statRow: { display: "flex", justifyContent: "center", gap: 12 },
  statBox: { background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "9px 18px", display: "flex", flexDirection: "column", alignItems: "center" },
  statN: { fontSize: 22, fontWeight: 900, color: C.gold },
  statL: { fontSize: 9, color: C.muted, marginTop: 2, letterSpacing: "0.1em" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  .mc-hover:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(0,0,0,0.5); }
  .sug-item:hover { background: rgba(139,92,246,0.12) !important; }
  .qpick:hover { background: rgba(255,255,255,0.08) !important; color: #e2e8f0 !important; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
  input:focus { border-color: rgba(139,92,246,0.5) !important; box-shadow: 0 0 0 2px rgba(139,92,246,0.08) !important; }
  @media (max-width: 600px) {
    div[style*="setupGrid"] { grid-template-columns: 1fr !important; }
    div[style*="modeGrid"] { grid-template-columns: 1fr !important; }
    div[style*="statRow"] { gap: 8px !important; }
  }
`;
