"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useThemePreference } from "@/lib/hooks/useThemePreference";
import { getConceptEvidence } from "@/lib/api";
import { Brain, X, BookOpen, Target, Zap, ChevronRight, Atom } from "lucide-react";
import ReactMarkdown from "react-markdown";

// SSR-safe dynamic import (react-force-graph-2d uses window)
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-600 rounded-full animate-spin" />
        </div>
    ),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeNode {
    id: number;
    name: string;
    slug: string;
    description?: string;
    mastery?: number;
    // Added by force-graph at runtime
    x?: number;
    y?: number;
}

export interface KnowledgeEdge {
    source: number;
    target: number;
    type: string;
    strength: number;
}

export interface KnowledgeGraphData {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
}

interface KnowledgeGraphProps {
    data: KnowledgeGraphData;
    learnerId: string;
    onRebuild?: () => void;
    isRebuilding?: boolean;
}

// ── Mastery color helpers ─────────────────────────────────────────────────────

function getMasteryColor(mastery: number, isDark: boolean): [string, string] {
    if (mastery >= 0.8) return isDark ? ["#fde047", "#d97706"] : ["#fef08a", "#ea580c"]; // Gold/Amber
    if (mastery >= 0.5) return isDark ? ["#34d399", "#059669"] : ["#6ee7b7", "#10b981"]; // Emerald
    if (mastery >= 0.25) return isDark ? ["#60a5fa", "#3b82f6"] : ["#93c5fd", "#2563eb"]; // Blue
    return isDark ? ["#f472b6", "#be185d"] : ["#fbcfe8", "#e11d48"]; // Rose
}

