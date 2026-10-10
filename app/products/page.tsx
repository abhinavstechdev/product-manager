"use client";

import React, { useState, useEffect } from "react";
import { Package, Search, Plus, AlertTriangle, Layers, CheckCircle2, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryName?: string;
  purchaseCost: string;
  sellingPrice: string;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  reorderThreshold: number;
  isActive: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New product form
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [initialStock, setInitialStock] = useState("10");
  const [reorderThreshold, setReorderThreshold] = useState("5");
  const [description, setDescription] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set("search", search);
      if (selectedCategory) query.set("categoryId", selectedCategory);
      if (lowStockFilter) query.set("lowStock", "true");

      const res = await fetch(`/api/products?${query.toString()}`);
      const data = await res.json();
      setProducts(data.products || []);
      setCategories(data.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, selectedCategory, lowStockFilter]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          barcode: barcode || null,
          categoryId: categoryId || null,
          purchaseCost: parseFloat(purchaseCost),
          sellingPrice: parseFloat(sellingPrice),
          initialStock: parseInt(initialStock, 10),
          reorderThreshold: parseInt(reorderThreshold, 10),
          description: description || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create product");

      setIsAddModalOpen(false);
      setName("");
      setSku("");
      setBarcode("");
      loadProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-400" />
            Product Catalog & SKU Registry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage SKU unique definitions, selling prices, cost baselines, and physical vs reserved stock levels.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Product SKU
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setLowStockFilter(!lowStockFilter)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
            lowStockFilter
              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
              : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Low Stock Only
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">SKU / Code</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Cost Price</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-center">Physical</th>
                <th className="py-3 px-4 text-center">Reserved</th>
                <th className="py-3 px-4 text-center">Available</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.availableStock <= p.reorderThreshold && p.availableStock > 0;
                  const isOut = p.availableStock <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                        {p.sku}
                      </td>
                      <td className="py-3 px-4 text-white font-medium">
                        {p.name}
                        {p.barcode && (
                          <span className="block text-[10px] text-slate-500 font-mono">
                            UPC: {p.barcode}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-[11px]">
                          {p.categoryName || "General"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        ₹{p.purchaseCost}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        ₹{p.sellingPrice}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                        {p.physicalStock}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">
                        {p.reservedStock}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span
                          className={
                            isOut
                              ? "text-rose-400"
                              : isLow
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }
                        >
                          {p.availableStock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Register New Product SKU</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-300">Product Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Ergonomic Office Desk Lamp"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Unique SKU</label>
                  <input
                    type="text"
                    placeholder="e.g. HOM-LMP-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(e.target.value)}
                    required
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    required
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Initial Physical Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    required
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Reorder Alert Threshold</label>
                  <input
                    type="number"
                    min={1}
                    value={reorderThreshold}
                    onChange={(e) => setReorderThreshold(e.target.value)}
                    required
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Key features and specifications..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  {formLoading ? "Registering..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
