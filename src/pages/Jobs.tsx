import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateEligibility, getEligibilityClass } from "@/lib/eligibility";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Calendar, Zap, Building2 } from "lucide-react";

export default function Jobs() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const [jobsRes, appsRes] = await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("applications").select("job_id").eq("student_id", user.id),
    ]);
    setJobs(jobsRes.data || []);
    setAppliedIds(new Set((appsRes.data || []).map(a => a.job_id)));
    setLoading(false);
  };

  const applyToJob = async (jobId: string) => {
    if (!user) return;
    setApplying(jobId);
    const { error } = await supabase.from("applications").insert({
      student_id: user.id,
      job_id: jobId,
      status: "applied",
      method: "manual",
    });
    if (error) {
      toast({ title: "Failed to apply", description: error.message, variant: "destructive" });
    } else {
      setAppliedIds(prev => new Set([...prev, jobId]));
      toast({ title: "Applied successfully!" });
    }
    setApplying(null);
  };

  const autoApplyAll = async () => {
    if (!user || !profile) return;
    const eligible = filteredJobs.filter(j => {
      const elig = calculateEligibility(
        { cgpa: Number(profile.cgpa) || 0, skills: profile.skills || [], backlogs: profile.backlogs || 0 },
        j
      );
      return elig.eligible && !appliedIds.has(j.id);
    });

    if (eligible.length === 0) {
      toast({ title: "No eligible jobs to auto-apply" });
      return;
    }

    const inserts = eligible.map(j => ({
      student_id: user.id,
      job_id: j.id,
      status: "applied" as const,
      auto_applied: true,
      method: "auto" as const,
    }));

    const { error } = await supabase.from("applications").insert(inserts);
    if (error) {
      toast({ title: "Auto-apply failed", description: error.message, variant: "destructive" });
    } else {
      setAppliedIds(prev => new Set([...prev, ...eligible.map(j => j.id)]));
      toast({ title: `Auto-applied to ${eligible.length} jobs!` });
    }
  };

  const filteredJobs = jobs.filter(j => {
    const matchSearch = j.company.toLowerCase().includes(search.toLowerCase()) ||
      j.role.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === "all" || j.source === sourceFilter;
    return matchSearch && matchSource;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Job Listings</h1>
          <p className="text-muted-foreground">{filteredJobs.length} opportunities available</p>
        </div>
        <Button onClick={autoApplyAll} className="gradient-primary border-0">
          <Zap className="mr-2 h-4 w-4" /> Auto Apply to All Eligible
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="on-campus">On Campus</SelectItem>
            <SelectItem value="off-campus">Off Campus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading jobs...</div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No jobs found</div>
      ) : (
        <div className="grid gap-4">
          {filteredJobs.map(job => {
            const elig = profile ? calculateEligibility(
              { cgpa: Number(profile.cgpa) || 0, skills: profile.skills || [], backlogs: profile.backlogs || 0 },
              job
            ) : null;
            const applied = appliedIds.has(job.id);

            return (
              <Card key={job.id} className="card-hover">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold font-display text-lg">{job.role}</h3>
                        <Badge variant="outline" className="text-xs">
                          {job.source === "on-campus" ? "On Campus" : "Off Campus"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
                        {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                        {job.deadline && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(job.deadline).toLocaleDateString()}</span>}
                      </div>
                      {job.description && <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(job.required_skills || []).slice(0, 5).map((skill: string) => (
                          <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                        ))}
                        {job.min_cgpa > 0 && <Badge variant="secondary" className="text-xs">Min CGPA: {job.min_cgpa}</Badge>}
                      </div>
                      {elig && elig.missingSkills.length > 0 && (
                        <p className="text-xs text-destructive mt-2">Missing: {elig.missingSkills.join(", ")}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {elig && (
                        <Badge variant="outline" className={`${getEligibilityClass(elig.score)} text-sm`}>
                          {elig.score}% match
                        </Badge>
                      )}
                      {applied ? (
                        <Badge className="bg-success/20 text-success border-success/30">Applied</Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => applyToJob(job.id)}
                          disabled={applying === job.id || (elig ? !elig.eligible : false)}
                        >
                          {applying === job.id ? "Applying..." : elig && !elig.eligible ? "Not Eligible" : "Apply"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
