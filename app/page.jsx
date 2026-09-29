"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const COLS = "nim,nama,prodi,cluster,kelompok,tema,photo_url";

// Kecilkan foto di browser (maks 1024px, JPEG) supaya upload cepat & hemat storage
async function compress(file, max = 1024, quality = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Gagal memproses foto"))), "image/jpeg", quality));
}

export default function Home() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const seq = useRef(0);

  // Cari (debounce 250 ms): nama atau NIM, tidak sensitif huruf besar/kecil
  useEffect(() => {
    const term = q.trim().replace(/[%,()]/g, " ");
    if (term.length < 2) { setResults([]); return; }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("participants").select(COLS)
        .or(`nama.ilike.%${term}%,nim.ilike.%${term}%`)
        .order("nama").limit(30);
      if (id !== seq.current) return;
      setLoading(false);
      if (!error) setResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  function pick(p) { setSelected(p); setFile(null); setPreviewUrl(null); setMsg(null); }
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setPreviewUrl(URL.createObjectURL(f)); setMsg(null);
    e.target.value = "";
  }

  async function save() {
    if (!file || !selected) return;
    setSaving(true); setMsg(null);
    try {
      const blob = await compress(file);
      const path = `${selected.nim}.jpg`;
      const up = await supabase.storage.from("photos").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`; // ?v= supaya foto baru tidak tertahan cache
      const upd = await supabase.from("participants")
        .update({ photo_url: url, photo_updated_at: new Date().toISOString() }).eq("nim", selected.nim);
      if (upd.error) throw upd.error;
      const next = { ...selected, photo_url: url };
      setSelected(next);
      setResults((r) => r.map((x) => (x.nim === next.nim ? next : x)));
      setFile(null); setPreviewUrl(null);
      setMsg({ ok: true, t: "Foto tersimpan." });
    } catch (e) {
      setMsg({ ok: false, t: `Gagal menyimpan: ${e.message || e}` });
    } finally { setSaving(false); }
  }

  if (selected) {
    const shown = previewUrl || selected.photo_url;
    return (
      <main className="detail">
        <button className="back" onClick={() => setSelected(null)}>‹ Kembali ke pencarian</button>
        <h2>{selected.nama}</h2>
        <p className="info">{selected.nim} · {selected.prodi}<br />{selected.kelompok} · {selected.tema}</p>
        {shown
          ? <img className="preview" src={shown} alt={`Foto ${selected.nama}`} />
          : <div className="preview">Belum ada foto</div>}
        <div className="actions">
          <label className="btn">Ambil foto
            <input type="file" accept="image/*" capture="environment" onChange={onFile} />
          </label>
          <label className="btn">Unggah dari galeri
            <input type="file" accept="image/*" onChange={onFile} />
          </label>
          {file && <button className="primary" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan foto"}</button>}
        </div>
        {msg && <p className={`msg ${msg.ok ? "good" : "err"}`}>{msg.t}</p>}
      </main>
    );
  }

  return (
    <main>
      <h1>Foto peserta Intrivia</h1>
      <p className="sub">Ketik nama atau NIM, lalu pilih peserta untuk memotret atau mengunggah foto.</p>
      <input className="search" type="search" placeholder="Cari nama atau NIM" value={q}
        onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Cari nama atau NIM" />
      {q.trim().length >= 2 && !loading && results.length === 0 && <p className="empty">Tidak ada peserta dengan kata itu. Coba sebagian nama saja.</p>}
      <ul className="list">
        {results.map((p) => (
          <li key={p.nim}>
            <button className="row" onClick={() => pick(p)}>
              {p.photo_url
                ? <img className="thumb" src={p.photo_url} alt="" />
                : <span className="thumb">{p.nama[0]}</span>}
              <span className="meta">
                <span className="name">{p.nama}</span><br />
                <span className="small">{p.nim} · {p.kelompok}</span>
              </span>
              <span className={`tag ${p.photo_url ? "ok" : "no"}`}>{p.photo_url ? "Ada foto" : "Belum"}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
