"use client";

import { useState, useEffect } from "react";
import { Brain, Trash2, ChevronDown, ChevronUp, BookOpen, Search, Calendar, Tag, Atom, PanelRightClose, PanelRightOpen } from "lucide-react";
import { PersonalKnowledge } from "@/types";
import { getLearnerKnowledge, deleteLearnerKnowledge, getKnowledgeGraph } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import KnowledgeGraph, { KnowledgeGraphData } from "./KnowledgeGraph";
import { MermaidBlock } from "./MermaidBlock";

interface KnowledgeHubProps {
    learnerId: string;
}

export default function KnowledgeHub({ learnerId }: KnowledgeHubProps) {
    const [knowledge, setKnowledge] = useState<PersonalKnowledge[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
    const [graphLoading, setGraphLoading] = useState(true);
    const [showGraph, setShowGraph] = useState(true);
    const [isRebuilding, setIsRebuilding] = useState(false);


    // Fetch knowledge entries
    useEffect(() => {
        const fetchKnowledge = async () => {
            try {
                const data = await getLearnerKnowledge(Number(learnerId));
                setKnowledge(data.map((k: any) => ({ ...k, id: String(k.id), learner_id: String(k.learner_id), course_id: k.course_id ? String(k.course_id) : null, module_id: k.module_id ? String(k.module_id) : null })));
            } catch (error) {
                console.error("Error fetching knowledge:", error);
            } finally {
                setLoading(false);
            }
        };

        if (learnerId) {
            fetchKnowledge();
        }
    }, [learnerId]);

    // Fetch knowledge graph
    const fetchGraph = async () => {
        try {
            const data = await getKnowledgeGraph(Number(learnerId));
            setGraphData(data);
        } catch (error) {
            console.error("Error fetching knowledge graph:", error);
            setGraphData({ nodes: [], edges: [] });
        } finally {
            setGraphLoading(false);
        }
    };

    // Fetch knowledge graph
    useEffect(() => {
        if (learnerId) {
            fetchGraph();
        }
    }, [learnerId]);

    const handleRebuildGraph = async () => {
        setIsRebuilding(true);
        try {
            await import("@/lib/api").then(m => m.rebuildKnowledgeGraph(Number(learnerId)));
            await fetchGraph();
        } catch (error) {
            console.error("Error rebuilding knowledge graph:", error);
        } finally {
            setIsRebuilding(false);
        }
    };

    const handleDelete = async (knowledgeId: string) => {
        if (!confirm("Are you sure you want to remove this from your knowledge base?")) return;

        try {
            await deleteLearnerKnowledge(Number(learnerId), Number(knowledgeId));
            setKnowledge(prev => prev.filter(k => k.id !== knowledgeId));
        } catch (error) {
            console.error("Error deleting knowledge:", error);
        }
    };

    const filteredKnowledge = knowledge.filter(k =>
        k.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        k.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400 animate-pulse">Consulting your knowledge base...</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Title Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                        My Knowledge Hub
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Synthesized wisdom from your learning journey and discussions.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search your notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0D0D0D] focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        />
                    </div>

                    {/* Toggle graph panel */}
                    <button
                        onClick={() => setShowGraph(!showGraph)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border transition-all cursor-pointer ${
                            showGraph
                                ? "border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                                : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0D0D0D] text-gray-500 dark:text-gray-400 hover:border-purple-200"
                        }`}
                        title={showGraph ? "Hide Knowledge Map" : "Show Knowledge Map"}
                    >
                        {showGraph ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                        <span className="text-sm font-medium hidden md:inline">
                            {showGraph ? "Hide Map" : "Show Map"}
                        </span>
                    </button>
                </div>
            </div>

            {/* Main Content: Notes (left) + Graph (right) */}
            <div className={`flex gap-6 ${showGraph ? "" : ""}`}>
                {/* Left: Knowledge Notes */}
                <div className={`transition-all duration-300 ${showGraph ? "w-full lg:w-1/2" : "w-full"}`}>
                    {filteredKnowledge.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-[#0D0D0D] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                            <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-6">
                                <Brain className="text-purple-600 dark:text-purple-400" size={40} />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Empty Library</h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-sm text-center">
                                You haven&apos;t added any chat insights to your knowledge base yet.
                                Start by clicking &quot;Convert to Knowledge&quot; in any discussion.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5">
                            {filteredKnowledge.map((item) => (
                                <div
                                    key={item.id}
                                    className={`group relative overflow-hidden transition-all duration-300 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0D0D0D] hover:shadow-xl hover:shadow-purple-500/5 ${
                                        expandedId === item.id ? "ring-2 ring-purple-500/20" : ""
                                    }`}
                                >
                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                                        <BookOpen size={10} />
                                                        Insight
                                                    </span>
                                                    <span className="flex items-center gap-1 text-gray-400 text-[10px]">
                                                        <Calendar size={10} />
                                                        {new Date(item.created_at.endsWith("Z") ? item.created_at : item.created_at + "Z").toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 leading-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                                                    {item.title}
                                                </h2>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.tags.slice(0, 4).map(tag => (
                                                        <span key={tag} className="flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-[10px] font-medium">
                                                            <Tag size={8} />
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {item.tags.length > 4 && (
                                                        <span className="px-2 py-0.5 text-[10px] text-gray-400">+{item.tags.length - 4}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                                    className="flex items-center justify-center w-9 h-9 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-purple-600 hover:text-white transition-all shadow-sm cursor-pointer"
                                                >
                                                    {expandedId === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        {expandedId === item.id && (
                                            <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-4 duration-500">
                                                <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 leading-relaxed p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                    <ReactMarkdown
                                                        components={{
                                                            code(props) {
                                                                const {children, className, node, ...rest} = props;
                                                                const match = /language-(\w+)/.exec(className || '');
                                                                if (match && match[1] === 'mermaid') {
                                                                    return <MermaidBlock code={String(children).replace(/\n$/, '')} />;
                                                                }
                                                                return <code {...rest} className={className}>{children}</code>;
                                                            }
                                                        }}
                                                    >
                                                        {item.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Knowledge Graph */}
                {showGraph && (
                    <div className="hidden lg:flex lg:w-1/2 flex-col sticky top-4">
                        <div className="h-[calc(100vh-200px)] rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0A0A0A] overflow-hidden shadow-lg shadow-purple-500/5">
                            {graphLoading ? (
                                <div className="flex flex-col items-center justify-center h-full">
                                    <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-600 rounded-full animate-spin mb-3" />
                                    <p className="text-sm text-gray-400 animate-pulse">Loading knowledge map...</p>
                                </div>
                            ) : graphData ? (
                                <KnowledgeGraph 
                                    data={graphData} 
                                    learnerId={learnerId} 
                                    onRebuild={handleRebuildGraph}
                                    isRebuilding={isRebuilding}
                                />
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
