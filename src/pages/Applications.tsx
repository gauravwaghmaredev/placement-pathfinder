import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-warning/20 text-warning border-warning/30",
  applied: "bg-info/20 text-info border-info/30",
  shortlisted: "bg-success/20 text-success border-success/30",
  rejected: "bg-destructive/20 text-destructive border-destructive/30",
  accepted: "bg-accent/20 text-accent border-accent/30",
};

export default function Applications() {
  const { user } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("applications")
      .select("*, jobs(*)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setApps(data || []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">My Applications</h1>
        <p className="text-muted-foreground">{apps.length} applications tracked</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No applications yet. Browse jobs to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {apps.map(app => (
            <Card key={app.id} className="card-hover">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium font-display">{app.jobs?.role || "Unknown Role"}</p>
                  <p className="text-sm text-muted-foreground">{app.jobs?.company} · {new Date(app.created_at).toLocaleDateString()}</p>
                  {app.auto_applied && <Badge variant="secondary" className="text-xs mt-1">Auto Applied ({app.method})</Badge>}
                </div>
                <Badge variant="outline" className={statusColors[app.status || "pending"]}>
                  {app.status || "pending"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
