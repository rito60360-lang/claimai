
"use client";
import { useState, useEffect } from "react";

const SYSTEM_PROMPT = `あなたはEC・小売店のクレーム対応専門AIです。担当者向けに返答案を作成してください。

【ルール】
- 冒頭で共感と謝罪を示す
- 具体的な解決策を提示する（返金・交換・再送など状況に応じて）
- 丁寧な敬語、200〜350文字
- 件名と本文を以下の形式で出力する：
件名：〇〇について
本文：（返答内容）`;

const INITIAL_COMPLAINTS = [
  { id: 1, customer: "田中 花子", email: "tanaka@example.com", category: "商品破損", priority: "高", status: "未対応", date: "2026-04-21", text: "注文した商品が届いたのですが、箱が完全につぶれていて中身も壊れていました。高かったのに本当にがっかりです。どうしてくれるんですか？", draft: null, loading: false, sent: false },
  { id: 2, customer: "鈴木 一郎", email: "suzuki@example.com", category: "配送遅延", priority: "中", status: "対応中", date: "2026-04-20", text: "先週注文したのにまだ届きません。サイトには3日以内発送と書いてあったのに、追跡番号を調べても動いていません。いつ届くんですか。", draft: "件名：配送遅延についてのお詫びとご報告\n本文：田中様\n\nこの度はご不便をおかけしまして、誠に申し訳ございません。ご注文の商品につきまして配送状況を確認いたしました。現在、物流センターにて手続き中であることが判明いたしました。本日中に発送手配を完了し、明日〜明後日にはお届けできる見込みです。追跡番号を改めてご連絡いたします。ご不便をおかけして誠に申し訳ございません。", loading: false, sent: false },
  { id: 3, customer: "山本 さくら", email: "yamamoto@example.com", category: "商品間違い", priority: "高", status: "完了", date: "2026-04-19", text: "注文したのと全然違う色のものが届きました。プレゼント用だったのに、これじゃ渡せません。早急に対応してください。", draft: "件名：商品お取り違えのお詫び\n本文：山本様\n\nこの度は誤った商品をお届けしてしまい、誠に申し訳ございません。プレゼント用にご用意いただいていたとのこと、大変ご迷惑をおかけいたしました。正しい商品を本日特急便にて発送いたします。また、誤って届いた商品の返送は着払いにて承りますので、お手数をおかけしますがご返送いただけますと幸いです。ご不便をおかけして誠に申し訳ございません。", loading: false, sent: true },
  { id: 4, customer: "佐藤 健", email: "sato@example.com", category: "返品・返金", priority: "低", status: "未対応", date: "2026-04-21", text: "サイズが合わなかったので返品したいのですが、手続き方法がわかりません。購入から2週間以内です。", draft: null, loading: false, sent: false },
  { id: 5, customer: "伊藤 美咲", email: "ito@example.com", category: "品質問題", priority: "中", status: "未対応", date: "2026-04-20", text: "購入した洋服を1回洗っただけで色落ちしてしまいました。品質が悪すぎます。返金してください。", draft: null, loading: false, sent: false },
];

const STATUS_CONFIG = {
  "未対応": { bg: "#FEE2E2", text: "#DC2626", dot: "#DC2626" },
  "対応中": { bg: "#FEF9C3", text: "#CA8A04", dot: "#CA8A04" },
  "完了":   { bg: "#DCFCE7", text: "#16A34A", dot: "#16A34A" },
};
const PRIORITY_CONFIG = {
  "高": { bg: "#FEE2E2", text: "#DC2626" },
  "中": { bg: "#FEF9C3", text: "#CA8A04" },
  "低": { bg: "#DBEAFE", text: "#2563EB" },
};
const CATEGORIES = ["すべて", "商品破損", "配送遅延", "商品間違い", "返品・返金", "品質問題", "その他"];
const STATUSES = ["すべて", "未対応", "対応中", "完了"];

