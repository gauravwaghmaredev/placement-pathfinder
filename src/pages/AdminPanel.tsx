import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Plus, Users, Briefcase, Trash2, Zap, Building2 } from "lucide-react";

const SAMPLE_COMPANIES = [
  { name: "TCS", roles: ["Software Developer", "Data Analyst", "System Engineer", "Business Analyst"], location: "Mumbai" },
  { name: "Infosys", roles: ["Associate Software Engineer", "Power Programmer", "Digital Specialist"], location: "Bangalore" },
  { name: "Wipro", roles: ["Project Engineer", "Full Stack Developer", "Cloud Engineer"], location: "Hyderabad" },
  { name: "HCL Technologies", roles: ["Software Engineer", "DevOps Engineer", "QA Engineer"], location: "Noida" },
  { name: "Cognizant", roles: ["Programmer Analyst", "GenC Next", "Data Engineer"], location: "Chennai" },
  { name: "Accenture", roles: ["Application Developer", "Strategy Analyst", "Cloud Solutions Architect"], location: "Pune" },
  { name: "Tech Mahindra", roles: ["Software Developer", "Network Engineer", "UI/UX Designer"], location: "Hyderabad" },
  { name: "Capgemini", roles: ["Analyst", "Senior Analyst", "Software Engineer"], location: "Mumbai" },
  { name: "Deloitte", roles: ["Analyst", "Consultant", "Tax Associate"], location: "Gurugram" },
  { name: "Amazon", roles: ["SDE Intern", "Operations Manager", "Data Analyst"], location: "Bangalore" },
  { name: "Google", roles: ["Software Engineer", "Product Manager", "Data Scientist"], location: "Bangalore" },
  { name: "Microsoft", roles: ["SDE", "PM", "Data & Applied Scientist"], location: "Hyderabad" },
  { name: "Flipkart", roles: ["SDE-1", "Product Analyst", "Business Analyst"], location: "Bangalore" },
  { name: "Zoho", roles: ["Member Technical Staff", "QA Engineer", "Technical Writer"], location: "Chennai" },
  { name: "Razorpay", roles: ["Backend Engineer", "Frontend Engineer", "DevOps"], location: "Bangalore" },
  { name: "PhonePe", roles: ["Software Engineer", "Product Analyst"], location: "Bangalore" },
  { name: "Freshworks", roles: ["Software Developer", "QA Engineer", "Product Designer"], location: "Chennai" },
  { name: "Swiggy", roles: ["SDE-1", "Data Analyst", "Business Analyst"], location: "Bangalore" },
  { name: "Paytm", roles: ["Software Engineer", "ML Engineer", "Product Manager"], location: "Noida" },
  { name: "Juspay", roles: ["Software Developer", "Haskell Developer"], location: "Bangalore" },
];

const SKILLS = ["Java", "Python", "C++", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "MongoDB", "AWS", "Docker", "Kubernetes", "Machine Learning", "Data Structures", "Algorithms", "HTML/CSS", "Spring Boot", "Django", "Flutter", "Git", "REST APIs", "GraphQL", "Linux", "Agile", "Communication"];

const TAGS = ["IT", "Product", "Service", "Startup", "MNC", "FAANG", "Fintech", "EdTech", "E-commerce", "Consulting", "Analytics"];

