// src/pages/VendorPage.jsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  createVendorApi,
  listVendorsApi,
  getVendorByIdApi,
  updateVendorapi,
  deleteVendorapi,
} from "../context/api";

// Helper: normalize backend vendor (_id) into frontend shape
const normalizeVendor = (raw) => {
  if (!raw) return raw;
  return {
    ...raw,
    id: raw.id || raw._id, // prefer backend _id
  };
};

export default function VendorPage() {
  const [vendors, setVendors] = useState([]);

  const [detailVendor, setDetailVendor] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState("add"); // "add" | "edit"
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // formState mirrors Vendor model + UI helpers
  const [formState, setFormState] = useState({
    id: null,
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    categoriesText: "", // comma-separated
    catalogText: "",
    rating: "",
    vendorMetaText: "", // vendor-level meta as JSON
    catalogItems: [
      {
        name: "",
        price: "",
        stock: "",
        metaText: "", // JSON string for each catalog item
      },
    ],
  });

  const isEditing = formMode === "edit";

  // ---------- Helpers for details ----------
  const formatDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const renderMetaObject = (meta) => {
    if (!meta || typeof meta !== "object") return "—";

    const entries = Object.entries(meta);
    if (entries.length === 0) return "—";

    return (
      <ul className="list-disc ml-4 space-y-0.5">
        {entries.map(([key, val]) => (
          <li key={key}>
            <span className="text-slate-400">{key}: </span>
            <span className="text-slate-100">
              {typeof val === "boolean" ? (val ? "Yes" : "No") : String(val)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  // shared JSON parser for meta fields
  const parseMetaFromText = (metaText) => {
    const trimmed = (metaText || "").trim();
    if (!trimmed) return {}; // empty is allowed, becomes {}

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") return parsed;
      alert("Meta JSON must be an object (e.g. {\"gst\":\"123\",\"preferred\":true}).");
      return null;
    } catch (err) {
      console.error("Invalid meta JSON", err);
      alert("Invalid meta JSON. Please fix it or clear the field.");
      return null;
    }
  };

  // ---------- Load vendors from backend ----------
  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await listVendorsApi();
      const apiVendors = res?.data?.data || res?.data || [];
      setVendors(apiVendors.map(normalizeVendor));
    } catch (err) {
      console.error("listVendors error (frontend)", err);
      alert("Failed to load vendors. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  // ---------- Form helpers ----------
  const resetForm = () => {
    setFormState({
      id: null,
      name: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      categoriesText: "",
      catalogText: "",
      rating: "",
      vendorMetaText: "",
      catalogItems: [
        {
          name: "",
          price: "",
          stock: "",
          metaText: "",
        },
      ],
    });
  };

  const openAddModal = () => {
    setFormMode("add");
    resetForm();
    setIsFormModalOpen(true);
  };

  const openEditModal = (vendor) => {
    setFormMode("edit");

    const catalogItems =
      (vendor.catalog && vendor.catalog.length > 0
        ? vendor.catalog.map((item) => ({
            name: item.name || "",
            price: item.price ?? "",
            stock: item.stock ?? "",
            metaText: item.meta ? JSON.stringify(item.meta, null, 2) : "",
          }))
        : [
            {
              name: "",
              price: "",
              stock: "",
              metaText: "",
            },
          ]) || [];

    setFormState({
      id: vendor.id,
      name: vendor.name || "",
      contactName: vendor.contactName || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      categoriesText: (vendor.categories || []).join(", "),
      catalogText: vendor.catalogText || "",
      rating: vendor.rating ?? "",
      vendorMetaText: vendor.meta ? JSON.stringify(vendor.meta, null, 2) : "",
      catalogItems,
    });
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    if (saving) return;
    setIsFormModalOpen(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleCatalogItemChange = (index, field, value) => {
    setFormState((prev) => {
      const copy = [...prev.catalogItems];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, catalogItems: copy };
    });
  };

  const addCatalogItem = () => {
    setFormState((prev) => ({
      ...prev,
      catalogItems: [
        ...prev.catalogItems,
        { name: "", price: "", stock: "", metaText: "" },
      ],
    }));
  };

  const removeCatalogItem = (index) => {
    setFormState((prev) => {
      const copy = [...prev.catalogItems];
      if (copy.length === 1) return prev; // keep at least one row
      copy.splice(index, 1);
      return { ...prev, catalogItems: copy };
    });
  };

  // ---------- NEW: Fill example data in Add Vendor ----------
  const fillExampleVendor = () => {
    // Always switch to Add mode for example
    setFormMode("add");
    setFormState({
      id: null,
      name: "ITPro Services India",
      contactName: "Karan Mehta",
      email: "info@itproservices.in",
      phone: "+91-8080808080",
      address: "Delhi NCR",
      categoriesText: "services, networking",
      catalogText: "IT AMC, networking support, on-site services",
      rating: "4.3",
      vendorMetaText: JSON.stringify(
        {
          gst: "07ABCDE1234F1Z5",
          website: "https://itproservices.in",
          yearsInBusiness: 8,
          preferred: true,
        },
        null,
        2
      ),
      catalogItems: [
        {
          name: "Annual Maintenance Contract (AMC)",
          price: "50000",
          stock: "",
          metaText: JSON.stringify(
            { duration: "1 year", prioritySupport: true },
            null,
            2
          ),
        },
        {
          name: "Network Cable Installation",
          price: "2500",
          stock: "",
          metaText: JSON.stringify(
            { perMeter: true, type: "Cat6" },
            null,
            2
          ),
        },
      ],
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Basic required fields
    if (!formState.name.trim()) {
      alert("Vendor name is required.");
      return;
    }
    if (!formState.contactName.trim()) {
      alert("Contact name is required.");
      return;
    }
    if (!formState.email.trim()) {
      alert("Email is required.");
      return;
    }
    if (!formState.phone.trim()) {
      alert("Phone is required.");
      return;
    }
    if (!formState.address.trim()) {
      alert("Address is required.");
      return;
    }
    if (!formState.categoriesText.trim()) {
      alert("At least one category is required.");
      return;
    }
    if (!formState.catalogText.trim()) {
      alert("Catalog summary (catalogText) is required.");
      return;
    }
    if (formState.rating === "" || formState.rating === null) {
      alert("Rating is required.");
      return;
    }

    const categories =
      formState.categoriesText
        ?.split(",")
        .map((c) => c.trim())
        .filter(Boolean) || [];
    if (categories.length === 0) {
      alert("Please provide at least one category.");
      return;
    }

    const ratingNum = Number(formState.rating);
    if (Number.isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      alert("Rating must be a number between 0 and 5.");
      return;
    }

    // Vendor meta
    const vendorMeta = parseMetaFromText(formState.vendorMetaText);
    if (vendorMeta === null) {
      // parseMetaFromText already alerted
      return;
    }

    // Catalog validation
    if (!formState.catalogItems || formState.catalogItems.length === 0) {
      alert("Please add at least one catalog item.");
      return;
    }

    const catalog = [];
    for (let i = 0; i < formState.catalogItems.length; i++) {
      const item = formState.catalogItems[i];
      if (!item.name.trim()) {
        alert(`Catalog item #${i + 1}: name is required.`);
        return;
      }
      if (item.price === "" || item.price === null) {
        alert(`Catalog item #${i + 1}: price is required.`);
        return;
      }
      const priceNum = Number(item.price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        alert(`Catalog item #${i + 1}: price must be a positive number.`);
        return;
      }

      let stockNum = null;
      if (item.stock !== "" && item.stock !== null) {
        const parsedStock = Number(item.stock);
        if (Number.isNaN(parsedStock) || parsedStock < 0) {
          alert(
            `Catalog item #${i + 1}: stock must be a positive number or left blank.`
          );
          return;
        }
        stockNum = parsedStock;
      }

      const metaObj = parseMetaFromText(item.metaText);
      if (metaObj === null) {
        // parseMetaFromText already shows alert
        return;
      }

      catalog.push({
        name: item.name.trim(),
        price: priceNum,
        stock: stockNum,
        meta: metaObj,
      });
    }

    const payload = {
      name: formState.name.trim(),
      contactName: formState.contactName.trim(),
      email: formState.email.trim(),
      phone: formState.phone.trim(),
      address: formState.address.trim(),
      categories,
      catalogText: formState.catalogText.trim(),
      rating: ratingNum,
      catalog,
      meta: vendorMeta,
    };

    setSaving(true);
    try {
      if (isEditing) {
        const res = await updateVendorapi(formState.id, payload);
        const updated = normalizeVendor(res?.data?.data || res?.data);
        if (updated) {
          setVendors((prev) =>
            prev.map((v) => (v.id === updated.id ? updated : v))
          );
          if (detailVendor && detailVendor.id === updated.id) {
            setDetailVendor(updated);
          }
        }
      } else {
        const res = await createVendorApi(payload);
        const created = normalizeVendor(res?.data?.data || res?.data);
        if (created) {
          setVendors((prev) => [created, ...prev]);
        }
      }

      closeFormModal();
      resetForm();
    } catch (err) {
      console.error("save vendor error (frontend)", err);
      alert("Failed to save vendor. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Detail popup ----------
  const openDetailModal = async (vendor) => {
    setDetailVendor(vendor);
    setIsDetailModalOpen(true);

    try {
      setDetailLoading(true);
      const res = await getVendorByIdApi(vendor.id);
      const full = normalizeVendor(res?.data?.data || res?.data);
      if (full) {
        setDetailVendor(full);
        setVendors((prev) => prev.map((v) => (v.id === full.id ? full : v)));
      }
    } catch (err) {
      console.error("getVendor error (frontend)", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setDetailVendor(null);
    setIsDetailModalOpen(false);
  };

  // ---------- Delete ----------
  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this vendor?"
    );
    if (!confirmed) return;

    try {
      await deleteVendorapi(id);
      setVendors((prev) => prev.filter((v) => v.id !== id));
      if (detailVendor && detailVendor.id === id) {
        closeDetailModal();
      }
    } catch (err) {
      console.error("deleteVendor error (frontend)", err);
      alert("Failed to delete vendor. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Vendors</h2>
          <p className="text-sm text-slate-400">
            Manage your vendor directory used for RFP distribution.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-full bg-emerald-500 text-slate-900 text-sm font-semibold hover:bg-emerald-400 transition flex items-center gap-1.5"
        >
          <span className="text-base">＋</span>
          <span>Add Vendor</span>
        </button>
      </div>

      {/* Vendor List Card */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/60 p-4 md:p-6 shadow-lg shadow-slate-950/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Vendor Directory
            </h3>
            {loading && (
              <span className="text-xs text-slate-400 italic">Loading…</span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Total vendors:{" "}
            <span className="text-emerald-400 font-semibold">
              {vendors.length}
            </span>
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-400 border-b border-slate-800">
                  Name
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-400 border-b border-slate-800">
                  Contact Name
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-400 border-b border-slate-800">
                  Email
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-400 border-b border-slate-800">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && vendors.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No vendors yet. Click{" "}
                    <span className="text-emerald-400 font-medium">
                      “Add Vendor”
                    </span>{" "}
                    to create one.
                  </td>
                </tr>
              )}

              {vendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="hover:bg-slate-900/70 transition border-b border-slate-800/60"
                >
                  <td className="px-4 py-2">
                    <Link
                      to="#"
                      onClick={(e) => {
                        e.preventDefault();
                        openDetailModal(vendor);
                      }}
                      className="font-medium text-emerald-400 hover:underline"
                    >
                      {vendor.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-200">
                    {vendor.contactName || "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-300">
                    {vendor.email}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(vendor)}
                        className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800/80"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => handleDelete(vendor.id)}
                        className="text-xs px-3 py-1 rounded-full bg-red-500/80 text-slate-50 hover:bg-red-400"
                      >
                        DELETE
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Vendor Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-xl shadow-slate-950/70">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">
                    {isEditing ? "Edit Vendor" : "Add New Vendor"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {isEditing
                      ? "Update the vendor information."
                      : "Fill all details to create a new vendor."}
                  </p>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={fillExampleVendor}
                      className="mt-2 inline-flex items-center px-3 py-1.5 rounded-full border border-emerald-500 text-[11px] text-emerald-400 hover:bg-emerald-500/10"
                    >
                      Fill Example Data
                    </button>
                  )}
                </div>
                <button
                  onClick={closeFormModal}
                  className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="px-4 py-4 space-y-4">
                {/* Basic fields */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">
                      Vendor / Company Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formState.name}
                      onChange={handleFormChange}
                      className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="ITPro Services India"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      name="contactName"
                      value={formState.contactName}
                      onChange={handleFormChange}
                      className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Karan Mehta"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formState.email}
                      onChange={handleFormChange}
                      className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="info@itproservices.in"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Phone *</label>
                    <input
                      type="text"
                      name="phone"
                      value={formState.phone}
                      onChange={handleFormChange}
                      className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="+91-8080808080"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Address *</label>
                  <input
                    type="text"
                    name="address"
                    value={formState.address}
                    onChange={handleFormChange}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Delhi NCR"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">
                      Categories (comma-separated) *
                    </label>
                    <input
                      type="text"
                      name="categoriesText"
                      value={formState.categoriesText}
                      onChange={handleFormChange}
                      className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="services, networking"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">
                      Rating (0–5) *
                    </label>
                    <input
                      type="number"
                      name="rating"
                      min="0"
                      max="5"
                      step="0.1"
                      value={formState.rating}
                      onChange={handleFormChange}
                      className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="4.3"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">
                    Catalog Summary / Notes (catalogText) *
                  </label>
                  <textarea
                    name="catalogText"
                    value={formState.catalogText}
                    onChange={handleFormChange}
                    rows={3}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
                    placeholder="IT AMC, networking support, on-site services"
                    required
                  />
                </div>

                {/* Vendor-level meta */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">
                    Vendor Metadata (JSON, optional)
                  </label>
                  <textarea
                    name="vendorMetaText"
                    value={formState.vendorMetaText}
                    onChange={handleFormChange}
                    rows={3}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
                    placeholder='{"gst":"19BCDEA5432L1Z8","website":"https://nextgenit.co","yearsInBusiness":15,"preferred":true}'
                  />
                  <p className="text-[11px] text-slate-500">
                    Leave empty if not needed. Must be valid JSON if provided.
                  </p>
                </div>

                {/* Catalog items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-slate-300">
                      Catalog Items *
                    </h5>
                    <button
                      type="button"
                      onClick={addCatalogItem}
                      className="text-[11px] px-2 py-1 rounded-full border border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      + Add Item
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Each item requires a name and price. Meta should be valid
                    JSON (e.g.
                    {" {\"duration\":\"1 year\",\"prioritySupport\":true}"}).
                  </p>

                  <div className="space-y-3">
                    {formState.catalogItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-800 p-3 space-y-2 bg-slate-900/60"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-slate-400">
                            Item #{idx + 1}
                          </span>
                          {formState.catalogItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCatalogItem(idx)}
                              className="text-[11px] text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">
                              Name *
                            </label>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                handleCatalogItemChange(
                                  idx,
                                  "name",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Annual Maintenance Contract (AMC)"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">
                              Price (₹) *
                            </label>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) =>
                                handleCatalogItemChange(
                                  idx,
                                  "price",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="50000"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">
                              Stock
                            </label>
                            <input
                              type="number"
                              value={item.stock}
                              onChange={(e) =>
                                handleCatalogItemChange(
                                  idx,
                                  "stock",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="(leave blank for null)"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">
                            Meta (JSON)
                          </label>
                          <textarea
                            rows={2}
                            value={item.metaText}
                            onChange={(e) =>
                              handleCatalogItemChange(
                                idx,
                                "metaText",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
                            placeholder='{"duration":"1 year","prioritySupport":true}'
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeFormModal}
                    disabled={saving}
                    className="px-4 py-2 rounded-full border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800/80 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-full bg-emerald-500 text-slate-900 text-xs font-semibold hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {saving
                      ? isEditing
                        ? "Updating..."
                        : "Adding..."
                      : isEditing
                      ? "Update Vendor"
                      : "Add Vendor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Detail Modal - full details */}
      {isDetailModalOpen && detailVendor && (
        <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-xl shadow-slate-950/70">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">
                    Vendor Details
                  </h4>
                  <p className="text-xs text-slate-400">
                    {detailVendor.name}
                  </p>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="px-4 py-4 space-y-6">
                {detailLoading && (
                  <div className="text-xs text-slate-400 italic mb-2">
                    Refreshing latest details…
                  </div>
                )}

                {/* Basic Info */}
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="min-w-full text-xs md:text-sm">
                    <tbody>
                      <tr className="border-b border-slate-800/70">
                        <td className="px-3 py-2 font-medium text-slate-400 w-40">
                          Vendor Name
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {detailVendor.name}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-800/70">
                        <td className="px-3 py-2 font-medium text-slate-400">
                          Contact Name
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {detailVendor.contactName || "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-800/70">
                        <td className="px-3 py-2 font-medium text-slate-400">
                          Email
                        </td>
                        <td className="px-3 py-2 text-emerald-300">
                          {detailVendor.email}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-800/70">
                        <td className="px-3 py-2 font-medium text-slate-400">
                          Phone
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {detailVendor.phone || "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-800/70">
                        <td className="px-3 py-2 font-medium text-slate-400">
                          Address
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {detailVendor.address || "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-800/70">
                        <td className="px-3 py-2 font-medium text-slate-400">
                          Categories
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {(detailVendor.categories || []).length > 0
                            ? detailVendor.categories.join(", ")
                            : "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-800/70">
                        <td className="px-3 py-2 font-medium text-slate-400">
                          Rating
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {detailVendor.rating ?? "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-800/70">
                        <td className="px-3 py-2 font-medium text-slate-400">
                          Created At
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {formatDateTime(detailVendor.createdAt)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-slate-400">
                          Updated At
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {formatDateTime(detailVendor.updatedAt)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Catalog Summary */}
                <div className="rounded-xl border border-slate-800 p-3">
                  <h5 className="text-xs font-semibold text-slate-300 mb-1">
                    Catalog Summary
                  </h5>
                  <p className="text-xs md:text-sm text-slate-100 whitespace-pre-wrap">
                    {detailVendor.catalogText || "—"}
                  </p>
                </div>

                {/* Vendor Meta */}
                <div className="rounded-xl border border-slate-800 p-3">
                  <h5 className="text-xs font-semibold text-slate-300 mb-1">
                    Vendor Metadata
                  </h5>
                  <div className="text-xs md:text-sm">
                    {renderMetaObject(detailVendor.meta)}
                  </div>
                </div>

                {/* Catalog Items */}
                <div className="rounded-xl border border-slate-800 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-semibold text-slate-300">
                      Catalog Items
                    </h5>
                    <span className="text-[10px] text-slate-400">
                      Total: {(detailVendor.catalog || []).length}
                    </span>
                  </div>

                  {(detailVendor.catalog || []).length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No catalog items stored for this vendor.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-800">
                      <table className="min-w-full text-[11px] md:text-xs">
                        <thead className="bg-slate-900/70">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-400 border-b border-slate-800">
                              Item Name
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-400 border-b border-slate-800">
                              Price
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-400 border-b border-slate-800">
                              Stock
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-400 border-b border-slate-800">
                              Meta
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailVendor.catalog.map((item, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-slate-800/70 hover:bg-slate-900/60"
                            >
                              <td className="px-3 py-2 text-slate-100">
                                {item.name || "—"}
                              </td>
                              <td className="px-3 py-2 text-slate-100">
                                {item.price != null ? `₹${item.price}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-slate-100">
                                {item.stock != null ? item.stock : "—"}
                              </td>
                              <td className="px-3 py-2 text-slate-100">
                                {renderMetaObject(item.meta)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end mt-2 gap-2">
                  <button
                    onClick={() => {
                      openEditModal(detailVendor);
                      closeDetailModal();
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800/80"
                  >
                    Edit Vendor
                  </button>
                  <button
                    onClick={closeDetailModal}
                    className="text-xs px-3 py-1.5 rounded-full bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
