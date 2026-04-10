"use client";

import { useAuth } from "@/lib/auth";
import KnowledgeHub from "@/components/KnowledgeHub";
import { Header } from "@/components/layout/header";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function KnowledgePage() {
    const { user, isAuthenticated, isLoading } = useAuth();
    const params = useParams();
    const router = useRouter();
    const schoolId = params.id as string;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        router.push("/login");
        return null;
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <Header showCreateCourseButton={false} />
            
            <div className="bg-gray-50 dark:bg-[#080808] min-h-[calc(100vh-64px)]">
                <div className="max-w-7xl mx-auto py-4 px-4">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-500 hover:text-purple-600 transition-colors mb-6 group"
                    >
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Courses
                    </button>
                    
                    <KnowledgeHub learnerId={user?.id?.toString() || ""} />
                </div>
            </div>
        </div>
    );
}
