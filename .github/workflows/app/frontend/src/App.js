import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API = (process.env.REACT_APP_BACKEND_URL || "http://localhost:8000") + "/api";

/* -------- utilitaires -------- */
async function jsonFetch(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename; document.body.appendChild(a);
  a.click(); a.remove(); URL.revokeObjectURL(url);
}
function svgToPng(svgEl, filename) {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const w = svgEl.viewBox.baseVal.width || svgEl.clientWidth || 800;
    const h = svgEl.viewBox.baseVal.height || svgEl.clientHeight || 300;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--surface-1") || "#fff";
    ctx.fillStyle = (bg || "#fff").trim(); ctx.fillRect(0,0,w,h);
    ctx.drawImage(img, 0, 0);
    c.toBlob(b => downloadBlob(b, filename));
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

/* --------- composants charts (SVG minimal) --------- */
function BarChart({ data, xKey, yKey, title }) {
  const svgRef = useRef(null);
  const width = 800, height = 300, pad = 40;
  const items = data || [];
  const max = Math.max(1, ...items.map(d => Number(d[yKey] ?? 0)));
  const barW = (width - pad * 2) / Math.max(1, items.length);

  return (
    <div className="card">
      <div className="card-header">
        <strong>{title}</strong>
        <button className="btn" onClick={() => {
          const theme = document.documentElement.classList.contains("light") ? "light" : "dark";
          svgToPng(svgRef.current, `bar_${theme}.png`);
        }}>Export PNG</button>
      </div>
      <svg ref={svgRef} width={width} height={height} role="img" aria-label={`${title} chart`}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="axis" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="axis" />
        {items.map((d, i) => {
          const h = (Number(d[yKey]) / max) * (height - pad * 2);
          return (
            <rect key={i}
              x={pad + i * barW + barW * 0.1}
              y={height - pad - h}
              width={barW * 0.8}
              height={h}
              className="bar" />
          );
        })}
        {items.map((d, i) => (
          <text key={`x-${i}`} x={pad + i * barW + barW / 2} y={height - pad + 14}
            className="tick" textAnchor="middle">
            {String(d[xKey]).slice(0, 10)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function LineChart({ data, xKey, yKey, title }) {
  const svgRef = useRef(null);
  const width = 800, height = 300, pad = 40;
  const items = data || [];
  const max = Math.max(1, ...items.map(d => Number(d[yKey] ?? 0)));
  const step = (width - pad * 2) / Math.max(1, items.length - 1);
  const points = items.map((d, i) => {
    const x = pad + i * step;
    const y = height - pad - (Number(d[yKey]) / max) * (height - pad * 2);
    return `${x},${y}`;
  });
  return (
    <div className="card">
      <div className="card-header">
        <strong>{title}</strong>
        <button className="btn" onClick={() => {
          const theme = document.documentElement.classList.contains("light") ? "light" : "dark";
          svgToPng(svgRef.current, `line_${theme}.png`);
        }}>Export PNG</button>
      </div>
      <svg ref={svgRef} width={800} height={300} role="img" aria-label={`${title} chart`}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="axis" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="axis" />
        <polyline className="line" points={points.join(" ")} />
        {items.map((d, i) => {
          const x = pad + i * step;
          const y = height - pad - (Number(d[yKey]) / max) * (height - pad * 2);
          return <circle key={i} cx={x} cy={y} r={3} className="dot" />;
        })}
      </svg>
    </div>
  );
}

function PieChart({ data, labelKey, valueKey, title }) {
  const svgRef = useRef(null);
  const width = 320, height = 320, cx = width / 2, cy = height / 2, r = 150;
  const items = data || [];
  const total = Math.max(1, items.reduce((a, b) => a + Number(b[valueKey] ?? 0), 0));
  let acc = 0;
  const slices = items.map((d) => {
    const val = Number(d[valueKey] ?? 0);
    const angle = (val / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(acc), y1 = cy + r * Math.sin(acc);
    const x2 = cx + r * Math.cos(acc + angle), y2 = cy + r * Math.sin(acc + angle);
    const large = angle > Math.PI ? 1 : 0;
    acc += angle;
    return { path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z` };
  });

  return (
    <div className="card">
      <div className="card-header">
        <strong>{title}</strong>
        <button className="btn" onClick={() => {
          const theme = document.documentElement.classList.contains("light") ? "light" : "dark";
          svgToPng(svgRef.current, `pie_${theme}.png`);
        }}>Export PNG</button>
      </div>
      <svg ref={svgRef} width={width} height={height} role="img" aria-label={`${title} chart`}>
        {slices.map((s, i) => <path key={i} d={s.path} className="pie-slice" />)}
      </svg>
    </div>
  );
}

/* ------------------- App ------------------- */
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [datasets, setDatasets] = useState([]);
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState([]);
  const [column, setColumn] = useState("");
  const [value, setValue] = useState("");
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    jsonFetch(`${API}/datasets`).then(d => setDatasets(d.items || [])).catch(console.error);
  }, []);

  const columns = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);

  const groupBy = (key) => {
    if (!key) return [];
    const m = new Map();
    rows.forEach(r => m.set(r[key], (m.get(r[key]) || 0) + 1));
    return Array.from(m.entries()).map(([k, v]) => ({ key: String(k), count: v }));
  };
  const barPieData = useMemo(() => groupBy(columns[0]), [rows, columns]);
  const lineData = useMemo(() => rows.map((_, i) => ({ idx: i + 1, count: i + 1 })), [rows]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`${API}/files/upload`, { method: "POST", body: fd });
    const list = await jsonFetch(`${API}/datasets`);
    setDatasets(list.items || []);
  }

  async function loadDataset(id) {
    setSelected(id);
    const body = { limit, offset };
    const d = await jsonFetch(`${API}/datasets/${id}/data`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    setRows(d.rows || []);
  }

  async function applyFilters() {
    if (!selected) return;
    const body = { limit, offset };
    if (column && value) Object.assign(body, { column, value });
    const d = await jsonFetch(`${API}/datasets/${selected}/data`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    setRows(d.rows || []);
  }

  async function exportCSV() {
    if (!selected) return;
    const body = { limit, offset };
    if (column && value) Object.assign(body, { column, value });
    const r = await fetch(`${API}/datasets/${selected}/export/csv`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const blob = await r.blob();
    downloadBlob(blob, `${selected}.csv`);
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Mini BI</h1>
        <div className="right">
          <label className="controls">
            <input
              type="checkbox"
              checked={theme === "light"}
              onChange={(e) => setTheme(e.target.checked ? "light" : "dark")}
              aria-label="Basculer thème clair/sombre"
            />
            <span>Thème: {theme}</span>
          </label>
        </div>
      </header>

      <section className="panel">
        <div className="row">
          <div className="block">
            <label className="label">Uploader CSV</label>
            <input type="file" accept=".csv" onChange={handleUpload} />
          </div>

          <div className="block">
            <label className="label">Datasets</label>
            <select value={selected} onChange={(e) => loadDataset(e.target.value)}>
              <option value="">— sélectionner —</option>
              {datasets.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.rows})</option>
              ))}
            </select>
          </div>

          <div className="block">
            <label className="label">Colonne</label>
            <select value={column} onChange={(e) => setColumn(e.target.value)}>
              <option value="">(aucune)</option>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="block">
            <label className="label">Valeur</label>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="égalité" />
          </div>

          <div className="block">
            <label className="label">Limit</label>
            <input type="number" value={limit} min={1} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>

          <div className="block">
            <label className="label">Offset</label>
            <input type="number" value={offset} min={0} onChange={(e) => setOffset(Number(e.target.value))} />
          </div>

          <div className="block">
            <label className="label">&nbsp;</label>
            <button className="btn primary" onClick={applyFilters} disabled={!selected}>Appliquer filtres</button>
          </div>

          <div className="block">
            <label className="label">&nbsp;</label>
            <button className="btn" onClick={exportCSV} disabled={!selected}>Export CSV</button>
          </div>
        </div>
      </section>

      <section className="grid">
        <BarChart data={barPieData} xKey="key" yKey="count" title="Comptes par 1ère colonne" />
        <LineChart data={lineData} xKey="idx" yKey="count" title="Cumul simple" />
        <PieChart data={barPieData} labelKey="key" valueKey="count" title="Répartition 1ère colonne" />

        <div className="card">
          <div className="card-header"><strong>Table</strong></div>
          <div className="table">
            <table>
              <thead>
                <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {columns.map(c => <td key={c + i}>{String(r[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
