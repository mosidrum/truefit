import Dashboard from "@/components/Dashboard";
import Landing from "@/components/Landing";
import { getJobSummaries } from "@/lib/jobs";
import { buildProfileFromCvs } from "@/lib/profile";
import { getAppUser } from "@/lib/session";

export default async function Home() {
  const user = await getAppUser();

  if (!user) {
    return <Landing />;
  }

  const [profile, jobs] = await Promise.all([
    buildProfileFromCvs(user.id),
    getJobSummaries(user.id),
  ]);

  return <Dashboard user={user} completion={profile.completion} jobs={jobs} />;
}
