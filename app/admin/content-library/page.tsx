"use client";

import { useState, useEffect, useCallback } from "react";

interface ContentPage {
  id: string;
  title: string;
  body: string;
  subtopicId: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  subtopic?: {
    id: string; name: string; topicId: string;
    topic?: { id: string; name: string; subjectId: string; subject?: { id: string; name: string; categoryId: string; category?: { id: string; name: string } } };
  } | null;
}

interface PdfAsset {
  id: string;
  title: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  categoryId: string | null;
  subjectId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

interface TaxItem { id: string; name: string; }

export default function ContentLibraryPage() {
  const [tab, setTab] = useState<"html" | "pdf">("html");

  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [pageSearch, setPageSearch] = useState("");
  const [pagePubFilter, setPagePubFilter] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageTotalPages, setPageTotalPages] = useState(1);

  const [pdfs, setPdfs] = useState<PdfAsset[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(true);
  const [pdfSearch, setPdfSearch] = useState("");
  const [pdfPubFilter, setPdfPubFilter] = useState("");
  const [pdfPageNum, setPdfPageNum] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(1);

  const [showPageModal, setShowPageModal] = useState(false);
  const [editingPage, setEditingPage] = useState<ContentPage | null>(null);
  const [pageForm, setPageForm] = useState({ title: "", body: "", categoryId: "", subjectId: "", topicId: "", subtopicId: "", isPublished: false, xpEnabled: false, xpValue: "0" });
  const [showPreview, setShowPreview] = useState(false);

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [editingPdf, setEditingPdf] = useState<PdfAsset | null>(null);
  const [pdfForm, setPdfForm] = useState({ title: "", categoryId: "", subjectId: "", topicId: "", subtopicId: "", isPublished: false });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", categoryId: "", subjectId: "", topicId: "", subtopicId: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [categories, setCategories] = useState<TaxItem[]>([]);
  const [subjects, setSubjects] = useState<TaxItem[]>([]);
  const [topics, setTopics] = useState<TaxItem[]>([]);
  const [subtopics, setSubtopics] = useState<TaxItem[]>([]);

  const [upSubjects, setUpSubjects] = useState<TaxItem[]>([]);
  const [upTopics, setUpTopics] = useState<TaxItem[]>([]);
  const [upSubtopics, setUpSubtopics] = useState<TaxItem[]>([]);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTax = async (level: string, parentId?: string): Promise<TaxItem[]> => {
    const params = new URLSearchParams({ level });
    if (parentId) params.set("parentId", parentId);
    const res = await fetch(`/api/taxonomy?${params}`);
    const json = await res.json();
    return json.data || [];
  };

  useEffect(() => { loadTax("category").then(setCategories); }, []);

  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    const params = new URLSearchParams({ page: String(pageNum), pageSize: "20" });
    if (pageSearch) params.set("search", pageSearch);
    if (pagePubFilter) params.set("isPublished", pagePubFilter);
    try {
      const res = await fetch(`/api/content-pages?${params}`);
      const json = await res.json();
      setPages(json.items || []);
      setPageTotalPages(Math.ceil((json.total || 0) / 20));
    } catch { showToast("Failed to load pages", "error"); }
    finally { setLoadingPages(false); }
  }, [pageNum, pageSearch, pagePubFilter]);

  const loadPdfs = useCallback(async () => {
    setLoadingPdfs(true);
    const params = new URLSearchParams({ page: String(pdfPageNum), pageSize: "20" });
    if (pdfSearch) params.set("search", pdfSearch);
    if (pdfPubFilter) params.set("isPublished", pdfPubFilter);
    try {
      const res = await fetch(`/api/pdf-assets?${params}`);
      const json = await res.json();
      setPdfs(json.items || []);
      setPdfTotalPages(Math.ceil((json.total || 0) / 20));
    } catch { showToast("Failed to load PDFs", "error"); }
    finally { setLoadingPdfs(false); }
  }, [pdfPageNum, pdfSearch, pdfPubFilter]);

  useEffect(() => { loadPages(); }, [loadPages]);
  useEffect(() => { loadPdfs(); }, [loadPdfs]);

  const handleTaxChange = async (level: string, value: string, target: "page" | "upload" | "pdfEdit") => {
    const setForm = target === "page" ? (v: any) => setPageForm((f: any) => ({ ...f, ...v }))
      : target === "upload" ? (v: any) => setUploadForm((f: any) => ({ ...f, ...v }))
      : (v: any) => setPdfForm((f: any) => ({ ...f, ...v }));
    const setSub = target === "upload" ? setUpSubjects : setSubjects;
    const setTop = target === "upload" ? setUpTopics : setTopics;
    const setSubt = target === "upload" ? setUpSubtopics : setSubtopics;

    if (level === "category") {
      setForm({ categoryId: value, subjectId: "", topicId: "", subtopicId: "" });
      setSub(value ? await loadTax("subject", value) : []);
      setTop([]); setSubt([]);
    } else if (level === "subject") {
      setForm({ subjectId: value, topicId: "", subtopicId: "" });
      setTop(value ? await loadTax("topic", value) : []);
      setSubt([]);
    } else if (level === "topic") {
      setForm({ topicId: value, subtopicId: "" });
      setSubt(value ? await loadTax("subtopic", value) : []);
    } else if (level === "subtopic") {
      setForm({ subtopicId: value });
    }
  };

  const openPageEditor = async (p?: ContentPage) => {
    if (p) {
      setEditingPage(p);
      const catId = p.subtopic?.topic?.subject?.categoryId || "";
      const subId = p.subtopic?.topic?.subjectId || "";
      const topId = p.subtopic?.topicId || "";
      setPageForm({
        title: p.title, body: p.body,
        categoryId: catId, subjectId: subId, topicId: topId,
        subtopicId: p.subtopicId || "",
        isPublished: p.isPublished,
        xpEnabled: !!(p as any).xpEnabled,
        xpValue: (p as any).xpValue != null ? String((p as any).xpValue) : "0",
      });
      if (catId) setSubjects(await loadTax("subject", catId));
      if (subId) setTopics(await loadTax("topic", subId));
      if (topId) setSubtopics(await loadTax("subtopic", topId));
    } else {
      setEditingPage(null);
      setPageForm({ title: "", body: "", categoryId: "", subjectId: "", topicId: "", subtopicId: "", isPublished: false, xpEnabled: false, xpValue: "0" });
      setSubjects([]); setTopics([]); setSubtopics([]);
    }
    setShowPreview(false);
    setShowPageModal(true);
  };

  const handleSavePage = async () => {
    if (!pageForm.title.trim()) { showToast("Title is required", "error"); return; }
    if (!pageForm.body.trim()) { showToast("Body content is required", "error"); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: pageForm.title,
        body: pageForm.body,
        subtopicId: pageForm.subtopicId || null,
        isPublished: pageForm.isPublished,
        xpEnabled: pageForm.xpEnabled,
        xpValue: parseInt(pageForm.xpValue) || 0,
      };
      let res;
      if (editingPage) {
        res = await fetch(`/api/content-pages/${editingPage.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/content-pages", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(editingPage ? "Page updated" : "Page created", "success");
      setShowPageModal(false);
      loadPages();
    } catch { showToast("Failed to save page", "error"); }
    finally { setSaving(false); }
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm("Delete this content page?")) return;
    try {
      const res = await fetch(`/api/content-pages/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Page deleted", "success");
      loadPages();
    } catch { showToast("Failed to delete", "error"); }
  };

  const handleUploadPdf = async () => {
    if (!uploadForm.title.trim()) { showToast("Title is required", "error"); return; }
    if (!uploadFile) { showToast("Please select a PDF file", "error"); return; }
    if (uploadFile.type !== "application/pdf") { showToast("Only PDF files are allowed", "error"); return; }
    if (uploadFile.size > 20 * 1024 * 1024) { showToast("File exceeds 20MB limit", "error"); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", uploadForm.title);
      fd.append("file", uploadFile);
      if (uploadForm.categoryId) fd.append("categoryId", uploadForm.categoryId);
      if (uploadForm.subjectId) fd.append("subjectId", uploadForm.subjectId);
      if (uploadForm.topicId) fd.append("topicId", uploadForm.topicId);
      if (uploadForm.subtopicId) fd.append("subtopicId", uploadForm.subtopicId);

      const res = await fetch("/api/pdf-assets", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Upload failed", "error"); return; }
      showToast("PDF uploaded", "success");
      setShowUploadForm(false);
      setUploadForm({ title: "", categoryId: "", subjectId: "", topicId: "", subtopicId: "" });
      setUploadFile(null);
      loadPdfs();
    } catch { showToast("Failed to upload", "error"); }
    finally { setSaving(false); }
  };

  const openPdfEditor = async (pdf: PdfAsset) => {
    setEditingPdf(pdf);
    setPdfForm({
      title: pdf.title,
      categoryId: pdf.categoryId || "",
      subjectId: pdf.subjectId || "",
      topicId: pdf.topicId || "",
      subtopicId: pdf.subtopicId || "",
      isPublished: pdf.isPublished,
    });
    if (pdf.categoryId) setSubjects(await loadTax("subject", pdf.categoryId));
    if (pdf.subjectId) setTopics(await loadTax("topic", pdf.subjectId));
    if (pdf.topicId) setSubtopics(await loadTax("subtopic", pdf.topicId));
    setShowPdfModal(true);
  };

  const handleSavePdf = async () => {
    if (!editingPdf || !pdfForm.title.trim()) { showToast("Title is required", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/pdf-assets/${editingPdf.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pdfForm.title,
          categoryId: pdfForm.categoryId || null,
          subjectId: pdfForm.subjectId || null,
          topicId: pdfForm.topicId || null,
          subtopicId: pdfForm.subtopicId || null,
          isPublished: pdfForm.isPublished,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("PDF updated", "success");
      setShowPdfModal(false);
      loadPdfs();
    } catch { showToast("Failed to update", "error"); }
    finally { setSaving(false); }
  };

  const handleDeletePdf = async (id: string) => {
    if (!confirm("Delete this PDF asset?")) return;
    try {
      const res = await fetch(`/api/pdf-assets/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("PDF deleted", "success");
      loadPdfs();
    } catch { showToast("Failed to delete", "error"); }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max) + "..." : s;

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem", outline: "none" };
  const btnPrimary: React.CSSProperties = { padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 };
  const btnSecondary: React.CSSProperties = { padding: "8px 16px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "0.875rem" };
  const btnDanger: React.CSSProperties = { padding: "6px 12px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" };
  const btnSmall: React.CSSProperties = { padding: "4px 10px", fontSize: "0.8rem", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", background: "#fff" };
  const badgeStyle = (pub: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 600,
    background: pub ? "#dcfce7" : "#fef3c7", color: pub ? "#166534" : "#92400e",
  });
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 24px", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", border: "none",
    borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
    background: "transparent", color: active ? "#2563eb" : "#6b7280",
  });

  const renderTaxDropdowns = (form: any, target: "page" | "upload" | "pdfEdit", subs: TaxItem[], tops: TaxItem[], subts: TaxItem[]) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
      <div>
        <label style={{ fontSize: "0.7rem", color: "#6b7280" }}>Category</label>
        <select style={inputStyle} value={form.categoryId} onChange={(e) => handleTaxChange("category", e.target.value, target)}>
          <option value="">None</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: "0.7rem", color: "#6b7280" }}>Subject</label>
        <select style={inputStyle} value={form.subjectId} onChange={(e) => handleTaxChange("subject", e.target.value, target)} disabled={!form.categoryId}>
          <option value="">None</option>
          {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: "0.7rem", color: "#6b7280" }}>Topic</label>
        <select style={inputStyle} value={form.topicId} onChange={(e) => handleTaxChange("topic", e.target.value, target)} disabled={!form.subjectId}>
          <option value="">None</option>
          {tops.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: "0.7rem", color: "#6b7280" }}>Subtopic</label>
        <select style={inputStyle} value={form.subtopicId} onChange={(e) => handleTaxChange("subtopic", e.target.value, target)} disabled={!form.topicId}>
          <option value="">None</option>
          {subts.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, padding: "12px 20px", borderRadius: "8px", zIndex: 9999,
          background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "success" ? "#166534" : "#991b1b",
          boxShadow: "0 4px 12px rgba(0,0,0,.15)", fontWeight: 500, fontSize: "0.875rem",
        }}>
          {toast.msg}
        </div>
      )}

      <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111", marginBottom: "16px" }}>Content Library</h1>

      <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: "20px" }}>
        <button style={tabStyle(tab === "html")} onClick={() => setTab("html")}>HTML Pages</button>
        <button style={tabStyle(tab === "pdf")} onClick={() => setTab("pdf")}>PDF Library</button>
      </div>

      {/* HTML PAGES TAB */}
      {tab === "html" && (
        <div>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <input type="text" placeholder="Search pages..." value={pageSearch}
              onChange={(e) => { setPageSearch(e.target.value); setPageNum(1); }}
              style={{ ...inputStyle, maxWidth: "250px" }} />
            <select value={pagePubFilter} onChange={(e) => { setPagePubFilter(e.target.value); setPageNum(1); }} style={{ ...inputStyle, maxWidth: "150px" }}>
              <option value="">All</option>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
            <div style={{ flex: 1 }} />
            <button style={btnPrimary} onClick={() => openPageEditor()}>+ New HTML Page</button>
          </div>

          {loadingPages ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>Loading...</p>
          ) : pages.length === 0 ? (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px" }}>No content pages found</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Title</th>
                  <th style={{ padding: "8px" }}>Subtopic</th>
                  <th style={{ padding: "8px" }}>Status</th>
                  <th style={{ padding: "8px" }}>Updated</th>
                  <th style={{ padding: "8px", width: "140px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px", fontWeight: 500 }}>{truncate(p.title, 50)}</td>
                    <td style={{ padding: "8px", color: "#6b7280" }}>{p.subtopic?.name || "-"}</td>
                    <td style={{ padding: "8px" }}><span style={badgeStyle(p.isPublished)}>{p.isPublished ? "Published" : "Draft"}</span></td>
                    <td style={{ padding: "8px", color: "#6b7280" }}>{formatDate(p.updatedAt)}</td>
                    <td style={{ padding: "8px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button style={{ ...btnSmall, color: "#2563eb" }} onClick={() => openPageEditor(p)}>Edit</button>
                        <button style={{ ...btnSmall, color: "#ef4444" }} onClick={() => handleDeletePage(p.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pageTotalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "12px" }}>
              <button style={btnSmall} disabled={pageNum <= 1} onClick={() => setPageNum(pageNum - 1)}>Prev</button>
              <span style={{ fontSize: "0.8rem", color: "#6b7280", lineHeight: "28px" }}>{pageNum}/{pageTotalPages}</span>
              <button style={btnSmall} disabled={pageNum >= pageTotalPages} onClick={() => setPageNum(pageNum + 1)}>Next</button>
            </div>
          )}
        </div>
      )}

      {/* PDF LIBRARY TAB */}
      {tab === "pdf" && (
        <div>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <input type="text" placeholder="Search PDFs..." value={pdfSearch}
              onChange={(e) => { setPdfSearch(e.target.value); setPdfPageNum(1); }}
              style={{ ...inputStyle, maxWidth: "250px" }} />
            <select value={pdfPubFilter} onChange={(e) => { setPdfPubFilter(e.target.value); setPdfPageNum(1); }} style={{ ...inputStyle, maxWidth: "150px" }}>
              <option value="">All</option>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
            <div style={{ flex: 1 }} />
            <button style={btnPrimary} onClick={() => { setShowUploadForm(true); setUploadForm({ title: "", categoryId: "", subjectId: "", topicId: "", subtopicId: "" }); setUploadFile(null); setUpSubjects([]); setUpTopics([]); setUpSubtopics([]); }}>+ Upload PDF</button>
          </div>

          {loadingPdfs ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>Loading...</p>
          ) : pdfs.length === 0 ? (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px" }}>No PDF assets found</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Title</th>
                  <th style={{ padding: "8px" }}>File</th>
                  <th style={{ padding: "8px" }}>Size</th>
                  <th style={{ padding: "8px" }}>Status</th>
                  <th style={{ padding: "8px" }}>Updated</th>
                  <th style={{ padding: "8px", width: "140px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pdfs.map((pdf) => (
                  <tr key={pdf.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px", fontWeight: 500 }}>{truncate(pdf.title, 40)}</td>
                    <td style={{ padding: "8px" }}>
                      <a href={pdf.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.8rem" }}>
                        Open PDF
                      </a>
                    </td>
                    <td style={{ padding: "8px", color: "#6b7280" }}>{formatSize(pdf.fileSize)}</td>
                    <td style={{ padding: "8px" }}><span style={badgeStyle(pdf.isPublished)}>{pdf.isPublished ? "Published" : "Draft"}</span></td>
                    <td style={{ padding: "8px", color: "#6b7280" }}>{formatDate(pdf.updatedAt)}</td>
                    <td style={{ padding: "8px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button style={{ ...btnSmall, color: "#2563eb" }} onClick={() => openPdfEditor(pdf)}>Edit</button>
                        <button style={{ ...btnSmall, color: "#ef4444" }} onClick={() => handleDeletePdf(pdf.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pdfTotalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "12px" }}>
              <button style={btnSmall} disabled={pdfPageNum <= 1} onClick={() => setPdfPageNum(pdfPageNum - 1)}>Prev</button>
              <span style={{ fontSize: "0.8rem", color: "#6b7280", lineHeight: "28px" }}>{pdfPageNum}/{pdfTotalPages}</span>
              <button style={btnSmall} disabled={pdfPageNum >= pdfTotalPages} onClick={() => setPdfPageNum(pdfPageNum + 1)}>Next</button>
            </div>
          )}
        </div>
      )}

      {/* HTML PAGE EDITOR MODAL */}
      {showPageModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "700px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>{editingPage ? "Edit HTML Page" : "New HTML Page"}</h3>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Title *</label>
              <input style={inputStyle} value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Body (HTML) *</label>
                <button style={{ ...btnSmall, fontSize: "0.7rem" }} onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? "Edit" : "Preview"}
                </button>
              </div>
              {showPreview ? (
                <div
                  style={{ border: "1px solid #d1d5db", borderRadius: "6px", padding: "12px", minHeight: "200px", fontSize: "0.875rem", background: "#fafafa" }}
                  dangerouslySetInnerHTML={{ __html: pageForm.body }}
                />
              ) : (
                <textarea
                  style={{ ...inputStyle, minHeight: "200px", fontFamily: "monospace", fontSize: "0.8rem" }}
                  value={pageForm.body}
                  onChange={(e) => setPageForm({ ...pageForm, body: e.target.value })}
                  placeholder="Enter HTML content..."
                />
              )}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" }}>Taxonomy (optional)</label>
              {renderTaxDropdowns(pageForm, "page", subjects, topics, subtopics)}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input type="checkbox" checked={pageForm.isPublished} onChange={(e) => setPageForm({ ...pageForm, isPublished: e.target.checked })} />
                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Published</span>
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd", marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={pageForm.xpEnabled} onChange={(e) => setPageForm({ ...pageForm, xpEnabled: e.target.checked })} />
                XP Reward
              </label>
              {pageForm.xpEnabled && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input type="number" min="0" value={pageForm.xpValue} onChange={(e) => setPageForm({ ...pageForm, xpValue: e.target.value })} style={{ border: "1px solid #d1d5db", borderRadius: "6px", padding: "4px 8px", fontSize: "0.875rem", width: "80px" }} placeholder="XP" />
                  <span style={{ fontSize: "0.72rem", color: "#0369a1" }}>XP on completion</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setShowPageModal(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleSavePage} disabled={saving}>{saving ? "Saving..." : editingPage ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF UPLOAD MODAL */}
      {showUploadForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "520px", maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>Upload PDF</h3>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Title *</label>
              <input style={inputStyle} value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>PDF File *</label>
              <input type="file" accept=".pdf,application/pdf" style={{ display: "block", marginTop: "4px", fontSize: "0.875rem" }}
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              {uploadFile && <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "4px" }}>{uploadFile.name} ({formatSize(uploadFile.size)})</p>}
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" }}>Taxonomy (optional)</label>
              {renderTaxDropdowns(uploadForm, "upload", upSubjects, upTopics, upSubtopics)}
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setShowUploadForm(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleUploadPdf} disabled={saving}>{saving ? "Uploading..." : "Upload"}</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF EDIT MODAL */}
      {showPdfModal && editingPdf && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "520px", maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>Edit PDF Asset</h3>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Title *</label>
              <input style={inputStyle} value={pdfForm.title} onChange={(e) => setPdfForm({ ...pdfForm, title: e.target.value })} />
            </div>

            <div style={{ marginBottom: "12px", padding: "8px", background: "#f3f4f6", borderRadius: "6px", fontSize: "0.8rem" }}>
              <span style={{ color: "#6b7280" }}>File: </span>
              <a href={editingPdf.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
                {editingPdf.fileUrl.split("/").pop()}
              </a>
              <span style={{ color: "#9ca3af", marginLeft: "8px" }}>({formatSize(editingPdf.fileSize)})</span>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" }}>Taxonomy (optional)</label>
              {renderTaxDropdowns(pdfForm, "pdfEdit", subjects, topics, subtopics)}
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input type="checkbox" checked={pdfForm.isPublished} onChange={(e) => setPdfForm({ ...pdfForm, isPublished: e.target.checked })} />
                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Published</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setShowPdfModal(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleSavePdf} disabled={saving}>{saving ? "Saving..." : "Update"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