function generateJobs(count: number, userId: string) {
  const jobs: any[] = [];
  for (let i = 0; i < count; i++) {
    const company = SAMPLE_COMPANIES[i % SAMPLE_COMPANIES.length];
    const role = company.roles[Math.floor(Math.random() * company.roles.length)];
    const skillCount = 2 + Math.floor(Math.random() * 4);
    const shuffledSkills = [...SKILLS].sort(() => Math.random() - 0.5).slice(0, skillCount);
    const tagCount = 1 + Math.floor(Math.random() * 3);
    const shuffledTags = [...TAGS].sort(() => Math.random() - 0.5).slice(0, tagCount);
    const deadlineDays = 3 + Math.floor(Math.random() * 25);
    const deadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString();
    const minCgpa = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0][Math.floor(Math.random() * 7)];
    const maxBacklogs = [0, 0, 1, 1, 2, 3][Math.floor(Math.random() * 6)];
    const source = Math.random() > 0.4 ? "on-campus" : "off-campus";

    jobs.push({
      company: company.name,
      role,
      description: `${company.name} is hiring for ${role}. Join our team and work on exciting projects with cutting-edge technologies.`,
      min_cgpa: minCgpa,
      required_skills: shuffledSkills,
      max_backlogs: maxBacklogs,
      deadline,
      apply_link: `https://careers.${company.name.toLowerCase().replace(/\s/g, "")}.com`,
      source,
      location: company.location,
      hr_name: `HR ${company.name}`,
      hr_email: `hr@${company.name.toLowerCase().replace(/\s/g, "")}.com`,
      tags: shuffledTags,
      created_by: userId,
    });
  }
  return jobs;
}

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Job form state
  const [form, setForm] = useState({
    company: "", role: "", description: "", min_cgpa: "6.0",
    required_skills: "", max_backlogs: "0", deadline: "",
    apply_link: "", source: "on-campus", location: "",
    hr_name: "", hr_email: "", tags: "",
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [jobsRes, studentsRes, appsRes] = await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("applications").select("*, jobs(company, role), profiles:student_id(name, email)"),
    ]);
    setJobs(jobsRes.data || []);
    setStudents(studentsRes.data || []);
    setApplications(appsRes.data || []);
    setLoading(false);
  };

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("jobs").insert({
      company: form.company, role: form.role, description: form.description,
      min_cgpa: parseFloat(form.min_cgpa) || 0,
      required_skills: form.required_skills.split(",").map(s => s.trim()).filter(Boolean),
      max_backlogs: parseInt(form.max_backlogs) || 0,
      deadline: form.deadline || null,
      apply_link: form.apply_link || null,
      source: form.source, location: form.location,
      hr_name: form.hr_name, hr_email: form.hr_email,
      tags: form.tags.split(",").map(s => s.trim()).filter(Boolean),
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Job created!" });
      setDialogOpen(false);
      fetchData();
    }
  };

  const deleteJob = async (id: string) => {
    await supabase.from("jobs").delete().eq("id", id);
    setJobs(jobs.filter(j => j.id !== id));
    toast({ title: "Job deleted" });
  };

  const generate100Jobs = async () => {
    if (!user) return;
    setGenerating(true);
    const batch = generateJobs(100, user.id);
    // Insert in batches of 50
    for (let i = 0; i < batch.length; i += 50) {
      const chunk = batch.slice(i, i + 50);
      const { error } = await supabase.from("jobs").insert(chunk);
      if (error) {
        toast({ title: "Generation failed", description: error.message, variant: "destructive" });
        setGenerating(false);
        return;
      }
    }
    toast({ title: "100 jobs generated!" });
    setGenerating(false);
    fetchData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Admin Panel (T&P Cell)
          </h1>
          <p className="text-muted-foreground">Manage jobs, students, and applications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generate100Jobs} disabled={generating}>
            <Zap className="mr-2 h-4 w-4" /> {generating ? "Generating..." : "Generate 100 Jobs"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Job</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">Create New Job</DialogTitle></DialogHeader>
              <form onSubmit={createJob} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Company</Label><Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} required /></div>
                  <div className="space-y-1"><Label>Role</Label><Input value={form.role} onChange={e => setForm({...form, role: e.target.value})} required /></div>
                  <div className="space-y-1"><Label>Min CGPA</Label><Input type="number" step="0.1" value={form.min_cgpa} onChange={e => setForm({...form, min_cgpa: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Max Backlogs</Label><Input type="number" value={form.max_backlogs} onChange={e => setForm({...form, max_backlogs: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Source</Label>
                    <Select value={form.source} onValueChange={v => setForm({...form, source: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on-campus">On Campus</SelectItem>
                        <SelectItem value="off-campus">Off Campus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Apply Link</Label><Input value={form.apply_link} onChange={e => setForm({...form, apply_link: e.target.value})} /></div>
                  <div className="space-y-1"><Label>HR Name</Label><Input value={form.hr_name} onChange={e => setForm({...form, hr_name: e.target.value})} /></div>
                  <div className="space-y-1"><Label>HR Email</Label><Input value={form.hr_email} onChange={e => setForm({...form, hr_email: e.target.value})} /></div>
                </div>
                <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                <div className="space-y-1"><Label>Skills (comma-separated)</Label><Input value={form.required_skills} onChange={e => setForm({...form, required_skills: e.target.value})} placeholder="Java, Python, React" /></div>
                <div className="space-y-1"><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="IT, Startup, MNC" /></div>
                <Button type="submit" className="w-full">Create Job</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger>
          <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-3 mt-4">
          {jobs.slice(0, 50).map(job => (
            <Card key={job.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium font-display">{job.role}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />{job.company} · {job.location} · {job.source}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {(job.required_skills || []).slice(0, 3).map((s: string) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteJob(job.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {jobs.length > 50 && <p className="text-sm text-muted-foreground text-center">Showing 50 of {jobs.length} jobs</p>}
        </TabsContent>

        <TabsContent value="students" className="space-y-3 mt-4">
          {students.map(s => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.name || "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground">{s.email} · CGPA: {s.cgpa} · Backlogs: {s.backlogs}</p>
                  <div className="flex gap-1 mt-1">
                    {(s.skills || []).slice(0, 4).map((sk: string) => (
                      <Badge key={sk} variant="secondary" className="text-xs">{sk}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="applications" className="space-y-3 mt-4">
          {applications.slice(0, 50).map((app: any) => (
            <Card key={app.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{(app.profiles as any)?.name || "Unknown"} → {(app.jobs as any)?.role || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{(app.jobs as any)?.company} · {new Date(app.created_at).toLocaleDateString()}</p>
                  {app.auto_applied && <Badge variant="secondary" className="text-xs mt-1">Auto ({app.method})</Badge>}
                </div>
                <Badge variant="outline">{app.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