export default function App() {
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);
  const [selected, setSelected] = useState(INITIAL_COMPLAINTS[0]);
  const [filterStatus, setFilterStatus] = useState("すべて");
  const [filterCategory, setFilterCategory] = useState("すべて");
  const [editingDraft, setEditingDraft] = useState("");
  const [view, setView] = useState("list"); // list | detail | stats
  const [search, setSearch] = useState("");

  const current = complaints.find(c => c.id === selected?.id);

  useEffect(() => {
    if (current?.draft) setEditingDraft(current.draft);
    else setEditingDraft("");
  }, [selected?.id]);

  const filtered = complaints.filter(c => {
    const matchStatus = filterStatus === "すべて" || c.status === filterStatus;
    const matchCat = filterCategory === "すべて" || c.category === filterCategory;
    const matchSearch = !search || c.customer.includes(search) || c.text.includes(search) || c.category.includes(search);
    return matchStatus && matchCat && matchSearch;
  });

  const stats = {
    total: complaints.length,
    未対応: complaints.filter(c => c.status === "未対応").length,
    対応中: complaints.filter(c => c.status === "対応中").length,
    完了: complaints.filter(c => c.status === "完了").length,
    高優先: complaints.filter(c => c.priority === "高" && c.status !== "完了").length,
  };

  const generateDraft = async () => {
    setComplaints(prev => prev.map(c => c.id === current.id ? { ...c, loading: true, draft: null } : c));
    setEditingDraft("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `顧客名：${current.customer}\nカテゴリ：${current.category}\nクレーム内容：${current.text}` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "生成に失敗しました";
      setComplaints(prev => prev.map(c => c.id === current.id ? { ...c, loading: false, draft: text, status: c.status === "未対応" ? "対応中" : c.status } : c));
      setEditingDraft(text);
    } catch {
      setComplaints(prev => prev.map(c => c.id === current.id ? { ...c, loading: false } : c));
    }
  };

  const handleSend = () => {
    setComplaints(prev => prev.map(c => c.id === current.id ? { ...c, status: "完了", draft: editingDraft, sent: true } : c));
  };

  const handleSelect = (c) => {
    setSelected(c);
    setView("detail");
  };

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif", background: "#0F172A", minHeight: "100vh", color: "#E2E8F0", display: "flex", flexDirection: "column" }}>
      {/* Top Nav */}
      <nav style={{ background: "#0F172A", borderBottom: "1px solid #1E293B", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#6366F1,#06B6D4)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.02em", color: "#F1F5F9" }}>ClaimAI</span>
          <span style={{ fontSize: 11, background: "#1E293B", color: "#64748B", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>EC・小売プラン</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["📋", "list", "一覧"], ["📊", "stats", "統計"]].map(([icon, v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{ background: view === v ? "#1E293B" : "transparent", border: "none", color: view === v ? "#6366F1" : "#64748B", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              {icon} {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {stats.高優先 > 0 && <span style={{ background: "#DC2626", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>🔥 緊急 {stats.高優先}件</span>}
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6366F1,#06B6D4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
        </div>
      </nav>

      {/* Stats Bar */}
      <div style={{ background: "#0F172A", borderBottom: "1px solid #1E293B", padding: "12px 24px", display: "flex", gap: 16, overflowX: "auto" }}>
        {[
          { label: "総件数", value: stats.total, color: "#94A3B8" },
          { label: "未対応", value: stats.未対応, color: "#DC2626" },
          { label: "対応中", value: stats.対応中, color: "#CA8A04" },
          { label: "完了", value: stats.完了, color: "#16A34A" },
        ].map(s => (
          <div key={s.label} style={{ background: "#1E293B", borderRadius: 10, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", minWidth: 100 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 12, color: "#64748B" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {view === "stats" ? (
        <StatsView complaints={complaints} stats={stats} />
      ) : view === "detail" && current ? (
        <DetailView
          current={current}
          editingDraft={editingDraft}
          setEditingDraft={setEditingDraft}
          generateDraft={generateDraft}
          handleSend={handleSend}
          onBack={() => setView("list")}
        />
      ) : (
        <ListView
          filtered={filtered}
          complaints={complaints}
          search={search}
          setSearch={setSearch}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          onSelect={handleSelect}
          selected={selected}
        />
      )}
    </div>
  );
}

function ListView({ filtered, search, setSearch, filterStatus, setFilterStatus, filterCategory, setFilterCategory, onSelect, selected }) {
  return (
    <div style={{ padding: 24, flex: 1 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  顧客名・内容で検索..."
          style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 8, padding: "8px 14px", color: "#E2E8F0", fontSize: 13, outline: "none", width: 220 }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ background: filterStatus === s ? "#6366F1" : "#1E293B", border: "none", color: filterStatus === s ? "#fff" : "#94A3B8", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{s}</button>
          ))}
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 8, padding: "7px 12px", color: "#E2E8F0", fontSize: 12, outline: "none", cursor: "pointer" }}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#1E293B", borderRadius: 12, overflow: "hidden", border: "1px solid #334155" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #334155" }}>
              {["顧客名", "カテゴリ", "優先度", "ステータス", "受信日", "内容"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#64748B", fontWeight: 600, letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const sc = STATUS_CONFIG[c.status];
              const pc = PRIORITY_CONFIG[c.priority];
              const isSelected = selected?.id === c.id;
              return (
                <tr key={c.id} onClick={() => onSelect(c)} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #0F172A" : "none", background: isSelected ? "#1A2744" : "transparent", cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = isSelected ? "#1A2744" : "#263147"}
                  onMouseLeave={e => e.currentTarget.style.background = isSelected ? "#1A2744" : "transparent"}
                >
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#F1F5F9" }}>{c.customer}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{c.email}</div>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#94A3B8" }}>{c.category}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ background: pc.bg, color: pc.text, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>{c.priority}</span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ background: sc.bg + "22", color: sc.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot, display: "inline-block" }} />{c.status}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748B" }}>{c.date}</td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#94A3B8", maxWidth: 280 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.text}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>該当するクレームがありません</div>
        )}
      </div>
    </div>
  );
}

function DetailView({ current, editingDraft, setEditingDraft, generateDraft, handleSend, onBack }) {
  const sc = STATUS_CONFIG[current.status];
  const pc = PRIORITY_CONFIG[current.priority];
  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto", width: "100%" }}>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#6366F1", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>← 一覧に戻る</button>
      
      {/* Header */}
      <div style={{ background: "#1E293B", borderRadius: 12, padding: "20px 24px", marginBottom: 16, border: "1px solid #334155" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: "#F1F5F9", marginBottom: 4 }}>{current.customer}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>{current.email} · {current.date}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ background: pc.bg, color: pc.text, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>優先度：{current.priority}</span>
            <span style={{ background: sc.bg + "22", color: sc.text, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>{current.status}</span>
          </div>
        </div>
        <div style={{ background: "#0F172A", borderRadius: 8, padding: "14px 16px", fontSize: 14, color: "#CBD5E1", lineHeight: 1.8, borderLeft: "3px solid #334155" }}>
          {current.text}
        </div>
        <button
          onClick={generateDraft}
          disabled={current.loading}
          style={{ marginTop: 16, background: current.loading ? "#334155" : "linear-gradient(135deg,#6366F1,#06B6D4)", color: current.loading ? "#64748B" : "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: current.loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          {current.loading
            ? <><Spinner />AI生成中...</>
            : current.draft ? "🔄 返答案を再生成する" : "⚡ AI返答案を生成する"}
        </button>
      </div>

      {/* Draft */}
      {(current.draft || current.loading) && (
        <div style={{ background: "#1E293B", borderRadius: 12, padding: "20px 24px", border: "1px solid #334155" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#94A3B8", marginBottom: 12 }}>✏️ 返答案（自由に編集できます）</div>
          {current.loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#475569" }}>
              <Spinner large /><div style={{ marginTop: 12, fontSize: 13 }}>AIが返答案を生成しています...</div>
            </div>
          ) : (
            <>
              <textarea
                value={editingDraft}
                onChange={e => setEditingDraft(e.target.value)}
                rows={10}
                style={{ width: "100%", background: "#0F172A", border: "1px solid #334155", borderRadius: 8, padding: "14px 16px", color: "#E2E8F0", fontSize: 13, lineHeight: 1.9, resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  onClick={handleSend}
                  disabled={current.sent}
                  style={{ flex: 1, background: current.sent ? "#166534" : "linear-gradient(135deg,#16A34A,#22C55E)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: current.sent ? "not-allowed" : "pointer" }}
                >{current.sent ? "✓ 送信済み" : "📨 この内容で送信する"}</button>
              </div>
              <p style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>※ 送信前に必ず内容を確認してください。AIの返答案は担当者の判断で編集できます。</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatsView({ complaints, stats }) {
  const categories = {};
  complaints.forEach(c => { categories[c.category] = (categories[c.category] || 0) + 1; });
  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#F1F5F9", marginBottom: 20 }}>📊 クレーム統計</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Status Breakdown */}
        <div style={{ background: "#1E293B", borderRadius: 12, padding: "20px 24px", border: "1px solid #334155" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>ステータス別</div>
          {[["未対応", stats.未対応, "#DC2626"], ["対応中", stats.対応中, "#CA8A04"], ["完了", stats.完了, "#16A34A"]].map(([label, val, color]) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: "#CBD5E1" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{val}件</span>
              </div>
              <div style={{ height: 6, background: "#0F172A", borderRadius: 3 }}>
                <div style={{ height: "100%", width: `${(val / stats.total) * 100}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Category Breakdown */}
        <div style={{ background: "#1E293B", borderRadius: 12, padding: "20px 24px", border: "1px solid #334155" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>カテゴリ別</div>
          {sorted.map(([cat, count]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: "#CBD5E1" }}>{cat}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#6366F1" }}>{count}件</span>
              </div>
              <div style={{ height: 6, background: "#0F172A", borderRadius: 3 }}>
                <div style={{ height: "100%", width: `${(count / max) * 100}%`, background: "linear-gradient(90deg,#6366F1,#06B6D4)", borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Summary Card */}
        <div style={{ background: "linear-gradient(135deg,#1E1B4B,#1E293B)", borderRadius: 12, padding: "20px 24px", border: "1px solid #4338CA44", gridColumn: "1 / -1" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#818CF8", marginBottom: 12 }}>📈 今週のサマリー</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[
              { label: "対応完了率", value: `${Math.round((stats.完了 / stats.total) * 100)}%`, sub: "目標 80%" },
              { label: "緊急対応待ち", value: `${stats.高優先}件`, sub: "優先度「高」" },
              { label: "AI活用件数", value: "2件", sub: "返答案生成済み" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#6366F1" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: "#475569" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner({ large }) {
  return (
    <span style={{ display: "inline-block", width: large ? 24 : 14, height: large ? 24 : 14, border: `2px solid ${large ? "#334155" : "#fff"}`, borderTopColor: large ? "#6366F1" : "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
