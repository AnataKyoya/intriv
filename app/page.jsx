"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const COLS = "nim,nama,prodi,cluster,photo_url";

// Kecilkan foto di browser (maks 1024px, JPEG) supaya upload cepat & hemat storage
async function compress(file, max = 1024, quality = 0.82) {
	const bmp = await createImageBitmap(file, {
		imageOrientation: "from-image",
	});
	const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
	const c = document.createElement("canvas");
	c.width = Math.round(bmp.width * scale);
	c.height = Math.round(bmp.height * scale);
	c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
	return new Promise((res, rej) =>
		c.toBlob(
			(b) => (b ? res(b) : rej(new Error("Gagal memproses foto"))),
			"image/jpeg",
			quality,
		),
	);
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
	const [done, setDone] = useState([]);
	const [totals, setTotals] = useState(null); // { "TEKNIK INFORMATIKA": 249, ... }
	const seq = useRef(0);

	// Statistik depan: total peserta + daftar yang sudah punya foto (terbaru di atas)
	useEffect(() => {
		(async () => {
			const [all, withPhoto] = await Promise.all([
				supabase.from("participants").select("prodi").limit(5000),
				supabase
					.from("participants")
					.select(COLS)
					.not("photo_url", "is", null)
					.order("photo_updated_at", { ascending: false }),
			]);
			if (all.data) {
				const t = {};
				for (const r of all.data) t[r.prodi] = (t[r.prodi] || 0) + 1;
				setTotals(t);
			}
			if (withPhoto.data) setDone(withPhoto.data);
		})();
	}, []);

	// Cari (debounce 250 ms): nama atau NIM, tidak sensitif huruf besar/kecil
	useEffect(() => {
		const term = q.trim().replace(/[%,()]/g, " ");
		if (term.length < 2) {
			setResults([]);
			return;
		}
		const id = ++seq.current;
		setLoading(true);
		const t = setTimeout(async () => {
			const { data, error } = await supabase
				.from("participants")
				.select(COLS)
				.or(`nama.ilike.%${term}%,nim.ilike.%${term}%`)
				.order("nama")
				.limit(30);
			if (id !== seq.current) return;
			setLoading(false);
			if (!error) setResults(data || []);
		}, 250);
		return () => clearTimeout(t);
	}, [q]);

	useEffect(
		() => () => previewUrl && URL.revokeObjectURL(previewUrl),
		[previewUrl],
	);

	function pick(p) {
		setSelected(p);
		setFile(null);
		setPreviewUrl(null);
		setMsg(null);
	}
	function onFile(e) {
		const f = e.target.files?.[0];
		if (!f) return;
		setFile(f);
		setPreviewUrl(URL.createObjectURL(f));
		setMsg(null);
		e.target.value = "";
	}

	async function save() {
		if (!file || !selected) return;
		setSaving(true);
		setMsg(null);
		try {
			const blob = await compress(file);
			const path = `${selected.nim}.jpg`;
			const up = await supabase.storage
				.from("photos")
				.upload(path, blob, {
					upsert: true,
					contentType: "image/jpeg",
				});
			if (up.error) throw up.error;
			const { data: pub } = supabase.storage
				.from("photos")
				.getPublicUrl(path);
			const url = `${pub.publicUrl}?v=${Date.now()}`; // ?v= supaya foto baru tidak tertahan cache
			const upd = await supabase
				.from("participants")
				.update({
					photo_url: url,
					photo_updated_at: new Date().toISOString(),
				})
				.eq("nim", selected.nim);
			if (upd.error) throw upd.error;
			const next = { ...selected, photo_url: url };
			setSelected(next);
			setResults((r) => r.map((x) => (x.nim === next.nim ? next : x)));
			setDone((d) => [next, ...d.filter((x) => x.nim !== next.nim)]);
			setFile(null);
			setPreviewUrl(null);
			setMsg({ ok: true, t: "Foto tersimpan." });
		} catch (e) {
			setMsg({ ok: false, t: `Gagal menyimpan: ${e.message || e}` });
		} finally {
			setSaving(false);
		}
	}

	if (selected) {
		const shown = previewUrl || selected.photo_url;
		return (
			<main className="detail">
				<button className="back" onClick={() => setSelected(null)}>
					‹ Kembali ke pencarian
				</button>
				<h2>{selected.nama}</h2>
				<p className="info">
					{selected.nim} · {selected.prodi}
					<br />
					{selected.cluster} · {selected.tema}
				</p>
				{shown ? (
					<img
						className="preview"
						src={shown}
						alt={`Foto ${selected.nama}`}
					/>
				) : (
					<div className="preview">Belum ada foto</div>
				)}
				<div className="actions">
					<label className="btn">
						Ambil foto
						<input
							type="file"
							accept="image/*"
							capture="environment"
							onChange={onFile}
						/>
					</label>
					<label className="btn">
						Unggah dari galeri
						<input type="file" accept="image/*" onChange={onFile} />
					</label>
					{file && (
						<button
							className="primary"
							onClick={save}
							disabled={saving}
						>
							{saving ? "Menyimpan…" : "Simpan foto"}
						</button>
					)}
				</div>
				{msg && (
					<p className={`msg ${msg.ok ? "good" : "err"}`}>{msg.t}</p>
				)}
			</main>
		);
	}

	async function exportCsv() {
		setExporting(true);
		try {
			const { data, error } = await supabase
				.from("participants")
				.select("nim,nama,prodi,cluster,photo_url,photo_updated_at")
				.order("cluster")
				.order("nama")
				.limit(5000);
			if (error) throw error;
			const head = [
				"nim",
				"nama",
				"prodi",
				"cluster",
				"ada_foto",
				"photo_url",
				"photo_updated_at",
			];
			const lines = data.map((r) =>
				[
					r.nim,
					r.nama,
					r.prodi,
					r.cluster,
					r.photo_url ? "ya" : "tidak",
					r.photo_url ? r.photo_url.split("?")[0] : "",
					r.photo_updated_at || "",
				]
					.map(csvCell)
					.join(","),
			);
			// BOM supaya Excel membaca UTF-8 dengan benar
			const csv = "\uFEFF" + [head.join(","), ...lines].join("\r\n");
			const url = URL.createObjectURL(
				new Blob([csv], { type: "text/csv;charset=utf-8" }),
			);
			const a = document.createElement("a");
			a.href = url;
			a.download = `peserta-intrivia-${new Date().toISOString().slice(0, 10)}.csv`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (e) {
			alert(`Gagal ekspor: ${e.message || e}`);
		} finally {
			setExporting(false);
		}
	}

	const searching = q.trim().length >= 2;
	const list = searching ? results : done;
	const grandTotal = totals
		? Object.values(totals).reduce((a, b) => a + b, 0)
		: null;
	const prodiRows = totals
		? Object.keys(totals)
				.sort()
				.map((name) => {
					const n = done.filter((d) => d.prodi === name).length;
					return {
						name,
						n,
						total: totals[name],
						pct: Math.round((n / totals[name]) * 100),
					};
				})
		: [];

	return (
		<main>
			<h1>Foto peserta Intrivia</h1>
			<p className="sub">
				Ketik nama atau NIM, lalu pilih peserta untuk memotret atau
				mengunggah foto.
			</p>
			<div className="stat" aria-live="polite">
				<p className="stat-total">
					<strong>{done.length}</strong> dari {grandTotal ?? "…"}{" "}
					peserta sudah difoto
				</p>
				{prodiRows.map((r) => (
					<div key={r.name} className="prodi">
						<div className="stat-top">
							<span className="prodi-name">{r.name}</span>
							<span className="small">
								{r.n}/{r.total} · {r.pct}%
							</span>
						</div>
						<div
							className="bar"
							role="progressbar"
							aria-label={`Progres foto ${r.name}`}
							aria-valuenow={r.pct}
							aria-valuemin={0}
							aria-valuemax={100}
						>
							<div
								className="bar-fill"
								style={{ width: `${r.pct}%` }}
							/>
						</div>
					</div>
				))}
				<button
					className="export"
					onClick={exportCsv}
					disabled={exporting}
				>
					{exporting ? "Menyiapkan…" : "Ekspor CSV"}
				</button>
			</div>
			<input
				className="search"
				type="search"
				placeholder="Cari nama atau NIM"
				value={q}
				onChange={(e) => setQ(e.target.value)}
				autoFocus
				aria-label="Cari nama atau NIM"
			/>
			{searching && !loading && results.length === 0 && (
				<p className="empty">
					Tidak ada peserta dengan kata itu. Coba sebagian nama saja.
				</p>
			)}
			{!searching && (
				<h2 className="section">Sudah difoto ({done.length})</h2>
			)}
			{!searching && done.length === 0 && (
				<p className="empty">
					Belum ada foto. Cari nama peserta untuk mulai.
				</p>
			)}
			<ul className="list">
				{list.map((p) => (
					<li key={p.nim}>
						<button className="row" onClick={() => pick(p)}>
							{p.photo_url ? (
								<img
									className="thumb"
									src={p.photo_url}
									alt=""
									loading="lazy"
								/>
							) : (
								<span className="thumb">{p.nama[0]}</span>
							)}
							<span className="meta">
								<span className="name">{p.nama}</span>
								<br />
								<span className="small">
									{p.nim} · {p.cluster}
								</span>
							</span>
							<span
								className={`tag ${p.photo_url ? "ok" : "no"}`}
							>
								{p.photo_url ? "Ada foto" : "Belum"}
							</span>
						</button>
					</li>
				))}
			</ul>
		</main>
	);
}
