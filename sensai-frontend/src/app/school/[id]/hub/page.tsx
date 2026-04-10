"use client";

import { use } from "react";
import CourseHub from "@/components/CourseHub";
import { useAuth } from "@/lib/auth";
import { getCourseModules } from "@/lib/api";
import { useState, useEffect } from "react";

interface HubPageProps {
  params: Promise<{ id: string }>;
}

export default function HubPage({ params }: HubPageProps) {
  const { id: schoolId } = use(params);
  const { user } = useAuth();

  // Derive courseId from query or fall back to schoolId
  // In this codebase the school page URL is /school/[id] where [id] is the org/school id.
  // The course hub is reached from the course page so the courseId is passed via searchParams.
  // We read it from the URL search params client-side.
  const [courseId, setCourseId] = useState<string>("");
  const [courseName, setCourseName] = useState<string>("");
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
        .then(({ courseData, modules: mods }) => {
          setCourseName(courseData?.name || "");
          setModules(
            mods.map((m: any) => ({ id: String(m.id), title: m.title || m.name || `Module ${m.id}` }))
          );
        })
        .catch(() => {});
    }
  }, []);

  if (!courseId) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Loading hub…
      </div>
    );
  }

  return (
    <CourseHub
      courseId={courseId}
      schoolId={schoolId}
      courseName={courseName}
      isMentor={isMentor}
      modules={modules}
    />
  );
}
