"use client";

import { use, useState, useEffect } from "react";
import HubPostDetail from "@/components/HubPostDetail";
import { getCourseModules } from "@/lib/api";

interface PostDetailPageProps {
  params: Promise<{ id: string; postId: string }>;
}

export default function HubPostDetailPage({ params }: PostDetailPageProps) {
  const { id: schoolId, postId } = use(params);

  const [courseId, setCourseId] = useState<string>("");
  const [modules, setModules] = useState<{ id: string; title: string }[]>([]);
  const [isMentor, setIsMentor] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const cid = sp.get("courseId") || "";
    const role = sp.get("role") || "learner";
    setCourseId(cid);
    setIsMentor(role === "mentor");

    if (cid) {
      getCourseModules(cid)
        .then(({ modules: mods }) => {
          setModules(
            mods.map((m: any) => ({ id: String(m.id), title: m.title || m.name || `Module ${m.id}` }))
          );
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black py-4">
      <HubPostDetail
        postId={postId}
        schoolId={schoolId}
        isMentor={isMentor}
        modules={modules}
      />
    </div>
  );
}