function getMasteryLabel(mastery: number): string {
    if (mastery >= 0.8) return "Mastered";
    if (mastery >= 0.5) return "Familiar";
    if (mastery >= 0.25) return "Explored";
    return "Discovered";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function KnowledgeGraph({ data, learnerId, onRebuild, isRebuilding }: KnowledgeGraphProps) {
    const fgRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { isDarkMode } = useThemePreference();
    const isDark = isDarkMode;

    const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
    const [evidence, setEvidence] = useState<any[]>([]);
    const [evidenceLoading, setEvidenceLoading] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 600, height: 500 });

    // Measure container
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Transform data for the graph library
    const graphData = useMemo(() => ({
        nodes: data.nodes.map(n => ({ ...n })),
        links: data.edges.map(e => ({
            source: e.source,
            target: e.target,
            type: e.type,
            strength: e.strength,
        })),
    }), [data]);

    // Configure physics forces
    useEffect(() => {
        if (!fgRef.current) return;
        const fg = fgRef.current;

        fg.d3Force("charge")?.strength(-400);
        fg.d3Force("link")?.distance(120).strength(0.4);
        fg.d3Force("center")?.strength(0.6);

        // Zoom to fit after initial render
        setTimeout(() => {
            fg.zoomToFit?.(400, 60);
        }, 800);
    }, [graphData]);

    // Handle node click
    const handleNodeClick = useCallback(async (node: any) => {
        setSelectedNode(node);
        setEvidenceLoading(true);
        try {
            const data = await getConceptEvidence(node.id, Number(learnerId));
            setEvidence(data);
        } catch (err) {
            console.error("Failed to load evidence:", err);
            setEvidence([]);
        } finally {
            setEvidenceLoading(false);
        }
    }, [learnerId]);

    const closeSidebar = () => {
        setSelectedNode(null);
        setEvidence([]);
    };

    // Custom Canvas node rendering
    const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        if (node.x === undefined || node.y === undefined) return;
        
        const mastery = node.mastery || 0;
        const baseSize = 6;
        const size = baseSize + mastery * 6; // 6-12px radius
        const isSelected = selectedNode?.id === node.id;

        // 1. Glow effect for selected node
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 8, 0, 2 * Math.PI);
            const glow = ctx.createRadialGradient(node.x, node.y, size, node.x, node.y, size + 8);
            glow.addColorStop(0, "rgba(147, 51, 234, 0.3)");
            glow.addColorStop(1, "rgba(147, 51, 234, 0)");
            ctx.fillStyle = glow;
            ctx.fill();
        }

        // 2. Mastery progress ring (background track)
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 3. Mastery progress ring (filled arc)
        if (mastery > 0) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 3, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * mastery);
            const [, strokeColor] = getMasteryColor(mastery, isDark);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        // 4. Main node circle with gradient
        const [lightColor, darkColor] = getMasteryColor(mastery, isDark);
        const gradient = ctx.createRadialGradient(
            node.x - size * 0.3, node.y - size * 0.3, 0,
            node.x, node.y, size
        );
        gradient.addColorStop(0, lightColor);
        gradient.addColorStop(1, darkColor);

        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 5. Inner highlight
        ctx.beginPath();
        ctx.arc(node.x - size * 0.2, node.y - size * 0.2, size * 0.35, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fill();

        // 6. Text label (show when zoomed in enough)
        if (globalScale > 0.6) {
            const fontSize = Math.max(6, 9 / globalScale);
            ctx.font = `500 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            // Text shadow for clarity against links
            ctx.fillStyle = isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)";
            ctx.fillText(node.name, node.x, node.y + size + 4.5);
            ctx.fillText(node.name, node.x, node.y + size + 5.5);

            // Text
            ctx.fillStyle = isDark ? "#cbd5e1" : "#334155";
            ctx.fillText(node.name, node.x, node.y + size + 5);
        }
    }, [isDark, selectedNode]);

    if (data.nodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl flex items-center justify-center mb-4">
                    <Atom className="text-purple-500/40" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-400 dark:text-gray-500 mb-2">
                    No Knowledge Graph Yet
                </h3>
                <p className="text-sm text-gray-400 dark:text-gray-600 max-w-[240px] mb-6">
                    Convert some chat discussions to knowledge to see your concept map grow here.
                </p>
                {onRebuild && (
                    <button
                        onClick={onRebuild}
                        disabled={isRebuilding}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isRebuilding && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                        {isRebuilding ? "Structuring map..." : "Generate from existing notes"}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="relative h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <Atom size={18} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Neural Knowledge Map
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                        {data.nodes.length} concepts · {data.edges.length} links
                    </span>
                    {onRebuild && (
                        <button
                            onClick={onRebuild}
                            disabled={isRebuilding}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-2 py-1 rounded-full transition-colors disabled:opacity-50"
                        >
                            Sync
                        </button>
                    )}
                </div>
            </div>

            {/* Graph Canvas */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden">
                <ForceGraph2D
                    ref={fgRef}
                    graphData={graphData}
                    width={dimensions.width}
                    height={dimensions.height}
                    onNodeClick={handleNodeClick}
                    nodeCanvasObject={drawNode}
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                        if (node.x === undefined || node.y === undefined) return;
                        const size = 6 + (node.mastery || 0) * 6 + 5;
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                        ctx.fill();
                    }}
                    linkColor={() => isDark ? "rgba(255, 255, 255, 0.45)" : "rgba(0, 0, 0, 0.4)"}
                    linkWidth={2}
                    linkCurvature={0.15}
                    linkDirectionalParticles={1}
                    linkDirectionalParticleSpeed={0.005}
                    linkDirectionalParticleWidth={3}
                    linkDirectionalParticleColor={() => isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(147, 51, 234, 1)"}
                    backgroundColor={isDark ? "#0a0a0a" : "#fafafa"}
                    cooldownTicks={100}
                    enableZoomInteraction={true}
                    enablePanInteraction={true}
                />
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm">
                {[
                    { color: "bg-rose-500", label: "Discovered" },
                    { color: "bg-blue-500", label: "Explored" },
                    { color: "bg-emerald-500", label: "Familiar" },
                    { color: "bg-amber-500", label: "Mastered" },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color} shadow-sm`} />
                        <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">{item.label}</span>
                    </div>
                ))}
            </div>

            {/* Sidebar: Concept Detail */}
            {selectedNode && (
                <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-[#0D0D0D] border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 z-10">
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                (selectedNode.mastery || 0) >= 0.8 ? "bg-amber-500" :
                                (selectedNode.mastery || 0) >= 0.5 ? "bg-emerald-500" :
                                (selectedNode.mastery || 0) >= 0.25 ? "bg-blue-500" : "bg-rose-500"
                            }`} />
                            <h3 className="font-bold text-gray-900 dark:text-white truncate">{selectedNode.name}</h3>
                        </div>
                        <button onClick={closeSidebar} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                            <X size={16} className="text-gray-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                        {/* Mastery Bar */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                                    <Target size={12} />
                                    Mastery Level
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    (selectedNode.mastery || 0) >= 0.8
                                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                        : (selectedNode.mastery || 0) >= 0.5
                                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                            : (selectedNode.mastery || 0) >= 0.25
                                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                                : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                                }`}>
                                    {getMasteryLabel(selectedNode.mastery || 0)}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                        (selectedNode.mastery || 0) >= 0.8 ? "bg-gradient-to-r from-amber-400 to-amber-600" :
                                        (selectedNode.mastery || 0) >= 0.5 ? "bg-gradient-to-r from-emerald-400 to-emerald-600" :
                                        (selectedNode.mastery || 0) >= 0.25 ? "bg-gradient-to-r from-blue-400 to-blue-600" :
                                        "bg-gradient-to-r from-rose-400 to-rose-600"
                                    }`}
                                    style={{ width: `${Math.max(5, (selectedNode.mastery || 0) * 100)}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                {Math.round((selectedNode.mastery || 0) * 100)}% mastery
                            </p>
                        </div>

                        {/* Insight Summary */}
                        {selectedNode.description && (
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                    <Zap size={12} />
                                    Insight
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                    {selectedNode.description}
                                </p>
                            </div>
                        )}

                        {/* Linked Knowledge Notes */}
                        <div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                <BookOpen size={12} />
                                Linked Knowledge Notes
                            </div>
                            {evidenceLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="w-5 h-5 border-2 border-purple-500/20 border-t-purple-600 rounded-full animate-spin" />
                                </div>
                            ) : evidence.length === 0 ? (
                                <p className="text-xs text-gray-400 italic py-4 text-center">No linked notes found.</p>
                            ) : (
                                <div className="space-y-2">
                                    {evidence.map((item: any) => (
                                        <div
                                            key={item.id}
                                            className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-800 transition-colors"
                                        >
                                            <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1">
                                                <ChevronRight size={10} className="text-purple-500" />
                                                {item.title}
                                            </h4>
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-3 prose-sm">
                                                <ReactMarkdown>{item.content?.substring(0, 200) + "..."}</ReactMarkdown>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {(item.tags || []).slice(0, 3).map((tag: string) => (
                                                    <span key={tag} className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded text-[9px] font-medium">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
