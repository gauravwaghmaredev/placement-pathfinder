import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, FileText, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { calculateEligibility, getEligibilityClass } from "@/lib/eligibility";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState({ totalJobs: 0, applied: 0, shortlisted: 0, pending: 0 });
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !profile) return;

    const fetchData = async () => {
      const [jobsRes, appsRes] = await Promise.all([
        supabase.from("jobs").select("*"),
        supabase.from("applications").select("*, jobs(*)").eq("student_id", user.id),
      ]);

      const jobs = jobsRes.data || [];
      const apps = appsRes.data || [];

      setStats({
        totalJobs: jobs.length,
        applied: apps.length,
        shortlisted: apps.filter(a => a.status === "shortlisted").length,
        pending: apps.filter(a => a.status === "pending").length,
      });

      // Recommended: eligible jobs with upcoming deadlines, not yet applied
      const appliedJobIds = new Set(apps.map(a => a.job_id));
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const eligible = jobs
        .filter(j => !appliedJobIds.has(j.id))
        .map(j => ({
          ...j,
          eligibility: calculateEligibility(
            { cgpa: Number(profile.cgpa) || 0, skills: profile.skills || [], backlogs: profile.backlogs || 0 },
            j
          ),
        }))
        .filter(j => j.eligibility.eligible)
        .sort((a, b) => {
          const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return aDeadline - bDeadline;
        })
        .slice(0, 5);

      setRecommendedJobs(eligible);
    };

    fetchData();
  }, [user, profile]);

  const statCards = [
    { label: "Total Jobs", value: stats.totalJobs, icon: Briefcase, color: "text-primary" },
    { label: "Applied", value: stats.applied, icon: FileText, color: "text-info" },
    { label: "Shortlisted", value: stats.shortlisted, icon: CheckCircle, color: "text-success" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-warning" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">
          Welcome back, {profile?.name || "Student"}! 👋
        </h1>
        <p className="text-muted-foreground">Here's your placement overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold font-display mt-1">{value}</p>
              </div>
              <Icon className={`h-8 w-8 ${color} opacity-80`} />
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <TrendingUp className="h-5 w-5 text-primary" />
            Recommended Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendedJobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recommendations yet. Complete your profile to get personalized job suggestions.</p>
          ) : (
            <div className="space-y-3">
              {recommendedJobs.map(job => (
                <Link key={job.id} to="/jobs" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium">{job.role}</p>
                    <p className="text-sm text-muted-foreground">{job.company} · {job.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getEligibilityClass(job.eligibility.score)}>
                      {job.eligibility.score}% match
                    </Badge>
                    {job.deadline && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
