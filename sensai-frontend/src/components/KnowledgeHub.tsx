"use client";

import { useState, useEffect } from "react";
import { Brain, Trash2, ChevronDown, ChevronUp, BookOpen, Search, Calendar, Tag } from "lucide-react";
import { PersonalKnowledge } from "@/types";
import { getLearnerKnowledge, deleteLearnerKnowledge } from "@/lib/api";
import ReactMarkdown from "react-markdown";

interface KnowledgeHubProps {
    learnerId: string;
}

export default function KnowledgeHub({ learnerId }: KnowledgeHubProps) {
    const [knowledge, setKnowledge] = useState<PersonalKnowledge[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

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
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                        My Knowledge Hub
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Synthesized wisdom from your learning journey and discussions.
                    </p>
                </div>
                
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search your notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0D0D0D] focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    />
                </div>
            </div>

            {filteredKnowledge.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-[#0D0D0D] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-6">
                        <Brain className="text-purple-600 dark:text-purple-400" size={40} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Empty Library</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm text-center">
                        You haven't added any chat insights to your knowledge base yet. 
                        Start by clicking "Convert to Knowledge" in any discussion.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {filteredKnowledge.map((item) => (
                        <div 
                            key={item.id}
                            className={`group relative overflow-hidden transition-all duration-300 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0D0D0D] hover:shadow-xl hover:shadow-purple-500/5 ${
                                expandedId === item.id ? 'ring-2 ring-purple-500/20' : ''
                            }`}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs font-bold uppercase tracking-wider">
                                                <BookOpen size={12} />
                                                Insight
                                            </span>
                                            <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                                                <Calendar size={12} />
                                                {new Date(item.created_at.endsWith("Z") ? item.created_at : item.created_at + "Z").toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 leading-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                            {item.title}
                                        </h2>
                                        <div className="flex flex-wrap gap-2">
                                            {item.tags.map(tag => (
                                                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium">
                                                    <Tag size={10} />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                        <button 
                                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                            className="flex items-center justify-center w-12 h-12 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                        >
                                            {expandedId === item.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                        </button>
                                    </div>
                                </div>

                                {expandedId === item.id && (
                                    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800">
                                            <ReactMarkdown>{item.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
