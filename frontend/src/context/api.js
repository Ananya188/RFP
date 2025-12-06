// src/api.js
import axios from 'axios';

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

// const API_BASE =
//   process.env.REACT_APP_API_BASE?.replace(/\/+$/, '') ||
//   'http://localhost:3000/api/rfps';

export async function createRfpApi(rfpObj) {
  const res = await axios.post(`${backendUrl}/api/rfp/`, rfpObj, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data;
}

export async function confirmRfpApi(rfpId) {
  const res = await axios.put(`${backendUrl}/api/rfp/${rfpId}/confirm`, {}, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data;
}

export async function getVendorCandidatesApi(rfpId, options = {}) {
  if (!rfpId) throw new Error("rfpId required");
  // ensure we only use the raw id (strip any accidental query or trailing slashes)
  const cleanId = String(rfpId).split("?")[0].replace(/\/+$/, "");
  const params = {};
  if (options.mode) params.mode = options.mode;
  if (typeof options.checkStock !== "undefined") params.checkStock = options.checkStock;
  const res = await axios.get(`${backendUrl}/api/rfp/${encodeURIComponent(cleanId)}/candidates`, { params });
  return res.data;
}

export async function sendRfpToVendorsApi(rfpId, payload) {
  if (!rfpId) throw new Error("rfpId required");
  const cleanId = String(rfpId).split("?")[0].replace(/\/+$/, "");
  const res = await axios.post(
    `${backendUrl}/api/rfp/${encodeURIComponent(cleanId)}/send`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
    }
  );
  return res.data;
}

export async function createVendorApi(vendorObj) {
  const res = await axios.post(
    `${backendUrl}/api/vendor/createVendor`,
    vendorObj,
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  return res.data;
}

export async function getRfpTemplatesApi({ q = "", limit = 50 } = {}) {
  const params = {};
  if (q) params.q = q;
  if (limit) params.limit = limit;
  const res = await axios.get(`${backendUrl}/api/rfp/templates`, { params });
  return res.data;
}

export async function listVendorsApi() {
  const res = await axios.get(`${backendUrl}/api/vendor/list`);
  return res.data;
}

export async function getVendorByIdApi(id) {
  const res = await axios.get(`${backendUrl}/api/vendor/${id}`);
  return res.data;
}

export async function aiRecommendForRfpApi(rfpId) {
  const res = await axios.get(`${backendUrl}/api/rfp/${rfpId}/ai`);
  return res.data;
}

export async function updateVendorapi(id, updates) {
  const res = await axios.put(
    `${backendUrl}/api/vendor/${id}`,
    updates,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return res.data; // { success: true, data: vendor }
}

export async function deleteVendorapi(vendorObj) {
    const res = await axios.delete(`${backendUrl}/api/vendor/${vendorObj}`, {}, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data;
}