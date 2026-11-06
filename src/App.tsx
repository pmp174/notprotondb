import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUpRight, Check, ChevronDown, CircleHelp,
  Gamepad2, Github, Info, LogIn, LogOut, Menu, Search, ShieldCheck,
  SlidersHorizontal, Sparkles, X
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { Compatibility, Game, Report, Result } from "./types";

type Page = "home" | "game" | "submit" | "about";

const resultLabels: Record<Result, string> = {
  works: "Works",
  minor_issues: "Minor issues",
  major_issues: "Major issues",
  does_not_work: "Doesn't work",
};

function ratingFor(stats?: Compatibility): { label: string; tone: string } {
  if (!stats || stats.report_count === 0) return { label: "Untested", tone: "neutral" };
  const p = stats.positive_percent ?? 0;
  if (p >= 90 && stats.report_count >= 3 && stats.does_not_work_count === 0) return { label: "Platinum", tone: "platinum" };
  if (p >= 80) return { label: "Gold", tone: "gold" };
  if (p >= 60) return { label: "Silver", tone: "silver" };
  if (p >= 35) return { label: "Bronze", tone: "bronze" };
  return { label: "Borked", tone: "borked" };
}

function App() {
  const [page, setPage] = useState<Page>("home");
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<Record<string, Compatibility>>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Game | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  async function loadGames() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("games")
      .select("id,title,steam_app_id,developer,publisher,release_year,created_at")
      .eq("review_state", "approved")
      .order("title");
    if (error) setMessage(error.message);
    const rows = (data ?? []) as Game[];
    setGames(rows);
    if (rows.length) {
      const { data: statRows } = await supabase.from("game_compatibility").select("*").in("game_id", rows.map(g => g.id));
      const map: Record<string, Compatibility> = {};
      (statRows ?? []).forEach((s: Compatibility) => { map[s.game_id] = s; });
      setStats(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadGames();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUserEmail(data.session?.user.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function openGame(game: Game) {
    setSelected(game);
    setPage("game");
    setMessage("");
    if (!supabase) return;
    const { data, error } = await supabase.from("reports")
      .select("*").eq("game_id", game.id).order("tested_at", { ascending: false }).limit(40);
    if (error) setMessage(error.message);
    setReports((data ?? []) as Report[]);
  }

  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter(g => {
      const matches = !q || g.title.toLowerCase().includes(q) ||
        (g.developer ?? "").toLowerCase().includes(q) ||
        (g.steam_app_id ?? "").includes(q);
      const rating = ratingFor(stats[g.id]).label.toLowerCase();
      return matches && (filter === "all" || rating === filter);
    });
  }, [games, query, filter, stats]);

  function navigate(next: Page) {
    setPage(next);
    setSelected(null);
    setMessage("");
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} aria-label="NotProtonDB home">
          <span className="brand-mark"><Gamepad2 size={21}/></span>
          <span>notproton<span className="brand-db">DB</span></span>
        </button>
        <nav className={mobileMenu ? "nav nav-open" : "nav"}>
          <button className={page === "home" ? "nav-link active" : "nav-link"} onClick={() => navigate("home")}>Games</button>
          <button className={page === "submit" ? "nav-link active" : "nav-link"} onClick={() => navigate("submit")}>Submit a report</button>
          <button className={page === "about" ? "nav-link active" : "nav-link"} onClick={() => navigate("about")}>About</button>
        </nav>
        <div className="top-actions">
          {userEmail ? (
            <button className="account-button" onClick={() => void supabase?.auth.signOut()} title="Sign out">
              <span className="avatar">{userEmail.slice(0,1).toUpperCase()}</span><span className="account-email">{userEmail}</span><LogOut size={15}/>
            </button>
          ) : (
            <button className="button button-quiet button-small" onClick={() => setAuthOpen(true)}><LogIn size={15}/> Sign in</button>
          )}
          <button className="icon-button menu-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X/> : <Menu/>}</button>
        </div>
      </header>

      <main>
        {page === "home" && (
          <>
            <section className="hero">
              <div className="hero-glow"/>
              <div className="hero-content">
                <div className="eyebrow"><span className="live-dot"/> COMMUNITY-POWERED MAC GAMING</div>
                <h1>Will it run<br/><span>on your Mac?</span></h1>
                <p className="hero-copy">Real-world compatibility reports for Windows games running through NotProton and CrossOver.</p>
                <div className="search-wrap">
                  <Search size={19}/>
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search games, developers, or Steam App ID…" aria-label="Search games"/>
                  <kbd>↵</kbd>
                </div>
                <div className="hero-meta"><span><strong>{games.length}</strong> games tracked</span><i/> <span>Community tested</span><i/> <span>Apple Silicon focused</span></div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
                <div className="chip-visual"><Gamepad2 size={76} strokeWidth={1.15}/><span></span></div>
                <div className="float-tag tag-top">APPLE SILICON <span>↗</span></div>
                <div className="float-tag tag-bottom"><span className="green-dot"/> COMPATIBILITY CHECK</div>
              </div>
            </section>

            {!isSupabaseConfigured && <SetupNotice/>}
            {message && <div className="notice notice-error">{message}</div>}

            <section className="catalog-section">
              <div className="section-heading">
                <div><div className="eyebrow muted-eyebrow">THE DATABASE</div><h2>Explore games<span className="heading-period">.</span></h2></div>
                <button className="button button-outline" onClick={() => navigate("submit")}>Add a game <ArrowUpRight size={16}/></button>
              </div>
              <div className="catalog-toolbar">
                <div className="catalog-count">{loading ? "Loading catalogue…" : `${filteredGames.length} ${filteredGames.length === 1 ? "game" : "games"}`}</div>
                <label className="filter-control"><SlidersHorizontal size={15}/><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter by compatibility"><option value="all">All ratings</option><option value="platinum">Platinum</option><option value="gold">Gold</option><option value="silver">Silver</option><option value="bronze">Bronze</option><option value="borked">Borked</option><option value="untested">Untested</option></select><ChevronDown size={14}/></label>
              </div>
              {loading ? <div className="empty-state"><div className="spinner"/><p>Loading the community database…</p></div> :
                filteredGames.length ? (
                  <div className="game-grid">
                    {filteredGames.map((game, index) => {
                      const s = stats[game.id];
                      const r = ratingFor(s);
                      return <button className="game-card" key={game.id} onClick={() => void openGame(game)}>
                        <div className={`game-art-placeholder art-${index % 6}`}><Gamepad2 size={30}/><span>{game.title.slice(0,1).toUpperCase()}</span></div>
                        <div className="game-card-body">
                          <div className="game-card-top"><span className={`rating-pill ${r.tone}`}>{r.label}</span><ArrowUpRight size={15} className="card-arrow"/></div>
                          <h3>{game.title}</h3>
                          <p>{game.developer || game.publisher || (game.release_year ? String(game.release_year) : "Community entry")}</p>
                          <div className="game-card-footer"><span>{s?.report_count ?? 0} reports</span><span>{s?.positive_percent == null ? "—" : `${s.positive_percent}% positive`}</span></div>
                        </div>
                      </button>;
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon"><Gamepad2 size={27}/></div>
                    <h3>{query ? "No matching games" : "The catalogue is ready for its first game."}</h3>
                    <p>{query ? "Try another title or clear your search." : "Be one of the first to add a game and start building the compatibility database."}</p>
                    <button className="button button-primary" onClick={() => navigate("submit")}>Add the first game <ArrowUpRight size={16}/></button>
                  </div>
                )}
            </section>
          </>
        )}

        {page === "game" && selected && (
          <GameDetail game={selected} stats={stats[selected.id]} reports={reports} onBack={() => navigate("home")} onReport={() => navigate("submit")}/>
        )}

        {page === "submit" && (
          <SubmitPage games={games} userEmail={userEmail} onSignIn={() => setAuthOpen(true)} onDone={async () => { await loadGames(); navigate("home"); }}/>
        )}

        {page === "about" && <AboutPage/>}
      </main>

      <footer className="footer">
        <div className="footer-brand"><span className="brand-mark"><Gamepad2 size={18}/></span><strong>notproton<span className="brand-db">DB</span></strong></div>
        <p>An independent, community-powered compatibility database for Mac gaming.</p>
        <div className="footer-bottom"><span>Not affiliated with CodeWeavers, Valve, or Apple.</span><a href="https://github.com" target="_blank" rel="noreferrer">Built in the open <Github size={14}/></a><span>© {new Date().getFullYear()} NotProtonDB</span></div>
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onMessage={setMessage}/>}
    </div>
  );
}

function SetupNotice() {
  return <div className="setup-notice"><Info size={18}/><div><strong>Connect your Supabase project to activate the database.</strong><p>This preview is running without a backend. Follow the README setup steps to enable sign-in, game submissions, and reports.</p></div></div>;
}

function GameDetail({ game, stats, reports, onBack, onReport }: { game: Game; stats?: Compatibility; reports: Report[]; onBack: () => void; onReport: () => void }) {
  const rating = ratingFor(stats);
  return <section className="detail-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Back to games</button>
    <div className="detail-hero">
      <div className="detail-art"><Gamepad2 size={48}/><span>{game.title.slice(0,1)}</span></div>
      <div className="detail-main">
        <div className="eyebrow muted-eyebrow">GAME COMPATIBILITY</div>
        <h1>{game.title}</h1>
        <div className="detail-sub">{[game.developer, game.release_year].filter(Boolean).join(" · ") || "Community game entry"}</div>
        <span className={`rating-pill large ${rating.tone}`}>{rating.label}</span>
      </div>
      <button className="button button-primary detail-report" onClick={onReport}>Submit report <ArrowUpRight size={16}/></button>
    </div>
    <div className="stats-panel">
      <div className="big-stat"><strong>{stats?.positive_percent == null ? "—" : `${stats.positive_percent}%`}</strong><span>Positive reports</span></div>
      <div className="big-stat"><strong>{stats?.report_count ?? 0}</strong><span>Community reports</span></div>
      <div className="big-stat"><strong>{stats?.last_tested ? new Date(stats.last_tested).toLocaleDateString() : "—"}</strong><span>Last tested</span></div>
    </div>
    <div className="section-heading compact-heading"><div><div className="eyebrow muted-eyebrow">COMMUNITY DATA</div><h2>Compatibility reports<span className="heading-period">.</span></h2></div></div>
    <div className="reports-list">
      {reports.length ? reports.map(report => <article className="report-card" key={report.id}>
        <div className="report-card-heading"><span className={`result-label ${report.result}`}>{resultLabels[report.result]}</span><time>{new Date(report.tested_at).toLocaleDateString()}</time></div>
        <div className="report-specs"><span>{report.mac_model}</span><span>{report.chip}</span><span>{report.macos_version}</span><span>CrossOver {report.crossover_version}</span><span>NotProton {report.notproton_version}</span></div>
        {report.notes && <p className="report-notes">{report.notes}</p>}
        <div className="report-foot">{report.storefront}{report.average_fps ? ` · ${report.average_fps} FPS` : ""}{report.session_minutes ? ` · ${report.session_minutes} min session` : ""}</div>
      </article>) : <div className="empty-state small-empty"><p>No compatibility reports yet.</p><button className="button button-outline" onClick={onReport}>Be the first to report</button></div>}
    </div>
    <p className="fine-print"><Info size={14}/> Ratings are calculated from community submissions. Results vary by hardware, OS, game build, and compatibility-layer version.</p>
  </section>;
}

function SubmitPage({ games, userEmail, onSignIn, onDone }: { games: Game[]; userEmail: string | null; onSignIn: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"report" | "game">("report");
  const [gameId, setGameId] = useState("");
  const [title, setTitle] = useState("");
  const [steamId, setSteamId] = useState("");
  const [result, setResult] = useState<Result>("works");
  const [macModel, setMacModel] = useState("");
  const [chip, setChip] = useState("");
  const [memory, setMemory] = useState("");
  const [macos, setMacos] = useState("");
  const [crossover, setCrossover] = useState("");
  const [notproton, setNotproton] = useState("");
  const [storefront, setStorefront] = useState("Steam");
  const [gameVersion, setGameVersion] = useState("");
  const [resolution, setResolution] = useState("");
  const [fps, setFps] = useState("");
  const [session, setSession] = useState("");
  const [multiplayer, setMultiplayer] = useState("Not tested");
  const [launchOptions, setLaunchOptions] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!supabase) { setError("Supabase is not configured yet. Follow the README setup instructions."); return; }
    if (!userEmail) { onSignIn(); return; }
    setBusy(true);
    try {
      let chosenId = gameId;
      if (mode === "game") {
        if (!title.trim()) throw new Error("Enter a game title.");
        const { error: gameError } = await supabase.from("games").insert({
          title: title.trim(), steam_app_id: steamId.trim() || null,
          submitted_by: (await supabase.auth.getUser()).data.user?.id,
          review_state: "pending"
        }).select("id").single();
        if (gameError) throw gameError;
        setSuccess("Game suggestion submitted. It will appear after a moderator approves it.");
        setBusy(false);
        return;
      }
      if (!chosenId) throw new Error("Choose a game.");
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Please sign in again.");
      const { error: reportError } = await supabase.from("reports").insert({
        game_id: chosenId, user_id: user.id, result,
        mac_model: macModel.trim(), chip: chip.trim(), memory_gb: memory ? Number(memory) : null,
        macos_version: macos.trim(), crossover_version: crossover.trim(), notproton_version: notproton.trim(),
        storefront, game_version: gameVersion.trim() || null, resolution: resolution.trim() || null,
        average_fps: fps ? Number(fps) : null, session_minutes: session ? Number(session) : null,
        multiplayer_status: multiplayer, launch_options: launchOptions.trim() || null, notes: notes.trim() || null
      });
      if (reportError) throw reportError;
      setSuccess("Thanks — your compatibility report has been submitted.");
      setTimeout(onDone, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  return <section className="form-page">
    <div className="eyebrow muted-eyebrow">HELP THE COMMUNITY</div>
    <h1>Share what <span>works.</span></h1>
    <p className="form-intro">Your report helps other Mac gamers understand what to expect from a game on their hardware.</p>
    {!userEmail && <div className="notice"><ShieldCheck size={18}/><span>Sign in is required to submit a report. <button className="inline-link" onClick={onSignIn}>Sign in or create an account</button>.</span></div>}
    <div className="mode-tabs"><button className={mode === "report" ? "mode-tab selected" : "mode-tab"} onClick={() => setMode("report")}>Submit a report</button><button className={mode === "game" ? "mode-tab selected" : "mode-tab"} onClick={() => setMode("game")}>Suggest a game</button></div>
    <form className="report-form" onSubmit={submit}>
      {mode === "game" ? <>
        <div className="form-section-title"><span>01</span><div><h3>Game information</h3><p>New game suggestions are reviewed before appearing in the public catalogue.</p></div></div>
        <label>Game title<input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Baldur's Gate 3"/></label>
        <label>Steam App ID <span className="optional">Optional</span><input value={steamId} onChange={e => setSteamId(e.target.value)} placeholder="e.g. 1086940"/></label>
      </> : <>
        <div className="form-section-title"><span>01</span><div><h3>Game and result</h3><p>Tell us which game you tested and how it performed.</p></div></div>
        <label>Game<select required value={gameId} onChange={e => setGameId(e.target.value)}><option value="">Choose a game…</option>{games.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
        <div className="field-label">How did it run?</div>
        <div className="result-options">
          {(["works","minor_issues","major_issues","does_not_work"] as Result[]).map(v => <button type="button" key={v} onClick={() => setResult(v)} className={`result-option ${result === v ? "chosen" : ""}`}><span className={`result-dot ${v}`}/>{resultLabels[v]}{result === v && <Check size={15}/>}</button>)}
        </div>
        <div className="form-section-title"><span>02</span><div><h3>Your Mac</h3><p>Hardware details help people with similar systems compare results.</p></div></div>
        <div className="form-grid">
          <label>Mac model<input required value={macModel} onChange={e => setMacModel(e.target.value)} placeholder="MacBook Pro 14-inch"/></label>
          <label>Apple chip<input required value={chip} onChange={e => setChip(e.target.value)} placeholder="M4 Pro"/></label>
          <label>Unified memory (GB) <span className="optional">Optional</span><input type="number" min="4" max="512" value={memory} onChange={e => setMemory(e.target.value)} placeholder="24"/></label>
          <label>macOS version<input required value={macos} onChange={e => setMacos(e.target.value)} placeholder="macOS 26.1"/></label>
        </div>
        <div className="form-section-title"><span>03</span><div><h3>Compatibility environment</h3><p>Record the versions involved in the test.</p></div></div>
        <div className="form-grid">
          <label>CrossOver version<input required value={crossover} onChange={e => setCrossover(e.target.value)} placeholder="25.1"/></label>
          <label>NotProton version<input required value={notproton} onChange={e => setNotproton(e.target.value)} placeholder="0.1.0"/></label>
          <label>Storefront<select value={storefront} onChange={e => setStorefront(e.target.value)}><option>Steam</option><option>GOG</option><option>Epic Games</option><option>Other</option></select></label>
          <label>Game version <span className="optional">Optional</span><input value={gameVersion} onChange={e => setGameVersion(e.target.value)} placeholder="Build or version number"/></label>
        </div>
        <div className="form-section-title"><span>04</span><div><h3>Performance and notes</h3><p>Optional details make your report more actionable.</p></div></div>
        <div className="form-grid">
          <label>Resolution <span className="optional">Optional</span><input value={resolution} onChange={e => setResolution(e.target.value)} placeholder="1920 × 1200"/></label>
          <label>Average FPS <span className="optional">Optional</span><input type="number" min="1" max="1000" value={fps} onChange={e => setFps(e.target.value)} placeholder="60"/></label>
          <label>Session length (minutes) <span className="optional">Optional</span><input type="number" min="1" value={session} onChange={e => setSession(e.target.value)} placeholder="45"/></label>
          <label>Multiplayer <select value={multiplayer} onChange={e => setMultiplayer(e.target.value)}><option>Not tested</option><option>Works</option><option>Partially works</option><option>Does not work</option><option>Not applicable</option></select></label>
        </div>
        <label>Launch options or fixes <span className="optional">Optional</span><input value={launchOptions} onChange={e => setLaunchOptions(e.target.value)} placeholder="Commands, bottle settings, patches…"/></label>
        <label>Additional notes <span className="optional">Optional</span><textarea rows={4} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe crashes, graphical glitches, stability, workarounds, and how long you tested…"/></label>
        <p className="privacy-note"><Info size={14}/> Only the information entered in this form is submitted. NotProtonDB does not collect diagnostic data from this website form.</p>
      </>}
      {error && <div className="notice notice-error">{error}</div>}
      {success && <div className="notice notice-success"><Check size={17}/>{success}</div>}
      <button className="button button-primary submit-button" disabled={busy || !isSupabaseConfigured} type="submit">{busy ? "Submitting…" : mode === "game" ? "Submit game suggestion" : "Submit compatibility report"} <ArrowUpRight size={17}/></button>
      {!isSupabaseConfigured && <p className="disabled-hint">Configure Supabase to enable submissions. See README.md.</p>}
    </form>
  </section>;
}

function AboutPage() {
  return <section className="about-page">
    <div className="eyebrow muted-eyebrow">ABOUT THE PROJECT</div>
    <h1>Mac gaming,<br/><span>by the community.</span></h1>
    <p>NotProtonDB is a community-driven compatibility database for Windows PC games running on macOS through NotProton and CrossOver.</p>
    <div className="about-cards">
      <article><Gamepad2/><h3>Real-world reports</h3><p>Compatibility is based on individual user experiences, not assumptions based on a game's ability to launch.</p></article>
      <article><SlidersHorizontal/><h3>Configuration matters</h3><p>Reports capture Mac hardware, macOS, CrossOver, and NotProton versions so results can be compared meaningfully.</p></article>
      <article><ShieldCheck/><h3>Community reviewed</h3><p>Game suggestions are held for approval. Reports remain separate so conflicting experiences are visible.</p></article>
    </div>
    <div className="notice"><CircleHelp size={18}/><span>Compatibility can change with game updates, macOS releases, and compatibility-layer versions. Always check the report details and test dates.</span></div>
    <h2>Compatibility scale</h2>
    <div className="scale-list">{[["Platinum","Works reliably without special changes","platinum"],["Gold","Works with minor adjustments","gold"],["Silver","Playable with noticeable issues","silver"],["Bronze","Runs, but has substantial issues","bronze"],["Borked","Currently reported as not working","borked"],["Untested","Not enough community reports","neutral"]].map(([name,desc,tone]) => <div className="scale-row" key={name}><span className={`rating-pill ${tone}`}>{name}</span><span>{desc}</span></div>)}</div>
    <p className="fine-print">Ratings are an indicative summary of community reports, not a guarantee. NotProtonDB is an independent community project and is not affiliated with Apple, Valve, or CodeWeavers.</p>
  </section>;
}

function AuthModal({ onClose, onMessage }: { onClose: () => void; onMessage: (s: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    if (!supabase) { setError("Supabase is not configured."); setBusy(false); return; }
    const response = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (response.error) setError(response.error.message);
    else {
      onMessage(mode === "signup" ? "Check your email to confirm your account." : "Signed in.");
      if (mode === "signup" && !response.data.session) setError("Check your inbox for the confirmation link, then sign in.");
      else onClose();
    }
    setBusy(false);
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="auth-modal">
      <button className="modal-close" onClick={onClose}><X size={19}/></button>
      <div className="brand-mark modal-mark"><Gamepad2 size={23}/></div>
      <h2>{mode === "signin" ? "Welcome back." : "Join the community."}</h2>
      <p>{mode === "signin" ? "Sign in to submit compatibility reports." : "Create an account to contribute game reports."}</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <label>Password<input type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
        {error && <div className="notice notice-error">{error}</div>}
        <button className="button button-primary submit-button" disabled={busy || !isSupabaseConfigured}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
      </form>
      <button className="inline-link switch-auth" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>{mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
    </div>
  </div>;
}

export default App;
